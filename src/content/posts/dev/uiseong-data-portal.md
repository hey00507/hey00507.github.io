---
title: "의성데이터포털 — 코딩 지침 검출 2,851건을 종결하기까지"
description: "공공 데이터 포털 백엔드에서 감리의 코딩 지침 검출 2,851건과 보안 취약점 6개 유형에 대응한 과정을 문제, 검토한 방안, 조치 순으로 정리했다."
category: dev
subcategory: "work"
tags: ["spring-boot", "java", "security", "jpa", "postgresql", "cwe"]
pubDate: 2026-03-17T13:22:00
updatedDate: 2026-11-22T19:34:48
urlSlug: "20260317-3"
series: "프로젝트 회고"
---

의성데이터포털은 의성군의 농업 데이터를 수집·저장·공유·진단하는 공공 포털이다.  
나는 이 프로젝트의 PL이었고, 백엔드는 나를 포함해 2명이 개발했다.

코드 작업은 2025년 8월부터 2026년 3월 초까지 했고, 백엔드 레포 커밋 약 990건 중 621건을 작성했다.  
스택은 Java 8, Spring Boot 2.7, Spring Data JPA, PostgreSQL이다.

공공 사업이라 개발이 끝난 뒤 보안 취약점 점검과 감리를 거쳐야 했다.  
이 글은 그 과정에서 풀었던 문제들을 `문제 → 검토한 방안 → 조치` 순서로 적은 기록이다.

---

## 1. 코딩 지침 검출 2,851건

### 문제

감리 항목 중에 TTAK.KO-11.0183 표준 기반의 코딩 지침 준수가 있었다.  
점검 도구를 돌리자 **2,851건**이 검출됐다. 시급도별로는 상 330건, 중 1,165건, 하 1,356건.

전부를 위반으로 보고 하나씩 고치기에는 양이 많았고, 살펴보니 위반이 아닌 항목도 섞여 있었다.

### 검토한 방안

전부 수정하는 대신 먼저 **분류**하기로 했다. 검출 항목을 세 갈래로 나눴다.

- **조치 가능**: 실제 위반이고 코드를 고치면 되는 것
- **오검출**: 도구가 위반으로 봤지만 위반이 아닌 것
- **조치 불필요**: 위반으로 잡히지만 쓰는 라이브러리와 맞물려 고칠 수 없는 것

### 조치

**자동으로 고칠 수 있는 것부터 처리했다.**  
들여쓰기, import 정렬, 라인 길이는 Spotless로 일괄 수정했다.  
처음에는 Google Java Format을 적용했는데 들여쓰기가 2칸이라 지침의 4칸과 충돌했다. Eclipse JDT 포맷터로 바꿔 4칸, 120자 제한에 맞췄다.

**오검출은 근거를 붙여 소명했다.**  
시급도 '중' 1,165건을 전부 확인했더니 696건이 오검출이었다. 전체로는 1,035건.  
대표적인 것이 한 줄 길이 제한이다. Spring Data JPA는 메서드 이름으로 쿼리를 만들기 때문에 조회 조건이 늘면 이름이 길어진다. 서비스 메서드 이름을 축약어 없이 풀어 쓴 것도 같은 규칙에 걸렸다.  
이런 항목은 "왜 위반이 아닌지"를 의견서로 정리해서 제출했다.

**실제 위반 1,816건은 코드를 고쳤다.**  
매직 넘버 상수화, 빈 catch 블록 처리, `Exception`을 구체 예외로 교체, `printStackTrace`를 `log.error`로 전환하는 작업이었다.

**고칠 수 없는 항목은 예외 승인을 받았다.**  
시급도 '하'의 상당수는 Lombok과 맞물린 것이었다. Lombok을 쓰면 소스에는 필드만 있고 생성자와 getter가 없어서 도구가 위반으로 본다.  
이 항목들은 사유를 정리해 예외로 요청했고 승인받았다.

결과적으로 검출 항목은 **수정, 오검출 소명, 예외 승인** 세 갈래로 전건 종결됐다.

