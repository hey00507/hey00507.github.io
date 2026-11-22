---
title: "도메인별 예외 클래스 11개를 만들었다가 지운 이유"
description: "단일 BusinessException 구조를 도메인별 구체 예외 클래스로 바꾸다가, 4개 도메인을 옮긴 시점에 설계를 되돌린 기록. 무엇이 불편했고, 왜 방향을 바꿨고, 최종 구조는 어떻게 됐는지."
category: "dev"
subcategory: "work"
tags: ["spring-boot", "exception", "architecture", "refactoring"]
pubDate: 2026-04-13T17:35:00
updatedDate: 2026-11-22T19:43:20
urlSlug: "20260413"
draft: false
---

인천공항 데이터플랫폼 제안용 PoC 백엔드에서 예외 처리 구조를 바꾼 기록이다.

결론부터 적으면, 도메인별 구체 예외 클래스를 11개 만들었다가 전부 지웠다.  
지금 남은 구조는 의미별 중간 클래스 6개와 `ErrorCode` 다. 이 글은 처음 설계가 왜 과했는지, 어느 시점에 알아챘는지를 순서대로 적는다.

## 문제 — 단일 `BusinessException`

시작 구조는 흔한 형태였다.

```java
public class BusinessException extends RuntimeException {
    private final ErrorCode errorCode;

    public BusinessException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }
}

public enum ErrorCode {
    USER_NOT_FOUND(HttpStatus.NOT_FOUND, "U001", "사용자를 찾을 수 없습니다."),
    DUPLICATE_USER(HttpStatus.CONFLICT, "U002", "이미 존재하는 사용자입니다."),
    // ...
}
```

```java
throw new BusinessException(ErrorCode.USER_NOT_FOUND);
```

`ErrorCode` 가 50개 가까이 쌓이자 불편한 점이 보였다.

**로그에서 구분이 안 된다.** 스택트레이스의 클래스명이 전부 `BusinessException` 이라 메시지를 읽어야 어떤 종류의 오류인지 알 수 있다.

```
com.zetta.airport.global.exception.BusinessException: 사용자를 찾을 수 없습니다.
    at com.zetta.airport.domain.system.user.UserService.findById(UserService.java:87)
```

**테스트가 느슨하다.** `assertThrows(BusinessException.class)` 는 거의 모든 실패 케이스를 통과시킨다.

**로깅 수준을 나눌 수 없다.** 사용자가 중복 가입을 시도한 것과 외부 연동 실패로 파일 업로드가 깨진 것이 같은 핸들러에서 같은 레벨로 찍힌다. 앞쪽은 `warn`, 뒤쪽은 `error` 여야 한다.

## 처음 세운 설계

예외의 의미를 타입으로 표현하기로 했다.

```
RuntimeException
 └── AirportException (abstract, 루트)
       ├── BusinessException (4xx — 사용자/규칙 위반)
       │     ├── NotFoundException          (404)
       │     ├── DuplicateException         (409)
       │     ├── InvalidStateException      (409 상태 충돌)
       │     └── InvalidInputException      (400 입력 검증)
       ├── AuthException            (401/403)
       └── InfrastructureException  (5xx — 시스템/외부 연동)
```

`BusinessException` 과 `InfrastructureException` 을 가른 것이 핵심이다. 핸들러에서 로깅 수준을 나눌 수 있게 된다.

```java
@ExceptionHandler(BusinessException.class)
protected ResponseEntity<?> handleBusiness(BusinessException ex) {
    log.warn("BusinessException [{}]: {}",
            ex.getClass().getSimpleName(), ex.getMessage());
    // ... 4xx 응답
}

@ExceptionHandler(InfrastructureException.class)
protected ResponseEntity<?> handleInfra(InfrastructureException ex) {
    log.error("InfrastructureException [{}]: {}",
            ex.getClass().getSimpleName(), ex.getMessage(), ex);
    // ... 5xx 응답
}
```

여기서 한 단계 더 나갔다. 중간 클래스는 전부 abstract 로 두고, 그 아래에 **도메인별 구체 클래스**를 만들기로 한 것이다.

```java
public class UserNotFoundException extends NotFoundException {

    public UserNotFoundException(Long userId) {
        super(ErrorCode.USER_NOT_FOUND, "사용자를 찾을 수 없습니다. id=" + userId);
    }
}
```

```java
// Before
throw new BusinessException(ErrorCode.USER_NOT_FOUND);

// After
throw new UserNotFoundException(userId);
```

