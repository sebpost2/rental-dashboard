# Rental Dashboard — Spring Boot Edition: Design

**Date:** 2026-09-29
**Status:** Approved in brainstorming, pending spec review
**New repo:** `rental-dashboard-spring` (backend only)

## 1. Goal

Rebuild the Rental Dashboard backend (currently FastAPI) in idiomatic Java / Spring Boot, so that job applications asking for Java can point at a real, tested, deployed Spring project.

**Success means:**
- A reviewer for a Java role opens the repo and sees conventional, modern Spring code, not a Python port.
- The existing Next.js frontend works against it **unchanged**, as a live demo like the rest of the portfolio.
- `mvn verify` passes in CI with ~46 integration + unit tests against real Postgres.

**Non-goals:**
- A shared cross-backend contract test suite (explicitly not the goal; each backend has its own native tests).
- The C# / ASP.NET Core edition — separate spec later, reusing this one.
- Any frontend change.

## 2. API contract (must match FastAPI exactly)

JSON field names are **snake_case**. Errors are ProblemDetail with a human-readable `detail` string (the frontend displays `data.detail`).

| Method & path | Auth | Request | Success | Notes |
|---|---|---|---|---|
| `GET /health` | no | — | 200 `{"status":"ok"}` | |
| `POST /auth/register` | no | JSON `{email, password}` | 201 `{id, email}` | email valid; password 8–72 chars; dup → 400 "Email already registered"; 10/min/IP → 429 |
| `POST /auth/login` | no | form-urlencoded `username`, `password` | 200 `{access_token, token_type:"bearer"}` + cookie | bad creds → 401 "Incorrect email or password"; origin check; 10/min/IP |
| `POST /auth/logout` | no | — | 200 `{"status":"ok"}`, cookie cleared | origin check |
| `GET /auth/me` | yes | — | 200 `{id, email}` | |
| `POST /properties` | yes | `{name, address, property_type?, currency?}` | 201 property | name 1–200; address 1–500; property_type ≤50, default `apartment`; currency exactly 3, default `USD` |
| `GET /properties` | yes | — | 200 list (own only) | |
| `GET /properties/{id}` | yes | — | 200 property | not owned → 404 "Property not found" |
| `PATCH /properties/{id}` | yes | any subset of create fields | 200 property | only provided fields change; same constraints |
| `DELETE /properties/{id}` | yes | — | 204 | cascades to incomes/expenses |
| `POST /properties/{id}/incomes` | yes | `{date, amount, source, notes?}` | 201 income | amount ≥ 0; source 1–200; notes ≤ 1000 |
| `GET /properties/{id}/incomes` | yes | `?start_date&end_date` | 200 list ordered by date | inclusive bounds |
| `DELETE /properties/{id}/incomes/{incomeId}` | yes | — | 204 | missing → 404 "Income not found" |
| `POST /properties/{id}/expenses` | yes | `{date, amount, category, notes?}` | 201 expense | category ∈ `cleaning, maintenance, commission, other`, else 422 |
| `GET /properties/{id}/expenses` | yes | `?start_date&end_date` | 200 list ordered by date | |
| `DELETE /properties/{id}/expenses/{expenseId}` | yes | — | 204 | missing → 404 "Expense not found" |
| `GET /reports/summary` | yes | `?start_date&end_date&property_id` | 200 `{total_income, total_expenses, net_balance}` | foreign property_id → 404; no data → zeros |
| `GET /reports/timeseries` | yes | same | 200 `[{period:"YYYY-MM", income, expenses}]` | months with data only, ascending |
| `GET /reports/export` | yes | same | 200 `text/csv`, `attachment; filename=transactions.csv` | header `type,date,amount,description`; income → source, expense → category; sorted by date |

Property JSON: `{id, name, address, property_type, currency}`. Income: `{id, date, amount, source, notes}`. Expense: `{id, date, amount, category, notes}`. Dates are `YYYY-MM-DD`; amounts are JSON numbers.

Status codes: validation failures are **422** (FastAPI's code, kept for compatibility — Spring's default would be 400). Unauthenticated is 401 with `WWW-Authenticate: Bearer`. Another user's resource is **404**, never 403.

## 3. Stack

