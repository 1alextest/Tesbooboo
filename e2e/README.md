# Tesbo Playwright API and UI suite

Tesbo runs end-to-end tests against its NestJS API and Next.js application. The main Playwright configuration groups tests into two projects. The API project uses HTTP requests and, where the scenario requires it, reads the database independently. The UI project drives Desktop Chrome through Chromium and records screenshots and traces on failure. The ticket regressions under `regression/api` and `regression/ui` belong to those same projects. A separate CI configuration exercises a small set of deployment smoke tests. [Main configuration](playwright.config.ts) · [Dedicated CI smoke configuration](playwright.ci-smoke.config.ts) · [Ticket regression scope](regression/README.md)

The [GitHub Actions workflow](../.github/workflows/smoke-security-quality.yml) starts isolated application services with PostgreSQL/pgvector and Redis, runs the dedicated smoke tests, and executes selected API and browser scenarios on pull requests. The [stage Jenkins pipeline](../Jenkinsfile.e2e) also defines a scheduled run. Coverage depends on the filters, environment, available fixtures and actual results of each invocation. The main configuration allows one retry in CI and zero locally. Browser coverage in this configuration is desktop Chromium. Native Android/Appium, Firefox and WebKit would each need their own target.

### Inventory at development commit `399b1803`

On November 25, 2026, Playwright Test 1.61.1 collected the following entries with the locked dependencies. The main collection used inert local context files for suites that read fixture identifiers during discovery. Test bodies did not execute.

| Project | Core entries / files | Reported-ticket regression entries / files | Total entries / files |
| --- | --- | --- | --- |
| API | 1,849 / 46 | 52 / 4 | 1,901 / 50 |
| UI | 1,144 / 34 | 47 / 9 | 1,191 / 43 |
| Main configuration | 2,993 / 80 | 99 / 13 | 3,092 / 93 |

The separate CI smoke configuration listed 19 tests in one file. In the main collection, the published reporter 0.2.0 recognized a declared Tesbo case marker on 1,465 entries, covering 1,384 distinct declared IDs. Another 1,627 entries carried no recognized marker at collection. A repeated ID can be intentional. Checking those IDs against a live project's cases and finding an actual Run receipt are separate operations. At this commit, the four `ZYR-P07` tests had no declared native case marker. All four did execute successfully in the [PR 281 CI job](https://github.com/1alextest/Tesbooboo/actions/runs/45666270840/job/139389141342). The [stale-save walkthrough](../docs/qa-orchestration/examples/zyra-stale-save.md) shows what the new reviewer would add to the existing test runner.

The repository's separate coverage script found a source reference to 357 of 377 eligible HTTP method/route pairs and 57 of 59 eligible UI pages at that commit. It could not match the knowledge-base trash or project Skills settings pages. The count measures recognizable references in test source. Whether a test would catch the relevant defect requires inspecting and exercising its assertions. [Coverage script](scripts/coverage-report.ts)

## Running locally

From the repo root, after the docker-compose stack is up and healthy:

```
scripts/deploy-and-test.sh
```

This rebuilds the backend/frontend/migrator images, brings the stack up, waits for the
backend and frontend health checks, then runs the full suite.

To run the suite directly (stack already up):

```
cd e2e
npm ci
npm run install-browsers   # once, downloads the Chromium binary
npm test                   # both projects
npm run test:api           # API tests only
npm run test:ui            # UI tests only
npm run report             # open the last HTML report
```

## How auth works in these tests

There's no API endpoint that returns a signup OTP. Outside production the backend runs with
`EMAIL_DELIVERY_MODE=log` (the default), which prints the code to the backend container's stdout and
never emails it — whether or not a `POSTMARK_API_TOKEN` is configured. So:

- `global-setup.ts` runs once before any test. It first tries `POST
  /api/auth/password/login` with the configured smoke-test credentials
  (`E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD`, defaults in `.env.example`).
