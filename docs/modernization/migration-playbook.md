# Java Service Migration Playbook

This playbook defines the default process for modernizing one AssetTrack Java
service at a time. It supersedes service-specific migration research as the
process authority: service plans still provide exact target versions,
dependency decisions, and known risks, while this document governs sequencing,
scope, evidence, and approval gates.

The goal is not merely to make the application compile on newer versions. A
successful migration preserves public behavior, keeps intentional course
exercise targets intact, produces clean target-version bytecode, and leaves no
known-vulnerable dependency in the resolved runtime graph.

## 1. Operating principles

### One service, one phase, one approval

- Select exactly one service.
- Work on one migration phase per approved turn or change set.
- Do not begin the next phase because the current phase passed.
- Keep framework migration separate from optional refactoring, persistence
  changes, performance tuning, and feature work.
- Treat a cross-service or frontend change as a separate project unless the
  approved migration plan explicitly requires it.

This sequencing makes failures attributable. If Java, Spring Boot, persistence,
and application code all change together, a green or red build provides much
less useful evidence.

### Preserve behavior before improving it

Modernization is not permission to redesign the service. Preserve:

- endpoint paths, status codes, and public JSON field names;
- database ownership, schema, seed data, and initialization behavior;
- environment-variable and runtime configuration contracts;
- documented partial-failure or integration behavior;
- intentional vulnerabilities and teaching gaps that are outside the selected
  exercise.

Record desirable but unrelated improvements as follow-on work.

### Evidence beats configuration

A version in `pom.xml` is an intention, not proof. Validate the active JDK,
resolved dependency graph, compiled bytecode, test results, runtime behavior,
and container wiring independently.

## 2. Required migration profile

Before editing, create or approve a service-specific profile containing:

| Item | Required detail |
|---|---|
| Service boundary | Service directory and exclusive repository wiring |
| Current stack | JDK, Java target, Spring Boot, Spring Framework, server, serializer, persistence |
| Target stack | Exact approved versions, not version ranges |
| Maintenance prerequisite | Latest supported maintenance release required before the major jump |
| Dependency surface | Direct dependencies, BOM overrides, plugins, processors, test libraries |
| Source exposure | `javax.*`, `jakarta.*`, Spring APIs, Jackson types, security/token libraries |
| Configuration exposure | Renamed or removed properties and environment variables |
| Runtime wiring | Dockerfile, Compose, scripts, CI, devcontainer, deployment manifests |
| Behavioral contracts | HTTP, JSON, database, seed, initialization, and integration expectations |
| Security constraints | Required pins, forbidden packages, and vulnerability scanning method |
| Explicit exclusions | Refactors, persistence migrations, features, and exercise targets not being changed |
| Phase gates | Commands and observable exit criteria for every phase |
| Rollback boundary | Smallest change that restores the prior passing phase |

Do not extrapolate exact dependency versions from another service. Services
that share Spring Boot can still have different serializer, ORM, token,
database, and test migration requirements.

## 3. Preparation and inventory

Read the complete service plan, service README, root architecture and exercise
documentation, `pom.xml`, source, tests, configuration, Dockerfile, and any
repository instructions that apply to Java files. Inspect the worktree before
editing and preserve unrelated changes.

Build an inventory using the following questions:

1. Is the service already on the latest maintenance release from which the
   target major supports migration?
2. Which Java version runs Maven, and which Java release does Maven compile?
3. Are build and runtime container images aligned?
4. Does source code import APIs that changed namespace or package?
5. Does application code reference Jackson, servlet, validation, persistence,
   or test types directly?
6. Which transitive dependencies are hidden behind starters or third-party
   integration libraries?
7. Which dependency versions are deliberately pinned for security?
8. Which tests assert current JSON, initialization, and persistence behavior?
9. Which generated IDE files exist, and are they committed or local-only?
10. Which gaps are intentional course material and therefore out of scope?

Before each phase, state:

- the phase objective and current/target versions;
- the files allowed to change;
- the expected edits;
- the validation commands and exit criteria.

## 4. Phase 0 - Behavioral safety net

**Objective:** make regressions observable before changing the runtime or
framework.

Keep the current Java target and Spring Boot version unchanged. Add only the
test support needed to cover existing behavior.

### Minimum coverage

- application context starts;
- health and representative read/write endpoints preserve status and JSON;
- repository insert, query, ordering, and limit behavior;
- schema initialization is repeatable and seed data is not duplicated;
- environment-backed configuration is overridden safely in tests;
- tests use an isolated temporary database rather than service data;
- known intentional defects remain documented and are not silently fixed.

