# auth-svc (Java 21 / Spring Boot 4.1)

> [!IMPORTANT]
> This service has moved to the team's current Java 21 and Spring Boot 4.1
> stack. JJWT uses its Gson serializer so the token path does not retain
> Jackson 2 alongside Spring Boot 4's Jackson 3 defaults.

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
- The signing key is generated at startup, so restarting the service invalidates existing tokens.
