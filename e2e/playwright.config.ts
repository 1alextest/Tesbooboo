import path from "node:path";
import { defineConfig, devices, type ReporterDescription } from "@playwright/test";
import { env, loadedEnvironment } from "./utils/env";


/*
 * Which environment this run is aimed at, printed before the first test.
 *
 * Selected with E2E_ENV (see utils/env-file.ts); `local` when nothing is given. The banner is here
 * rather than in global-setup so it also prints for `--list`, and because the failure it exists to
 * prevent happens *before* global-setup gets far enough to say anything useful: a run that silently
 * defaulted to the wrong host reported "Provisioned <user> but the follow-up password login still
 * failed", forty lines of stack, and no mention anywhere of the URL it had been talking to.
 *
 * Printed once — TEST_WORKER_INDEX is set in workers, which re-import this config.
 */
if (process.env.TEST_WORKER_INDEX === undefined) {
  const loaded = loadedEnvironment();
  const db = env.dbUrl
    ? "configured — SQL-fixture specs will run and WRITE to it"
    : "not configured — SQL-fixture specs will skip themselves";
  process.stdout.write(
    [
      `e2e environment: ${loaded.name ?? "(none — built-in defaults)"}` +
        `${loaded.file ? ` — ${path.relative(__dirname, loaded.file)}` : ""}` +
        `${loaded.explicit ? "" : " [default; set E2E_ENV to change]"}`,
      `  api:      ${env.apiBaseUrl}`,
      `  web:      ${env.webBaseUrl}`,
      `  account:  ${env.testEmail}`,
      `  database: ${db}`,
      `  provision: ${env.autoProvision ? "on — tenants are created as needed" : "off — tenants must already exist"}`,
      "",
    ].join("\n"),
  );
}

export default defineConfig({
  testDir: __dirname,
  testMatch: /(api|ui)\/.*\.spec\.ts/,
  /*
   * 30s was right when the stack's database was the compose postgres container. It is not right for
   * a stack pointed at a hosted Postgres: a single round trip costs tens of milliseconds instead of
   * a fraction of one, and provisionRbacTenant — which creates an org, three users, two projects and
   * their memberships before a suite can start — measures ~57s against this stack's Neon instance.
   * That overran the 30s budget in the `beforeAll` of all 22 suites that own a tenant, so they
   * failed to start rather than failing an assertion.
   *
   * This is the harness's setup budget, not a product-timing assertion, and no assertion below is
   * relaxed by it. Where the product's own speed is the thing under test, the bound is written into
   * the test and left tight — see execution-ops.spec.ts EXO-E-01, which still holds a 250-case add
   * to 30s because that is the ceiling the 524 came from.
   */
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: env.ci ? 1 : 0,
  /*
   * This suite reports its own results back into Tesbo — the product it tests.
   *
   * The reporter reads baseUrl, projectId, and token from TESBO_BASE_URL,
   * TESBO_PROJECT_ID, and TESBO_API_TOKEN. An optional ignored local config file
   * may supply the first two values, never a credential committed to Git.
   * Keep options out of this block so environment variables always take precedence;
   * hardcoding them previously caused test results to reach the wrong instance.
   *
   * This block used to carry a hardcoded `http://localhost:1021` fallback, its own
   * TESBO_REPORTER_* environment names, and a four-clause `enabled` gate, none of which exist in
   * the SDK. That divergence is what made this repo a bad template for anyone integrating
   * Playwright with Tesbo, and it is deliberately gone: what remains is the shape the SDK's README
   * documents, so a normal project can copy it verbatim.
   *
   * To point a run somewhere else, set TESBO_BASE_URL / TESBO_PROJECT_ID / TESBO_API_TOKEN in the
   * environment — those beat the file without editing anything.
   */
  reporter: [
    ["list"],
    ...(env.ci ? [["html", { open: "never" }] as ReporterDescription] : []),
    [
      "@tesbox/playwright-reporter",
      {
        /*
         * Recorded on the run so results from a laptop are filterable apart from CI's.
         * Each environment configures its own explicit target. `env.environment` is
         * the E2E_ENV file in effect ("local", "stage"); "staging" is the fallback.
         */
        environment: env.environment ?? "staging",
        /*
         * Require an explicitly injected token to enable reporting; fork PR jobs,
         * anonymous local runs, and checkouts of the public repo must never
         * authenticate to the historical project's reporting endpoint.
         * TESBO_REPORTER_ENABLED=0 remains an explicit local opt-out.
         */
        // Fork/PR CI jobs do not receive project secrets. Reporting is explicitly
        // disabled unless the workflow supplies all credentials from its trusted context.
        enabled:
          process.env.TESBO_REPORTER_ENABLED !== "0" &&
          Boolean(process.env.TESBO_API_TOKEN?.trim()),
      },
    ],
  ],
  globalSetup: require.resolve("./global-setup"),
  use: {
    storageState: path.join(__dirname, ".auth/state.json"),
  },
  projects: [
    {
      name: "api",
      testMatch: /api\/.*\.spec\.ts/,
      use: { baseURL: env.apiBaseUrl },
    },
    {
      name: "ui",
      testMatch: /ui\/.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: env.webBaseUrl,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
      },
    },
  ],
});
