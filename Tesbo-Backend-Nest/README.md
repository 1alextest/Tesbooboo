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

```bash
npm install
npm run build
PORT=7700 npm start
```

Set `DATABASE_URL`, `DATABASE_USER`, and `DATABASE_PASSWORD` for your PostgreSQL database. Run migrations before starting the API:

```bash
npm run build
npm run migrate
```

The SQL files in `migrations/` are the source of truth for schema creation.
