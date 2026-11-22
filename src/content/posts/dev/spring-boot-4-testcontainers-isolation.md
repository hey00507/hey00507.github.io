---
title: "통합 테스트가 개발 DB에 붙어 있었다 — Testcontainers로 격리하기"
description: "./gradlew test 가 개발용 PostgreSQL 에 연결되던 문제를 Testcontainers 로 끊은 기록. H2 대신 Testcontainers 를 고른 이유, @ServiceConnection 설정, 베이스 클래스로 같은 실수를 줄인 방법."
category: "dev"
subcategory: "work"
tags: ["spring-boot", "testcontainers", "postgresql", "integration-test", "devops"]
pubDate: 2026-04-28T16:49:03
updatedDate: 2026-11-22T19:38:37
urlSlug: "20260428"
draft: false
---

## 문제 — `./gradlew test` 가 개발 DB 에 닿고 있었다

인천공항 데이터플랫폼 제안용 PoC 백엔드(Spring Boot 4.0.5 + Java 21)에서 있었던 일이다.  
통합 테스트를 한 번 돌리면 개발용 PostgreSQL 의 `flyway_schema_history` 가 갱신되고, 테스트가 만든 row 가 그 DB 에 남는 일이 반복됐다.

원인은 단순했다.

```yaml
# application.yml (local 프로파일)
spring:
  datasource:
    url: jdbc:postgresql://{개발 DB 호스트}:{포트}/{DB명}
    username: {계정}
    password: {비밀번호}
```

`local` 프로파일의 datasource 가 **개발 PG 를 가리키고 있었고**, 통합 테스트에 별도 프로파일이 없었다. 그러니 `@SpringBootTest` 가 부팅하는 컨텍스트는 그 datasource 로 그대로 연결됐다. `@Transactional` 로 트랜잭션 롤백을 걸어도 Flyway 마이그레이션은 commit 되어 있어서 schema 변경은 누적됐다.

한 번 정도면 사람이 정리하면 된다. 그런데 이게 **빌드마다** 일어나면 개발 DB 의 데이터를 믿을 수 없게 된다. 테스트가 이 DB 에 닿지 않게 끊는 것이 목표였다.

## H2 vs Testcontainers — 왜 Testcontainers 였나

가장 빠른 해법은 H2 인메모리 + PostgreSQL compatibility mode 다. 의존성 한 줄이면 되고 컨테이너를 띄울 필요도 없다. 그런데 이 프로젝트에서는 쓸 수 없었다.

마이그레이션이 V1~V15 까지 있었고, 그 안에 PG 전용 문법이 들어 있었다.

```sql
-- V13 시드 일부
INSERT INTO tb_bi_report (...) VALUES (...)
ON CONFLICT (id) DO NOTHING;
```

`ON CONFLICT`, `::cast`, `LATERAL` 같은 PG 만의 문법이 몇 개라도 있으면 H2 에서 파싱 자체가 깨진다. 그리고 우리 환경은 `spring.jpa.hibernate.ddl-auto=validate` 였다. JPA 가 부팅할 때 Entity 와 schema 를 비교해서 미세한 타입 불일치(VARCHAR 길이, BIGINT vs INTEGER)도 컨텍스트 부팅 실패로 만든다. H2 와 PG 사이의 타입 정확도 차이는 장담할 수 없었다.

그래서 **개발 DB 와 같은 PostgreSQL 16 을 Testcontainers 로 띄우는 방향**으로 갔다. 첫 실행은 느리지만 같은 엔진에서 마이그레이션과 쿼리를 검증할 수 있고, `withReuse(true)` 로 두 번째 실행부터는 빨라진다.

## `@ServiceConnection` 으로 연결 설정을 한 곳에

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

`@ServiceConnection` 을 본 Spring Boot 가 컨테이너의 JDBC URL / username / password 를 datasource 에 연결한다. 이전엔 이런 코드가 필요했다.

```java
// @ServiceConnection 이전 방식
@DynamicPropertySource
static void registerProps(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
}
```

`@DynamicPropertySource` 는 컨테이너 종류마다 같은 코드를 반복해야 한다.

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

