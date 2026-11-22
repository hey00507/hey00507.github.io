---
title: "프로젝트 초기에 BE 규칙 6가지를 샘플 코드와 ArchUnit으로 남기기"
description: "LS전선 리뉴얼 프로젝트 초기에 BE 구조를 잡으면서 정한 규칙 6가지와 그 이유. DTO 위치, Entity 도메인 로직, Lombok 최소화, HTTP 메서드, 용도별 Update 분리, 일급 컬렉션. 세팅 이후 확인하지 못한 것도 함께 적었다."
category: "dev"
subcategory: "work"
tags: ["spring-boot", "ddd", "architecture", "convention", "archunit"]
pubDate: 2026-04-02T16:57:00
updatedDate: 2026-11-22T19:40:27
urlSlug: "20260402"
draft: false
---

## 들어가며

LS전선 리뉴얼 프로젝트(Spring Boot 4.0, Java 21)에서 내가 맡은 일은 초기 BE 구조를 잡는 것이었다.  
도메인 개발은 팀원들이 진행했고, 나는 그 전에 패키지 구조를 DDD Layered 로 바꾸고, ArchUnit 규칙과 샘플 도메인 하나를 만들어 두었다.

여러 사람이 동시에 도메인을 만들기 시작하면 사람마다 구조가 달라진다. 그래서 샘플 도메인에 규칙 6가지를 적용해 두고, 새 도메인은 그걸 복사해서 시작하게 했다.  
이 글은 각 규칙을 "왜 이렇게 정했는지"에 초점을 맞춘다.

## 1. DTO는 domain 레이어에 둔다

### 기존 구조의 문제

```
api/sample/
├── SampleController.java
└── dto/
    ├── SampleRequestDto.java    ← DTO가 여기 있으면
    └── SampleResponseDto.java

domain/sample/
├── SampleService.java           ← Service가 api.dto를 import해야 함
├── entity/
└── repository/
```

Service가 DTO를 가장 많이 사용하는데, DTO가 api 패키지에 있으면 **domain → api 역참조**가 발생한다. ArchUnit으로 "domain은 api를 참조하지 않는다" 규칙을 걸어놓고, 정작 `ignoreDependency`로 예외를 뚫고 있었다.

### 해결

```
api/sample/
└── SampleController.java       ← Controller만

domain/sample/
├── SampleService.java
├── dto/                         ← DTO를 domain으로 이동
│   ├── SampleCreateDto.java
│   └── SampleResponseDto.java
├── entity/
└── repository/
```

이제 의존 방향이 `api → domain`으로 자연스럽고, ArchUnit 예외도 제거했다. **규칙에 예외가 있다면, 규칙이 아니라 코드 구조를 바꿔야 한다.**

## 2. 비즈니스 로직은 Entity에 둔다

Service가 뚱뚱해지는 걸 막는 핵심이다.

### Before: Service가 모든 걸 한다

```java
// Service
public SampleResponseDto create(SampleRequestDto request) {
    SampleEntity entity = SampleEntity.builder()
            .title(request.getTitle())
            .description(request.getDescription())
            .build();
    return new SampleResponseDto(sampleRepository.save(entity));
}
```

### After: Entity가 자기 자신을 안다

```java
// Entity
public static SampleEntity fromCreateDto(SampleCreateDto dto) {
    return new SampleEntity(dto.getTitle(), dto.getDescription());
}

public void update(SampleUpdateDto dto) {
    this.title = dto.getTitle();
    this.description = dto.getDescription();
}

public SampleResponseDto toResponseDto() {
    return new SampleResponseDto(this);
}

// Service — 흐름 조율만
public SampleResponseDto create(SampleCreateDto request) {
    SampleEntity entity = SampleEntity.fromCreateDto(request);
    return sampleRepository.save(entity).toResponseDto();
}
```

Service는 **"무엇을 하라"**만 지시하고, **"어떻게"**는 Entity가 담당한다. 변환 로직이 변경되어도 Entity 한 곳만 수정하면 된다.

## 3. Lombok은 최소한만 쓴다

| 대상 | 허용 | 금지 |
|------|------|------|
| Entity | `@Getter`, `@NoArgsConstructor(PROTECTED)`, `@Builder`(private 생성자만) | `@Setter`, `@AllArgsConstructor`, 클래스 레벨 `@Builder` |
| DTO | `@Getter`, `@NoArgsConstructor` | `@AllArgsConstructor`, `@Builder` |

**핵심 기준: 어노테이션이 생성 의도를 숨기면 금지.**

클래스 레벨 `@Builder`는 "아무 조합으로나 만들 수 있다"는 잘못된 신호를 준다. private 생성자에 `@Builder`를 붙이면 외부에서 빌더 직접 호출이 차단되고, `fromCreateDto()` 같은 팩토리 메서드 내부에서만 활용할 수 있다.