기대한 것은 네 가지였다. 스택트레이스에 도메인 이름이 찍히고, 호출부가 `ErrorCode` 를 몰라도 되고, 테스트가 정밀해지고, 예외 파일이 도메인 패키지 안에 모인다.

### 옮기는 순서

기존 코드를 깨뜨리지 않으려고 세 단계로 나눴다.

1. **골격만 추가**: 새 클래스와 핸들러를 추가한다. 기존 `BusinessException` 은 `AirportException` 을 상속하게만 바꿔서, 기존 호출부는 그대로 동작한다
2. **도메인 단위 치환**: PR 하나에 도메인 하나씩 옮긴다
3. **옛 패턴 차단**: 전부 옮긴 뒤 `BusinessException` 을 abstract 로 바꾸고, CI 에서 `new BusinessException(` 을 grep 으로 막는다

## 4개 도메인을 옮기면서 본 것

mypage, file, code, board 순으로 옮겼다.

### 잘못된 코드 매핑이 드러났다

mypage 의 즐겨찾기 조회는 `ENTITY_NOT_FOUND` 라는 범용 코드를 던지고 있었다. 그런데 `ErrorCode` 에는 이미 `FAVORITE_NOT_FOUND` 가 정의돼 있었다.  
구체 클래스를 만들면서 "어느 코드를 매핑하지?"를 한 번 더 보게 됐고, 그 과정에서 매핑을 바로잡았다. HTTP 상태는 같은 404 지만 FE 가 받는 코드가 구분 가능한 값으로 바뀌었다.

### 동작을 바꾸고 싶은 곳은 따로 뺐다

file 도메인에서는 확장자 검증 실패가 500 으로 응답되고 있었다. 허용되지 않는 파일을 올린 것은 사용자 입력 오류라 400 이 맞다.

하지만 치환 PR 에서는 기존 동작을 그대로 뒀다. 구조만 바꾸는 PR 에 동작 변경이 섞이면 나중에 어느 쪽이 의도였는지 구분하기 어렵다. 주석을 남기고 별도 이슈로 분리했다.

```java
// NOTE: 확장자 검증 실패는 의미상 입력값 오류(400)지만,
// 현재 FILE_UPLOAD_FAILED(500)로 응답하는 기존 동작을 보존한다.
// HTTP 상태 정정은 별도 이슈에서 ErrorCode 추가와 함께 진행.
if (DANGEROUS_EXTENSIONS.contains(extension.toLowerCase())) {
    throw new FileUploadException("허용되지 않는 확장자입니다: " + extension);
}
```

### 패키지 선언이 디렉토리와 달랐다

`CodeService.java` 는 파일이 `domain/system/code/` 에 있는데 패키지 선언은 `domain.code` 였다. Java 컴파일러는 이걸 에러로 잡지 않는다.  
이것도 이슈를 따로 만들어 구조부터 정리한 뒤 예외 치환을 했다.

## 중간 점검 — 이 클래스들을 누가 쓰는가

4개 도메인을 옮긴 시점의 숫자다.

- 도메인별 구체 클래스: mypage 2 + file 3 + code 3 + board 3 = **11개**
- 바뀐 호출부: 약 20곳

남은 도메인은 8개였고, 같은 방식으로 가면 구체 클래스가 수십 개 더 생길 상황이었다.

여기서 만든 클래스들을 다시 열어봤다. 전부 `super(ErrorCode.X, "...")` 한 줄짜리였다.  
그리고 이 프로젝트에는 **특정 예외 타입을 잡아서 처리하는 코드가 한 곳도 없었다.** 핸들러는 `BusinessException`, `AuthException`, `InfrastructureException` 세 갈래로만 분기하고 있었다.

기대했던 것과 실제를 나란히 놓으면 이렇다.

| 기대한 것 | 실제 |
|-----------|------|
| 스택트레이스에 도메인 클래스명 | 로그에서 확인됨 |
| 호출부가 `ErrorCode` 를 몰라도 됨 | 생성자 안으로 옮겨졌을 뿐 그대로 있음 |
| 타입 기반 catch | 쓰는 곳이 없음 |
| 테스트 정밀화 | `isInstanceOf(NotFoundException.class)` 로도 충분 |
| 도메인별 파일 분리 | 확인됨 |

실제로 쓰이는 가치는 스택트레이스 가독성 정도였다. 그런데 그것은 중간 클래스 이름과 메시지만으로도 얻을 수 있다.

```
com.zetta.airport.global.exception.NotFoundException: 즐겨찾기를 찾을 수 없습니다. userId=42, refType=POST, refId=100
    at com.zetta.airport.domain.support.mypage.MypageService.removeFavorite(MypageService.java:73)
```