## 베이스 클래스로 같은 실수를 줄인다

걱정한 것은 나중에 새 통합 테스트를 만들면서 `@ActiveProfiles("test")` 를 빠뜨리는 경우다. 그러면 그 테스트만 다시 개발 PG 로 연결된다.

리뷰에서 매번 잡아내기는 어렵다고 보고, 설정을 한 클래스에 모았다.

```java
@SpringBootTest
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
public abstract class IntegrationTestSupport {
}
```

기존 통합 테스트 4개를 이 클래스를 상속하도록 바꿨다.

```java
@Transactional
class RequestServiceIntegrationTest extends IntegrationTestSupport {
    // ... 어노테이션 추가 없이 자동으로 test 프로파일 + Testcontainers 적용
}
```

`@SpringBootTest` 를 자식 클래스에 다시 붙일 일이 없으니 `@ActiveProfiles("test")` 를 빠뜨릴 일도 줄어든다.  
다만 상속하지 않고 `@SpringBootTest` 를 직접 붙이는 것까지 막지는 못한다. 그건 ArchUnit 규칙으로 걸 수 있는데 이때는 거기까지 하지 않았다.

## `withReuse(true)` — 첫 실행만 느리다

내 로컬에서 잰 시간이다.

- 첫 실행: 이미지 pull + 컨테이너 부팅 + Flyway V1~V15 적용 → 약 1분
- 두 번째 실행: 컨테이너 재사용 → **27초**, 그다음은 19초

`withReuse(true)` 가 작동하려면 `~/.testcontainers.properties` 에 한 줄이 필요하다.

```properties
testcontainers.reuse.enable=true
```

이 설정이 없으면 reuse 만 무시되고 테스트는 정상 동작한다.

## 의존성 설정

모듈명은 `spring-boot-starter-testcontainers` 가 아니라 `spring-boot-testcontainers` 다. Testcontainers 모듈 버전은 별도 BOM 으로 잡았다.

```kotlin
testImplementation("org.springframework.boot:spring-boot-testcontainers")
testImplementation(platform("org.testcontainers:testcontainers-bom:1.20.6"))
testImplementation("org.testcontainers:junit-jupiter")
testImplementation("org.testcontainers:postgresql")
```

Spring Boot 가 관리하는 모듈은 버전을 생략하고, Testcontainers 모듈은 BOM 으로 한 번에 맞춘다.

## 도중에 만난 에러 — macOS Docker daemon

도중에 한 번 이런 에러가 났다.

```
Could not find a valid Docker environment.
Please see logs and check configuration
```

`docker info` 가 뭔가를 출력하길래 데몬은 떠 있다고 생각했는데, `docker ps` 를 쳐보니 다른 메시지가 나왔다.

```
failed to connect to the docker API at unix://~/.docker/run/docker.sock;
check if the path is correct and if the daemon is running
```

원인은 Docker Desktop daemon 이 죽어있던 것. `docker info` 가 Server 섹션 없이 Client 정보만 출력했는데 그게 daemon 미동작의 신호였다. macOS 에서는 `/var/run/docker.sock` 이 실제 소켓이 아니라 `~/.docker/run/docker.sock` 을 가리키는 symlink 다. Docker Desktop 이 떠있어야 target 이 존재한다.

비슷한 에러를 만나면 `docker info` 대신 `docker ps` 로 daemon 연결을 확인하는 편이 빠르다.

## 결과

- `./gradlew test` 가 개발 PG 에 닿지 않는다. 테스트는 컨테이너 PG 만 쓴다
- 통합 테스트 설정이 `IntegrationTestSupport` 한 곳에 모였다
- 두 번째 실행부터 20초 안팎에 끝난다
- H2 호환 모드로 우회하지 않고 PostgreSQL 16 에서 검증한다

`local` 프로파일 자체는 그대로 개발 DB 를 본다. 바꾼 것은 테스트 쪽뿐이다.

아쉬운 점은 베이스 클래스를 거치지 않는 테스트를 빌드에서 막는 규칙까지는 넣지 못했다는 것이다.
