# Rental Dashboard — Spring Boot Edition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `rental-dashboard-spring`, an idiomatic Spring Boot 4 rewrite of the Rental Dashboard FastAPI backend that the existing Next.js frontend can use unchanged, deployed as a live demo.

**Architecture:** Package-by-feature (`auth`, `property`, `ledger`, `report`, `demo`) with controller → service → repository layering inside each, plus `security` and `common`. Spring Security runs as an OAuth2 resource server validating our own HS256 JWTs, read from an httpOnly cookie. Flyway owns the schema; Hibernate only validates it. Reports aggregate in SQL through `JdbcClient`.

**Tech Stack:** Java 25, Spring Boot 4.1.1 (Maven wrapper), Spring MVC, Spring Data JPA / Hibernate 7, Flyway, PostgreSQL, Spring Security OAuth2 Resource Server (Nimbus), Bean Validation, springdoc-openapi 3.1.1, Bucket4j 8.20.0, JUnit 5 + MockMvc + Testcontainers 2 (Postgres 17), JaCoCo 0.8.15, Docker, GitHub Actions, Render, Neon, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-29-rental-dashboard-spring-design.md` (this repo)

**Where code goes:** a NEW repo at `D:\2_MyScripts\rental-dashboard-spring` (sibling of this repo). All paths below are relative to that new repo unless stated otherwise.

## Deviations from the spec (decided while planning)

1. **JWT handling uses Spring Security's OAuth2 resource server** (Nimbus `JwtEncoder`/`JwtDecoder`) instead of JJWT + a hand-written `JwtCookieAuthFilter`. A `CookieBearerTokenResolver` feeds the cookie to it. More idiomatic, one dependency fewer, and it avoids JJWT dragging Jackson 2 into a Jackson 3 app. Tokens also carry a `uid` claim so requests don't need a user lookup.
2. **Reports use `JdbcClient` with parameterized SQL** instead of JPQL. Optional filters are appended only when present, which sidesteps Postgres' "could not determine data type of parameter" error on typed nulls. Aggregation still happens in the database.
3. **Database connection is `DATABASE_URL` (JDBC form) + `DATABASE_USERNAME` + `DATABASE_PASSWORD`** instead of converting Neon's `postgresql://` URL in code.
4. **No CDS in the Docker image**: a CDS training run needs a live database. Cold starts are handled by the optional keep-alive in Task 9.
5. **Only a `demo` profile**; production behaviour comes from `APP_ENVIRONMENT=production`, so no `prod` profile file.
6. `UserService` from the spec is named **`AuthService`** (it only does register/login/me).
7. **`currency` is `varchar(3)`, not `char(3)`**: Hibernate's `validate` rejects `bpchar` for a `String` field. The 3-character rule is enforced by Bean Validation. The migrations also add `check` constraints (non-negative amounts, known categories) as a second line of defence.

## Prerequisites

- Java 25 on PATH (`java -version` → 25).
- **Docker Desktop running** — Testcontainers needs it for every integration test. Check: `docker info` prints a server version.
- Git Bash (commands below are bash). No global Maven needed; use `./mvnw`.

## Global Constraints

- Java 25; Spring Boot 4.1.1; Maven wrapper; groupId `com.sebpostigo`; root package `com.sebpostigo.rental`.
- JSON field names are snake_case (`property_type`, `access_token`); Java code stays camelCase.
- Every error body is a ProblemDetail whose `detail` is a human-readable string.
- Validation failures are **422**; another user's resource is **404**, never 403; unauthenticated is **401** with `WWW-Authenticate: Bearer`.
- Auth cookie: name `access_token`, httpOnly, path `/`, max-age 24h; `Secure` + `SameSite=None` when `app.environment=production`, else `SameSite=Lax`.
- JWT: HS256, `sub` = email, 24h expiry, secret ≥ 32 characters (startup fails otherwise).
- Rate limit: 10 requests/minute per client IP on `POST /auth/login` and `POST /auth/register` → 429.
- Demo account: `demo@rentalledger.com` / `demopass123` (hardcoded in the frontend).
- Expense categories on the wire and in the DB: `cleaning`, `maintenance`, `commission`, `other`.
- Money is `BigDecimal`, column `numeric(10,2)`; ledger dates are `LocalDate` (`YYYY-MM-DD`).
- Tests run against real Postgres 17 via Testcontainers — never H2.
- No changes to the `rental-dashboard` frontend code.

## Review Focus

1. **A returning visitor with an expired or garbage `access_token` cookie** must still be able to log in and register (public endpoints ignore the cookie) → test in Task 3.
2. **The browser's CORS preflight from the frontend origin** must succeed with `Access-Control-Allow-Credentials: true`, or the live demo can't log in → test in Task 3.
3. **Amounts with more than 2 decimals, or ≥ 100,000,000,** must be rejected with 422, not overflow `numeric(10,2)` into a 500 → test in Task 5.
4. **Malformed query parameters** (`?start_date=junk`, `?property_id=abc`) must be 422, not 500 → test in Task 6.
5. **CSV descriptions containing commas** must be quoted so the export stays parseable → test in Task 6.

---

### Task 1: Scaffold the project and the database schema

**Files:**
- Create (generated): `pom.xml`, `mvnw`, `mvnw.cmd`, `.mvn/wrapper/maven-wrapper.properties`, `.gitignore`, `.gitattributes`, `src/main/java/com/sebpostigo/rental/RentalDashboardSpringApplication.java`, `src/test/java/com/sebpostigo/rental/TestcontainersConfiguration.java`, `src/test/java/com/sebpostigo/rental/TestRentalDashboardSpringApplication.java`
- Delete (generated): `src/test/java/com/sebpostigo/rental/RentalDashboardSpringApplicationTests.java`, `HELP.md`
- Modify: `pom.xml`, `src/main/resources/application.properties`, `src/test/java/com/sebpostigo/rental/TestcontainersConfiguration.java`
- Create: `src/main/resources/db/migration/V1__users.sql`, `V2__properties.sql`, `V3__ledger.sql`
- Test: `src/test/java/com/sebpostigo/rental/IntegrationTest.java`, `src/test/java/com/sebpostigo/rental/SchemaTest.java`

**Interfaces:**
- Produces: `abstract class IntegrationTest` (package `com.sebpostigo.rental`) with `protected MockMvc mvc`, `protected JdbcClient jdbc`, and a `@BeforeEach` that truncates all data. Tables `users`, `properties`, `incomes`, `expenses`.

- [ ] **Step 1: Generate the project from Spring Initializr**

```bash
cd /d/2_MyScripts
curl -s https://start.spring.io/starter.zip \
  -d type=maven-project -d language=java -d bootVersion=4.1.1 -d javaVersion=25 \
  -d groupId=com.sebpostigo -d artifactId=rental-dashboard-spring -d name=rental-dashboard-spring \
  -d packageName=com.sebpostigo.rental \
  -d dependencies=web,data-jpa,flyway,security,validation,postgresql,testcontainers \
  -o rental-dashboard-spring.zip
unzip -q rental-dashboard-spring.zip -d rental-dashboard-spring
rm rental-dashboard-spring.zip
cd rental-dashboard-spring
rm HELP.md src/test/java/com/sebpostigo/rental/RentalDashboardSpringApplicationTests.java
chmod +x mvnw
git init -q && git add -A && git commit -qm "chore: generate project from Spring Initializr"
```

Expected: `ls` shows `mvnw pom.xml src .mvn`.

- [ ] **Step 2: Replace `pom.xml` with the full dependency set**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
	xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
	<modelVersion>4.0.0</modelVersion>
	<parent>
		<groupId>org.springframework.boot</groupId>
		<artifactId>spring-boot-starter-parent</artifactId>
		<version>4.1.1</version>
		<relativePath/>
	</parent>
	<groupId>com.sebpostigo</groupId>
	<artifactId>rental-dashboard-spring</artifactId>
	<version>0.0.1-SNAPSHOT</version>
	<name>rental-dashboard-spring</name>
	<description>Rental Dashboard API — Spring Boot edition</description>
	<properties>
		<java.version>25</java.version>
		<springdoc.version>3.1.1</springdoc.version>
		<bucket4j.version>8.20.0</bucket4j.version>
	</properties>
	<dependencies>
		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-webmvc</artifactId>
		</dependency>
		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-data-jpa</artifactId>
		</dependency>
		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-flyway</artifactId>
		</dependency>
		<dependency>
			<groupId>org.flywaydb</groupId>
			<artifactId>flyway-database-postgresql</artifactId>
		</dependency>
		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-security</artifactId>
		</dependency>
		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-security-oauth2-resource-server</artifactId>
		</dependency>
		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-validation</artifactId>
		</dependency>
		<dependency>
			<groupId>org.springdoc</groupId>
			<artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
			<version>${springdoc.version}</version>
		</dependency>
		<dependency>
			<groupId>com.bucket4j</groupId>
			<artifactId>bucket4j_jdk17-core</artifactId>
			<version>${bucket4j.version}</version>
		</dependency>
		<dependency>
			<groupId>org.postgresql</groupId>
			<artifactId>postgresql</artifactId>
			<scope>runtime</scope>
		</dependency>

		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-webmvc-test</artifactId>
			<scope>test</scope>
		</dependency>
		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-data-jpa-test</artifactId>
			<scope>test</scope>
		</dependency>
		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-flyway-test</artifactId>
			<scope>test</scope>
		</dependency>
		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-security-test</artifactId>
			<scope>test</scope>
		</dependency>
		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-validation-test</artifactId>
			<scope>test</scope>
		</dependency>
		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-testcontainers</artifactId>
			<scope>test</scope>
		</dependency>
		<dependency>
			<groupId>org.testcontainers</groupId>
			<artifactId>testcontainers-junit-jupiter</artifactId>
			<scope>test</scope>
		</dependency>
		<dependency>
			<groupId>org.testcontainers</groupId>
			<artifactId>testcontainers-postgresql</artifactId>
			<scope>test</scope>
		</dependency>
	</dependencies>
	<build>
		<plugins>
			<plugin>
				<groupId>org.springframework.boot</groupId>
				<artifactId>spring-boot-maven-plugin</artifactId>
			</plugin>
		</plugins>
	</build>
</project>
```

- [ ] **Step 3: Write `src/main/resources/application.properties`**

```properties
spring.application.name=rental-dashboard-spring