- If that fails and the target looks local (`API_BASE_URL` is localhost/127.0.0.1, or
  `E2E_AUTO_PROVISION=true` is set explicitly), it signs the user up via `/api/auth/signup/start`,
  scrapes the OTP out of `docker compose logs <service>`, and verifies it via
  `/api/auth/signup/verify`.
- It then ensures the user has a workspace + project (creating `E2E_ORG_NAME` /
  `E2E_PROJECT_NAME` if needed), and saves the authenticated session cookie to
  `.auth/state.json` plus `{ organizationId, projectId }` to `.auth/context.json` for every
  spec file to reuse.
- Against a remote target where you don't have docker log access, pre-create this user
  yourself and set `E2E_AUTO_PROVISION=false` (or just leave it unset — it already defaults
  to false for non-local hosts).

The seeded user and its "E2E Smoke Project" persist across runs (the docker volume isn't
wiped), so re-runs reuse the same account/project rather than accumulating new ones. Test
cases created by tests delete themselves at the end of the test.

## Choosing an environment

One file per environment under [`environments/`](environments/), selected with `E2E_ENV`. Nothing
else changes — the specs, the helpers and `playwright.config.ts` all resolve their target through
[`utils/env.ts`](utils/env.ts), which loads the selected file before the first value is read.

```bash
npx playwright test                       # local  — environments/local.env (the default)
E2E_ENV=stage npx playwright test         # stage  — environments/stage.env
E2E_ENV=stage npx playwright test regression/
E2E_ENV_FILE=/secrets/qa.env npx playwright test    # or name the file outright

npm run test:stage                        # the same thing, spelled as a script
```

Every run prints what it resolved before the first test, so a misdirected run is visible
immediately rather than forty lines into a `global-setup` stack trace:

```
e2e environment: stage — environments/stage.env
  api:      https://api-app-stage.tesbo.io
  web:      https://app-stage.tesbo.io
  account:  testing.staging105070@mailinator.com
  database: not configured — SQL-fixture specs will skip themselves
  provision: off — tenants must already exist
```

Three rules worth knowing:

- **`process.env` beats the file.** CI injects credentials as environment variables and the
  committed file supplies only the non-secret remainder. It also lets you override one value for a
  single run without editing anything.
- **`KEY=` means "not configured"**, not "the empty string" — the loader skips those lines, so
  whatever fallback sits behind them still applies.
- **A named environment that doesn't exist is a hard error**, never a silent fall-back to
  localhost. The *default* (`local`) is the one exception: if `environments/local.env` is absent,
  the built-in defaults apply and nothing fails.

Real `.env` files are gitignored; each environment ships a committed `.env.example`. Never commit a
password or a connection string.

## Running against the stage environment

Stage is https://app-stage.tesbo.io with its API at https://api-app-stage.tesbo.io. The specs
themselves need no changes — the suite already targets whatever `API_BASE_URL` / `WEB_BASE_URL`
point at. Three things are different about a remote target, and `scripts/e2e-stage.sh` exists to
handle all three:

1. **Tenants must already exist.** `global-setup.ts` fails the whole run if it cannot log in as
   account A or account B. On a local stack it creates them by scraping the signup OTP out of
   `docker compose logs`; there is no container log to read on stage, so both accounts have to be
   signed up by hand first and their credentials put in `e2e/environments/stage.env`.
2. **The SQL-fixture specs skip by default.** `utils/psql.ts` refuses to guess a database, so
   `dbControlAvailable()` is false and every suite that arranges state through SQL skips itself
   (~29 spec files). Setting `E2E_DATABASE_URL` to stage's own connection string unlocks them —
   the local postgres container is only transport for the `psql` binary, so a hosted URL is
   reachable — at the cost of real writes to the stage database. The runner requires
   `E2E_STAGE_DB_WRITES_ACK=yes` on top of it for that reason.
3. **Stage is shared.** Stripe write tests are refused outright, and the runner refuses any host
   that does not look like a stage host. The local stack's `DATABASE_URL` and `STRIPE_*` cannot
   leak into a remote run: `utils/env.ts` accepts only the `E2E_`-prefixed form once the target is
   not localhost, so this holds for a plain `E2E_ENV=stage npx playwright test` too, not just for
   runs that go through the script.

