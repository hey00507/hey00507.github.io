---
title: "Spring Boot 4.0 테스트 격리 — Testcontainers @ServiceConnection 패턴"
description: "./gradlew test 가 운영 PostgreSQL 에 직접 연결되던 사고를 Testcontainers 로 막은 이야기. H2 가 아니라 Testcontainers 를 고른 이유, @ServiceConnection 으로 보일러플레이트를 줄인 방법, 그리고 베이스 클래스로 회귀를 자동 차단한 패턴."
category: "dev"
subcategory: "project"
tags: ["spring-boot", "testcontainers", "postgresql", "integration-test", "devops"]
pubDate: 2026-04-28T16:49:03
draft: false
---

## 사고 — `./gradlew test` 가 운영 DB 에 닿고 있었다

PoC 백엔드(Spring Boot 4.0.5 + Java 21)에서 통합 테스트를 한 번 돌리면 운영 PostgreSQL 의 `flyway_schema_history` 가 매번 갱신되고, 테스트 도중 만든 `BiReportShare` row 가 운영에 그대로 남는 일이 반복됐다.

원인은 단순했다.

```yaml
# application.yml (local 프로파일)
spring:
  datasource:
    url: jdbc:postgresql://125.131.207.125:29997/airportdb
    username: zettadev
    password: zetta12345
```

`local` 프로파일의 datasource 가 **운영 PG 를 가리키고 있었고**, 통합 테스트에 별도 프로파일이 없었다. 그러니 `@SpringBootTest` 가 부팅하는 컨텍스트는 그 datasource 로 그대로 연결됐다. `@Transactional` 로 트랜잭션 롤백을 걸어도 Flyway 마이그레이션은 commit 되어 있어서 schema 변경은 누적됐다.