spring.datasource.url=${DATABASE_URL:jdbc:postgresql://localhost:5432/rental}
spring.datasource.username=${DATABASE_USERNAME:rental}
spring.datasource.password=${DATABASE_PASSWORD:rental}
spring.datasource.hikari.maximum-pool-size=5

spring.jpa.hibernate.ddl-auto=validate
spring.jpa.open-in-view=false

spring.jackson.property-naming-strategy=SNAKE_CASE
spring.mvc.format.date=iso
server.forward-headers-strategy=framework

app.environment=${APP_ENVIRONMENT:development}
app.cors-origins=${CORS_ORIGINS:http://localhost:3000}
app.jwt.secret=${JWT_SECRET:}
app.jwt.expiry=24h

springdoc.swagger-ui.path=/swagger-ui.html
```

- [ ] **Step 4: Pin the test database to Postgres 17**

In `src/test/java/com/sebpostigo/rental/TestcontainersConfiguration.java`, change the image line to:

```java
		return new PostgreSQLContainer(DockerImageName.parse("postgres:17"));
```

- [ ] **Step 5: Write the shared integration-test base class**

`src/test/java/com/sebpostigo/rental/IntegrationTest.java`:

```java
package com.sebpostigo.rental;

import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = "app.jwt.secret=test-secret-that-is-at-least-32-characters")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
public abstract class IntegrationTest {

	@Autowired
	protected MockMvc mvc;

	@Autowired
	protected JdbcClient jdbc;

	@BeforeEach
	void resetDatabase() {
		jdbc.sql("truncate table users restart identity cascade").update();
	}

}
```

- [ ] **Step 6: Write the failing schema test**

`src/test/java/com/sebpostigo/rental/SchemaTest.java`:

```java
package com.sebpostigo.rental;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class SchemaTest extends IntegrationTest {

	@Test
	void migrationsCreateAllTables() {
		List<String> tables = jdbc.sql("""
				select table_name from information_schema.tables
				where table_schema = 'public' and table_name in ('users', 'properties', 'incomes', 'expenses')
				order by table_name""").query(String.class).list();

		assertThat(tables).containsExactly("expenses", "incomes", "properties", "users");
	}

	@Test
	void childRowsCascadeWhenTheirParentIsDeleted() {
		List<String> rules = jdbc.sql("""
				select tc.table_name || ':' || rc.delete_rule
				from information_schema.referential_constraints rc
				join information_schema.table_constraints tc on tc.constraint_name = rc.constraint_name
				where tc.table_name in ('properties', 'incomes', 'expenses')
				order by tc.table_name""").query(String.class).list();

		assertThat(rules).containsExactly("expenses:CASCADE", "incomes:CASCADE", "properties:CASCADE");
	}

}
```

- [ ] **Step 7: Run it and watch it fail**

Run: `./mvnw -q test -Dtest=SchemaTest`
Expected: FAIL — `relation "users" does not exist` from the truncate in `IntegrationTest`.

- [ ] **Step 8: Write the migrations**

`src/main/resources/db/migration/V1__users.sql`:

```sql
create table users (
    id              bigserial    primary key,
    email           varchar(320) not null unique,
    hashed_password varchar(100) not null,
    created_at      timestamptz  not null default now()
);
```

`src/main/resources/db/migration/V2__properties.sql`:

```sql
create table properties (
    id            bigserial    primary key,
    owner_id      bigint       not null references users (id) on delete cascade,
    name          varchar(200) not null,
    address       varchar(500) not null,
    property_type varchar(50)  not null default 'apartment',
    currency      varchar(3)   not null default 'USD',
    created_at    timestamptz  not null default now()
);

create index ix_properties_owner_id on properties (owner_id);
```

`src/main/resources/db/migration/V3__ledger.sql`:

```sql
create table incomes (
    id          bigserial     primary key,
    property_id bigint        not null references properties (id) on delete cascade,
    date        date          not null,
    amount      numeric(10,2) not null check (amount >= 0),
    source      varchar(200)  not null,
    notes       varchar(1000),
    created_at  timestamptz   not null default now()
);

create index ix_incomes_property_date on incomes (property_id, date);

create table expenses (
    id          bigserial     primary key,
    property_id bigint        not null references properties (id) on delete cascade,
    date        date          not null,
    amount      numeric(10,2) not null check (amount >= 0),
    category    varchar(20)   not null check (category in ('cleaning', 'maintenance', 'commission', 'other')),
    notes       varchar(1000),
    created_at  timestamptz   not null default now()
);

create index ix_expenses_property_date on expenses (property_id, date);
```

- [ ] **Step 9: Run it and watch it pass**

Run: `./mvnw -q test -Dtest=SchemaTest`
Expected: PASS (2 tests). The first run pulls the `postgres:17` image.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: Flyway schema for users, properties and ledger with cascading deletes"
```

---

### Task 2: Error handling, JWT infrastructure and the health endpoint

**Files:**
- Modify: `src/main/java/com/sebpostigo/rental/RentalDashboardSpringApplication.java`
- Create: `src/main/java/com/sebpostigo/rental/common/AppProperties.java`, `TimeConfig.java`, `ApiException.java`, `NotFoundException.java`, `ProblemResponses.java`, `GlobalExceptionHandler.java`, `HealthController.java`
- Create: `src/main/java/com/sebpostigo/rental/security/SecurityConfig.java`, `JwtService.java`, `CurrentUser.java`, `CookieBearerTokenResolver.java`, `ProblemAuthenticationEntryPoint.java`
- Test: `src/test/java/com/sebpostigo/rental/HealthTest.java`, `src/test/java/com/sebpostigo/rental/security/JwtServiceTest.java`

**Interfaces:**
- Consumes: `IntegrationTest` (Task 1).
- Produces:
  - `record AppProperties(String environment, List<String> corsOrigins, AppProperties.Jwt jwt)` with `record Jwt(String secret, Duration expiry)` and `boolean isProduction()`.
  - `class ApiException(HttpStatus status, String detail)` with `HttpStatus status()`; `class NotFoundException(String detail) extends ApiException` (404).
  - `ProblemResponses.write(HttpServletResponse, HttpStatus, String detail)` for filters.
  - `JwtService.issue(long userId, String email) : String`; `CurrentUser.id(Jwt) : long`.
  - `SecurityConfig.PUBLIC_PATHS : String[]`; package-private statics `signingKey(String)`, `jwtEncoderFor(SecretKey)`, `jwtDecoderFor(SecretKey)`.
  - A `Clock` bean.

- [ ] **Step 1: Write the failing tests**

`src/test/java/com/sebpostigo/rental/HealthTest.java`:

```java
package com.sebpostigo.rental;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

class HealthTest extends IntegrationTest {

	@Test
	void healthCheckReturnsOk() throws Exception {
		mvc.perform(get("/health"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("ok"));
	}

	@Test
	void wrongMethodIsA405ProblemNotA500() throws Exception {
		mvc.perform(post("/health"))
			.andExpect(status().isMethodNotAllowed())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
	}

	@Test
	void protectedEndpointWithoutTokenIs401WithBearerChallenge() throws Exception {
		mvc.perform(get("/properties"))
			.andExpect(status().isUnauthorized())
			.andExpect(header().string("WWW-Authenticate", "Bearer"))
			.andExpect(jsonPath("$.detail").value("Could not validate credentials"));
	}

}
```

`src/test/java/com/sebpostigo/rental/security/JwtServiceTest.java`:

```java
package com.sebpostigo.rental.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.sebpostigo.rental.common.AppProperties;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import javax.crypto.SecretKey;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;

class JwtServiceTest {

	private static final String SECRET = "unit-test-secret-that-is-at-least-32-chars";

	private final JwtDecoder decoder = SecurityConfig.jwtDecoderFor(SecurityConfig.signingKey(SECRET));

	private static JwtService serviceSigningWith(String secret, Instant now) {
		SecretKey key = SecurityConfig.signingKey(secret);
		AppProperties props = new AppProperties("development", List.of("http://localhost:3000"),
				new AppProperties.Jwt(secret, Duration.ofHours(24)));
		return new JwtService(SecurityConfig.jwtEncoderFor(key), props, Clock.fixed(now, ZoneOffset.UTC));
	}

	@Test
	void tokenRoundTripsEmailAndUserId() {
		String token = serviceSigningWith(SECRET, Instant.now()).issue(42L, "ana@example.com");

		Jwt jwt = decoder.decode(token);

		assertThat(jwt.getSubject()).isEqualTo("ana@example.com");
		assertThat(CurrentUser.id(jwt)).isEqualTo(42L);
	}

	@Test
	void expiredTokenIsRejected() {
		String token = serviceSigningWith(SECRET, Instant.now().minus(Duration.ofDays(2))).issue(1L, "ana@example.com");

		assertThatThrownBy(() -> decoder.decode(token)).isInstanceOf(JwtException.class);
	}

	@Test
	void tokenSignedWithAnotherKeyIsRejected() {
		String token = serviceSigningWith("a-different-secret-that-is-also-32-chars", Instant.now())
			.issue(1L, "ana@example.com");

		assertThatThrownBy(() -> decoder.decode(token)).isInstanceOf(JwtException.class);
	}

}
```

- [ ] **Step 2: Run them and watch them fail**

Run: `./mvnw -q test -Dtest='HealthTest,JwtServiceTest'`
Expected: FAIL — compilation errors (`AppProperties`, `JwtService`, `SecurityConfig`, `CurrentUser` not found).

- [ ] **Step 3: Enable configuration-properties scanning**

Replace `src/main/java/com/sebpostigo/rental/RentalDashboardSpringApplication.java`:

```java
package com.sebpostigo.rental;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class RentalDashboardSpringApplication {

	public static void main(String[] args) {
		SpringApplication.run(RentalDashboardSpringApplication.class, args);
	}

}
```

- [ ] **Step 4: Write the `common` package**

`src/main/java/com/sebpostigo/rental/common/AppProperties.java`:

```java
package com.sebpostigo.rental.common;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties("app")
public record AppProperties(@NotBlank String environment, @NotEmpty List<String> corsOrigins, @Valid @NotNull Jwt jwt) {

	public record Jwt(@NotBlank @Size(min = 32, message = "must be at least 32 characters") String secret,
			@NotNull Duration expiry) {
	}

	public boolean isProduction() {
		return "production".equals(environment);
	}

}
```

`src/main/java/com/sebpostigo/rental/common/TimeConfig.java`:

```java
package com.sebpostigo.rental.common;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class TimeConfig {

	@Bean
	Clock clock() {
		return Clock.systemUTC();
	}

}
```

`src/main/java/com/sebpostigo/rental/common/ApiException.java`:

```java
package com.sebpostigo.rental.common;

import org.springframework.http.HttpStatus;

public class ApiException extends RuntimeException {

	private final HttpStatus status;

	public ApiException(HttpStatus status, String detail) {
		super(detail);
		this.status = status;
	}

	public HttpStatus status() {
		return status;
	}

}
```

`src/main/java/com/sebpostigo/rental/common/NotFoundException.java`:

```java
package com.sebpostigo.rental.common;

import org.springframework.http.HttpStatus;

public class NotFoundException extends ApiException {

	public NotFoundException(String detail) {
		super(HttpStatus.NOT_FOUND, detail);
	}

}
```

`src/main/java/com/sebpostigo/rental/common/ProblemResponses.java`:

```java
package com.sebpostigo.rental.common;

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;

/** Writes a ProblemDetail body from servlet filters, which run before Spring MVC's exception handling. */
public final class ProblemResponses {

	private ProblemResponses() {
	}

	public static void write(HttpServletResponse response, HttpStatus status, String detail) throws IOException {
		response.setStatus(status.value());
		response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
		response.setCharacterEncoding("UTF-8");
		response.getWriter().write("{\"type\":\"about:blank\",\"title\":\"%s\",\"status\":%d,\"detail\":\"%s\"}"
			.formatted(status.getReasonPhrase(), status.value(), escape(detail)));
	}

	private static String escape(String value) {
		return value.replace("\\", "\\\\").replace("\"", "\\\"");
	}

}
```

`src/main/java/com/sebpostigo/rental/common/GlobalExceptionHandler.java`:

```java
package com.sebpostigo.rental.common;

import java.util.Locale;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.TypeMismatchException;
import org.springframework.context.MessageSourceResolvable;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

	private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

	// 422 is what FastAPI returns for validation errors; kept so the frontend and tests match.
	private static final HttpStatusCode UNPROCESSABLE = HttpStatusCode.valueOf(422);

	@ExceptionHandler(ApiException.class)
	ResponseEntity<ProblemDetail> handleApi(ApiException ex) {
		ResponseEntity.BodyBuilder response = ResponseEntity.status(ex.status());
		if (ex.status() == HttpStatus.UNAUTHORIZED) {
			response.header(HttpHeaders.WWW_AUTHENTICATE, "Bearer");
		}
		return response.body(ProblemDetail.forStatusAndDetail(ex.status(), ex.getMessage()));
	}

	@ExceptionHandler(Exception.class)
	ProblemDetail handleUnexpected(Exception ex) {
		log.error("Unhandled exception", ex);
		return ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR, "Internal server error");
	}

	@Override
	protected ResponseEntity<Object> handleMethodArgumentNotValid(MethodArgumentNotValidException ex,
			HttpHeaders headers, HttpStatusCode status, WebRequest request) {
		String detail = ex.getBindingResult()
			.getFieldErrors()
			.stream()
			.map(error -> snakeCase(error.getField()) + ": " + error.getDefaultMessage())
			.sorted()
			.collect(Collectors.joining("; "));
		return unprocessable(detail);
	}

	@Override
	protected ResponseEntity<Object> handleHandlerMethodValidationException(HandlerMethodValidationException ex,
			HttpHeaders headers, HttpStatusCode status, WebRequest request) {
		String detail = ex.getAllErrors()
			.stream()
			.map(MessageSourceResolvable::getDefaultMessage)
			.collect(Collectors.joining("; "));
		return unprocessable(detail);
	}

	@Override
	protected ResponseEntity<Object> handleHttpMessageNotReadable(HttpMessageNotReadableException ex,
			HttpHeaders headers, HttpStatusCode status, WebRequest request) {
		Throwable cause = NestedExceptionUtils.getMostSpecificCause(ex);
		return unprocessable(cause instanceof IllegalArgumentException ? cause.getMessage() : "Malformed request body");
	}

	@Override
	protected ResponseEntity<Object> handleTypeMismatch(TypeMismatchException ex, HttpHeaders headers,
			HttpStatusCode status, WebRequest request) {
		return unprocessable(ex.getPropertyName() + ": invalid value");
	}

	@Override
	protected ResponseEntity<Object> handleMissingServletRequestParameter(MissingServletRequestParameterException ex,
			HttpHeaders headers, HttpStatusCode status, WebRequest request) {
		return unprocessable(ex.getParameterName() + ": is required");
	}

	private static ResponseEntity<Object> unprocessable(String detail) {
		return ResponseEntity.status(UNPROCESSABLE).body(ProblemDetail.forStatusAndDetail(UNPROCESSABLE, detail));
	}

	static String snakeCase(String field) {
		return field.replaceAll("([a-z])([A-Z])", "$1_$2").toLowerCase(Locale.ROOT);
	}

}
```

`src/main/java/com/sebpostigo/rental/common/HealthController.java`:

```java
package com.sebpostigo.rental.common;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {

	@GetMapping("/health")
	public Map<String, String> health() {
		return Map.of("status", "ok");
	}

}
```

- [ ] **Step 5: Write the `security` package**

`src/main/java/com/sebpostigo/rental/security/JwtService.java`:

```java
package com.sebpostigo.rental.security;

import com.sebpostigo.rental.common.AppProperties;
import java.time.Clock;
import java.time.Instant;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

	static final String USER_ID_CLAIM = "uid";

	private final JwtEncoder encoder;

	private final AppProperties props;

	private final Clock clock;

	public JwtService(JwtEncoder encoder, AppProperties props, Clock clock) {
		this.encoder = encoder;
		this.props = props;
		this.clock = clock;
	}

	public String issue(long userId, String email) {
		Instant now = clock.instant();
		JwtClaimsSet claims = JwtClaimsSet.builder()
			.subject(email)
			.claim(USER_ID_CLAIM, userId)
			.issuedAt(now)
			.expiresAt(now.plus(props.jwt().expiry()))
			.build();
		JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
		return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
	}

}
```

`src/main/java/com/sebpostigo/rental/security/CurrentUser.java`:

```java
package com.sebpostigo.rental.security;

import org.springframework.security.oauth2.jwt.Jwt;

public final class CurrentUser {

	private CurrentUser() {
	}

	public static long id(Jwt jwt) {
		Number userId = jwt.getClaim(JwtService.USER_ID_CLAIM);
		return userId.longValue();
	}

}
```

`src/main/java/com/sebpostigo/rental/security/CookieBearerTokenResolver.java`:

```java
package com.sebpostigo.rental.security;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.oauth2.server.resource.web.BearerTokenResolver;
import org.springframework.security.oauth2.server.resource.web.DefaultBearerTokenResolver;
import org.springframework.web.util.WebUtils;

/**
 * Reads the JWT from the access_token cookie, falling back to the Authorization header. Public
 * endpoints get no token at all, so a stale cookie can never block login or registration.
 */
class CookieBearerTokenResolver implements BearerTokenResolver {

	static final String COOKIE_NAME = "access_token";

	private final DefaultBearerTokenResolver headerResolver = new DefaultBearerTokenResolver();

	@Override
	public String resolve(HttpServletRequest request) {
		if (isPublic(request.getRequestURI())) {
			return null;
		}
		Cookie cookie = WebUtils.getCookie(request, COOKIE_NAME);
		if (cookie != null && !cookie.getValue().isBlank()) {
			return cookie.getValue();
		}
		return headerResolver.resolve(request);
	}

	static boolean isPublic(String path) {
		for (String pattern : SecurityConfig.PUBLIC_PATHS) {
			boolean matches = pattern.endsWith("/**") ? path.startsWith(pattern.substring(0, pattern.length() - 3))
					: path.equals(pattern);
			if (matches) {
				return true;
			}
		}
		return false;
	}

}
```

`src/main/java/com/sebpostigo/rental/security/ProblemAuthenticationEntryPoint.java`:

```java
package com.sebpostigo.rental.security;

import com.sebpostigo.rental.common.ProblemResponses;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;

class ProblemAuthenticationEntryPoint implements AuthenticationEntryPoint {

	@Override
	public void commence(HttpServletRequest request, HttpServletResponse response,
			AuthenticationException authException) throws IOException {
		response.setHeader(HttpHeaders.WWW_AUTHENTICATE, "Bearer");
		ProblemResponses.write(response, HttpStatus.UNAUTHORIZED, "Could not validate credentials");
	}

}
```

`src/main/java/com/sebpostigo/rental/security/SecurityConfig.java`:

```java
package com.sebpostigo.rental.security;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.sebpostigo.rental.common.AppProperties;
import java.nio.charset.StandardCharsets;
import java.util.List;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration(proxyBeanMethods = false)
@EnableWebSecurity
public class SecurityConfig {

	static final String[] PUBLIC_PATHS = { "/health", "/auth/register", "/auth/login", "/auth/logout", "/error",
			"/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html" };

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
		ProblemAuthenticationEntryPoint entryPoint = new ProblemAuthenticationEntryPoint();
		http
			// Stateless API: no session to ride, and login/logout are guarded by an Origin check instead.
			.csrf(AbstractHttpConfigurer::disable)
			.cors(Customizer.withDefaults())
			.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
			.authorizeHttpRequests(auth -> auth.requestMatchers(PUBLIC_PATHS).permitAll().anyRequest().authenticated())
			.oauth2ResourceServer(oauth -> oauth.bearerTokenResolver(new CookieBearerTokenResolver())
				.authenticationEntryPoint(entryPoint)
				.jwt(Customizer.withDefaults()))
			.exceptionHandling(exceptions -> exceptions.authenticationEntryPoint(entryPoint));
		return http.build();
	}

	@Bean
	JwtEncoder jwtEncoder(AppProperties props) {
		return jwtEncoderFor(signingKey(props.jwt().secret()));
	}

	@Bean
	JwtDecoder jwtDecoder(AppProperties props) {
		return jwtDecoderFor(signingKey(props.jwt().secret()));
	}

	@Bean
	CorsConfigurationSource corsConfigurationSource(AppProperties props) {
		CorsConfiguration cors = new CorsConfiguration();
		cors.setAllowedOrigins(props.corsOrigins());
		cors.setAllowedMethods(List.of("GET", "POST", "PATCH", "DELETE", "OPTIONS"));
		cors.setAllowedHeaders(List.of("*"));
		cors.setExposedHeaders(List.of("Content-Disposition"));
		cors.setAllowCredentials(true);
		UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
		source.registerCorsConfiguration("/**", cors);
		return source;
	}

	static SecretKey signingKey(String secret) {
		return new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
	}

	static JwtEncoder jwtEncoderFor(SecretKey key) {
		return new NimbusJwtEncoder(new ImmutableSecret<>(key));
	}

	static JwtDecoder jwtDecoderFor(SecretKey key) {
		return NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
	}

}
```

- [ ] **Step 6: Run the tests and watch them pass**

Run: `./mvnw -q test -Dtest='HealthTest,JwtServiceTest,SchemaTest'`
Expected: PASS (8 tests).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: ProblemDetail error handling, JWT resource server and health endpoint"
```

---

### Task 3: Authentication — register, login, logout, me, origin check, rate limit

**Files:**
- Create: `src/main/java/com/sebpostigo/rental/auth/User.java`, `UserRepository.java`, `AuthService.java`, `AuthController.java`, `RegisterRequest.java`, `UserResponse.java`, `TokenResponse.java`
- Create: `src/main/java/com/sebpostigo/rental/security/AuthCookieFactory.java`, `OriginCheckFilter.java`, `RateLimiter.java`, `RateLimitFilter.java`
- Modify: `src/main/java/com/sebpostigo/rental/security/SecurityConfig.java` (full replacement below)
- Modify: `src/test/java/com/sebpostigo/rental/IntegrationTest.java` (full replacement below)
- Test: `src/test/java/com/sebpostigo/rental/auth/AuthControllerTest.java`

**Interfaces:**
- Consumes: `ApiException`, `AppProperties`, `JwtService.issue`, `CurrentUser.id`, `ProblemResponses.write`, `SecurityConfig.PUBLIC_PATHS` (Task 2).
- Produces:
  - Entity `User(String email, String hashedPassword)` with `getId() : Long`, `getEmail()`, `getHashedPassword()`, `changePassword(String)`; `UserRepository.findByEmail(String) : Optional<User>`, `existsByEmail(String) : boolean`.
  - `RateLimiter.tryConsume(String key) : boolean`, `reset()`.
  - `PasswordEncoder` bean.
  - `IntegrationTest` helpers: `PASSWORD`, `register(String email) : ResultActions`, `login(String email, String password) : ResultActions`, `signUp(String email) : Cookie`.

- [ ] **Step 1: Replace `IntegrationTest` with the auth-aware version**

```java
package com.sebpostigo.rental;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.sebpostigo.rental.security.RateLimiter;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

@SpringBootTest(properties = "app.jwt.secret=test-secret-that-is-at-least-32-characters")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
public abstract class IntegrationTest {

	protected static final String PASSWORD = "password123";

	@Autowired
	protected MockMvc mvc;

	@Autowired
	protected JdbcClient jdbc;

	@Autowired
	private RateLimiter rateLimiter;

	@BeforeEach
	void resetState() {
		jdbc.sql("truncate table users restart identity cascade").update();
		rateLimiter.reset();
	}

	protected ResultActions register(String email) throws Exception {
		return mvc.perform(post("/auth/register").contentType(MediaType.APPLICATION_JSON)
			.content("{\"email\":\"%s\",\"password\":\"%s\"}".formatted(email, PASSWORD)));
	}

	protected ResultActions login(String email, String password) throws Exception {
		return mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_FORM_URLENCODED)
			.param("username", email)
			.param("password", password));
	}

	/** Registers and logs in a user, returning their auth cookie. Uses 1 register + 1 login of the rate budget. */
	protected Cookie signUp(String email) throws Exception {
		register(email).andExpect(status().isCreated());
		return login(email, PASSWORD).andExpect(status().isOk()).andReturn().getResponse().getCookie("access_token");
	}

}
```

- [ ] **Step 2: Write the failing auth tests**

`src/test/java/com/sebpostigo/rental/auth/AuthControllerTest.java`:

```java
package com.sebpostigo.rental.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.sebpostigo.rental.IntegrationTest;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockCookie;