```bash
cp e2e/environments/stage.env.example e2e/environments/stage.env   # then fill in the accounts
scripts/e2e-stage.sh api/health.spec.ts api/testcases.spec.ts
```

It announces the selection and the suite total, refuses a 0-test selection, refuses to start while
another run holds `e2e/.auth/state.json`, and opens a Terminal window at `--workers=10` teeing to
`e2e/.run-logs/stage-<stamp>.log` — the same protocol as `scripts/e2e-run.sh`.

Note that `e2e/.auth/` is shared with local runs. Each run's global setup rewrites it, so they
self-heal in sequence, but never run a local suite and a stage suite at the same time.

## Reporting results into Tesbo

`playwright.config.ts` registers `@tesbox/playwright-reporter`, which can submit linked results to the configured Tesbo project when reporting is enabled. A reporter override on the command line changes the active reporters. The stage wrapper uses list, JUnit and HTML output. [Stage runner](../scripts/e2e-ci.sh)

**Never commit an API token.** The former `e2e/tesbo.config.json` contained a real-looking
write-capable token and was removed from source control. That token must remain revoked.
`e2e/tesbo.config.json` is now ignored by Git; the safely shareable
`e2e/tesbo.config.example.json` has only placeholder public settings.

To report from your own machine, provide `TESBO_BASE_URL`, `TESBO_PROJECT_ID`, and
`TESBO_API_TOKEN` in the environment. The token must have read/write scope for writing
test results. You can alternatively create an ignored `e2e/tesbo.config.json` with
`baseUrl` and `projectId` (never put the token in that file), and provide the token
through `TESBO_API_TOKEN`.

For GitHub Actions, add `TESBO_API_TOKEN` under repository Actions **Secrets**,
and `TESBO_BASE_URL` / `TESBO_PROJECT_ID` under Actions **Variables**. Only inject
the secret into trusted reporting jobs (not untrusted fork pull requests). Example:

```yaml
env:
  TESBO_BASE_URL: ${{ vars.TESBO_BASE_URL }}
  TESBO_PROJECT_ID: ${{ vars.TESBO_PROJECT_ID }}
  TESBO_API_TOKEN: ${{ secrets.TESBO_API_TOKEN }}
```

The reporter automatically disables outbound reporting when `TESBO_API_TOKEN` is absent.
This supports untrusted PR builds without sharing a project write credential.
When reporting is required for a trusted release job, add an explicit preflight check
for all three environment values so a missing token cannot silently pass.

Each test is linked to the case it validates by a tag:

```ts
test("ACT-A-01 an action in a project appears in that project's feed", { tag: '@tesbo.testId("TES-TC-886")' }, async () => {
```

- The leading `@` is required — Playwright rejects any tag without it at collection time.
- **One id per test.** Two is an error, not a coin flip.
- An untagged test is reported as `not linked to Tesbo` and does not fail anything. Tests generated
  in a loop from a single `test()` call are untagged for that reason: one call site cannot carry one
  id per generated test.
- An unknown case ID produces a warning in the default configuration. Strict mode makes it an error. The reporter can attach results to an existing case once the mapping resolves. [Reporter behavior](../sdk/playwright-reporter/README.md#untagged-tests)

When adding a spec, look up the case in Tesbo and add its id. When there is no case yet, leave the
test untagged rather than pointing it at an approximate one.

## Config

Copy `.env.example` to `.env` and adjust if needed — every value has a working default for
the local stack. See that file for the full list (`API_BASE_URL`, `WEB_BASE_URL`,
`E2E_TEST_EMAIL`, etc).

## Layout

```
e2e/
  global-setup.ts     # provisions the smoke user + workspace/project, saves auth state
  playwright.config.ts
  api/                 # APIRequestContext-based tests, no browser
  ui/                  # browser-driven tests (chromium)
  utils/env.ts         # central env var + defaults
```
