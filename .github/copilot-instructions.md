# Copilot instructions for AssetTrack

## Repository model

AssetTrack is an intentionally vulnerable teaching application with seven independently runnable services and a separate course-branch generation subsystem. Before fixing an apparent defect, check `exercises.md`, the root `README.md`, and the affected service README; validation, authentication, SQL injection, resilience, and modernization gaps may be deliberate exercise targets.

- `services/web` is the browser-facing Astro SSR application and backend-for-frontend. Browser requests go to Astro; Astro server code calls the backend services.
- `assets-svc` owns assets in SQLite and uses .NET 10 minimal APIs with Dapper.
- `workforce-svc` owns employees and assignments in SQLite and uses Java 21, Spring Boot, JPA, and Hibernate.
- `reporting-svc` is a stateless FastAPI composition service. It reads live data from other services and proxies CSV imports to `assets-svc`.
- `notifications-svc` receives assignment webhooks and persists a local SQLite event log.
- `audit-svc` and `auth-svc` use Java 21, Spring Boot 4.1, raw JDBC, and SQLite.
- Databases are service-owned. Cross-service IDs such as `Assignment.assetId` are scalar references with no database foreign keys or shared transactions.
- Auth issues JWTs, but the web and domain services do not yet forward or validate them. Audit integration is also configured but not wired.

`course-build/` is not an application service. It stores ordered patch deltas and scripts that deterministically generate cumulative `start-of-module-*` learner branches. Make application changes on `main`; do not edit generated learner refs or promotion refs directly.

## Build, run, test, and lint

Use the devcontainer toolchain: Node 22, .NET 10, Python 3.12, Maven, and JDK 21.

### Whole stack

```bash
npm install
npm run install:all
npm run dev                 # all services on ports 4321 and 5001-5006
npm run dev:verbose
docker compose up --build   # optional containerized flow
```

The root `package.json` is a process orchestrator; it has no repository-wide build, test, or lint script.

### Web (`services/web`)

```bash
cd services/web
npm install
npm run dev
npm run build
npm run preview
```

There is currently no web unit-test, end-to-end-test, or lint script on `main`.

### Assets service (`services/assets-svc`)

```bash
dotnet build services/assets-svc/AssetsService.csproj
dotnet test services/assets-svc/Tests/AssetsService.Tests.csproj
dotnet test services/assets-svc/Tests/AssetsService.Tests.csproj --filter 'FullyQualifiedName~AssetsDbTests'
dotnet test services/assets-svc/Tests/AssetsService.Tests.csproj --filter 'FullyQualifiedName~AssetsDbTests.Initialize_creates_assets_table_and_seed_data'
```

Run locally with `npm run dev:assets` from the root or `dotnet run --project services/assets-svc/AssetsService.csproj` with `ASSETS_DB_PATH` pointing to a writable file.

### Workforce service (`services/workforce-svc`)

```bash
cd services/workforce-svc
WORKFORCE_DB_PATH=/tmp/assettrack-workforce-test.db mvn test
WORKFORCE_DB_PATH=/tmp/assettrack-workforce-test.db mvn -Dtest=WorkforceApplicationTests test
WORKFORCE_DB_PATH=/tmp/assettrack-workforce-test.db mvn -Dtest=WorkforceApplicationTests#contextLoads test
mvn spring-boot:run
```

### Audit and auth services

From either `services/audit-svc` or `services/auth-svc`:

```bash
mvn test
mvn spring-boot:run
```

Both modules have characterization tests that use isolated temporary SQLite
databases. Run one with `mvn -Dtest=ClassName#methodName test`.

### Python services

```bash
cd services/reporting-svc
pip install -e ".[dev]"
ruff check .
# Once tests exist:
python -m pytest -q
python -m pytest tests/test_file.py::test_name

cd ../notifications-svc
pip install -e .
uvicorn app.main:app --reload --port 8080
```

`reporting-svc/tests` currently contains only a README, and `notifications-svc` has no test or lint configuration.

### Course branch tooling

```bash
node course-build/scripts/build-branches.mjs --check
node course-build/scripts/selftest.mjs
course-build/scripts/validate-branch.sh start-of-module-04
```

The validation script creates temporary refs/worktrees and runs every suite present in the generated learner state. Use it for `course-build/**` changes, not as a substitute for testing a normal service change.

## Codebase-specific conventions

- Keep web data access server-side. Add typed backend calls under `services/web/src/lib/api/` and call them from Astro frontmatter; do not fetch services directly from browser JavaScript.
- Service URLs in the web client come from `process.env`, not `import.meta.env`, so Docker/runtime values are not baked into the build. Preserve the `SERVICE_URLS` and `apiFetch` boundary.
- Prefer Astro pages/components and Bootstrap 5. React is installed but currently unused; introduce an island only for interaction that requires client-side state.
- Dashboard-style composition tolerates partial backend failure and renders warnings. Preserve explicit partial-data behavior when changing multi-service pages.
- Keep `assets-svc` as minimal APIs: register infrastructure in `Program.cs`, map domain routes through endpoint extension classes, open connections through `AssetsDb`, and use Dapper parameters rather than interpolating user input. Preserve `public partial class Program` for `WebApplicationFactory`.
- `workforce-svc` uses controller/service/repository separation. Business and cross-service orchestration belongs in `AssignmentService`; controllers translate results to HTTP responses. Service clients are configured as named `RestClient` beans in `HttpClientsConfig`.
- Python runtime configuration uses environment variables with container-network defaults. `reporting-svc` splits route groups into `app/routers`; `notifications-svc` is intentionally small and keeps startup, routes, and SQLite persistence in `app/main.py`.
- SQLite schemas are initialized at startup rather than through migrations. Local development writes ignored databases under each service's `data/`; Compose uses named volumes and `/data`.
- Preserve public JSON field names and existing HTTP status behavior across service boundaries. There is no generated shared schema, so the typed Astro clients and receiving models must be updated together.
- Seed data is deterministic and intentionally includes inconsistent states used by exercises. Update `tools/seedgen.py` and regenerate its outputs rather than hand-editing generated seed datasets when the seed model changes.
- If a task intentionally completes an exercise gap, update the associated README or `exercises.md` wording so documentation no longer claims the old behavior.
- For `course-build/**`, preserve ordered `git format-patch` deltas, manifest tree hashes, and cumulative branch behavior. Read `course-build/REFS.md` and `course-build/OPERATIONS.md` before changing generation or promotion logic.