For SQLite integration tests, prefer a temporary file when multiple
connections or contexts must observe the same database. A connection-local
`:memory:` database can disappear or produce different state when the pool
opens another connection.

### Gate

Run both the ordinary test command and the service plan's full lifecycle gate:

```bash
mvn test
mvn verify
```

Record tests, failures, errors, and skipped counts. Do not proceed with a
failing baseline or unexplained skipped coverage.

## 5. Phase 1 - Java toolchain and runtime alignment

**Objective:** move the service to the target Java release while keeping the
existing Spring Boot line fixed.

### Changes

- update the Maven Java release property;
- update committed Docker build and runtime images;
- update service-specific scripts, CI, or deployment wiring that selects the
  old JDK;
- update directly affected service documentation;
- leave the Spring Boot parent and dependency pins unchanged;
- do not commit language-server-generated `.classpath`, `.project`, or
  `.settings` files unless the repository intentionally tracks them.

Confirm the current Spring Boot maintenance line supports the target JDK before
making this an isolated phase.

### Gate

Run the required commands on the target JDK:

```bash
java -version
mvn test
mvn verify
mvn clean verify
```

The clean build is mandatory after changing compiler properties. Maven's
incremental compiler can leave unchanged classes in `target/classes` at the old
bytecode level while `mvn test` and `mvn verify` still pass.

Inspect at least one cleanly compiled application class:

```bash
javap -verbose target/classes/path/to/Application.class
```

Expected class-file major versions include:

| Java | Major version |
|---:|---:|
| 17 | 61 |
| 21 | 65 |

Do not use `mvn help:evaluate -Dexpression=java.version` as the sole compiler
check. Maven expression evaluation can expose the running JVM's
`java.version`, which does not prove the project's configured release or the
bytecode already present in `target`.

### Exit criteria

- active Maven JVM is the target JDK;
- clean application bytecode has the target major version;
- Spring Boot remains on the pre-migration maintenance release;
- baseline test count and behavior remain stable;
- committed runtime wiring selects the target JDK.

## 6. Phase 2 - Spring Boot and dependency migration

**Objective:** move the framework and its managed dependency graph while the
Java toolchain and behavioral baseline remain fixed.

### Research before editing

Review the official migration guide and release notes for:

- minimum Java and Maven requirements;
- removed modules, starters, and auto-configurations;
- package or namespace changes;
- configuration-property changes;
- test-support relocations;
- embedded server changes;
- serializer and JSON behavior changes;
- persistence and transaction changes;
- observability and actuator changes.

Move to the latest required maintenance release of the current Spring Boot line
before making the major jump.

### Dependency rules

- let the Spring Boot BOM manage versions unless there is a documented reason
  to override one;
- preserve or re-point security pins instead of deleting them reflexively;
- inspect third-party integration libraries for transitive dependencies that
  the new Boot BOM no longer manages;
- do not copy ORM, validation, security, or serializer dependencies from a
  sibling service without a service-specific requirement;
- do not introduce a known-vulnerable package at any intermediate phase.

For a Spring Boot 3 to 4 migration, specifically inspect the move to Jackson 3.
Services returning plain records, maps, or DTOs may need no source changes, but
their JSON contracts still require tests. Services importing Jackson types or
using serializer-specific third-party libraries require a dedicated migration
decision.

### Temporary migration aids

Tools such as `spring-boot-properties-migrator` may be used only when the plan
calls for them. Mark them as temporary and remove them before stabilization.
Do not ship a diagnostic migration dependency by accident.

### Gate

```bash
mvn dependency:tree
mvn test
mvn clean verify
```

Use the dependency tree to confirm:

- target Spring Boot and Spring Framework versions;
- target embedded server and serializer lines;
- every required security pin;
- absence of an unexpected legacy serializer or duplicate major line;
- absence of forbidden or known-vulnerable packages.

A dependency tree is version evidence, not a vulnerability scanner by itself.
Use the repository-approved advisory or software-composition analysis gate when
available, and document the source and date of any manual vulnerability
assessment.

### Exit criteria

- the target Spring Boot parent resolves successfully;
- the full clean test suite passes with the baseline contract count;
- required dependency versions are present;
- removed or vulnerable transitive dependencies are absent;
- no unrelated application redesign was introduced.

## 7. Phase 3 - Stabilization

**Objective:** remove migration scaffolding and make only the changes required
to operate the migrated service reliably.

### Required work

- remove temporary migration aids;
- resolve deprecations or warnings that affect supported operation;
- update service documentation to the final stack;
- verify configuration and container startup;
- rerun dependency and clean Maven gates.

### Separate approval required