class AuthControllerTest extends IntegrationTest {

	@Test
	void registerCreatesUser() throws Exception {
		register("ana@example.com").andExpect(status().isCreated())
			.andExpect(jsonPath("$.id").isNumber())
			.andExpect(jsonPath("$.email").value("ana@example.com"));
	}

	@Test
	void registerDuplicateEmailRejected() throws Exception {
		register("ana@example.com").andExpect(status().isCreated());

		register("ana@example.com").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.detail").value("Email already registered"));
	}

	@Test
	void registerWithShortPasswordRejected() throws Exception {
		mvc.perform(post("/auth/register").contentType(MediaType.APPLICATION_JSON)
			.content("{\"email\":\"ana@example.com\",\"password\":\"short\"}"))
			.andExpect(status().is(422))
			.andExpect(jsonPath("$.detail").value(containsString("password")));
	}

	@Test
	void loginWithCorrectCredentialsReturnsToken() throws Exception {
		register("ana@example.com");

		login("ana@example.com", PASSWORD).andExpect(status().isOk())
			.andExpect(jsonPath("$.access_token").isNotEmpty())
			.andExpect(jsonPath("$.token_type").value("bearer"));
	}

	@Test
	void loginWithWrongPasswordRejected() throws Exception {
		register("ana@example.com");

		login("ana@example.com", "wrong-password").andExpect(status().isUnauthorized())
			.andExpect(header().string("WWW-Authenticate", "Bearer"))
			.andExpect(jsonPath("$.detail").value("Incorrect email or password"));
	}

	@Test
	void loginWithUnknownEmailRejected() throws Exception {
		login("ghost@example.com", PASSWORD).andExpect(status().isUnauthorized());
	}

	@Test
	void meWithoutTokenRejected() throws Exception {
		mvc.perform(get("/auth/me"))
			.andExpect(status().isUnauthorized())
			.andExpect(header().string("WWW-Authenticate", "Bearer"));
	}

	@Test
	void meWithValidBearerTokenReturnsCurrentUser() throws Exception {
		register("ana@example.com");
		String body = login("ana@example.com", PASSWORD).andReturn().getResponse().getContentAsString();
		String token = JsonPath.read(body, "$.access_token");

		mvc.perform(get("/auth/me").header("Authorization", "Bearer " + token))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.email").value("ana@example.com"));
	}

	@Test
	void meWithInvalidTokenRejected() throws Exception {
		mvc.perform(get("/auth/me").header("Authorization", "Bearer not-a-real-token"))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.detail").value("Could not validate credentials"));
	}

	@Test
	void loginSetsHttpOnlyCookie() throws Exception {
		register("ana@example.com");

		MockCookie cookie = (MockCookie) login("ana@example.com", PASSWORD).andReturn()
			.getResponse()
			.getCookie("access_token");

		assertThat(cookie).isNotNull();
		assertThat(cookie.isHttpOnly()).isTrue();
		assertThat(cookie.getPath()).isEqualTo("/");
		assertThat(cookie.getMaxAge()).isEqualTo(86400);
		assertThat(cookie.getSameSite()).isEqualTo("Lax");
		assertThat(cookie.getSecure()).isFalse();
	}

	@Test
	void meWorksViaCookieWithoutHeader() throws Exception {
		Cookie cookie = signUp("ana@example.com");

		mvc.perform(get("/auth/me").cookie(cookie))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.email").value("ana@example.com"));
	}

	@Test
	void logoutClearsCookie() throws Exception {
		MockCookie cleared = (MockCookie) mvc.perform(post("/auth/logout"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("ok"))
			.andReturn()
			.getResponse()
			.getCookie("access_token");

		assertThat(cleared).isNotNull();
		assertThat(cleared.getMaxAge()).isZero();
		assertThat(cleared.getValue()).isEmpty();
	}

	@Test
	void loginIsRateLimited() throws Exception {
		for (int i = 0; i < 10; i++) {
			login("ghost@example.com", "wrong").andExpect(status().isUnauthorized());
		}

		login("ghost@example.com", "wrong").andExpect(status().isTooManyRequests())
			.andExpect(jsonPath("$.detail").value("Too many requests"));
	}

	@Test
	void registerIsRateLimited() throws Exception {
		for (int i = 0; i < 10; i++) {
			register("user" + i + "@example.com").andExpect(status().isCreated());
		}

		register("user10@example.com").andExpect(status().isTooManyRequests());
	}

	@Test
	void loginFromForeignOriginRejected() throws Exception {
		mvc.perform(post("/auth/login").header("Origin", "https://evil.example")
			.contentType(MediaType.APPLICATION_FORM_URLENCODED)
			.param("username", "ana@example.com")
			.param("password", PASSWORD))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.detail").value("Invalid origin"));
	}

	@Test
	void loginFromFrontendOriginAllowed() throws Exception {
		register("ana@example.com");

		mvc.perform(post("/auth/login").header("Origin", "http://localhost:3000")
			.contentType(MediaType.APPLICATION_FORM_URLENCODED)
			.param("username", "ana@example.com")
			.param("password", PASSWORD))
			.andExpect(status().isOk());
	}

	@Test
	void staleCookieDoesNotBlockLogin() throws Exception {
		register("ana@example.com");

		mvc.perform(post("/auth/login").cookie(new Cookie("access_token", "expired-or-garbage"))
			.contentType(MediaType.APPLICATION_FORM_URLENCODED)
			.param("username", "ana@example.com")
			.param("password", PASSWORD))
			.andExpect(status().isOk());
	}

	@Test
	void corsPreflightFromFrontendAllowsCredentials() throws Exception {
		mvc.perform(options("/auth/login").header("Origin", "http://localhost:3000")
			.header("Access-Control-Request-Method", "POST"))
			.andExpect(status().isOk())
			.andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:3000"))
			.andExpect(header().string("Access-Control-Allow-Credentials", "true"));
	}

}
```

- [ ] **Step 3: Run them and watch them fail**

Run: `./mvnw -q test -Dtest=AuthControllerTest`
Expected: FAIL — compilation error, `RateLimiter` not found.

- [ ] **Step 4: Write the `auth` package**

`src/main/java/com/sebpostigo/rental/auth/User.java`:

```java
package com.sebpostigo.rental.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "users")
public class User {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, unique = true)
	private String email;

	@Column(nullable = false)
	private String hashedPassword;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	protected User() {
	}

	public User(String email, String hashedPassword) {
		this.email = email;
		this.hashedPassword = hashedPassword;
	}

	public Long getId() {
		return id;
	}

	public String getEmail() {
		return email;
	}

	public String getHashedPassword() {
		return hashedPassword;
	}

	public void changePassword(String hashedPassword) {
		this.hashedPassword = hashedPassword;
	}

}
```

`src/main/java/com/sebpostigo/rental/auth/UserRepository.java`:

```java
package com.sebpostigo.rental.auth;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {

	Optional<User> findByEmail(String email);

	boolean existsByEmail(String email);

}
```

`src/main/java/com/sebpostigo/rental/auth/RegisterRequest.java`:

```java
package com.sebpostigo.rental.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record RegisterRequest(@NotBlank @Email String email, @NotNull @Size(min = 8, max = 72) String password) {
}
```

`src/main/java/com/sebpostigo/rental/auth/UserResponse.java`:

```java
package com.sebpostigo.rental.auth;

public record UserResponse(long id, String email) {

	static UserResponse from(User user) {
		return new UserResponse(user.getId(), user.getEmail());
	}

}
```

`src/main/java/com/sebpostigo/rental/auth/TokenResponse.java`:

```java
package com.sebpostigo.rental.auth;

public record TokenResponse(String accessToken, String tokenType) {
}
```

`src/main/java/com/sebpostigo/rental/auth/AuthService.java`:

```java
package com.sebpostigo.rental.auth;

import com.sebpostigo.rental.common.ApiException;
import com.sebpostigo.rental.security.JwtService;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class AuthService {

	private final UserRepository users;

	private final PasswordEncoder passwordEncoder;

	private final JwtService jwtService;

	public AuthService(UserRepository users, PasswordEncoder passwordEncoder, JwtService jwtService) {
		this.users = users;
		this.passwordEncoder = passwordEncoder;
		this.jwtService = jwtService;
	}

	@Transactional
	public UserResponse register(RegisterRequest request) {
		if (users.existsByEmail(request.email())) {
			throw new ApiException(HttpStatus.BAD_REQUEST, "Email already registered");
		}
		User user = users.save(new User(request.email(), passwordEncoder.encode(request.password())));
		return UserResponse.from(user);
	}

	public String login(String email, String password) {
		User user = users.findByEmail(email)
			.filter(candidate -> passwordEncoder.matches(password, candidate.getHashedPassword()))
			.orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Incorrect email or password"));
		return jwtService.issue(user.getId(), user.getEmail());
	}

	public UserResponse me(long userId) {
		return users.findById(userId)
			.map(UserResponse::from)
			.orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Could not validate credentials"));
	}

}
```

`src/main/java/com/sebpostigo/rental/auth/AuthController.java`:

```java
package com.sebpostigo.rental.auth;

import com.sebpostigo.rental.security.AuthCookieFactory;
import com.sebpostigo.rental.security.CurrentUser;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
public class AuthController {

	private final AuthService authService;

	private final AuthCookieFactory cookies;

	public AuthController(AuthService authService, AuthCookieFactory cookies) {
		this.authService = authService;
		this.cookies = cookies;
	}

	@PostMapping("/register")
	@ResponseStatus(HttpStatus.CREATED)
	public UserResponse register(@Valid @RequestBody RegisterRequest request) {
		return authService.register(request);
	}

	/** Form-encoded like FastAPI's OAuth2PasswordRequestForm, which the frontend already sends. */
	@PostMapping(path = "/login", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
	public ResponseEntity<TokenResponse> login(@RequestParam String username, @RequestParam String password) {
		String token = authService.login(username, password);
		return ResponseEntity.ok()
			.header(HttpHeaders.SET_COOKIE, cookies.issue(token).toString())
			.body(new TokenResponse(token, "bearer"));
	}

	@PostMapping("/logout")
	public ResponseEntity<Map<String, String>> logout() {
		return ResponseEntity.ok()
			.header(HttpHeaders.SET_COOKIE, cookies.clear().toString())
			.body(Map.of("status", "ok"));
	}

	@GetMapping("/me")
	public UserResponse me(@AuthenticationPrincipal Jwt jwt) {
		return authService.me(CurrentUser.id(jwt));
	}

}
```

- [ ] **Step 5: Write the cookie factory, filters and rate limiter**

`src/main/java/com/sebpostigo/rental/security/AuthCookieFactory.java`:

```java
package com.sebpostigo.rental.security;

import com.sebpostigo.rental.common.AppProperties;
import java.time.Duration;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

@Component
public class AuthCookieFactory {

	private final AppProperties props;

	public AuthCookieFactory(AppProperties props) {
		this.props = props;
	}

	public ResponseCookie issue(String token) {
		return cookie(token, props.jwt().expiry());
	}

	public ResponseCookie clear() {
		return cookie("", Duration.ZERO);
	}

	/** Cross-site in production (Vercel frontend → Render API), so SameSite=None requires Secure. */
	private ResponseCookie cookie(String value, Duration maxAge) {
		return ResponseCookie.from(CookieBearerTokenResolver.COOKIE_NAME, value)
			.httpOnly(true)
			.path("/")
			.maxAge(maxAge)
			.secure(props.isProduction())
			.sameSite(props.isProduction() ? "None" : "Lax")
			.build();
	}

}
```

`src/main/java/com/sebpostigo/rental/security/OriginCheckFilter.java`:

```java
package com.sebpostigo.rental.security;

import com.sebpostigo.rental.common.ProblemResponses;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * CSRF guard for login/logout: browsers can send these form POSTs cross-site without a CORS
 * preflight, so a present Origin header must be one of ours. Requests without Origin (curl,
 * server-to-server) are allowed, as in the FastAPI version.
 */
class OriginCheckFilter extends OncePerRequestFilter {

	private static final Set<String> GUARDED_PATHS = Set.of("/auth/login", "/auth/logout");

	private final Set<String> allowedOrigins;

	OriginCheckFilter(List<String> allowedOrigins) {
		this.allowedOrigins = Set.copyOf(allowedOrigins);
	}

