# Module 06 delta — LANDED

**Produces:** `start-of-module-07` (= cumulative end state of Module 06)

**Adds/updates** (seed — Copilot-authored, performing ACC module 06; 27 files):
- Finalized modernization of `services/audit-svc` and `services/auth-svc`: Spring Boot `3.5.16` → `4.1.0`, Java `17` → `21`, Dockerfiles `temurin-17` → `temurin-21`, and the required Jackson 3 / Log4j2 currency pins.
- `auth-svc` JJWT `0.11.5` → `0.12.7`, the fluent `JwtIssuer` API, and `jjwt-jackson` → `jjwt-gson`.
- Final integration test suites: four audit test classes and three auth test classes, including isolated SQLite databases, controller coverage, repository coverage, and JWT round-trip verification.
- `.github/lsp.json`, the full Java migrator agent, audit/auth migration plans, the reusable migration playbook, and service-aware lifecycle hook routing.
- Root, service, contribution, exercise, architecture, Copilot-instruction, and pull-request documentation aligned with the completed Java 21 / Spring Boot 4.1 state.

The patch is a single `git format-patch --zero-commit` delta derived from the
cumulative end state of Module 05. It preserves all earlier module output and
does not contain `course-build/` or course automation workflows.

**Expected tree:** `bc126e38a84e775eeffb80882bbbeddcdf01cd38`. See
`manifest.json` (module 6) for the checked assets.