돌아보면 도구가 뱉은 숫자를 그대로 작업량으로 받아들이지 않은 것이 가장 중요했다.  
2,851건 중 3분의 1 이상이 고칠 필요가 없는 항목이었다.

---

## 2. 오류 메시지로 내부 정보가 노출되는 문제 (CWE-209)

### 문제

가장 많이 수정한 취약점이다.  
`e.getMessage()`를 응답에 그대로 담으면 DB 정보, 쿼리, 서버 경로가 사용자에게 보인다.

### 검토한 방안

메시지를 숨기기만 하면 운영 중에 어떤 오류였는지 추적하기 어려워진다.  
그래서 응답에는 **에러 ID만** 내려주고, 서버 로그에서 그 ID로 원인을 찾는 방식을 택했다.

### 조치

`SecureLogUtil`을 만들어 환경별로 메시지를 분기했다.

```java
public static String getSafeMessage(Exception ex) {
    String errorId = generateErrorId(); // UUID 8자리
    if (PROD_PROFILE.equals(profile)) {
        // 운영: 에러 ID만 반환
        return String.format("오류가 발생했습니다. (에러ID: %s)", errorId);
    }
    // 개발: 민감정보를 가린 뒤 반환
    return maskSensitiveData(ex.getMessage());
}
```

개발 환경에서도 파일 경로, DB 정보, IP, 이메일은 정규식으로 가린다.

```java
result = FILE_PATH_PATTERN.matcher(result).replaceAll("[PATH]");
result = DB_INFO_PATTERN.matcher(result).replaceAll("[DB_INFO]");
result = IP_PATTERN.matcher(result).replaceAll("[IP]");
result = EMAIL_PATTERN.matcher(result).replaceAll("[EMAIL]");
```

접속 로그를 남길 때도 같은 유틸을 거치게 해서, 로그 테이블에 민감정보가 쌓이지 않게 했다.

---

## 3. 로그인 무차별 대입 (CWE-307)

### 문제

로그인 API에 시도 횟수 제한이 없었다.

### 검토한 방안

제한 기준을 **계정**으로 할지 **IP**로 할지가 갈림길이었다.

계정 기준이면 공격자가 남의 계정으로 일부러 실패를 반복해서 그 계정을 잠글 수 있다.  
IP 기준이면 공격자 자신만 차단된다. 대신 여러 사람이 같은 IP를 쓰는 환경에서는 한 사람의 실패가 다른 사람에게 영향을 준다.

이 한계를 알고 IP 기준을 골랐다.

### 조치

IP별 시도 횟수를 `ConcurrentHashMap`으로 추적하는 `LoginRateLimiter`를 구현했다.

```java
// 허용 횟수를 넘으면 일정 시간 차단, 이후 자동으로 풀린다
attemptCache.compute(ipAddress, (key, existingInfo) -> {
    if (existingInfo == null) return new LoginAttemptInfo();
    existingInfo.incrementAttempts();
    if (existingInfo.getAttempts() > MAX_ATTEMPTS && !existingInfo.isBlocked()) {
        existingInfo.block(LocalDateTime.now().plusMinutes(BLOCK_DURATION_MINUTES));
    }
    return existingInfo;
});
```

서버 메모리에 두는 방식이라 서버가 여러 대면 횟수가 서버마다 따로 세어진다.  
분산 환경에서도 동작하게 하려면 Redis 같은 외부 저장소로 옮겨야 하는데, 여기까지는 하지 못했다.

---

## 4. 파일 업로드 검증

### 문제

데이터 공유 기능에서 사용자가 올린 파일을 서버가 열어서 읽는다.  
실행 파일이 올라오는 것도 문제지만, 허용된 형식 안에 공격 코드가 들어오는 것도 막아야 했다.

### 조치

검증을 세 단계로 뒀다.

1. **확장자 차단 목록**: 실행 가능한 확장자를 거부
2. **확장자 허용 목록**: 데이터 파일 형식만 통과
3. **내용 파싱 검증**: CSV Injection, XXE 방지

차단 목록만으로는 새로 나오는 확장자를 놓치기 때문에 허용 목록과 같이 썼다.  
XML은 파서 설정으로 외부 엔티티를 막았다.

