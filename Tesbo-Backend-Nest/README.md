# Tesbo Test Manager Nest Backend

Primary NestJS backend for Tesbo Test Manager.

## API coverage

The service exposes the Tesbo Test Manager product API surface used by the frontend, including auth, setup, workspace, projects, suites, test cases, plans, cycles, reports, AI stubs, admin views, and health checks.

The service uses the PostgreSQL schema in `migrations/` and the `tesbo_session` cookie contract.

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
