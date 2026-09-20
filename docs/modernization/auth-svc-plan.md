# Migration plan: `auth-svc` from Spring Boot 3.5.16 / Java 17 to Spring Boot 4.1.0 / Java 21

## 1. Executive summary

`auth-svc` issues JWTs and looks up users. It starts from the same baseline as
`audit-svc` — Spring Boot 3.5.16 / Java 17, `spring-boot-starter-web` +
`spring-boot-starter-jdbc` over SQLite — and takes the same runtime and framework
jump to Spring Boot 4.1.0 / Java 21 (Spring Framework 7). The difference, and the
whole point of doing this service second, is its token library: `auth-svc` depends
on `jjwt` `0.11.5` with the `jjwt-jackson` serializer. Under Spring Boot 4 that
serializer drags in a transitive **Jackson 2**, which Boot 4 no longer manages and
which trips the "no known-vulnerable dependency" constraint. Clearing it is the
substance of this upgrade: bump `jjwt` to `0.12.7` and swap `jjwt-jackson` for
`jjwt-gson`, whose CVE-clean Gson (`2.13.2`) removes Jackson 2 from `auth-svc`
entirely. The `jjwt` `0.11 → 0.12` bump is also a **breaking API change**, so
`JwtIssuer` needs small code edits — caught by the Phase 0 safety net.

A hard organizational constraint frames the whole upgrade: **no phase may
introduce a known-vulnerable dependency.**

## 2. Current state vs. target state

| Dimension | Current (`auth-svc`) | Target | Source |
|---|---|---|---|
| Spring Boot parent | `3.5.16` | `4.1.0` | pom.xml → Spring Boot 4 migration guide |
| Java source/target | `17` | `21` | pom.xml `<java.version>` |
| JSON binding (web) | Jackson 2 (BOM-pinned `2.22.2`) | Jackson 3, pinned `3.1.6` | pom.xml → Jackson 3 |
| Currency pins | `jackson-bom 2.22.2`, `log4j2 2.25.5` | `jackson-bom 3.1.6` (re-pinned), `log4j2 2.25.5` (held) | pom.xml |
| Token library | `jjwt-api/impl/jackson 0.11.5` | `jjwt-api/impl/gson 0.12.7` | pom.xml → jjwt releases |
| Token serializer | `jjwt-jackson` (pulls transitive Jackson 2) | `jjwt-gson` (Gson `2.13.2`, no Jackson 2) | jjwt-gson |
| Persistence | Raw `JdbcTemplate` + SQLite `3.45.3.0` | unchanged | `UserRepository` |
| Tests | Baseline suite (added in the previous exercise) | held constant through migration | — |

## 3. Scope and key decisions

### In scope

- Bump the Spring Boot parent `3.5.16` → `4.1.0` and Java `17` → `21`.
- Re-point the currency pins for Boot 4: re-aim `<jackson-bom.version>` at a
  CVE-clean Jackson 3 (`3.1.6`, matching `audit-svc`) and hold `<log4j2.version>`
  at `2.25.5`, then confirm the resolved tree is CVE-clean.
- **Replace the token serializer:** bump the three `jjwt` artifacts `0.11.5` →
  `0.12.7`, and replace `jjwt-jackson` with `jjwt-gson` so the vulnerable
  transitive Jackson 2 is removed from `auth-svc` entirely. Confirm `jjwt-gson`
  resolves a CVE-clean Gson (`2.13.2`); pin it explicitly if the resolved version
  is not clean.
- **Migrate `JwtIssuer` to the jjwt `0.12.x` API** (breaking change from `0.11`):
  - `Jwts.builder().setIssuer(...)` → `.issuer(...)`
  - `.setSubject(...)` → `.subject(...)`
  - `.setIssuedAt(...)` → `.issuedAt(...)`
  - `.setExpiration(...)` → `.expiration(...)`
  - `.signWith(key, SignatureAlgorithm.RS256)` → `.signWith(key, Jwts.SIG.RS256)`
    (the `SignatureAlgorithm` enum is removed in `0.12`).
  Preserve the exact issued claims (`iss`, `sub`, `role`, `iat`, `exp`) and the
  RS256 signature so the `/token` and JWKS contracts are unchanged.
