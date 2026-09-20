# audit-svc (Java 21 / Spring Boot 4.1)

> [!IMPORTANT]
> This service has moved to the team's current Java 21 and Spring Boot 4.1
> stack while retaining its existing raw JDBC and SQLite design.

Append-only audit log. Other services POST events; humans GET them.

## Endpoints

| Method | Path                | Description                                            |
|--------|---------------------|--------------------------------------------------------|
| GET    | `/health`           | Liveness check                                         |
| POST   | `/events`           | Record an audit event                                  |
| GET    | `/events`           | List most recent events (`limit`, or `query` to search)|

### Event body shape

```json
{
  "actor": "helpdesk@contoso.example",
  "action": "assignment.create",
  "entityType": "assignment",
  "entityId": "42",
  "details": "Assigned CON-LPT-001 to employee 7"
}
```

## Run locally

```bash
mvn spring-boot:run
```

## Test

```bash
mvn test
```

The integration tests use an isolated temporary SQLite database and do not read
or write `AUDIT_DB_PATH`.

## Known smells (course material)

- **SQL injection** in `AuditRepository.search` (string concatenation across three `LIKE` clauses). Course exercise target.
- The current test suite is a behavior-preserving safety net for modernization; it does not fix intentional exercise targets.
- Nothing currently POSTs to this service from `workforce-svc` — wiring that up is also an exercise.