```java
DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
factory.setXIncludeAware(false);
factory.setExpandEntityReferences(false);
```

### 보안 대응 요약

| CWE | 취약점 | 대응 |
|-----|--------|------|
| CWE-209 | 오류 메시지 정보 노출 | 환경별 메시지 분기, 운영은 에러 ID만 반환 |
| CWE-307 | 무차별 대입 | IP 기준 로그인 시도 제한 |
| CWE-807 | 신뢰할 수 없는 입력 | JWT 토큰 형식 검증 강화 |
| CWE-495 | 변경 가능한 객체 노출 | 방어적 복사, 수정 불가 리스트 반환 |
| CWE-539/614 | 쿠키 보안 | Secure, HttpOnly 속성 추가 |
| CWE-390 | 빈 catch 블록 | 예외별로 처리 방식을 나눠 수정 |

---

## 5. 개인정보 마스킹을 어디서 할 것인가

### 문제

같은 개인정보라도 화면에 따라 보여야 하는 수준이 달랐다.

| 데이터 | 일반 조회 | 관리자 조회 | 엑셀 다운로드 |
|--------|----------|------------|------------|
| 이메일 | `te**@email.com` | 원본 | 암호화된 값 |
| 전화번호 | `010****5678` | 원본 | 암호화된 값 |
| 이름 | `홍*동` | 원본 | 암호화된 값 |

### 검토한 방안

Entity에서 마스킹하면 구현은 한 곳으로 끝나지만 관리자도 원본을 볼 수 없게 된다.

### 조치

마스킹을 **응답 DTO 단계**에 뒀다. 같은 Entity에서 화면별 DTO가 각자 필요한 수준으로 가린다.  
2026년 초 유지보수 때 관리자 조회에서는 마스킹을 풀도록 조정했다.

---

## 6. MyBatis에서 JPA로, 복합키에서 단일 PK로

### 문제

프로젝트에는 MyBatis가 설정돼 있었다.  
그런데 이 포털의 핵심인 표준사전 4종(용어, 단어, 도메인, 코드)은 대부분 도메인 객체 단위의 CRUD였다.

### 조치

MyBatis를 걷어내고 JPA로 전환했다. 표준사전 CRUD는 `JpaRepository`로 처리하고, 복잡한 통계 조회만 Native Query로 보완했다.

PK도 바꿨다. 초기 스키마는 복합키였는데, JPA에서 `@IdClass`로 다루기가 번거롭고, 키 구성이 바뀌면 참조하는 쪽까지 고쳐야 했다.  
일련번호 단일 PK로 바꾸고, 원래 복합키가 보장하던 유일성은 유니크 검증으로 옮겼다.

---

## 7. 접속 로그를 빠뜨리지 않는 방법

### 문제

개인정보를 다루는 포털이라 누가 어떤 API를 호출했는지 전부 남겨야 했다.  
Controller마다 로깅 코드를 넣으면 새 API를 만들 때 빠뜨리기 쉽다.

### 조치

`@RestController`의 모든 메서드를 감싸는 AOP Aspect를 만들었다.  
호출마다 클라이언트 IP, 브라우저, 토큰의 사용자 정보, 메뉴, 요청 파라미터를 추출해 DB에 적재한다.

API 설명은 Swagger의 `@Operation`에서 가져오게 해서, 문서에 적은 설명이 접속 로그의 "수행 업무"로 그대로 남는다.  
관리자 화면의 개인정보 조회 이력이 이 로그를 읽는다.

---

## 마무리

이 프로젝트에서 가장 많이 배운 것은 **검출 결과를 다루는 방법**이다.  
2,851건이라는 숫자를 받았을 때 바로 고치기 시작하지 않고 분류부터 한 것, 고치지 않기로 한 항목에 근거를 남긴 것이 감리를 끝낼 수 있었던 이유라고 생각한다.

보안 쪽은 CWE 항목을 하나씩 찾아보고 내 코드의 어느 줄이 해당하는지 확인하는 과정이 도움이 됐다.  
`e.getMessage()`를 그대로 반환하는 한 줄이 왜 문제인지는 직접 고쳐 보고 나서야 제대로 이해한 것 같다.