	@Override
	protected boolean shouldNotFilter(HttpServletRequest request) {
		return !("POST".equals(request.getMethod()) && GUARDED_PATHS.contains(request.getRequestURI()));
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
			throws ServletException, IOException {
		String origin = request.getHeader("Origin");
		if (origin != null && !allowedOrigins.contains(origin)) {
			ProblemResponses.write(response, HttpStatus.FORBIDDEN, "Invalid origin");
			return;
		}
		chain.doFilter(request, response);
	}

}
```

`src/main/java/com/sebpostigo/rental/security/RateLimiter.java`:

```java
package com.sebpostigo.rental.security;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

@Component
public class RateLimiter {

	// ponytail: in-memory and one bucket per key forever — fine for one Render instance and a
	// demo's traffic; move to Bucket4j's Redis/JDBC backend (with expiry) if this ever scales out.
	private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

	public boolean tryConsume(String key) {
		return buckets.computeIfAbsent(key, k -> newBucket()).tryConsume(1);
	}

	public void reset() {
		buckets.clear();
	}

	private static Bucket newBucket() {
		return Bucket.builder()
			.addLimit(Bandwidth.builder().capacity(10).refillIntervally(10, Duration.ofMinutes(1)).build())
			.build();
	}

}
```

`src/main/java/com/sebpostigo/rental/security/RateLimitFilter.java`:

```java
package com.sebpostigo.rental.security;

import com.sebpostigo.rental.common.ProblemResponses;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.web.filter.OncePerRequestFilter;

/** 10 requests/minute per client IP and endpoint on login and register. */
class RateLimitFilter extends OncePerRequestFilter {

	private static final Set<String> LIMITED_PATHS = Set.of("/auth/login", "/auth/register");

	private final RateLimiter rateLimiter;

	RateLimitFilter(RateLimiter rateLimiter) {
		this.rateLimiter = rateLimiter;
	}

	@Override
	protected boolean shouldNotFilter(HttpServletRequest request) {
		return !("POST".equals(request.getMethod()) && LIMITED_PATHS.contains(request.getRequestURI()));
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
			throws ServletException, IOException {
		// remoteAddr is the real client IP behind Render's proxy thanks to server.forward-headers-strategy.
		String key = request.getRemoteAddr() + " " + request.getRequestURI();
		if (!rateLimiter.tryConsume(key)) {
			ProblemResponses.write(response, HttpStatus.TOO_MANY_REQUESTS, "Too many requests");
			return;
		}
		chain.doFilter(request, response);
	}

}
```

- [ ] **Step 6: Replace `SecurityConfig` to register the filters and the password encoder**

```java
package com.sebpostigo.rental.security;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.sebpostigo.rental.common.AppProperties;
import java.nio.charset.StandardCharsets;
import java.util.List;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

@Configuration(proxyBeanMethods = false)
@EnableWebSecurity
public class SecurityConfig {

	static final String[] PUBLIC_PATHS = { "/health", "/auth/register", "/auth/login", "/auth/logout", "/error",
			"/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html" };

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http, AppProperties props, RateLimiter rateLimiter)
			throws Exception {
		ProblemAuthenticationEntryPoint entryPoint = new ProblemAuthenticationEntryPoint();
		http
			// Stateless API: no session to ride, and login/logout are guarded by an Origin check instead.
			.csrf(AbstractHttpConfigurer::disable)
			.cors(Customizer.withDefaults())
			.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
			.authorizeHttpRequests(auth -> auth.requestMatchers(PUBLIC_PATHS).permitAll().anyRequest().authenticated())
			.oauth2ResourceServer(oauth -> oauth.bearerTokenResolver(new CookieBearerTokenResolver())
				.authenticationEntryPoint(entryPoint)
				.jwt(Customizer.withDefaults()))
			.exceptionHandling(exceptions -> exceptions.authenticationEntryPoint(entryPoint))
			// Before CorsFilter so a foreign Origin gets our ProblemDetail, not CORS's plain-text rejection.
			.addFilterBefore(new OriginCheckFilter(props.corsOrigins()), CorsFilter.class)
			.addFilterAfter(new RateLimitFilter(rateLimiter), OriginCheckFilter.class);
		return http.build();
	}

	@Bean
	PasswordEncoder passwordEncoder() {
		return new BCryptPasswordEncoder();
	}

	@Bean
	JwtEncoder jwtEncoder(AppProperties props) {
		return jwtEncoderFor(signingKey(props.jwt().secret()));
	}

	@Bean
	JwtDecoder jwtDecoder(AppProperties props) {
		return jwtDecoderFor(signingKey(props.jwt().secret()));
	}

	@Bean
	CorsConfigurationSource corsConfigurationSource(AppProperties props) {
		CorsConfiguration cors = new CorsConfiguration();
		cors.setAllowedOrigins(props.corsOrigins());
		cors.setAllowedMethods(List.of("GET", "POST", "PATCH", "DELETE", "OPTIONS"));
		cors.setAllowedHeaders(List.of("*"));
		cors.setExposedHeaders(List.of("Content-Disposition"));
		cors.setAllowCredentials(true);
		UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
		source.registerCorsConfiguration("/**", cors);
		return source;
	}

	static SecretKey signingKey(String secret) {
		return new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
	}

	static JwtEncoder jwtEncoderFor(SecretKey key) {
		return new NimbusJwtEncoder(new ImmutableSecret<>(key));
	}