한 번 정도면 사람이 정리하면 된다. 그런데 이게 **빌드마다** 일어나면 운영 DB 가 곧 테스트 noise 의 함수가 된다. 본 PR(#157) 의 목표는 이걸 끊는 거였다.

## H2 vs Testcontainers — 왜 Testcontainers 였나

가장 빠른 해법은 H2 인메모리 + PostgreSQL compatibility mode 다. 의존성 한 줄, 컨테이너 부팅 비용 0. 그런데 우리 프로젝트는 그게 안 됐다.

마이그레이션이 V1~V15 까지 1192 줄 있었고, 그 안에 PG 전용 문법이 박혀 있었다.

```sql
-- V13 시드 일부
INSERT INTO tb_bi_report (...) VALUES (...)
ON CONFLICT (id) DO NOTHING;
```

`ON CONFLICT`, `::cast`, `LATERAL` 같은 PG 만의 문법이 몇 개라도 있으면 H2 에서 파싱 자체가 깨진다. 그리고 우리 환경은 `spring.jpa.hibernate.ddl-auto=validate` 였다. JPA 가 부팅할 때 Entity 와 schema 를 비교해서 미세한 타입 불일치(VARCHAR 길이, BIGINT vs INTEGER)도 컨텍스트 부팅 실패로 만든다. H2 와 PG 사이의 타입 정확도 차이는 장담할 수 없었다.

그래서 **운영과 같은 `postgres:16-alpine` 을 Testcontainers 로 띄우는 방향**으로 갔다. 첫 실행 비용은 있지만 운영 동작과 100% 동일한 검증이 되고, `withReuse(true)` 로 두 번째부터는 거의 공짜다.

## `@ServiceConnection` — 보일러플레이트 0

Spring Boot 3.1 부터 들어온 `@ServiceConnection` 이 Testcontainers 와 datasource 를 묶어주는 핵심 도구다.

```java
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

    @Bean
    @ServiceConnection
    PostgreSQLContainer<?> postgresContainer() {
        return new PostgreSQLContainer<>("postgres:16-alpine")
                .withReuse(true);
    }
}
```

이게 전부다. `@ServiceConnection` 을 본 Spring Boot 가 컨테이너의 JDBC URL / username / password 를 자동으로 datasource 프로퍼티에 매핑한다. 이전엔 이런 식의 코드가 필요했다.

```java
// @ServiceConnection 이전 시대 — 보일러플레이트
@DynamicPropertySource
static void registerProps(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
}
```

`@DynamicPropertySource` 는 매 컨테이너 종류마다 같은 패턴을 반복해야 한다. `@ServiceConnection` 은 컨테이너 타입(PostgreSQL, Redis, MongoDB 등)마다 적절한 ConnectionDetails 를 알아서 등록해줘서 한 줄로 끝난다.

`application-test.yml` 에 datasource 를 비워둔다.

```yaml
# application-test.yml — datasource 는 @ServiceConnection 자동 주입
spring:
  jpa:
    hibernate:
      ddl-auto: validate
  flyway:
    enabled: true
    locations: classpath:db/migration
```

## 베이스 클래스로 회귀를 막는다

제일 무서운 건 미래에 누군가가 새 통합 테스트를 만들면서 `@ActiveProfiles("test")` 를 빠뜨리는 것이다. 그러면 그 테스트만 다시 운영 PG 로 연결된다.

이걸 사람이 매번 review 로 잡는 건 시간 문제다. 컴파일러 / 컨벤션이 강제하게 만들어야 한다.

```java
@SpringBootTest
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
public abstract class IntegrationTestSupport {
}
```

그리고 모든 통합 테스트는 이걸 상속한다.

```java
@Transactional
class RequestServiceIntegrationTest extends IntegrationTestSupport {
    // ... 어노테이션 추가 없이 자동으로 test 프로파일 + Testcontainers 적용
}
```

`@SpringBootTest` 를 자식 클래스에 다시 붙일 일이 없으니 `@ActiveProfiles("test")` 누락도 일어날 일이 없다. 새 통합 테스트를 작성할 때 `extends IntegrationTestSupport` 가 강제 진입점이 되는 셈이다.

## `withReuse(true)` — 첫 실행만 비싸다

처음에는 컨테이너 부팅이 좀 길다.

- 첫 실행: 이미지 pull(50MB) + 컨테이너 부팅 + Flyway V1~V15 적용 → ~1분
- 두 번째 실행부터: 컨테이너 재사용 → **27초**, 그 다음부터 19초

`withReuse(true)` 가 작동하려면 `~/.testcontainers.properties` 에 한 줄이 필요하다.

```properties
testcontainers.reuse.enable=true
```

이게 없으면 reuse 가 무시되지만 동작 자체는 정상이다. 그러니까 안전하게 박아둘 수 있다.

## Spring Boot 4.0.5 + Testcontainers 의존성 — BOM 함정

Spring Boot 4.0.5 BOM 이 testcontainers 버전을 관리하지 않는 케이스가 있었다. `spring-boot-starter-testcontainers` 가 아니라 `spring-boot-testcontainers` 가 정확한 모듈명이고, testcontainers 자체는 별도 BOM 으로 잡아야 한다.

```kotlin
testImplementation("org.springframework.boot:spring-boot-testcontainers")
testImplementation(platform("org.testcontainers:testcontainers-bom:1.20.6"))
testImplementation("org.testcontainers:junit-jupiter")
testImplementation("org.testcontainers:postgresql")
```

Spring Boot 가 관리하는 모듈은 버전 생략, testcontainers 모듈은 BOM 으로 일괄. 이렇게 분리하면 Spring Boot 와 Testcontainers 양쪽 업그레이드가 독립적이다.

## 디버깅 인사이트 — macOS Docker daemon

도중에 한 번 이런 에러가 났다.

```
Could not find a valid Docker environment.
Please see logs and check configuration
```

`docker info` 가 정상 응답하길래 데몬은 떠있다고 생각했는데 — `docker ps` 를 쳐보니 다른 메시지가 나왔다.

```
failed to connect to the docker API at unix:///Users/ethankim/.docker/run/docker.sock;
check if the path is correct and if the daemon is running
```

원인은 Docker Desktop daemon 이 죽어있던 것. `docker info` 가 Server 섹션 없이 Client 정보만 출력했는데 그게 daemon 미동작의 신호였다. macOS 에서는 `/var/run/docker.sock` 이 실제 소켓이 아니라 `~/.docker/run/docker.sock` 을 가리키는 symlink 다. Docker Desktop 이 떠있어야 target 이 존재한다.

다음에 비슷한 에러를 만나면 `docker info` 가 아니라 `docker ps` 로 실제 daemon 연결을 확인하면 1초만에 진단된다.

## 결론

본 PR 후로 이런 게 보장된다.

- `./gradlew test` 가 운영 PG 에 닿지 않는다 (컨테이너 PG 만 사용)
- 새 통합 테스트가 `IntegrationTestSupport` 상속을 빠뜨릴 수 없다 (회귀 자동 차단)
- 두 번째 빌드부터 ~20초 (Testcontainers reuse)
- 운영과 동일한 PostgreSQL 16 으로 검증 (H2 호환성 우회 안 함)

단순 격리가 아니라 **회귀가 일어날 수 없는 구조**로 만든 게 더 중요하다. 운영 사고는 한 번 일어나면 사람이 정리하면 되지만, 그게 매 빌드마다 일어나면 사람으로는 못 막는다.

> Spring Boot 3.1 이후의 `@ServiceConnection` + Testcontainers `withReuse` 조합은 Spring 진영의 통합 테스트 표준이 됐다. 운영과 같은 DB 엔진을 쓸 수 있는 환경이라면 H2 보다 거의 항상 이쪽이 답이다.
