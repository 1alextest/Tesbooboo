# Tesbo Test Manager Nest Backend

Primary NestJS backend for Tesbo Test Manager.

## API coverage

The service exposes the Tesbo Test Manager product API surface used by the frontend, including auth, setup, workspace, projects, suites, test cases, plans, cycles, reports, AI stubs, admin views, and health checks.

The service uses the PostgreSQL schema in `migrations/` and the `tesbo_session` cookie contract.

## PostgreSQL history-import assurance

`src/automation/automation-closure.db.spec.ts` is already selected by the
`database-integrity` job in `.github/workflows/behavioral-quality.yml`. Reuse its
production migrations, disposable `tesbo_ci` service, dedicated committed fixtures
and independent database connections; do not target the shared application database.
The database-name guard alone is not authorization to connect to an arbitrary DB.

The rollback-after-write regression keeps `DatabaseService.transaction` intact and
observes a real completed run UPDATE plus its pending changed values. A later
result payload containing U+0000 reaches PostgreSQL JSONB conversion and must fail
with SQLSTATE `22P05`. Full persisted run, execution, snapshot, audit and attachment
rows are compared with their pre-import state through an independent connection.
A valid retry must then commit on the same single-connection import pool. Auth and
activity delivery are stubbed as in the existing DB tests; this is not REST/MCP
authorization or real audit-delivery coverage.

**Verification boundary:** the test's presence, compilation, or a locally skipped
suite is not a rollback proof. Require execution on migrated PostgreSQL and attach
the latest CI evidence to its PR. This scenario fails after the run write but before
any result/snapshot write; it does not establish rollback after every later stage.

**Adjacent finding (deferred):** `LegacyService.historyText` accepts U+0000, which
PostgreSQL cannot store in JSONB/text. The source-established validation gap can
surface a database error instead of a field-level validation response (medium
error-handling risk; HTTP behavior not yet reproduced). Consider explicit input
validation in a separate behavior-changing fix with API regressions. If validation
is strengthened, replace this failure probe with another genuine late DB failure;
never remove the completed-write/non-vacuity requirement to make the test pass.

## Run locally

Development tooling requires Node `^22.18.0 || >=24.11.0` (including the locked
Stryker/Babel dependencies). CI and Docker use the Node 22 LTS line.

```bash
npm ci
npm run build
PORT=7700 npm start
```

Set `DATABASE_URL`, `DATABASE_USER`, and `DATABASE_PASSWORD` for your PostgreSQL database. Run migrations before starting the API:

```bash
npm run build
npm run migrate
```

The SQL files in `migrations/` are the source of truth for schema creation.

## Reproducible dependencies and security patches

Commit dependency updates in `package.json` and `package-lock.json`; build and CI use
`npm ci`. Do not run `npm update`, ad-hoc `--no-save` installs, `--force`, or
`--legacy-peer-deps` inside the image or mutation job.

- Langfuse remains at the tested `5.10.1` release with OpenTelemetry API `1.9.1`,
  SDK `0.221.0`, and an explicit HTTP trace exporter `0.221.0`. The SDK/core peers
  require API `<1.10.0`; the exporter accepts `^1.3.0`. Langfuse's broad exporter
  peer range otherwise permits `0.301.1`, which requires API `^1.10.0` and conflicts
  with this SDK. Upgrade the tracing graph together, not an individual peer.
- Manifest overrides preserve NestJS 10's patched Multer and body-parser graph in
  **both** normal installations and the image. The version-specific glob override
  replaces `10.4.5` with its compatible `10.5.0` security release, without forcing
  legacy glob 7 consumers onto a different API.
- Stryker core/runner are exact, locked development dependencies. Run
  `npm run test:mutation`; the existing mutation scope and score gate are unchanged.
- English OCR data is a locked build dependency, copied from the builder into the
  runtime image. The production install never resolves extra packages afterward.

After an update, run typecheck, the frozen lint-baseline check, compilation, backend
regressions, mutation tests, and production dependency audit. GitHub CI additionally
owns disposable migrated-PostgreSQL tests, application smoke tests and the Trivy
image gate. An npm audit is not a substitute for the image scan; remaining moderate
findings are tracked in `docs/FEATURE_DOCUMENTATION.md` and are not waived.