	static JwtDecoder jwtDecoderFor(SecretKey key) {
		return NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
	}

}
```

- [ ] **Step 7: Run the tests and watch them pass**

Run: `./mvnw -q test`
Expected: PASS (26 tests: 2 schema + 3 health + 3 JWT + 18 auth).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: cookie-based JWT auth with origin check and login rate limiting"
```

---

### Task 4: Properties CRUD scoped to the owner

**Files:**
- Create: `src/main/java/com/sebpostigo/rental/property/Property.java`, `PropertyRepository.java`, `PropertyService.java`, `PropertyController.java`, `PropertyCreateRequest.java`, `PropertyUpdateRequest.java`, `PropertyResponse.java`
- Modify: `src/test/java/com/sebpostigo/rental/IntegrationTest.java` (add `createProperty`)
- Test: `src/test/java/com/sebpostigo/rental/property/PropertyControllerTest.java`

**Interfaces:**
- Consumes: `NotFoundException`, `CurrentUser.id`, `IntegrationTest.signUp` (Tasks 2–3).
- Produces:
  - Entity `Property(Long ownerId, String name, String address, String propertyType, String currency)` with `getId() : Long` and getters.
  - `PropertyRepository` (`JpaRepository<Property, Long>`) with `findByOwnerIdOrderByIdAsc(Long)`, `findByIdAndOwnerId(Long, Long)`.
  - `PropertyService.requireOwned(long ownerId, long propertyId) : Property` — throws `NotFoundException("Property not found")`. Used by ledger and reports.
  - `IntegrationTest.createProperty(Cookie owner, String name) : long` (address is always `"Av. Test 123"`).

- [ ] **Step 1: Add the `createProperty` helper to `IntegrationTest`**

Add the import `import com.jayway.jsonpath.JsonPath;` and this method below `signUp`:

```java
	protected long createProperty(Cookie owner, String name) throws Exception {
		String body = mvc.perform(post("/properties").cookie(owner)
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"name\":\"%s\",\"address\":\"Av. Test 123\"}".formatted(name)))
			.andExpect(status().isCreated())
			.andReturn()
			.getResponse()
			.getContentAsString();
		return ((Number) JsonPath.read(body, "$.id")).longValue();
	}
```

- [ ] **Step 2: Write the failing property tests**

`src/test/java/com/sebpostigo/rental/property/PropertyControllerTest.java`:

```java
package com.sebpostigo.rental.property;

import static org.hamcrest.Matchers.contains;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.sebpostigo.rental.IntegrationTest;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

class PropertyControllerTest extends IntegrationTest {

	@Test
	void createPropertyRequiresAuth() throws Exception {
		mvc.perform(post("/properties").contentType(MediaType.APPLICATION_JSON)
			.content("{\"name\":\"Casa Sol\",\"address\":\"Calle 1\"}"))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void createPropertyReturnsCreatedPropertyWithDefaults() throws Exception {
		Cookie ana = signUp("ana@example.com");

		mvc.perform(post("/properties").cookie(ana)
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"name\":\"Casa Sol\",\"address\":\"Calle 1\"}"))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.id").isNumber())
			.andExpect(jsonPath("$.name").value("Casa Sol"))
			.andExpect(jsonPath("$.address").value("Calle 1"))
			.andExpect(jsonPath("$.property_type").value("apartment"))
			.andExpect(jsonPath("$.currency").value("USD"));
	}

	@Test
	void listPropertiesReturnsOnlyOwn() throws Exception {
		Cookie ana = signUp("ana@example.com");
		Cookie ben = signUp("ben@example.com");
		createProperty(ana, "Casa Sol");
		createProperty(ana, "Depa Luna");
		createProperty(ben, "Ben House");

		mvc.perform(get("/properties").cookie(ana))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[*].name", contains("Casa Sol", "Depa Luna")));
	}

	@Test
	void getPropertyById() throws Exception {
		Cookie ana = signUp("ana@example.com");
		long id = createProperty(ana, "Casa Sol");

		mvc.perform(get("/properties/{id}", id).cookie(ana))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.name").value("Casa Sol"));
	}

	@Test
	void getOtherUsersPropertyReturns404() throws Exception {
		Cookie ana = signUp("ana@example.com");
		Cookie ben = signUp("ben@example.com");
		long id = createProperty(ana, "Casa Sol");

		mvc.perform(get("/properties/{id}", id).cookie(ben))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.detail").value("Property not found"));
	}

	@Test
	void updatePropertyChangesOnlyProvidedFields() throws Exception {
		Cookie ana = signUp("ana@example.com");
		long id = createProperty(ana, "Casa Sol");

		mvc.perform(patch("/properties/{id}", id).cookie(ana)
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"name\":\"Casa Luna\"}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.name").value("Casa Luna"))
			.andExpect(jsonPath("$.address").value("Av. Test 123"));
	}

	@Test
	void deleteProperty() throws Exception {
		Cookie ana = signUp("ana@example.com");
		long id = createProperty(ana, "Casa Sol");

		mvc.perform(delete("/properties/{id}", id).cookie(ana)).andExpect(status().isNoContent());

		mvc.perform(get("/properties/{id}", id).cookie(ana)).andExpect(status().isNotFound());
	}

	@Test
	void deleteOtherUsersPropertyReturns404() throws Exception {
		Cookie ana = signUp("ana@example.com");
		Cookie ben = signUp("ben@example.com");
		long id = createProperty(ana, "Casa Sol");

		mvc.perform(delete("/properties/{id}", id).cookie(ben)).andExpect(status().isNotFound());

		mvc.perform(get("/properties/{id}", id).cookie(ana)).andExpect(status().isOk());
	}

}
```

- [ ] **Step 3: Run them and watch them fail**

Run: `./mvnw -q test -Dtest=PropertyControllerTest`
Expected: FAIL — `createProperty` gets 404 from `POST /properties` (no controller yet): `Status expected:<201> but was:<404>`.

- [ ] **Step 4: Write the `property` package**

`src/main/java/com/sebpostigo/rental/property/Property.java`:

```java
package com.sebpostigo.rental.property;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "properties")
public class Property {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false)
	private Long ownerId;

	@Column(nullable = false)
	private String name;

	@Column(nullable = false)
	private String address;

	@Column(nullable = false)
	private String propertyType;

	@Column(nullable = false)
	private String currency;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	protected Property() {
	}

	public Property(Long ownerId, String name, String address, String propertyType, String currency) {
		this.ownerId = ownerId;
		this.name = name;
		this.address = address;
		this.propertyType = propertyType;
		this.currency = currency;
	}

	/** PATCH semantics: null means "not provided", so the field keeps its value. */
	public void update(String name, String address, String propertyType, String currency) {
		if (name != null) {
			this.name = name;
		}
		if (address != null) {
			this.address = address;
		}
		if (propertyType != null) {
			this.propertyType = propertyType;
		}
		if (currency != null) {
			this.currency = currency;
		}
	}

	public Long getId() {
		return id;
	}

	public Long getOwnerId() {
		return ownerId;
	}

	public String getName() {
		return name;
	}

	public String getAddress() {
		return address;
	}

	public String getPropertyType() {
		return propertyType;
	}

	public String getCurrency() {
		return currency;
	}

}
```

`src/main/java/com/sebpostigo/rental/property/PropertyRepository.java`:

```java
package com.sebpostigo.rental.property;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PropertyRepository extends JpaRepository<Property, Long> {

	List<Property> findByOwnerIdOrderByIdAsc(Long ownerId);

	Optional<Property> findByIdAndOwnerId(Long id, Long ownerId);

}
```

`src/main/java/com/sebpostigo/rental/property/PropertyCreateRequest.java`:

```java
package com.sebpostigo.rental.property;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PropertyCreateRequest(
		@NotBlank @Size(max = 200) String name,
		@NotBlank @Size(max = 500) String address,
		@Size(max = 50) String propertyType,
		@Size(min = 3, max = 3) String currency) {
}
```

`src/main/java/com/sebpostigo/rental/property/PropertyUpdateRequest.java`:

```java
package com.sebpostigo.rental.property;

import jakarta.validation.constraints.Size;

public record PropertyUpdateRequest(
		@Size(min = 1, max = 200) String name,
		@Size(min = 1, max = 500) String address,
		@Size(max = 50) String propertyType,
		@Size(min = 3, max = 3) String currency) {
}
```

`src/main/java/com/sebpostigo/rental/property/PropertyResponse.java`:

```java
package com.sebpostigo.rental.property;

public record PropertyResponse(long id, String name, String address, String propertyType, String currency) {

	static PropertyResponse from(Property property) {
		return new PropertyResponse(property.getId(), property.getName(), property.getAddress(),
				property.getPropertyType(), property.getCurrency());
	}

}
```

`src/main/java/com/sebpostigo/rental/property/PropertyService.java`:

```java
package com.sebpostigo.rental.property;

import com.sebpostigo.rental.common.NotFoundException;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class PropertyService {

	static final String DEFAULT_PROPERTY_TYPE = "apartment";

	static final String DEFAULT_CURRENCY = "USD";

	private final PropertyRepository properties;

	public PropertyService(PropertyRepository properties) {
		this.properties = properties;
	}

	@Transactional
	public PropertyResponse create(long ownerId, PropertyCreateRequest request) {
		Property property = new Property(ownerId, request.name(), request.address(),
				Objects.requireNonNullElse(request.propertyType(), DEFAULT_PROPERTY_TYPE),
				Objects.requireNonNullElse(request.currency(), DEFAULT_CURRENCY));
		return PropertyResponse.from(properties.save(property));
	}

	public List<PropertyResponse> list(long ownerId) {
		return properties.findByOwnerIdOrderByIdAsc(ownerId).stream().map(PropertyResponse::from).toList();
	}

	public PropertyResponse get(long ownerId, long propertyId) {
		return PropertyResponse.from(requireOwned(ownerId, propertyId));
	}

	@Transactional
	public PropertyResponse update(long ownerId, long propertyId, PropertyUpdateRequest request) {
		Property property = requireOwned(ownerId, propertyId);
		property.update(request.name(), request.address(), request.propertyType(), request.currency());
		return PropertyResponse.from(property);
	}

	/** Incomes and expenses go with it via ON DELETE CASCADE. */
	@Transactional
	public void delete(long ownerId, long propertyId) {
		properties.delete(requireOwned(ownerId, propertyId));
	}

	/** Not-found and not-yours are the same 404, so the API never reveals which ids exist. */
	public Property requireOwned(long ownerId, long propertyId) {
		return properties.findByIdAndOwnerId(propertyId, ownerId)
			.orElseThrow(() -> new NotFoundException("Property not found"));
	}

}
```

`src/main/java/com/sebpostigo/rental/property/PropertyController.java`:

```java
package com.sebpostigo.rental.property;

import com.sebpostigo.rental.security.CurrentUser;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/properties")
public class PropertyController {

	private final PropertyService propertyService;

	public PropertyController(PropertyService propertyService) {
		this.propertyService = propertyService;
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public PropertyResponse create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody PropertyCreateRequest request) {
		return propertyService.create(CurrentUser.id(jwt), request);
	}

	@GetMapping
	public List<PropertyResponse> list(@AuthenticationPrincipal Jwt jwt) {
		return propertyService.list(CurrentUser.id(jwt));
	}

	@GetMapping("/{propertyId}")
	public PropertyResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable long propertyId) {
		return propertyService.get(CurrentUser.id(jwt), propertyId);
	}

	@PatchMapping("/{propertyId}")
	public PropertyResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable long propertyId,
			@Valid @RequestBody PropertyUpdateRequest request) {
		return propertyService.update(CurrentUser.id(jwt), propertyId, request);
	}

	@DeleteMapping("/{propertyId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable long propertyId) {
		propertyService.delete(CurrentUser.id(jwt), propertyId);
	}

}
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `./mvnw -q test`
Expected: PASS (34 tests).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: owner-scoped property CRUD"
```

---

### Task 5: Ledger — incomes and expenses under a property

**Files:**
- Create: `src/main/java/com/sebpostigo/rental/ledger/Income.java`, `Expense.java`, `ExpenseCategory.java`, `ExpenseCategoryConverter.java`, `IncomeRepository.java`, `ExpenseRepository.java`, `LedgerService.java`, `IncomeController.java`, `ExpenseController.java`, `IncomeRequest.java`, `IncomeResponse.java`, `ExpenseRequest.java`, `ExpenseResponse.java`
- Modify: `src/test/java/com/sebpostigo/rental/IntegrationTest.java` (add `addIncome`, `addExpense`)
- Test: `src/test/java/com/sebpostigo/rental/ledger/LedgerControllerTest.java`

**Interfaces:**
- Consumes: `PropertyService.requireOwned(long ownerId, long propertyId)`, `NotFoundException`, `CurrentUser.id`, `IntegrationTest.signUp/createProperty`.
- Produces:
  - Entities `Income(Long propertyId, LocalDate date, BigDecimal amount, String source, String notes)` and `Expense(Long propertyId, LocalDate date, BigDecimal amount, ExpenseCategory category, String notes)` with getters.
  - `enum ExpenseCategory { CLEANING, MAINTENANCE, COMMISSION, OTHER }` with `value() : String` (lowercase) and `fromValue(String)`.
  - `IncomeRepository`, `ExpenseRepository` (`JpaRepository<…, Long>`).
  - `IntegrationTest.addIncome(Cookie, long propertyId, String date, String amount, String source)` and `addExpense(Cookie, long propertyId, String date, String amount, String category)`.

- [ ] **Step 1: Add ledger helpers to `IntegrationTest`**

Add below `createProperty`:

```java
	protected void addIncome(Cookie owner, long propertyId, String date, String amount, String source)
			throws Exception {
		mvc.perform(post("/properties/{id}/incomes", propertyId).cookie(owner)
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"date\":\"%s\",\"amount\":%s,\"source\":\"%s\"}".formatted(date, amount, source)))
			.andExpect(status().isCreated());
	}

	protected void addExpense(Cookie owner, long propertyId, String date, String amount, String category)
			throws Exception {
		mvc.perform(post("/properties/{id}/expenses", propertyId).cookie(owner)
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"date\":\"%s\",\"amount\":%s,\"category\":\"%s\"}".formatted(date, amount, category)))
			.andExpect(status().isCreated());
	}
```

- [ ] **Step 2: Write the failing ledger tests**

`src/test/java/com/sebpostigo/rental/ledger/LedgerControllerTest.java`:

```java
package com.sebpostigo.rental.ledger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.allOf;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.sebpostigo.rental.IntegrationTest;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

class LedgerControllerTest extends IntegrationTest {

	private static String incomeJson(String date, String amount, String source) {
		return "{\"date\":\"%s\",\"amount\":%s,\"source\":\"%s\"}".formatted(date, amount, source);
	}

	@Test
	void createIncomeRequiresAuth() throws Exception {
		mvc.perform(post("/properties/{id}/incomes", 1).contentType(MediaType.APPLICATION_JSON)
			.content(incomeJson("2026-06-01", "1200", "Rent")))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void createIncomeReturnsCreatedIncome() throws Exception {
		Cookie ana = signUp("ana@example.com");
		long casa = createProperty(ana, "Casa Sol");

		mvc.perform(post("/properties/{id}/incomes", casa).cookie(ana)
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"date\":\"2026-06-01\",\"amount\":1200.5,\"source\":\"Rent\",\"notes\":\"June\"}"))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.id").isNumber())
			.andExpect(jsonPath("$.date").value("2026-06-01"))
			.andExpect(jsonPath("$.amount").value(1200.5))
			.andExpect(jsonPath("$.source").value("Rent"))
			.andExpect(jsonPath("$.notes").value("June"));
	}

	@Test
	void createIncomeOnOtherUsersPropertyReturns404() throws Exception {
		Cookie ana = signUp("ana@example.com");
		Cookie ben = signUp("ben@example.com");
		long casa = createProperty(ana, "Casa Sol");

		mvc.perform(post("/properties/{id}/incomes", casa).cookie(ben)
			.contentType(MediaType.APPLICATION_JSON)
			.content(incomeJson("2026-06-01", "1200", "Rent")))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.detail").value("Property not found"));
	}

	@Test
	void listIncomeFiltersByDateRangeInclusiveAndOrdersByDate() throws Exception {
		Cookie ana = signUp("ana@example.com");
		long casa = createProperty(ana, "Casa Sol");
		addIncome(ana, casa, "2026-08-01", "1200", "Rent");
		addIncome(ana, casa, "2026-06-01", "1200", "Rent");
		addIncome(ana, casa, "2026-07-01", "1200", "Rent");

		mvc.perform(get("/properties/{id}/incomes", casa).cookie(ana)
			.param("start_date", "2026-07-01")
			.param("end_date", "2026-08-01"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.length()").value(2))
			.andExpect(jsonPath("$[0].date").value("2026-07-01"))
			.andExpect(jsonPath("$[1].date").value("2026-08-01"));
	}

	@Test
	void deleteIncome() throws Exception {
		Cookie ana = signUp("ana@example.com");
		long casa = createProperty(ana, "Casa Sol");
		String body = mvc.perform(post("/properties/{id}/incomes", casa).cookie(ana)
			.contentType(MediaType.APPLICATION_JSON)
			.content(incomeJson("2026-06-01", "1200", "Rent")))
			.andReturn()
			.getResponse()
			.getContentAsString();
		long incomeId = ((Number) JsonPath.read(body, "$.id")).longValue();

		mvc.perform(delete("/properties/{id}/incomes/{incomeId}", casa, incomeId).cookie(ana))
			.andExpect(status().isNoContent());

		mvc.perform(get("/properties/{id}/incomes", casa).cookie(ana)).andExpect(jsonPath("$.length()").value(0));
		mvc.perform(delete("/properties/{id}/incomes/{incomeId}", casa, incomeId).cookie(ana))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.detail").value("Income not found"));
	}

	@Test
	void createExpenseReturnsCreatedExpense() throws Exception {
		Cookie ana = signUp("ana@example.com");
		long casa = createProperty(ana, "Casa Sol");

		mvc.perform(post("/properties/{id}/expenses", casa).cookie(ana)
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"date\":\"2026-06-05\",\"amount\":80,\"category\":\"maintenance\"}"))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.category").value("maintenance"))
			.andExpect(jsonPath("$.amount").value(80.0));
	}

	@Test
	void createExpenseRejectsInvalidCategory() throws Exception {
		Cookie ana = signUp("ana@example.com");
		long casa = createProperty(ana, "Casa Sol");

		mvc.perform(post("/properties/{id}/expenses", casa).cookie(ana)
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"date\":\"2026-06-05\",\"amount\":80,\"category\":\"Utilities\"}"))
			.andExpect(status().is(422))
			.andExpect(jsonPath("$.detail").value(containsString("category")));
	}

	@Test
	void listExpensesFiltersByDateRange() throws Exception {
		Cookie ana = signUp("ana@example.com");
		long casa = createProperty(ana, "Casa Sol");
		addExpense(ana, casa, "2026-06-05", "80", "other");
		addExpense(ana, casa, "2026-07-05", "95", "other");

		mvc.perform(get("/properties/{id}/expenses", casa).cookie(ana).param("start_date", "2026-07-01"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.length()").value(1))
			.andExpect(jsonPath("$[0].date").value("2026-07-05"));
	}

	@Test
	void expenseOnOtherUsersPropertyReturns404() throws Exception {
		Cookie ana = signUp("ana@example.com");
		Cookie ben = signUp("ben@example.com");
		long casa = createProperty(ana, "Casa Sol");

		mvc.perform(get("/properties/{id}/expenses", casa).cookie(ben)).andExpect(status().isNotFound());
	}

	@Test
	void deleteExpense() throws Exception {
		Cookie ana = signUp("ana@example.com");
		long casa = createProperty(ana, "Casa Sol");
		String body = mvc.perform(post("/properties/{id}/expenses", casa).cookie(ana)
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"date\":\"2026-06-05\",\"amount\":80,\"category\":\"other\"}"))
			.andReturn()
			.getResponse()
			.getContentAsString();
		long expenseId = ((Number) JsonPath.read(body, "$.id")).longValue();

		mvc.perform(delete("/properties/{id}/expenses/{expenseId}", casa, expenseId).cookie(ana))
			.andExpect(status().isNoContent());

		mvc.perform(get("/properties/{id}/expenses", casa).cookie(ana)).andExpect(jsonPath("$.length()").value(0));
	}

	@Test
	void deletingAPropertyDeletesItsLedgerEntries() throws Exception {
		Cookie ana = signUp("ana@example.com");
		long casa = createProperty(ana, "Casa Sol");
		addIncome(ana, casa, "2026-06-01", "1200", "Rent");
		addExpense(ana, casa, "2026-06-05", "80", "other");

		mvc.perform(delete("/properties/{id}", casa).cookie(ana)).andExpect(status().isNoContent());

		long remaining = jdbc.sql("select (select count(*) from incomes) + (select count(*) from expenses)")
			.query(Long.class)
			.single();
		assertThat(remaining).isZero();
	}

	@Test
	void validationErrorsAre422WithAReadableDetail() throws Exception {
		Cookie ana = signUp("ana@example.com");
		long casa = createProperty(ana, "Casa Sol");

		mvc.perform(post("/properties/{id}/incomes", casa).cookie(ana)
			.contentType(MediaType.APPLICATION_JSON)
			.content(incomeJson("2026-06-01", "-5", "")))
			.andExpect(status().is(422))
			.andExpect(jsonPath("$.detail").value(allOf(containsString("amount:"), containsString("source:"))));
	}

	@Test
	void amountsThatDoNotFitNumeric10Point2AreRejected() throws Exception {
		Cookie ana = signUp("ana@example.com");
		long casa = createProperty(ana, "Casa Sol");

		mvc.perform(post("/properties/{id}/incomes", casa).cookie(ana)
			.contentType(MediaType.APPLICATION_JSON)
			.content(incomeJson("2026-06-01", "12.345", "Rent")))
			.andExpect(status().is(422));
		mvc.perform(post("/properties/{id}/incomes", casa).cookie(ana)
			.contentType(MediaType.APPLICATION_JSON)
			.content(incomeJson("2026-06-01", "100000000", "Rent")))
			.andExpect(status().is(422));
	}

}
```

- [ ] **Step 3: Run them and watch them fail**

Run: `./mvnw -q test -Dtest=LedgerControllerTest`
Expected: FAIL — e.g. `createIncomeReturnsCreatedIncome`: `Status expected:<201> but was:<404>`.

- [ ] **Step 4: Write the `ledger` package**

`src/main/java/com/sebpostigo/rental/ledger/ExpenseCategory.java`:

```java
package com.sebpostigo.rental.ledger;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Locale;

public enum ExpenseCategory {

	CLEANING, MAINTENANCE, COMMISSION, OTHER;

	/** Lowercase on the wire and in the database, as in the FastAPI version. */
	@JsonValue
	public String value() {
		return name().toLowerCase(Locale.ROOT);
	}

	@JsonCreator(mode = JsonCreator.Mode.DELEGATING)
	public static ExpenseCategory fromValue(String value) {
		for (ExpenseCategory category : values()) {
			if (category.value().equals(value)) {
				return category;
			}
		}
		throw new IllegalArgumentException("category: must be one of cleaning, maintenance, commission, other");
	}

}
```

`src/main/java/com/sebpostigo/rental/ledger/ExpenseCategoryConverter.java`:

```java
package com.sebpostigo.rental.ledger;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class ExpenseCategoryConverter implements AttributeConverter<ExpenseCategory, String> {

	@Override
	public String convertToDatabaseColumn(ExpenseCategory category) {
		return category == null ? null : category.value();
	}

	@Override
	public ExpenseCategory convertToEntityAttribute(String value) {
		return value == null ? null : ExpenseCategory.fromValue(value);
	}

}
```

`src/main/java/com/sebpostigo/rental/ledger/Income.java`:

```java
package com.sebpostigo.rental.ledger;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "incomes")
public class Income {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false)
	private Long propertyId;

	@Column(nullable = false)
	private LocalDate date;

	@Column(nullable = false, precision = 10, scale = 2)
	private BigDecimal amount;

	@Column(nullable = false)
	private String source;

	private String notes;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	protected Income() {
	}

	public Income(Long propertyId, LocalDate date, BigDecimal amount, String source, String notes) {
		this.propertyId = propertyId;
		this.date = date;
		this.amount = amount;
		this.source = source;
		this.notes = notes;
	}

	public Long getId() {
		return id;
	}

	public LocalDate getDate() {
		return date;
	}

	public BigDecimal getAmount() {
		return amount;
	}

	public String getSource() {
		return source;
	}

	public String getNotes() {
		return notes;
	}

}
```

`src/main/java/com/sebpostigo/rental/ledger/Expense.java`:

```java
package com.sebpostigo.rental.ledger;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "expenses")
public class Expense {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false)
	private Long propertyId;

	@Column(nullable = false)
	private LocalDate date;

	@Column(nullable = false, precision = 10, scale = 2)
	private BigDecimal amount;

	@Column(nullable = false)
	private ExpenseCategory category;

	private String notes;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	protected Expense() {
	}

	public Expense(Long propertyId, LocalDate date, BigDecimal amount, ExpenseCategory category, String notes) {
		this.propertyId = propertyId;
		this.date = date;
		this.amount = amount;
		this.category = category;
		this.notes = notes;
	}

	public Long getId() {
		return id;
	}

	public LocalDate getDate() {
		return date;
	}

	public BigDecimal getAmount() {
		return amount;
	}

	public ExpenseCategory getCategory() {
		return category;
	}

	public String getNotes() {
		return notes;
	}

}
```

`src/main/java/com/sebpostigo/rental/ledger/IncomeRepository.java`:

```java
package com.sebpostigo.rental.ledger;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IncomeRepository extends JpaRepository<Income, Long> {

	List<Income> findByPropertyIdAndDateBetweenOrderByDateAscIdAsc(Long propertyId, LocalDate start, LocalDate end);

	Optional<Income> findByIdAndPropertyId(Long id, Long propertyId);

}
```

`src/main/java/com/sebpostigo/rental/ledger/ExpenseRepository.java`:

```java
package com.sebpostigo.rental.ledger;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExpenseRepository extends JpaRepository<Expense, Long> {

	List<Expense> findByPropertyIdAndDateBetweenOrderByDateAscIdAsc(Long propertyId, LocalDate start, LocalDate end);

	Optional<Expense> findByIdAndPropertyId(Long id, Long propertyId);

}
```

`src/main/java/com/sebpostigo/rental/ledger/IncomeRequest.java`:

```java
package com.sebpostigo.rental.ledger;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

public record IncomeRequest(
		@NotNull LocalDate date,
		@NotNull @DecimalMin("0") @Digits(integer = 8, fraction = 2) BigDecimal amount,
		@NotBlank @Size(max = 200) String source,
		@Size(max = 1000) String notes) {
}
```

`src/main/java/com/sebpostigo/rental/ledger/IncomeResponse.java`:

```java
package com.sebpostigo.rental.ledger;

import java.math.BigDecimal;
import java.time.LocalDate;

public record IncomeResponse(long id, LocalDate date, BigDecimal amount, String source, String notes) {

	static IncomeResponse from(Income income) {
		return new IncomeResponse(income.getId(), income.getDate(), income.getAmount(), income.getSource(),
				income.getNotes());
	}

}
```

`src/main/java/com/sebpostigo/rental/ledger/ExpenseRequest.java`:

```java
package com.sebpostigo.rental.ledger;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

public record ExpenseRequest(
		@NotNull LocalDate date,
		@NotNull @DecimalMin("0") @Digits(integer = 8, fraction = 2) BigDecimal amount,
		@NotNull ExpenseCategory category,
		@Size(max = 1000) String notes) {
}
```

`src/main/java/com/sebpostigo/rental/ledger/ExpenseResponse.java`:

```java
package com.sebpostigo.rental.ledger;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ExpenseResponse(long id, LocalDate date, BigDecimal amount, ExpenseCategory category, String notes) {

	static ExpenseResponse from(Expense expense) {
		return new ExpenseResponse(expense.getId(), expense.getDate(), expense.getAmount(), expense.getCategory(),
				expense.getNotes());
	}

}
```

`src/main/java/com/sebpostigo/rental/ledger/LedgerService.java`:

```java
package com.sebpostigo.rental.ledger;

import com.sebpostigo.rental.common.NotFoundException;
import com.sebpostigo.rental.property.PropertyService;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class LedgerService {

	// Open-ended filters become Postgres' own date bounds, so one derived query covers every case.
	private static final LocalDate EARLIEST = LocalDate.of(1, 1, 1);

	private static final LocalDate LATEST = LocalDate.of(9999, 12, 31);

	private final PropertyService propertyService;

	private final IncomeRepository incomes;

	private final ExpenseRepository expenses;

	public LedgerService(PropertyService propertyService, IncomeRepository incomes, ExpenseRepository expenses) {
		this.propertyService = propertyService;
		this.incomes = incomes;
		this.expenses = expenses;
	}

	@Transactional
	public IncomeResponse createIncome(long ownerId, long propertyId, IncomeRequest request) {
		propertyService.requireOwned(ownerId, propertyId);
		Income income = new Income(propertyId, request.date(), request.amount(), request.source(), request.notes());
		return IncomeResponse.from(incomes.save(income));
	}

	public List<IncomeResponse> listIncomes(long ownerId, long propertyId, LocalDate start, LocalDate end) {
		propertyService.requireOwned(ownerId, propertyId);
		return incomes
			.findByPropertyIdAndDateBetweenOrderByDateAscIdAsc(propertyId, Objects.requireNonNullElse(start, EARLIEST),
					Objects.requireNonNullElse(end, LATEST))
			.stream()
			.map(IncomeResponse::from)
			.toList();
	}

	@Transactional
	public void deleteIncome(long ownerId, long propertyId, long incomeId) {
		propertyService.requireOwned(ownerId, propertyId);
		Income income = incomes.findByIdAndPropertyId(incomeId, propertyId)
			.orElseThrow(() -> new NotFoundException("Income not found"));
		incomes.delete(income);
	}

	@Transactional
	public ExpenseResponse createExpense(long ownerId, long propertyId, ExpenseRequest request) {
		propertyService.requireOwned(ownerId, propertyId);
		Expense expense = new Expense(propertyId, request.date(), request.amount(), request.category(),
				request.notes());
		return ExpenseResponse.from(expenses.save(expense));
	}

	public List<ExpenseResponse> listExpenses(long ownerId, long propertyId, LocalDate start, LocalDate end) {
		propertyService.requireOwned(ownerId, propertyId);
		return expenses
			.findByPropertyIdAndDateBetweenOrderByDateAscIdAsc(propertyId, Objects.requireNonNullElse(start, EARLIEST),
					Objects.requireNonNullElse(end, LATEST))
			.stream()
			.map(ExpenseResponse::from)
			.toList();
	}

	@Transactional
	public void deleteExpense(long ownerId, long propertyId, long expenseId) {
		propertyService.requireOwned(ownerId, propertyId);
		Expense expense = expenses.findByIdAndPropertyId(expenseId, propertyId)
			.orElseThrow(() -> new NotFoundException("Expense not found"));
		expenses.delete(expense);
	}

}
```

`src/main/java/com/sebpostigo/rental/ledger/IncomeController.java`:

```java
package com.sebpostigo.rental.ledger;

import com.sebpostigo.rental.security.CurrentUser;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/properties/{propertyId}/incomes")
public class IncomeController {

	private final LedgerService ledgerService;

	public IncomeController(LedgerService ledgerService) {
		this.ledgerService = ledgerService;
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public IncomeResponse create(@AuthenticationPrincipal Jwt jwt, @PathVariable long propertyId,
			@Valid @RequestBody IncomeRequest request) {
		return ledgerService.createIncome(CurrentUser.id(jwt), propertyId, request);
	}

	@GetMapping
	public List<IncomeResponse> list(@AuthenticationPrincipal Jwt jwt, @PathVariable long propertyId,
			@RequestParam(name = "start_date", required = false) LocalDate startDate,
			@RequestParam(name = "end_date", required = false) LocalDate endDate) {
		return ledgerService.listIncomes(CurrentUser.id(jwt), propertyId, startDate, endDate);
	}

	@DeleteMapping("/{incomeId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable long propertyId, @PathVariable long incomeId) {
		ledgerService.deleteIncome(CurrentUser.id(jwt), propertyId, incomeId);
	}

}
```

`src/main/java/com/sebpostigo/rental/ledger/ExpenseController.java`:

```java
package com.sebpostigo.rental.ledger;

import com.sebpostigo.rental.security.CurrentUser;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/properties/{propertyId}/expenses")
public class ExpenseController {

	private final LedgerService ledgerService;

	public ExpenseController(LedgerService ledgerService) {
		this.ledgerService = ledgerService;
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public ExpenseResponse create(@AuthenticationPrincipal Jwt jwt, @PathVariable long propertyId,
			@Valid @RequestBody ExpenseRequest request) {
		return ledgerService.createExpense(CurrentUser.id(jwt), propertyId, request);
	}

	@GetMapping
	public List<ExpenseResponse> list(@AuthenticationPrincipal Jwt jwt, @PathVariable long propertyId,
			@RequestParam(name = "start_date", required = false) LocalDate startDate,
			@RequestParam(name = "end_date", required = false) LocalDate endDate) {
		return ledgerService.listExpenses(CurrentUser.id(jwt), propertyId, startDate, endDate);
	}

	@DeleteMapping("/{expenseId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable long propertyId, @PathVariable long expenseId) {
		ledgerService.deleteExpense(CurrentUser.id(jwt), propertyId, expenseId);
	}

}
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `./mvnw -q test`
Expected: PASS (47 tests). If `createExpenseRejectsInvalidCategory` fails with detail `"Malformed request body"`, Jackson wrapped the creator's `IllegalArgumentException` differently: debug by printing `NestedExceptionUtils.getMostSpecificCause(ex).getClass()` in `handleHttpMessageNotReadable` and match that type too — do not loosen the test.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: incomes and expenses nested under properties"
```

---

### Task 6: Reports — summary, monthly timeseries, CSV export

**Files:**
- Create: `src/main/java/com/sebpostigo/rental/report/ReportFilter.java`, `ReportRepository.java`, `ReportService.java`, `ReportController.java`, `SummaryResponse.java`, `TimeseriesPoint.java`, `TransactionRow.java`
- Test: `src/test/java/com/sebpostigo/rental/report/ReportControllerTest.java`

**Interfaces:**
- Consumes: `PropertyService.requireOwned`, `CurrentUser.id`, `IntegrationTest.signUp/createProperty/addIncome/addExpense`.
- Produces: `GET /reports/summary|timeseries|export` per the spec's contract table.

- [ ] **Step 1: Write the failing report tests**

`src/test/java/com/sebpostigo/rental/report/ReportControllerTest.java`:

```java
package com.sebpostigo.rental.report;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.sebpostigo.rental.IntegrationTest;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ReportControllerTest extends IntegrationTest {

	private Cookie ana;

	private long casa;

	private long depa;

	@BeforeEach
	void seedLedger() throws Exception {
		ana = signUp("ana@example.com");
		casa = createProperty(ana, "Casa Sol");
		depa = createProperty(ana, "Depa Luna");
		addIncome(ana, casa, "2026-06-01", "1000.00", "Rent");
		addIncome(ana, casa, "2026-06-15", "200.00", "Parking");
		addIncome(ana, depa, "2026-07-01", "500.00", "Rent");
		addExpense(ana, casa, "2026-07-10", "100.00", "maintenance");
	}

	@Test
	void summaryReturnsTotalsAndNetBalance() throws Exception {
		mvc.perform(get("/reports/summary").cookie(ana))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.total_income").value(1700.0))
			.andExpect(jsonPath("$.total_expenses").value(100.0))
			.andExpect(jsonPath("$.net_balance").value(1600.0));
	}

	@Test
	void summaryFiltersByDateRange() throws Exception {
		mvc.perform(get("/reports/summary").cookie(ana).param("start_date", "2026-06-10").param("end_date", "2026-06-30"))
			.andExpect(jsonPath("$.total_income").value(200.0))
			.andExpect(jsonPath("$.total_expenses").value(0.0));
	}

	@Test
	void summaryFiltersByProperty() throws Exception {
		mvc.perform(get("/reports/summary").cookie(ana).param("property_id", String.valueOf(depa)))
			.andExpect(jsonPath("$.total_income").value(500.0))
			.andExpect(jsonPath("$.total_expenses").value(0.0));
	}

	@Test
	void summaryExcludesOtherUsersData() throws Exception {
		Cookie ben = signUp("ben@example.com");
		long benHouse = createProperty(ben, "Ben House");
		addIncome(ben, benHouse, "2026-06-01", "9999.00", "Rent");

		mvc.perform(get("/reports/summary").cookie(ana)).andExpect(jsonPath("$.total_income").value(1700.0));
	}

	@Test
	void summaryWithNoDataReturnsZeros() throws Exception {
		Cookie ben = signUp("ben@example.com");

		mvc.perform(get("/reports/summary").cookie(ben))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.total_income").value(0.0))
			.andExpect(jsonPath("$.total_expenses").value(0.0))
			.andExpect(jsonPath("$.net_balance").value(0.0));
	}

	@Test
	void summaryRejectsOtherUsersPropertyFilter() throws Exception {
		Cookie ben = signUp("ben@example.com");

		mvc.perform(get("/reports/summary").cookie(ben).param("property_id", String.valueOf(casa)))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.detail").value("Property not found"));
	}

	@Test
	void timeseriesGroupsByMonth() throws Exception {
		mvc.perform(get("/reports/timeseries").cookie(ana))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.length()").value(2))
			.andExpect(jsonPath("$[0].period").value("2026-06"))
			.andExpect(jsonPath("$[0].income").value(1200.0))
			.andExpect(jsonPath("$[0].expenses").value(0.0))
			.andExpect(jsonPath("$[1].period").value("2026-07"))
			.andExpect(jsonPath("$[1].income").value(500.0))
			.andExpect(jsonPath("$[1].expenses").value(100.0));
	}

	@Test
	void exportCsvReturnsCombinedTransactionsSortedByDate() throws Exception {
		String csv = mvc.perform(get("/reports/export").cookie(ana))
			.andExpect(status().isOk())
			.andExpect(content().contentTypeCompatibleWith("text/csv"))
			.andExpect(header().string("Content-Disposition", "attachment; filename=transactions.csv"))
			.andReturn()
			.getResponse()
			.getContentAsString();

		assertThat(csv.split("\r\n")).containsExactly("type,date,amount,description",
				"income,2026-06-01,1000.00,Rent", "income,2026-06-15,200.00,Parking",
				"income,2026-07-01,500.00,Rent", "expense,2026-07-10,100.00,maintenance");
	}

	@Test
	void exportCsvQuotesDescriptionsContainingCommas() throws Exception {
		addIncome(ana, casa, "2026-08-01", "10.00", "Rent, June");

		mvc.perform(get("/reports/export").cookie(ana))
			.andExpect(content().string(containsString("income,2026-08-01,10.00,\"Rent, June\"\r\n")));
	}

	@Test
	void malformedQueryParametersAre422() throws Exception {
		mvc.perform(get("/reports/summary").cookie(ana).param("start_date", "junk"))
			.andExpect(status().is(422))
			.andExpect(jsonPath("$.detail").value("start_date: invalid value"));
		mvc.perform(get("/reports/summary").cookie(ana).param("property_id", "abc"))
			.andExpect(status().is(422))
			.andExpect(jsonPath("$.detail").value("property_id: invalid value"));
	}

}
```

- [ ] **Step 2: Run them and watch them fail**

Run: `./mvnw -q test -Dtest=ReportControllerTest`
Expected: FAIL — `Status expected:<200> but was:<404>` on `/reports/summary`.

- [ ] **Step 3: Write the `report` package**

`src/main/java/com/sebpostigo/rental/report/SummaryResponse.java`:

```java
package com.sebpostigo.rental.report;

import java.math.BigDecimal;

public record SummaryResponse(BigDecimal totalIncome, BigDecimal totalExpenses, BigDecimal netBalance) {
}
```

`src/main/java/com/sebpostigo/rental/report/TimeseriesPoint.java`:

```java
package com.sebpostigo.rental.report;

import java.math.BigDecimal;

public record TimeseriesPoint(String period, BigDecimal income, BigDecimal expenses) {
}
```

`src/main/java/com/sebpostigo/rental/report/TransactionRow.java`:

```java
package com.sebpostigo.rental.report;

import java.math.BigDecimal;
import java.time.LocalDate;

record TransactionRow(String type, LocalDate date, BigDecimal amount, String description) {
}
```

`src/main/java/com/sebpostigo/rental/report/ReportFilter.java`:

```java
package com.sebpostigo.rental.report;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

/**
 * The owner scope plus optional filters. Conditions are added only when a filter is present,
 * so no untyped null parameters ever reach Postgres.
 */
record ReportFilter(long ownerId, Long propertyId, LocalDate start, LocalDate end) {

	/** SQL condition for a ledger table aliased {@code alias}, joined to properties as {@code p}. */
	String where(String alias) {
		StringBuilder sql = new StringBuilder("p.owner_id = :ownerId");
		if (propertyId != null) {
			sql.append(" and ").append(alias).append(".property_id = :propertyId");
		}
		if (start != null) {
			sql.append(" and ").append(alias).append(".date >= :start");
		}
		if (end != null) {
			sql.append(" and ").append(alias).append(".date <= :end");
		}
		return sql.toString();
	}

	Map<String, Object> params() {
		Map<String, Object> params = new HashMap<>();
		params.put("ownerId", ownerId);
		if (propertyId != null) {
			params.put("propertyId", propertyId);
		}
		if (start != null) {
			params.put("start", start);
		}
		if (end != null) {
			params.put("end", end);
		}
		return params;
	}

}
```

`src/main/java/com/sebpostigo/rental/report/ReportRepository.java`:

```java
package com.sebpostigo.rental.report;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Read-side SQL: reports aggregate in the database instead of loading every row. */
@Repository
class ReportRepository {

	private final JdbcClient jdbc;

	ReportRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	BigDecimal totalIncome(ReportFilter filter) {
		return total("incomes", filter);
	}

	BigDecimal totalExpenses(ReportFilter filter) {
		return total("expenses", filter);
	}

	// table is always one of the two constants above, never user input.
	private BigDecimal total(String table, ReportFilter filter) {
		String sql = "select coalesce(sum(t.amount), 0) from " + table
				+ " t join properties p on p.id = t.property_id where " + filter.where("t");
		return jdbc.sql(sql).params(filter.params()).query(BigDecimal.class).single();
	}

	List<TimeseriesPoint> timeseries(ReportFilter filter) {
		String sql = """
				select period, sum(income) as income, sum(expenses) as expenses
				from (
				    select to_char(t.date, 'YYYY-MM') as period, t.amount as income, 0::numeric as expenses
				    from incomes t join properties p on p.id = t.property_id
				    where %1$s
				    union all
				    select to_char(t.date, 'YYYY-MM'), 0::numeric, t.amount
				    from expenses t join properties p on p.id = t.property_id
				    where %1$s
				) months
				group by period
				order by period
				""".formatted(filter.where("t"));
		return jdbc.sql(sql)
			.params(filter.params())
			.query((rs, rowNum) -> new TimeseriesPoint(rs.getString("period"), rs.getBigDecimal("income"),
					rs.getBigDecimal("expenses")))
			.list();
	}

	List<TransactionRow> transactions(ReportFilter filter) {
		String sql = """
				select 'income' as type, t.date, t.amount, t.source as description, 0 as kind
				from incomes t join properties p on p.id = t.property_id
				where %1$s
				union all
				select 'expense', t.date, t.amount, t.category, 1
				from expenses t join properties p on p.id = t.property_id
				where %1$s
				order by date, kind
				""".formatted(filter.where("t"));
		return jdbc.sql(sql)
			.params(filter.params())
			.query((rs, rowNum) -> new TransactionRow(rs.getString("type"), rs.getObject("date", LocalDate.class),
					rs.getBigDecimal("amount"), rs.getString("description")))
			.list();
	}

}
```

`src/main/java/com/sebpostigo/rental/report/ReportService.java`:

```java
package com.sebpostigo.rental.report;

import com.sebpostigo.rental.property.PropertyService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ReportService {

	private final PropertyService propertyService;

	private final ReportRepository reports;

	public ReportService(PropertyService propertyService, ReportRepository reports) {
		this.propertyService = propertyService;
		this.reports = reports;
	}

	public SummaryResponse summary(long ownerId, Long propertyId, LocalDate start, LocalDate end) {
		ReportFilter filter = filter(ownerId, propertyId, start, end);
		BigDecimal income = reports.totalIncome(filter);
		BigDecimal expenses = reports.totalExpenses(filter);
		return new SummaryResponse(income, expenses, income.subtract(expenses));
	}

	public List<TimeseriesPoint> timeseries(long ownerId, Long propertyId, LocalDate start, LocalDate end) {
		return reports.timeseries(filter(ownerId, propertyId, start, end));
	}

	public String exportCsv(long ownerId, Long propertyId, LocalDate start, LocalDate end) {
		StringBuilder csv = new StringBuilder("type,date,amount,description\r\n");
		for (TransactionRow row : reports.transactions(filter(ownerId, propertyId, start, end))) {
			csv.append(row.type())
				.append(',')
				.append(row.date())
				.append(',')
				.append(row.amount().toPlainString())
				.append(',')
				.append(csvField(row.description()))
				.append("\r\n");
		}
		return csv.toString();
	}

	private ReportFilter filter(long ownerId, Long propertyId, LocalDate start, LocalDate end) {
		if (propertyId != null) {
			propertyService.requireOwned(ownerId, propertyId);
		}
		return new ReportFilter(ownerId, propertyId, start, end);
	}

	/** RFC 4180 quoting, same as Python's csv.writer. */
	static String csvField(String value) {
		if (value == null) {
			return "";
		}
		if (value.contains(",") || value.contains("\"") || value.contains("\n") || value.contains("\r")) {
			return "\"" + value.replace("\"", "\"\"") + "\"";
		}
		return value;
	}

}
```

`src/main/java/com/sebpostigo/rental/report/ReportController.java`:

```java
package com.sebpostigo.rental.report;

import com.sebpostigo.rental.security.CurrentUser;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/reports")
public class ReportController {

	private static final MediaType TEXT_CSV = new MediaType("text", "csv", StandardCharsets.UTF_8);

	private final ReportService reportService;

	public ReportController(ReportService reportService) {
		this.reportService = reportService;
	}

	@GetMapping("/summary")
	public SummaryResponse summary(@AuthenticationPrincipal Jwt jwt,
			@RequestParam(name = "start_date", required = false) LocalDate startDate,
			@RequestParam(name = "end_date", required = false) LocalDate endDate,
			@RequestParam(name = "property_id", required = false) Long propertyId) {
		return reportService.summary(CurrentUser.id(jwt), propertyId, startDate, endDate);
	}

	@GetMapping("/timeseries")
	public List<TimeseriesPoint> timeseries(@AuthenticationPrincipal Jwt jwt,
			@RequestParam(name = "start_date", required = false) LocalDate startDate,
			@RequestParam(name = "end_date", required = false) LocalDate endDate,
			@RequestParam(name = "property_id", required = false) Long propertyId) {
		return reportService.timeseries(CurrentUser.id(jwt), propertyId, startDate, endDate);
	}

	@GetMapping("/export")
	public ResponseEntity<String> export(@AuthenticationPrincipal Jwt jwt,
			@RequestParam(name = "start_date", required = false) LocalDate startDate,
			@RequestParam(name = "end_date", required = false) LocalDate endDate,
			@RequestParam(name = "property_id", required = false) Long propertyId) {
		String csv = reportService.exportCsv(CurrentUser.id(jwt), propertyId, startDate, endDate);
		return ResponseEntity.ok()
			.contentType(TEXT_CSV)
			.header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=transactions.csv")
			.body(csv);
	}

}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `./mvnw -q test`
Expected: PASS (57 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: summary, monthly timeseries and CSV export aggregated in SQL"
```

---

### Task 7: Swagger UI and the self-resetting demo account

**Files:**
- Create: `src/main/java/com/sebpostigo/rental/common/OpenApiConfig.java`
- Create: `src/main/java/com/sebpostigo/rental/demo/DemoDataSeeder.java`
- Modify: `src/main/java/com/sebpostigo/rental/property/PropertyRepository.java` (add `deleteByOwnerId`)
- Test: `src/test/java/com/sebpostigo/rental/OpenApiTest.java`, `src/test/java/com/sebpostigo/rental/demo/DemoDataSeederTest.java`

**Interfaces:**
- Consumes: `User`, `UserRepository`, `Property`, `PropertyRepository`, `Income`, `IncomeRepository`, `Expense`, `ExpenseRepository`, `ExpenseCategory`, `PasswordEncoder`, `Clock`.
- Produces: `DemoDataSeeder(UserRepository, PropertyRepository, IncomeRepository, ExpenseRepository, PasswordEncoder, Clock)` with `seed()`, constants `EMAIL`, `PASSWORD`; `PropertyRepository.deleteByOwnerId(Long)`.

- [ ] **Step 1: Write the failing tests**

`src/test/java/com/sebpostigo/rental/OpenApiTest.java`:

```java
package com.sebpostigo.rental;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;

class OpenApiTest extends IntegrationTest {

	@Test
	void apiDocsArePublicAndDescribeTheApi() throws Exception {
		mvc.perform(get("/v3/api-docs"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.info.title").value("Rental Dashboard API"))
			.andExpect(jsonPath("$.paths['/reports/summary']").exists());
	}

}
```

`src/test/java/com/sebpostigo/rental/demo/DemoDataSeederTest.java`:

```java
package com.sebpostigo.rental.demo;

import static org.hamcrest.Matchers.contains;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.sebpostigo.rental.IntegrationTest;
import com.sebpostigo.rental.auth.UserRepository;
import com.sebpostigo.rental.ledger.ExpenseRepository;
import com.sebpostigo.rental.ledger.IncomeRepository;
import com.sebpostigo.rental.property.PropertyRepository;
import jakarta.servlet.http.Cookie;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;

class DemoDataSeederTest extends IntegrationTest {

	@Autowired
	private UserRepository users;

	@Autowired
	private PropertyRepository properties;

	@Autowired
	private IncomeRepository incomes;

	@Autowired
	private ExpenseRepository expenses;

	@Autowired
	private PasswordEncoder passwordEncoder;

	private DemoDataSeeder seederOn(String isoDate) {
		Clock clock = Clock.fixed(Instant.parse(isoDate + "T12:00:00Z"), ZoneOffset.UTC);
		return new DemoDataSeeder(users, properties, incomes, expenses, passwordEncoder, clock);
	}

	@Test
	void seedingTwiceLeavesOneFreshDemoDatasetForTheLastThreeMonths() throws Exception {
		seederOn("2026-09-15").seed();
		seederOn("2026-09-15").seed();

		Cookie demo = login(DemoDataSeeder.EMAIL, DemoDataSeeder.PASSWORD).andExpect(status().isOk())
			.andReturn()
			.getResponse()
			.getCookie("access_token");

		String propertiesJson = mvc.perform(get("/properties").cookie(demo))
			.andExpect(jsonPath("$.length()").value(1))
			.andExpect(jsonPath("$[0].name").value("Casa Miraflores 402"))
			.andReturn()
			.getResponse()
			.getContentAsString();
		long propertyId = ((Number) JsonPath.read(propertiesJson, "$[0].id")).longValue();

		mvc.perform(get("/properties/{id}/expenses", propertyId).cookie(demo))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.length()").value(4));
		mvc.perform(get("/reports/timeseries").cookie(demo))
			.andExpect(jsonPath("$[*].period", contains("2026-06", "2026-07", "2026-08")));
		mvc.perform(get("/reports/summary").cookie(demo))
			.andExpect(jsonPath("$.total_income").value(3600.0))
			.andExpect(jsonPath("$.total_expenses").value(480.0));
	}

}
```

- [ ] **Step 2: Run them and watch them fail**

Run: `./mvnw -q test -Dtest='OpenApiTest,DemoDataSeederTest'`
Expected: FAIL — compilation error, `DemoDataSeeder` not found.

- [ ] **Step 3: Add the bulk delete to `PropertyRepository`**

Replace `src/main/java/com/sebpostigo/rental/property/PropertyRepository.java`:

```java
package com.sebpostigo.rental.property;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface PropertyRepository extends JpaRepository<Property, Long> {

	List<Property> findByOwnerIdOrderByIdAsc(Long ownerId);

	Optional<Property> findByIdAndOwnerId(Long id, Long ownerId);

	/** One statement; the database cascades to incomes and expenses. */
	@Transactional
	@Modifying(flushAutomatically = true, clearAutomatically = true)
	@Query("delete from Property p where p.ownerId = :ownerId")
	void deleteByOwnerId(@Param("ownerId") Long ownerId);

}
```

- [ ] **Step 4: Write the OpenAPI config and the seeder**

`src/main/java/com/sebpostigo/rental/common/OpenApiConfig.java`:

```java
package com.sebpostigo.rental.common;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class OpenApiConfig {

	@Bean
	OpenAPI rentalOpenApi() {
		SecurityScheme cookieAuth = new SecurityScheme().type(SecurityScheme.Type.APIKEY)
			.in(SecurityScheme.In.COOKIE)
			.name("access_token")
			.description("Set by POST /auth/login");
		return new OpenAPI()
			.info(new Info().title("Rental Dashboard API")
				.version("1.0")
				.description("Spring Boot edition of the Rental Dashboard backend."))
			.components(new Components().addSecuritySchemes("cookieAuth", cookieAuth))
			.addSecurityItem(new SecurityRequirement().addList("cookieAuth"));
	}

}
```

`src/main/java/com/sebpostigo/rental/demo/DemoDataSeeder.java`:

```java
package com.sebpostigo.rental.demo;

import com.sebpostigo.rental.auth.User;
import com.sebpostigo.rental.auth.UserRepository;
import com.sebpostigo.rental.ledger.Expense;
import com.sebpostigo.rental.ledger.ExpenseCategory;
import com.sebpostigo.rental.ledger.ExpenseRepository;
import com.sebpostigo.rental.ledger.Income;
import com.sebpostigo.rental.ledger.IncomeRepository;
import com.sebpostigo.rental.property.Property;
import com.sebpostigo.rental.property.PropertyRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.YearMonth;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Resets the one-click demo account on every startup (the frontend hardcodes its credentials).
 * Render's free tier restarts the app regularly, so visitor edits clean themselves up. Dates
 * follow the calendar so the demo never looks stale.
 */
@Component
@Profile("demo")
public class DemoDataSeeder implements ApplicationRunner {

	public static final String EMAIL = "demo@rentalledger.com";

	public static final String PASSWORD = "demopass123";

	private static final BigDecimal RENT = new BigDecimal("1200.00");

	private static final BigDecimal[] UTILITIES = { new BigDecimal("80.00"), new BigDecimal("95.00"),
			new BigDecimal("85.00") };

	private static final BigDecimal PLUMBING = new BigDecimal("220.00");

	private final UserRepository users;

	private final PropertyRepository properties;

	private final IncomeRepository incomes;

	private final ExpenseRepository expenses;

	private final PasswordEncoder passwordEncoder;

	private final Clock clock;

	public DemoDataSeeder(UserRepository users, PropertyRepository properties, IncomeRepository incomes,
			ExpenseRepository expenses, PasswordEncoder passwordEncoder, Clock clock) {
		this.users = users;
		this.properties = properties;
		this.incomes = incomes;
		this.expenses = expenses;
		this.passwordEncoder = passwordEncoder;
		this.clock = clock;
	}

	@Override
	@Transactional
	public void run(ApplicationArguments args) {
		seed();
	}

	@Transactional
	public void seed() {
		User user = users.findByEmail(EMAIL).orElseGet(() -> new User(EMAIL, ""));
		user.changePassword(passwordEncoder.encode(PASSWORD));
		user = users.save(user);

		properties.deleteByOwnerId(user.getId());
		Property property = properties.save(new Property(user.getId(), "Casa Miraflores 402",
				"Av. Larco 402, Miraflores, Lima", "apartment", "USD"));

		YearMonth thisMonth = YearMonth.now(clock);
		for (int i = 0; i < 3; i++) {
			YearMonth month = thisMonth.minusMonths(3 - i);
			incomes.save(new Income(property.getId(), month.atDay(1), RENT, "Rent", null));
			expenses.save(new Expense(property.getId(), month.atDay(5), UTILITIES[i], ExpenseCategory.OTHER,
					"Utilities"));
			if (i == 1) {
				expenses.save(new Expense(property.getId(), month.atDay(18), PLUMBING, ExpenseCategory.MAINTENANCE,
						"Plumbing repair"));
			}
		}
	}

}
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `./mvnw -q test`
Expected: PASS (59 tests).

- [ ] **Step 6: Try the app locally against the test container**

Run: `./mvnw -q spring-boot:test-run -Dspring-boot.run.profiles=demo -Dspring-boot.run.arguments=--app.jwt.secret=local-dev-secret-that-is-32-chars-long`
Then in another terminal:

```bash
curl -s localhost:8080/health
curl -s -c /tmp/c.txt -X POST localhost:8080/auth/login -d 'username=demo@rentalledger.com&password=demopass123'
curl -s -b /tmp/c.txt localhost:8080/reports/summary
```

Expected: `{"status":"ok"}`, a token JSON, then `{"total_income":3600.00,"total_expenses":480.00,"net_balance":3120.00}`. Open `http://localhost:8080/swagger-ui.html` and check the UI loads. Stop the app with Ctrl+C.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: Swagger UI and a demo account that resets on startup"
```

---

### Task 8: Container, CI with coverage gate, Render blueprint and README

**Files:**
- Create: `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `.github/workflows/ci.yml`, `render.yaml`, `README.md`
- Modify: `pom.xml` (add JaCoCo), `src/main/resources/application.properties` (add `server.port`)

**Interfaces:**
- Consumes: the whole app.
- Produces: a Docker image listening on `$PORT` (default 8080); `./mvnw verify` enforcing ≥ 80% line coverage.

- [ ] **Step 1: Add the coverage gate to `pom.xml`**

Inside `<build><plugins>`, after `spring-boot-maven-plugin`, add:

```xml
			<plugin>
				<groupId>org.jacoco</groupId>
				<artifactId>jacoco-maven-plugin</artifactId>
				<version>0.8.15</version>
				<configuration>
					<excludes>
						<exclude>com/sebpostigo/rental/RentalDashboardSpringApplication.class</exclude>
					</excludes>
				</configuration>
				<executions>
					<execution>
						<goals>
							<goal>prepare-agent</goal>
						</goals>
					</execution>
					<execution>
						<id>report</id>
						<phase>verify</phase>
						<goals>
							<goal>report</goal>
						</goals>
					</execution>
					<execution>
						<id>check</id>
						<phase>verify</phase>
						<goals>
							<goal>check</goal>
						</goals>
						<configuration>
							<rules>
								<rule>
									<element>BUNDLE</element>
									<limits>
										<limit>
											<counter>LINE</counter>
											<value>COVEREDRATIO</value>
											<minimum>0.80</minimum>
										</limit>
									</limits>
								</rule>
							</rules>
						</configuration>
					</execution>
				</executions>
			</plugin>
```

- [ ] **Step 2: Run the full verify and check the gate**

Run: `./mvnw -q verify`
Expected: BUILD SUCCESS. Open `target/site/jacoco/index.html` and confirm line coverage ≥ 80%. If it is below, add tests for the uncovered lines rather than lowering the gate.

- [ ] **Step 3: Honour Render's port**

Append to `src/main/resources/application.properties`:

```properties
server.port=${PORT:8080}
```

- [ ] **Step 4: Write the container files**

`Dockerfile`:

```dockerfile
FROM eclipse-temurin:25-jdk AS build
WORKDIR /src
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -B -q dependency:go-offline
COPY src src
# Tests need Docker (Testcontainers), so they run in CI, not inside this build.
RUN ./mvnw -B -q package -DskipTests

FROM eclipse-temurin:25-jre
RUN useradd --system --uid 1001 app
WORKDIR /app
COPY --from=build /src/target/rental-dashboard-spring-0.0.1-SNAPSHOT.jar app.jar
USER app
EXPOSE 8080
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75"
ENTRYPOINT ["java", "-jar", "app.jar"]
```

`.dockerignore`:

```
target
.git
.github
.idea
*.iml
```

`docker-compose.yml`:

```yaml
services:
  db:
    image: postgres:17
    environment:
      POSTGRES_DB: rental
      POSTGRES_USER: rental
      POSTGRES_PASSWORD: rental
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U rental -d rental"]
      interval: 2s
      retries: 15

  api:
    build: .
    depends_on:
      db:
        condition: service_healthy
    ports:
      - "8080:8080"
    environment:
      DATABASE_URL: jdbc:postgresql://db:5432/rental
      DATABASE_USERNAME: rental
      DATABASE_PASSWORD: rental
      JWT_SECRET: local-dev-secret-that-is-32-chars-long
      SPRING_PROFILES_ACTIVE: demo
```

- [ ] **Step 5: Build and smoke-test the container**

```bash
docker compose up --build -d
sleep 20
curl -s localhost:8080/health
docker compose down
```

Expected: `{"status":"ok"}`.

- [ ] **Step 6: Write the CI workflow**

`.github/workflows/ci.yml`:

```yaml
name: ci

on:
  push:
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-java@v5
        with:
          distribution: temurin
          java-version: "25"
          cache: maven
      # Testcontainers uses the runner's Docker; verify runs tests + the JaCoCo gate.
      - run: ./mvnw -B verify
```

- [ ] **Step 7: Write the Render blueprint**

`render.yaml`:

```yaml
services:
  - type: web
    name: rental-dashboard-spring
    runtime: docker
    plan: free
    healthCheckPath: /health
    envVars:
      # JDBC form from the Neon console: jdbc:postgresql://<host>/<db>?sslmode=require
      - key: DATABASE_URL
        sync: false
      - key: DATABASE_USERNAME
        sync: false
      - key: DATABASE_PASSWORD
        sync: false
      - key: JWT_SECRET
        generateValue: true
      # The Vercel URL of the Java-edition frontend, e.g. https://rental-dashboard-java.vercel.app
      - key: CORS_ORIGINS
        sync: false
      - key: APP_ENVIRONMENT
        value: production
      - key: SPRING_PROFILES_ACTIVE
        value: demo
```

- [ ] **Step 8: Write the README**

`README.md`:

````markdown
# Rental Dashboard API — Spring Boot edition

![ci](https://github.com/sebpost2/rental-dashboard-spring/actions/workflows/ci.yml/badge.svg)

**Live demo:** https://rental-dashboard-java.vercel.app (click "Ver demo en vivo") · **API docs:** https://rental-dashboard-spring.onrender.com/swagger-ui.html

A rental-property ledger: each owner tracks income and expenses per property and gets a monthly summary, a month-by-month chart and a CSV export. This is the Spring Boot rewrite of a FastAPI backend — the same Next.js frontend runs unchanged against either one.

> The free Render instance sleeps when idle; the first request can take up to a minute.

## Stack

Java 25 · Spring Boot 4 · Spring MVC · Spring Data JPA (Hibernate 7) · Flyway · PostgreSQL · Spring Security (OAuth2 resource server, HS256 JWT) · Bean Validation · springdoc-openapi · Bucket4j · JUnit 5 + MockMvc + Testcontainers · JaCoCo · Docker · GitHub Actions · Render · Neon

## Architecture

Package by feature, layered inside each feature:

```
com.sebpostigo.rental
├── auth       register, login, logout, me
├── property   owner-scoped property CRUD
├── ledger     incomes and expenses nested under a property
├── report     summary, monthly timeseries, CSV export
├── demo       self-resetting demo account (demo profile)
├── security   JWT, cookie token resolver, origin check, rate limit
└── common     ProblemDetail errors, config, health, OpenAPI
```

Requests flow controller → service → repository. Controllers only map HTTP to record DTOs; entities never leave the service layer.

## Key decisions

- **Flyway owns the schema; Hibernate runs with `ddl-auto=validate`**, so the app refuses to start if entities and database drift apart.
- **Money is `BigDecimal` / `numeric(10,2)`**, validated with `@Digits(integer = 8, fraction = 2)` so oversized or over-precise amounts are a 422, not a database error.
- **Reports aggregate in SQL** (`JdbcClient`, `SUM` / `GROUP BY to_char(date, 'YYYY-MM')`) instead of loading every row.
- **Ownership is part of every query** (`findByIdAndOwnerId`), and another user's data is a 404 — never a 403 — so ids can't be probed.
- **Stateless JWT in an httpOnly cookie**, validated by Spring Security's resource server with a custom `BearerTokenResolver` (cookie first, then `Authorization` header). Public endpoints ignore the cookie, so a stale one can't block login.
- **CSRF: an Origin check instead of CSRF tokens.** The API is stateless and cross-site (`SameSite=None` in production); login and logout reject a foreign `Origin`, and every other endpoint needs a JWT the attacker can't read.
- **422 for validation errors** (Spring's default is 400) to keep the API contract identical to the FastAPI version.
- **Demo data resets on every startup** and follows the calendar, so the demo is always clean and current.

## Run it

```bash
docker compose up --build        # API on :8080 with Postgres and the demo account
./mvnw verify                    # tests (needs Docker) + 80% coverage gate
```

Demo login: `demo@rentalledger.com` / `demopass123`.

## Tests

59 tests: MockMvc integration tests against a real Postgres 17 in Testcontainers (auth, properties, ledger, reports, schema, demo seeder) plus JWT unit tests. CI runs `./mvnw verify` on every push.

## Ported from FastAPI

Same routes, status codes, snake_case JSON and error `detail` strings. Two bugs in the original were fixed along the way: deleting a property with ledger entries now cascades (the original had no `ON DELETE CASCADE`), and the demo data uses expense categories the API actually accepts.
````

- [ ] **Step 9: Verify and commit**

Run: `./mvnw -q verify`
Expected: BUILD SUCCESS.

```bash
git add -A
git commit -m "build: Docker image, CI with coverage gate, Render blueprint and README"
```

---

### Task 9: Deploy the live demo and add it to the portfolio

This task is mostly dashboard work. Steps marked **(you)** need your accounts; the rest can be run from this machine.

**Files:**
- Create (optional): `.github/workflows/keep-alive.yml` in `rental-dashboard-spring`
- Modify: `D:\2_MyScripts\FINANCE\portfolio\src\lib\projects.ts`; Create: `D:\2_MyScripts\FINANCE\portfolio\public\projects\rental-dashboard-java.png`

- [ ] **Step 1: Publish the repo**

```bash
cd /d/2_MyScripts/rental-dashboard-spring
gh repo create sebpost2/rental-dashboard-spring --public --source . --push
gh run watch --exit-status
```

Expected: the `ci` workflow passes.

- [ ] **Step 2 (you): Create the database**

In Vercel → **Storage** → **Create Database** → **Neon**, name it `rental-dashboard-spring-db`, and connect it to no project. Open it in Neon → **Connect** and note host, database, user and password. The JDBC URL is `jdbc:postgresql://<host>/<database>?sslmode=require`.

- [ ] **Step 3 (you): Create the Render service**

Render → **New** → **Blueprint** → pick `sebpost2/rental-dashboard-spring`. Fill in `DATABASE_URL` (JDBC form from Step 2), `DATABASE_USERNAME`, `DATABASE_PASSWORD`, and for now `CORS_ORIGINS=http://localhost:3000`. Deploy, then check:

```bash
curl -s https://rental-dashboard-spring.onrender.com/health
```

Expected: `{"status":"ok"}` (first call may take a minute).

- [ ] **Step 4 (you): Create the Java-edition frontend on Vercel**

Vercel → **Add New** → **Project** → import `rental-dashboard`. Project name `rental-dashboard-java`, **Root Directory** `frontend`, environment variable `NEXT_PUBLIC_API_URL=https://rental-dashboard-spring.onrender.com`. Deploy.

- [ ] **Step 5 (you): Point CORS at the frontend**

In Render, set `CORS_ORIGINS=https://rental-dashboard-java.vercel.app` and let it redeploy.

- [ ] **Step 6: Smoke-test the live demo**

Open `https://rental-dashboard-java.vercel.app/login`, click **Ver demo en vivo**. Expected: the dashboard loads with 3 months of data and net balance 3,120.00. Also create and delete a property, and download the CSV.

- [ ] **Step 7 (optional): Keep the free instance awake**

Only if cold starts on the demo are a problem. `.github/workflows/keep-alive.yml` in `rental-dashboard-spring`:

```yaml
name: keep-alive

on:
  schedule:
    - cron: "*/14 * * * *"
  workflow_dispatch:

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: curl -fsS --max-time 90 https://rental-dashboard-spring.onrender.com/health
```

```bash
git add .github/workflows/keep-alive.yml
git commit -m "ci: ping the Render instance so the demo stays warm"
git push
```

- [ ] **Step 8: Add the portfolio card**

Take a 1280×800 screenshot of the live dashboard and save it as `D:\2_MyScripts\FINANCE\portfolio\public\projects\rental-dashboard-java.png`. In `D:\2_MyScripts\FINANCE\portfolio\src\lib\projects.ts`, insert this entry directly after the `rental-dashboard` entry:

```ts
  {
    slug: "rental-dashboard-java",
    title: "Rental Dashboard — Java edition",
    tagline: {
      en: "The same rental ledger rebuilt in idiomatic Spring Boot — same frontend, same API, a Java backend held to real Postgres tests.",
      es: "El mismo libro contable de alquileres reconstruido en Spring Boot idiomático — mismo frontend, misma API, un backend Java validado con tests contra Postgres real.",
    },
    description: {
      en: "Spring Boot 4 rewrite of the Rental Dashboard API: package-by-feature layering, Flyway migrations with Hibernate validate, BigDecimal money, SQL-side report aggregation, and Spring Security's resource server reading a JWT from an httpOnly cookie. 59 tests on Testcontainers Postgres with an 80% coverage gate in CI.",
      es: "Reescritura en Spring Boot 4 de la API de Rental Dashboard: capas por feature, migraciones Flyway con Hibernate en validate, dinero en BigDecimal, reportes agregados en SQL y el resource server de Spring Security leyendo un JWT desde una cookie httpOnly. 59 tests sobre Postgres en Testcontainers con un gate de 80% de cobertura en CI.",
    },
    checks: ["59 tests", "Testcontainers", "Spring Security"],
    caseStudy: {
      problem: {
        en: "A portfolio full of Python and TypeScript says little to a team hiring for Java. A toy CRUD app doesn't either — the questions in a Java interview are about layering, transactions, the ORM, security and tests.",
        es: "Un portafolio lleno de Python y TypeScript dice poco a un equipo que contrata para Java. Un CRUD de juguete tampoco — las preguntas de una entrevista Java son sobre capas, transacciones, el ORM, seguridad y tests.",
      },
      approach: {
        en: "Rebuilt a real, deployed backend in Spring Boot the way a Spring team would: features as packages, Flyway owning the schema, ownership enforced inside every query, reports aggregated in SQL, and JWT auth through Spring Security's own resource server instead of a hand-rolled filter. The existing Next.js frontend runs against it without a single change.",
        es: "Reconstruí un backend real y desplegado en Spring Boot como lo haría un equipo Spring: features como paquetes, Flyway dueño del esquema, la propiedad de cada dato validada dentro de cada query, reportes agregados en SQL y auth JWT con el propio resource server de Spring Security en vez de un filtro hecho a mano. El frontend Next.js existente corre contra él sin un solo cambio.",
      },
      result: {
        en: "59 integration and unit tests against real Postgres gate every push, and the port surfaced two bugs in the original (a delete that couldn't cascade and demo data the API itself rejected). Try the live demo above, or read the API in Swagger.",
        es: "59 tests de integración y unitarios contra Postgres real validan cada push, y la migración destapó dos bugs del original (un borrado que no podía hacer cascada y datos demo que la propia API rechazaba). Prueba la demo en vivo arriba, o revisa la API en Swagger.",
      },
    },
    stack: ["Java 25", "Spring Boot 4", "Spring Security", "JPA / Hibernate", "Flyway", "PostgreSQL", "Testcontainers", "Docker"],
    liveUrl: "https://rental-dashboard-java.vercel.app/login",
    liveLabel: { en: "Live demo", es: "Demo en vivo" },
    repoUrl: "https://github.com/sebpost2/rental-dashboard-spring",
    image: "/projects/rental-dashboard-java.png",
  },
```

- [ ] **Step 9: Check the portfolio builds and commit**

```bash
cd /d/2_MyScripts/FINANCE/portfolio
npx tsc --noEmit
git add src/lib/projects.ts public/projects/rental-dashboard-java.png
git commit -m "Add Rental Dashboard Java edition project"
```

Expected: no type errors. Pushing deploys the portfolio — do that when you're ready for it to go live.