DTO의 `@AllArgsConstructor`도 제거하고 직접 생성자를 작성한다. 파라미터 2~3개일 때는 의미 없어 보이지만, 필드가 늘어날수록 "이 생성자로 뭘 만드는 건지"가 코드에 드러나야 한다.

## 4. HTTP 메서드는 GET/POST만 사용한다

인프라 제약으로 PUT/DELETE를 쓸 수 없는 환경이었다. URL에 동작을 명시하는 방식으로 해결했다.

```
GET  /api/sample            ← 목록 조회
GET  /api/sample/{id}       ← 단건 조회
POST /api/sample            ← 등록
POST /api/sample/{id}/modify        ← 수정
POST /api/sample/{id}/modify-status ← 상태 변경
POST /api/sample/{id}/remove        ← 삭제
```

순수 REST 원칙에서는 벗어난다. 다만 Google API Design Guide 의 Custom Methods 처럼 URL 에 동작을 드러내는 방식도 쓰이고 있어서, 제약 안에서 URL 규칙을 하나로 통일하는 쪽을 택했다.

## 5. 용도별 Update를 분리한다

필드가 30개인 Entity가 있고, 화면 A에서는 5개 필드만, 화면 B에서는 10개 필드만 수정한다면?

```java
// DTO를 용도별로 분리
SampleUpdateDto         // 기본 정보 (title, description)
SampleStatusUpdateDto   // 상태 변경 (useYn)

// Entity에 메서드도 1:1 대응
entity.update(updateDto);
entity.updateStatus(statusDto);

// URL도 분리
POST /api/sample/{id}/modify         // 기본 정보
POST /api/sample/{id}/modify-status  // 상태 변경
```

update 메서드 하나에 모든 경우를 넣으면 어떤 화면이 어떤 필드를 바꾸는지 코드에서 보이지 않는다. 각 메서드가 하나의 "도메인 행위"를 표현하면, Validation도 DTO별로 다르게 적용할 수 있고, 테스트도 명확해진다.

## 6. 일급 컬렉션으로 컬렉션 로직을 응집한다

`List<SampleEntity>`를 그대로 쓰면 필터링, 변환 로직이 Service 곳곳에 흩어진다.

```java
// 일급 컬렉션
public class Samples {
    private final List<SampleEntity> items;

    public Samples(List<SampleEntity> items) {
        this.items = Collections.unmodifiableList(items);
    }

    public Samples filterActive() {
        return new Samples(items.stream()
                .filter(SampleEntity::isUseYn)
                .toList());
    }

    public List<SampleResponseDto> toResponseDtos() {
        return items.stream()
                .map(SampleEntity::toResponseDto)
                .toList();
    }
}

// Service에서 사용
public List<SampleResponseDto> findAll() {
    Samples samples = new Samples(sampleRepository.findAll());
    return samples.filterActive().toResponseDtos();
}
```

네이밍은 `{Domain}s` 복수형(`Samples`, `Users`)으로 통일했다. `Collections.unmodifiableList()`로 불변성을 보장하면 외부에서 `.add()`로 내부 상태를 변경하는 실수도 방지한다.

## 규칙을 테스트로 고정한다

샘플 도메인에는 테스트를 같이 넣었다.

- **Entity 테스트**: `fromCreateDto`, `update`, `updateStatus`, `toResponseDto`
- **일급 컬렉션 테스트**: `filterActive`, `filterInactive`, 불변성 검증
- **Service 테스트**: CRUD 전체 + 예외 케이스
- **ArchUnit 테스트**: 레이어 의존성, 네이밍 규칙

샘플 도메인 기준으로 테스트 30건이 통과한 상태에서 PR 을 올렸다.

## 마무리 — 세팅 이후에 확인하지 못한 것

규칙은 코드(ArchUnit, 샘플 도메인)와 문서(가이드 문서, `CLAUDE.md`) 양쪽에 남겼다.

돌아보면 두 종류의 규칙이 섞여 있었다.

- **빌드가 확인하는 규칙**: 레이어 의존 방향, 네이밍. 어기면 ArchUnit 테스트가 실패한다
- **문서와 샘플로만 남긴 규칙**: Lombok 사용 범위, 용도별 Update 분리, 일급 컬렉션, 테스트를 함께 작성하는 것

나는 세팅까지 했고 이후 도메인 개발은 팀원들이 이어갔다. 두 번째 종류의 규칙이 실제로 지켜졌는지는 끝까지 따라가 보지 못했다.

이 경험 때문에 다음 프로젝트부터는 지키게 하고 싶은 규칙을 가능한 한 빌드에 걸었다. 문서에 적은 규칙은 읽은 사람만 지키지만, 테스트로 건 규칙은 모두에게 똑같이 적용된다.
