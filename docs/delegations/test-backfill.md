# Test Backfill Delegation Brief: Playwright Accessibility Coverage

**Audience:** Copilot cloud agent (Copilot Coding Agent)

## Context

A minimal Playwright browser test suite for the AssetTrack web UI was started locally:

- `playwright.config.ts` — Chromium-only project, `baseURL: http://localhost:4321`, `webServer` runs `npm run dev` (starts the full polyglot dev stack) and reuses an already-running server when present.
- `tests/playwright/smoke.spec.ts` — home, `/assets`, and `/employees` load checks.
- `tests/playwright/accessibility.spec.ts` — dashboard landmarks, `aria-current` active-nav state, Tab/Enter keyboard access to the Assets link, and label-based coverage of the new-asset form and asset list filters.

Root scripts: `npm run test:e2e` (`playwright test`) and `npm run test:e2e:ui` (`playwright test --ui`).

## Primary Goal

Expand this Playwright accessibility suite under `tests/playwright/`. Do not start a new framework or config — build on what already exists.

## Areas to Cover

- **Dashboard:** heading hierarchy, link focus order across dashboard content (not just nav), any dashboard-specific summary/stat regions exposed with a role.
- **Navigation:** full keyboard traversal of all nav links (Dashboard, Assets, Employees, Assignments, Reports), not just Assets; confirm `aria-current` toggles correctly when moving between all of them; confirm nav landmark stays present across pages.
- **Asset list filters:** Type and Status `<select>` filters are keyboard-operable (focus, open, choose an option), the search input supports typing and clearing, the Filter button and conditional Clear link are reachable by keyboard and have accessible names, and the results table exposes `columnheader`/`row` roles.
- **New asset form:** every remaining labeled field (status, purchase date, warranty expiry, notes) is reachable via `getByLabel`, the submit button has an accessible name and is keyboard-activatable, and error/alert content (when the create call fails) is exposed with a role Playwright can query (e.g. `alert`).

## Locator Requirements

- Prefer `getByRole()` and `getByLabel()` (and other semantic locators such as `getByText()` for headings/alerts) over CSS selectors.
- Only fall back to a CSS/`locator()` selector when there is no accessible role, name, or label to target, and note why in a comment when you do.
- Continue exercising keyboard flows (Tab, Enter) alongside role/label assertions, not just visibility checks.

## Secondary Goal: xUnit Backfill for assets-svc

Add xUnit coverage in `services/assets-svc/Tests/` (currently smoke-test only) for the assets API:

- **Create:** valid asset creation; missing required fields; invalid data types.
- **Read:** existing asset by ID; non-existent ID (404); malformed ID.
- **Update:** valid changes; non-existent ID; partial updates.
- **Delete:** existing asset; non-existent ID (idempotency).
- **Search:** filter by `type`, `status`, and `q`; combined filters; no matches.
- **Stats-by-status:** correct counts for seeded/fixture data.
- **Not-found edge cases:** consistent 404 behavior across the read/update/delete endpoints above.

Use an isolated SQLite database per test class (in-memory or a temp file) with minimal seeded fixture data; do not depend on the shared dev database. Framework already present: xUnit, `Microsoft.AspNetCore.Mvc.Testing`.

**Run command:** `dotnet test services/assets-svc/Tests/AssetsService.Tests.csproj`

## Secondary Goal: pytest Backfill for reporting-svc

Add pytest coverage in `services/reporting-svc/tests/` (currently empty aside from a placeholder README):

- **Warranty-expiring report:** assets within the expiry threshold are returned correctly; empty results; upstream `assets-svc` error handling.
- **Utilization report:** correct assigned-vs-available calculations; edge cases (zero assets, all assigned, all available).
- **CSV import:** valid CSV import succeeds; malformed CSV returns a helpful error; a CSV with one bad row still imports the valid rows and reports the skipped row.

Mock cross-service HTTP calls (`assets-svc`, `workforce-svc`) rather than requiring the live services to be running. Declare any new test-only dependencies (e.g. `pytest-mock`, `respx`) under `pyproject.toml`'s dev/optional dependencies.

**Run command:** `pytest services/reporting-svc/tests/`

## Constraints

- Do not change production application code. If a test reveals a genuine accessibility gap or bug (e.g., an unlabeled control, an incorrect report calculation), document it instead of silently working around it; propose the fix separately.
- Do not add new backend framework dependencies unless required for the test framework already implied by the service (xUnit + `Microsoft.AspNetCore.Mvc.Testing` for `assets-svc`, pytest for `reporting-svc`).
- Prefer isolated test data and temporary SQLite databases — no shared/dev databases, no dependency on live running services.
- Mock cross-service HTTP calls (for example, `reporting-svc`'s calls to `assets-svc`) instead of requiring live services.
- If you add a test-only dependency such as a mocking library, declare it in the service's dependency manifest (`.csproj` `PackageReference`, `pyproject.toml` dev/optional dependencies) so the tests run from a clean install.
- If a real production bug blocks a test, document it in the PR instead of fixing it.
- Include exact commands and results in the PR description.
- Follow the Module 2 contribution standard: open an issue using the repository's issue template, link it from the pull request, and use the pull request template.
- Do not introduce a second test runner or config for any of the three suites; extend what already exists (`playwright.config.ts`, `services/assets-svc/Tests/AssetsService.Tests.csproj`, `services/reporting-svc/tests/`).
- Keep the Playwright suite fast and deterministic — Chromium only, no arbitrary `waitForTimeout` sleeps where a locator assertion can wait instead.
- Reuse the existing Playwright `webServer` (`npm run dev`) rather than adding a separate startup mechanism.

## Verification

Run all three suites and include pass/fail counts and a coverage summary in the PR description:

- `npm run test:e2e` (Playwright, from the repository root)
- `dotnet test services/assets-svc/Tests/AssetsService.Tests.csproj`
- `pytest services/reporting-svc/tests/`

Classify any failures as a test bug, an app bug/accessibility gap, or an environment/startup issue, per the working convention established in this repo.

## Success Criteria

- New Playwright tests pass locally against the existing dev stack; coverage visibly extends beyond the current dashboard/nav/keyboard/form/filter checks without duplicating existing tests.
- New xUnit tests pass and cover create/read/update/delete/search/stats-by-status/not-found for `assets-svc`.
- New pytest tests pass and cover warranty-expiring reports, utilization reports, and CSV import for `reporting-svc`, using mocks rather than live services.
- No production code changes are included unless a fix was explicitly requested and approved separately.