- Align toolchain references (Dockerfile / IDE metadata) with the new runtime.

### Explicitly out of scope

| Out-of-scope item | Rationale |
|---|---|
| "Fixing" the intentional auth vulnerabilities / exercise targets | `auth-svc` carries deliberate teaching gaps. They are separate educational concerns, unrelated to the platform migration, and must be preserved. |
| Migrating persistence to Spring Data JPA / Hibernate | `auth-svc` uses raw `JdbcTemplate`, fully supported under Spring Framework 7 / Boot 4. Track any ORM move as a separate follow-on. |
| Copying dependencies from a sibling service | `auth-svc`'s token/serializer surface is its own; do not import `workforce-svc` JPA or `audit-svc` decisions beyond the shared Boot/Java/Jackson-pin targets stated above. |
| Rotating to persistent JWT signing keys | The startup-generated key is intentional for the teaching codebase. Out of scope for a framework bump. |

## 4. Security constraints

- No phase may introduce or knowingly retain a known-vulnerable dependency.
- The migration must **remove** the transitive Jackson 2 that `jjwt-jackson`
  pulls under Boot 4 — verify its absence in `mvn dependency:tree` after Phase 2.
- Re-pointed Jackson 3 pin must resolve `3.1.6` (Boot 4.1.0 natively resolves a
  still-vulnerable `3.1.4`).
- A dependency tree proves resolution, not vulnerability status — run the
  repository-approved advisory/SCA gate when available, or record the source and
  date of the manual assessment.

## 5. Phased migration plan

Follow `migration-playbook.md` for sequencing, evidence, and approval gates. This
profile supplies the exact per-phase targets.

### Phase 0 — Behavioral safety net (already complete)

Context-load test, `TokenController` integration test asserting the `/token`
bearer-token contract, and a JWT-validation test that reconstructs the RSA public
key from the published JWKS and verifies the signature and claims — all on an
isolated temporary database, green on Spring Boot 3.5.16 / Java 17. This is the
baseline the later phases must keep satisfying.

### Phase 1 — Java toolchain and runtime (17 → 21)

Bump `<java.version>` to `21` and update committed Docker build/runtime images and
any service-specific scripts/CI that still select JDK 17. Leave the Spring Boot
parent and all dependency pins unchanged. Gate: `java -version`, `mvn test`,
`mvn verify`, `mvn clean verify`, then `javap -verbose` on a clean application
class to confirm major version `65`.

### Phase 2 — Spring Boot 4.1.0 + jjwt/Gson serializer swap

1. Bump the Spring Boot parent `3.5.16` → `4.1.0`.
2. Re-point `<jackson-bom.version>` to `3.1.6`; hold `<log4j2.version>` at `2.25.5`.
3. Bump `jjwt-api`, `jjwt-impl` to `0.12.7`; replace the `jjwt-jackson` `0.11.5`
   runtime dependency with `jjwt-gson` `0.12.7`.
4. Migrate `JwtIssuer` to the jjwt `0.12.x` API (see §3).
5. Gate: `mvn dependency:tree` (confirm Spring Boot 4.1.0, Jackson `3.1.6`,
   `jjwt-gson` + Gson `2.13.2`, **no Jackson 2**, no vulnerable transitives),
   `mvn test`, `mvn clean verify`, then the approved dependency-security check.

The Phase 0 tests are the tell here: if the API migration or serializer swap
changes the token contract, the `/token` and JWKS tests fail against the exact
phase that caused it.

### Phase 3 — Stabilization

Remove any temporary migration aids, resolve deprecations affecting supported
operation, update `auth-svc` documentation to the final stack, and verify
container startup. Rerun `mvn test`, `mvn clean verify`, `mvn dependency:tree`.

### Final integration gate

Confirm final Java/Boot/serializer/pin versions, then run `npm run test:e2e` from
the repository root. Fix only failures caused by `auth-svc` or its exclusive
wiring; report and stop if a fix would require another service or the frontend.

## 6. Rollback boundary

Each phase is an isolated, independently revertible change set: the Java target
(Phase 1), and the Boot parent + jjwt/serializer + `JwtIssuer` edits (Phase 2).
The smallest rollback that restores a passing state is reverting the current
phase's change set and rerunning that phase's gate.