Java 25 (LTS), Spring Boot 4, Maven, Spring Web, Spring Data JPA (Hibernate), Flyway, Spring Security, Bean Validation, springdoc-openapi (Swagger UI), Bucket4j, JJWT, Postgres driver. Tests: JUnit 5, MockMvc, Testcontainers (Postgres 17), JaCoCo. Exact versions confirmed during planning.

## 4. Architecture

Package-by-feature, layered inside each feature. Root package `com.sebpostigo.rental`.

| Package | Contents |
|---|---|
| `auth` | `AuthController`, `UserService`, `User`, `UserRepository`, records `RegisterRequest`, `UserResponse`, `TokenResponse` |
| `property` | `PropertyController`, `PropertyService`, `Property`, `PropertyRepository`, records `PropertyCreateRequest`, `PropertyUpdateRequest`, `PropertyResponse` |
| `ledger` | `IncomeController`, `ExpenseController`, `LedgerService`, `Income`, `Expense`, repositories, `ExpenseCategory` enum, request/response records |
| `report` | `ReportController`, `ReportService`, projection records `SummaryResponse`, `TimeseriesPoint` |
| `security` | `SecurityConfig`, `JwtService`, `JwtCookieAuthFilter`, `OriginCheckFilter`, `RateLimitFilter`, `AuthCookieFactory` |
| `common` | `GlobalExceptionHandler`, `NotFoundException`, `AppProperties` (`@ConfigurationProperties` record), Jackson + CORS config |
| `demo` | `DemoDataSeeder` (`@Profile("demo")`) |

Rules:
- Flow is controller → service → repository. Controllers only map HTTP ↔ DTO records. Entities never leave the service layer.
- Ownership is enforced **in queries** (`findByIdAndOwnerId`), so another user's rows are never loaded. Not-found and not-owned both raise `NotFoundException` → 404.
- Reports aggregate in the database, not in memory: the summary uses JPQL `SUM` queries; the timeseries uses a native Postgres query grouping by `to_char(date, 'YYYY-MM')`; the CSV export reads the filtered rows ordered by date.
- Jackson `PropertyNamingStrategies.SNAKE_CASE` globally; Java code stays camelCase.

## 5. Data

Flyway migrations in `src/main/resources/db/migration`; Hibernate `ddl-auto=validate`.

- `V1__users.sql` — `users(id bigserial pk, email varchar unique not null, hashed_password varchar not null, created_at timestamptz default now())`
- `V2__properties.sql` — `properties(id, owner_id → users(id) on delete cascade, name varchar(200), address varchar(500), property_type varchar(50) default 'apartment', currency char(3) default 'USD', created_at)`, index on `owner_id`
- `V3__ledger.sql` — `incomes(id, property_id → properties(id) on delete cascade, date date, amount numeric(10,2), source varchar(200), notes varchar(1000), created_at)` and `expenses(… category varchar(20) not null …)`, indexes on `property_id` and `date`

Java types: `BigDecimal` (scale 2) for money, `LocalDate` for ledger dates, `Instant` for `created_at`. `ExpenseCategory` has uppercase Java constants (`CLEANING`, …) mapped to the lowercase wire/DB values (`cleaning`, …) by a JPA `AttributeConverter` for the database and `@JsonValue`/`@JsonCreator` for JSON.

The Java edition uses its **own** Neon database, created from the Vercel Storage tab.

## 6. Security

- Stateless Spring Security; no HTTP session.
- Passwords: `BCryptPasswordEncoder`.
- JWT: HS256, `sub` = email, 24h expiry, secret from env (min 32 bytes, validated at startup).
- Cookie `access_token`: httpOnly, path `/`, max-age 24h; `Secure` + `SameSite=None` when `app.environment=production`, else `SameSite=Lax`.
- `JwtCookieAuthFilter` reads the token from the cookie, or `Authorization: Bearer`; resolves the user; controllers get it via `@AuthenticationPrincipal`.
- CSRF: Spring token CSRF disabled; `OriginCheckFilter` on `/auth/login` and `/auth/logout` rejects a present-but-unlisted `Origin` with 403 "Invalid origin". README documents why.
- CORS: origins from `CORS_ORIGINS` (comma-separated), credentials allowed.
- Rate limit: Bucket4j, 10 requests/minute per client IP on register and login → 429. In-memory (single instance). `server.forward-headers-strategy=framework` so the real client IP is used behind Render's proxy.

