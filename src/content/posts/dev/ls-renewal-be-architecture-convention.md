---
title: "Spring Boot DDD 프로젝트에서 개발 컨벤션 정립하기"
description: "LS Renewal 프로젝트에서 팀과 함께 정립한 6가지 BE 아키텍처 규칙 — DTO 위치, Entity 도메인 로직, Lombok 최소화, HTTP 메서드, 용도별 Update 분리, 일급 컬렉션"
category: "dev"
subcategory: "project"
tags: ["spring-boot", "ddd", "architecture", "convention", "tdd"]
pubDate: 2026-04-02T16:57:00
draft: false
---

## 들어가며

새 프로젝트를 시작할 때 가장 먼저 해야 할 일이 뭘까? 기능 구현? 아니다. **팀이 같은 방향으로 코드를 쓸 수 있는 규칙을 먼저 세우는 것**이다.

LS전선 리뉴얼 프로젝트(Spring Boot 4.0, Java 21)에서 BE 개발을 시작하면서, 샘플 도메인 하나를 기준으로 6가지 아키텍처 컨벤션을 정립했다. 이 글은 "왜 이렇게 정했는지"에 초점을 맞춘다.

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

순수 REST 원칙에서는 벗어나지만, Google API Design Guide에서도 Custom Methods 패턴을 공식 인정하고 있다. **REST는 규칙이 아니라 아키텍처 스타일**이다. 인프라 제약 하에서 팀 내 일관성만 유지하면 된다.

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

**하나의 거대한 update 메서드에 모든 경우를 때려넣는 건 안티패턴이다.** 각 메서드가 하나의 "도메인 행위"를 표현하면, Validation도 DTO별로 다르게 적용할 수 있고, 테스트도 명확해진다.

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

## TDD로 검증한다

이 모든 규칙은 테스트로 뒷받침된다.

- **Entity 테스트**: `fromCreateDto`, `update`, `updateStatus`, `toResponseDto`
- **일급 컬렉션 테스트**: `filterActive`, `filterInactive`, 불변성 검증
- **Service 테스트**: CRUD 전체 + 예외 케이스
- **ArchUnit 테스트**: 레이어 의존성 규칙 자동 강제

총 30건의 테스트가 모두 통과한 상태에서 PR을 올렸다. **테스트 없는 비즈니스 로직 PR은 머지하지 않는다**는 규칙도 함께.

## 마무리

컨벤션은 "정답"이 아니라 "합의"다. 중요한 건 팀원들이 동의하고, 일관되게 따를 수 있느냐다. 그래서 규칙을 코드(ArchUnit)와 문서(CLAUDE.md)로 동시에 남겼다.

이 6가지 규칙이 앞으로 모든 도메인 개발의 템플릿이 된다. 새 도메인을 추가할 때 sample 패키지를 복사해서 시작하면, 자연스럽게 이 규칙을 따르게 된다.