클래스명이 오류의 종류를, 메시지가 대상을, 호출 위치가 도메인을 알려준다.  
처음에 불편했던 "로그에 `BusinessException` 만 뜬다"의 원인은 중간 분류가 없었던 것이지, 도메인별 클래스가 없었던 것이 아니었다.

## 방향을 바꿨다

중간 클래스를 abstract 에서 일반 클래스로 바꾸고 `(ErrorCode, String detail)` 생성자를 추가했다. 호출부는 중간 클래스를 직접 쓴다.

```java
// 구체 클래스 방식
throw new FavoriteNotFoundException(userId, refType, refId);

// 중간 클래스 + detail
throw new NotFoundException(
        ErrorCode.FAVORITE_NOT_FOUND,
        "즐겨찾기를 찾을 수 없습니다. userId=" + userId
                + ", refType=" + refType + ", refId=" + refId);
```

이미 머지한 4개 도메인을 되돌렸다.

1. 중간 클래스 4개에 `(ErrorCode, String detail)` 생성자 추가, `abstract` 제거
2. 4개 도메인의 호출부를 중간 클래스로 다시 치환
3. 도메인별 구체 클래스 11개 삭제
4. import 정리, 테스트 assertion 조정

이 PR 하나가 29개 파일, +300 / -456 줄이었다.

4개 도메인에서 멈춘 덕에 되돌리는 데 오래 걸리지 않았다. 10개 도메인까지 갔다면 되돌리는 것 자체가 큰 작업이 됐을 것이고, 그냥 밀고 갔을 가능성이 높다.

## 마무리 — 나머지 도메인과 옛 패턴 차단

방향을 바꾼 뒤 나머지 8개 도메인(catalog, request, auth, user, role, menu, governance, sample)을 같은 방식으로 옮겼다. 구체 클래스를 만들지 않으니 도메인당 작업이 훨씬 작았다.

마지막으로 처음 계획의 3단계를 적용했다. `BusinessException` 을 abstract 로 바꿔서 `new BusinessException(...)` 이 컴파일되지 않게 하고, CI 에 grep 검사를 넣었다.

```yaml
- name: Forbidden exception patterns guard
  run: |
    if grep -rn "new BusinessException(" src/main/java; then
      echo "BusinessException 은 abstract 입니다. 구체 서브클래스를 사용하세요." >&2
      exit 1
    fi
```

골격 추가부터 여기까지 하루에 끝냈다. 최종 구조는 이렇다.

```
RuntimeException
 └── AirportException (abstract)
       ├── BusinessException (abstract, 4xx 상위 분류)
       │     ├── NotFoundException
       │     ├── DuplicateException
       │     ├── InvalidStateException
       │     └── InvalidInputException
       ├── AuthException            (401/403)
       └── InfrastructureException  (5xx)
```

```java
throw new NotFoundException(ErrorCode.USER_NOT_FOUND, "userId=" + userId);
throw new DuplicateException(ErrorCode.DUPLICATE_USER, "loginId=" + loginId);
throw new InfrastructureException(ErrorCode.FILE_UPLOAD_FAILED, "path=" + path, ioException);
```

## 돌아보며

**계층은 쓸 일이 있는 데까지만 만든다.**  
"나중에 타입별로 잡아서 처리할 수도 있으니까"로 만든 클래스는 그 나중이 오지 않았다. 필요해지면 그때 서브클래스를 추가해도 호출부는 깨지지 않는다.

**한 줄짜리 클래스는 다시 볼 신호다.**  
클래스 안에 `super(...)` 한 줄뿐이면 이름을 붙이려고 만든 껍데기일 가능성이 높다. 그 이름은 `ErrorCode` 값이 이미 갖고 있었다.

**중간에 한 번 멈춰서 봐야 한다.**  
4개 도메인을 옮긴 뒤에 본 것은 운이 좋았다. 전부 옮긴 뒤였다면 되돌리지 못했을 것 같다.

아쉬운 점도 있다. 이 PR 들은 전부 혼자 올리고 혼자 머지했다.  
"이 클래스를 실제로 잡아서 쓰는 곳이 있나?"는 설계 단계에서 확인할 수 있는 질문이었는데, 4개 도메인을 옮기고 나서야 스스로 물었다. 리뷰어가 있었다면 더 일찍 나왔을 질문이라고 생각한다.  
다음에는 구조를 바꾸는 작업을 시작하기 전에 설계안을 먼저 다른 사람에게 보이고 싶다.
