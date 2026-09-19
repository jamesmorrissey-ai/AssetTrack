# auth-svc (Java 21 / Spring Boot 3.5 — framework upgrade pending)

> [!IMPORTANT]
> This service now runs on Java 21, but its framework remains **a generation behind** the team's current cadence — Spring Boot 3.5, raw JDBC, plain-text passwords. It is CVE-clean but still due for the Spring Boot 4 and jjwt/serializer upgrade, giving course learners a realistic modernization/security target.

Issues RS256 JWTs and exposes a JWKs document so other services can validate tokens.

## Endpoints

| Method | Path                  | Description                              |
|--------|-----------------------|------------------------------------------|
| GET    | `/health`             | Liveness check                           |
| POST   | `/token`              | Exchange username/password for a JWT     |
| GET    | `/.well-known/jwks`   | Public JWKs document for token validation |
| GET    | `/users/{id}`         | Get a user by id                         |

## Seeded users

| username   | password   | role     |
|------------|------------|----------|
| `admin`    | `password` | admin    |
| `helpdesk` | `password` | helpdesk |
| `viewer`   | `password` | viewer   |

## Run locally

```bash
mvn spring-boot:run
```

## Test

```bash
mvn test
```

## Known smells (course material)

- **SQL injection** in `UserRepository.findByUsername` (string concatenation). Course exercise target.
- **Plain-text passwords** in the seeded database.
- **Spring Boot 3.5** — a generation behind the team's Spring Boot 4 target; the remaining currency-upgrade exercise includes the jjwt/serializer migration.