Do not silently include:

- Java language refactoring merely to demonstrate the new release;
- migration from JDBC to JPA or between persistence technologies;
- virtual-thread enablement;
- connection-pool or transaction redesign;
- schema or seed changes;
- performance tuning;
- CI expansion beyond the approved service;
- fixes for intentional vulnerabilities or unrelated defects.

These may be valuable follow-ons, but they change risk and rollback boundaries.

For SQLite, pay special attention to connection-scoped operations such as
`last_insert_rowid()`. A framework upgrade may expose a pre-existing
concurrency issue without causing it. Validate before changing pool size or
transaction handling, and document throughput tradeoffs.

### Gate

```bash
mvn test
mvn clean verify
mvn dependency:tree
```

Run focused endpoint or application startup checks required by the service
plan.

## 8. Final integration gate

After all service phases are approved and green:

1. Confirm final Java, Spring Boot, serializer, and security-pin versions.
2. Start the service using its supported runtime path.
3. Run the repository end-to-end suite:

   ```bash
   npm run test:e2e
   ```

4. Do not weaken or rewrite tests to manufacture a pass.
5. Fix only failures caused by the selected service or its exclusive wiring.
6. If a fix requires another service or the frontend, report the boundary and
   stop.
7. After any final-gate fix, rerun the service's clean Maven gate before
   rerunning end-to-end tests.

## 9. Documentation and repository hygiene

- Update the service README at the phase where its documented state changes.
- Update root architecture or exercise wording only when the completed
  migration makes existing statements false.
- Do not edit generated learner branches or promotion refs directly.
- Do not commit Maven `target` output, local databases, temporary logs, or
  language-server metadata.
- Review the complete diff and worktree status before reporting a phase
  complete.
- Preserve user changes already present in touched files.

## 10. Phase report template

```markdown
## Phase <N> status

**Target:** Java <version> / Spring Boot <version>

| Check | Command | Result |
|---|---|---|
| Unit/integration tests | `mvn test` | PASS - <tests, failures, errors, skipped> |
| Clean lifecycle | `mvn clean verify` | PASS |
| Bytecode | `javap -verbose ...` | major version <value> |
| Dependencies | `mvn dependency:tree` | <required versions or N/A> |

**Files changed:** <scoped list>

**Runtime/dependency evidence:** <JDK, framework, serializer, server, pins>

**Remaining risks or blockers:** <specific items or none>

Awaiting approval to begin Phase <N+1>.
```

Do not report `PASS` unless the named command ran successfully against the
current worktree. Do not report the overall migration complete until both the
final service gate and repository end-to-end gate pass on the target stack.

## 11. Final status template

```markdown
## Testing status

| Layer | Target stack | Command | Result |
|---|---|---|---|
| Service | Java <version> / Spring Boot <version> | `mvn test` and `mvn clean verify` | PASS - <tests, failures, errors, skipped> |
| Dependencies | Target managed graph | `mvn dependency:tree` and approved security check | PASS - <key versions> |
| End to end | Migrated service integrated with AssetTrack | `npm run test:e2e` | PASS - <passed, failed, skipped> |
```

Include:

- final Java bytecode major version;
- Spring Boot, Spring Framework, embedded server, and serializer versions;
- retained security pins and why they remain;
- optional follow-on work that was deliberately excluded;
- any warning that remains non-blocking and its future remediation point.

## 12. Common failure patterns

| Failure pattern | Why it is misleading or risky | Corrective action |
|---|---|---|
| `pom.xml` says Java 21, so Java 21 is proven | Incremental output may still contain Java 17 classes | Run `mvn clean verify` and inspect class major version |
| Maven runs on Java 21, so output targets Java 21 | Runtime JDK and compiler release are independent | Inspect Maven configuration and clean bytecode |
| Tests pass, so JSON is unchanged | Tests may not assert field names, ordering assumptions, or defaults | Add contract assertions before migration |
| Boot BOM manages dependencies, so the tree is safe | Third-party libraries and native Boot versions can still be vulnerable | Inspect the resolved tree and run the approved security gate |
| A sibling service uses a dependency, so this service should too | Services have different persistence and integration surfaces | Add only dependencies justified by the selected service |
| IDE metadata still says Java 17, so the build is wrong | Generated language-server files may be stale and untracked | Trust clean Maven evidence; regenerate local metadata separately |
| Framework migration is a good time to refactor | Combined changes obscure regressions and complicate rollback | Defer refactoring to a separately approved phase |
| A pre-existing defect appears during migration, so it must be fixed | It may be an intentional exercise or unrelated risk | Check documentation and scope before editing |