## 7. Error handling

One `@RestControllerAdvice` returning `ProblemDetail`:

| Exception | Status | `detail` |
|---|---|---|
| `MethodArgumentNotValidException`, `HandlerMethodValidationException`, unreadable JSON / bad enum | 422 | field messages joined with `; ` |
| `NotFoundException` | 404 | e.g. "Property not found" |
| Authentication failure | 401 | "Could not validate credentials" / "Incorrect email or password" |
| Duplicate email | 400 | "Email already registered" |
| Rate limited | 429 | "Too many requests" |
| Anything else | 500 | generic message; exception logged; no stack trace in response |

## 8. Demo data

`DemoDataSeeder` runs only under the `demo` profile, on every startup, and **resets** the demo account (the frontend hardcodes `demo@rentalledger.com` / `demopass123`):
- Deletes the demo user's properties (cascade clears entries), ensures the user exists with that password.
- Creates property "Casa Miraflores 402", "Av. Larco 402, Miraflores, Lima", apartment, USD.
- Creates rent income of 1200 on the 1st of each of the **last 3 full months relative to today**, and expenses on those months: 80 / 95 / 85 `other` (notes "Utilities") on the 5th, and 220 `maintenance` (notes "Plumbing repair") on the 18th of the middle month.

Fixes carried over from the Python seed: its categories `Utilities`/`Maintenance` are not valid API values, and its dates are fixed to Jun–Aug 2026 so the demo ages.

## 9. Testing

`@SpringBootTest` + MockMvc against a single reused Testcontainers Postgres 17; each test class creates its own users; data cleaned between tests.

| Class | Scope | Count |
|---|---|---|
| `AuthControllerTest` | ports the 14 Python auth tests | 14 |
| `HealthTest` | `/health` | 1 |
| `PropertyControllerTest` | ports 8 | 8 |
| `LedgerControllerTest` | ports 10 | 10 |
| `ReportControllerTest` | ports 8 | 8 |
| New | delete property cascades entries; foreign `Origin` → 403; 422 has readable `detail`; `JwtService` unit tests (expired, bad signature, round-trip) | ~5 |

JaCoCo line-coverage gate at 80%, enforced by `mvn verify`. GitHub Actions runs `mvn verify` on every push; README shows the badge.

## 10. Deployment

- **Docker:** multi-stage; Maven build stage → `eclipse-temurin:25-jre`; non-root user; `-XX:MaxRAMPercentage=75`; Spring Boot CDS to cut cold start.
- **Render:** free web service via `render.yaml`. Env: `DATABASE_URL`, `JWT_SECRET` (generated), `CORS_ORIGINS`, `APP_ENVIRONMENT=production`, `SPRING_PROFILES_ACTIVE=prod,demo`. `DATABASE_URL` in Neon's `postgresql://` form is converted to a JDBC URL at startup.
- **Frontend:** second Vercel project from the `rental-dashboard` repo, root `frontend/`, `NEXT_PUBLIC_API_URL` = Render URL. No code changes.
- **Swagger UI:** `/swagger-ui.html`, linked in README.
- **Keep-alive (optional, decide at deploy):** GitHub Actions cron hitting `/health` every 14 minutes.

## 11. README and portfolio

README for a Java reviewer: live demo + Swagger + CI badge; what it does; stack; architecture (packages, request flow); key decisions (Flyway + validate, BigDecimal, SQL aggregation, origin check vs CSRF token, 422 kept for compatibility, demo seeder); run locally (`docker compose up`, `mvn verify`); testing; "ported from FastAPI" note including the delete-cascade and seed-category fixes.

Portfolio: a **separate project card**, "Rental Dashboard — Java edition", with its own live demo and repo links and a Java-focused case study. The FastAPI card stays.

## 12. Found issues in the Python backend (out of scope, tracked)

1. `DELETE /properties/{id}` on a property with incomes/expenses likely fails with an FK violation (no `ON DELETE CASCADE`, no relationship cascade) → 500. Inferred from code, not yet reproduced.
2. `seed_demo.py` writes expense categories `Utilities`/`Maintenance`, which `ExpenseRead` does not accept; listing the demo property's expenses may error.
