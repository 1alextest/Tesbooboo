import assert from "node:assert/strict";
import { test } from "node:test";
import type { FullConfig, Suite } from "@playwright/test/reporter";
import TesboReporter, { TesboClient } from "./index";
import { ENV_BASE_URL, ENV_PROJECT_ID, ENV_TOKEN } from "./config";
import { createServer, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { execFile } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { FullResult, TestCase, TestResult } from "@playwright/test/reporter";

const PROJECT = "41dba2a2-a60b-4917-8d63-9f8a86986703";
const TOKEN = "tsbo_f89c09aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const BASE = "https://api-app-stage.tesbo.io";

/** Minimal stand-ins: every assertion below is reached before the suite or config is inspected. */
const fakeConfig = { shard: null } as unknown as FullConfig;
const emptySuite = { allTests: () => [] } as unknown as Suite;

/**
 * Runs `body` with the three env vars forced to a known state.
 *
 * Necessary because `resolveConfig` reads `process.env`, and this machine's own shell may export
 * them — a test that passed only because the developer had a token exported would be worthless.
 */
async function withEnv(vars: Record<string, string | undefined>, body: () => Promise<void>): Promise<void> {
  const names = [ENV_BASE_URL, ENV_PROJECT_ID, ENV_TOKEN];
  const saved = new Map(names.map((n) => [n, process.env[n]]));
  try {
    for (const name of names) {
      const value = vars[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    await body();
  } finally {
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

/** Swallows the reporter's console output so the test log stays readable, and returns what it said. */
async function captureLogs(body: () => Promise<void>): Promise<string> {
  const lines: string[] = [];
  const realLog = console.log;
  const realWarn = console.warn;
  console.log = (...args: unknown[]) => void lines.push(args.join(" "));
  console.warn = (...args: unknown[]) => void lines.push(args.join(" "));
  try {
    await body();
  } finally {
    console.log = realLog;
    console.warn = realWarn;
  }
  return lines.join("\n");
}

/* ─────────────────────────── partial config is a hard failure ─────────────────────────── */

/*
 * The behaviour the whole config split exists for. A run that reported nothing while exiting 0 is
 * indistinguishable from a run that reported everything, so a half-configured reporter must stop the
 * suite — with `requireConfig` off, which is the default.
 */
test("a missing token throws at collection time, even with requireConfig off", async () => {
  await withEnv({ [ENV_BASE_URL]: undefined, [ENV_PROJECT_ID]: undefined, [ENV_TOKEN]: undefined }, async () => {
    const reporter = new TesboReporter({ baseUrl: BASE, projectId: PROJECT });
    await assert.rejects(() => reporter.onBegin(fakeConfig, emptySuite), /TESBO_API_TOKEN is missing/);
  });
});

test("a missing base url throws — it is never assumed", async () => {
  await withEnv({ [ENV_BASE_URL]: undefined, [ENV_PROJECT_ID]: undefined, [ENV_TOKEN]: undefined }, async () => {
    const reporter = new TesboReporter({ projectId: PROJECT, token: TOKEN });
    await assert.rejects(() => reporter.onBegin(fakeConfig, emptySuite), /TESBO_BASE_URL is missing/);
  });
});

test("a missing project id throws", async () => {
  await withEnv({ [ENV_BASE_URL]: undefined, [ENV_PROJECT_ID]: undefined, [ENV_TOKEN]: undefined }, async () => {
    const reporter = new TesboReporter({ baseUrl: BASE, token: TOKEN });
    await assert.rejects(() => reporter.onBegin(fakeConfig, emptySuite), /TESBO_PROJECT_ID is missing/);
  });
});

test("an unusable base url throws rather than being retried against all run", async () => {
  await withEnv({ [ENV_BASE_URL]: undefined, [ENV_PROJECT_ID]: undefined, [ENV_TOKEN]: undefined }, async () => {
    const reporter = new TesboReporter({ baseUrl: "not-a-url", projectId: PROJECT, token: TOKEN });
    await assert.rejects(() => reporter.onBegin(fakeConfig, emptySuite), /must start with http/);
  });
});

/* ─────────────────────────── nothing configured is an opt-out ─────────────────────────── */

/*
 * Card §7's case: a fork's pull request build has no secrets and must still be able to run the
 * suite. This is the one state allowed to degrade quietly.
 */
test("nothing configured disables the reporter without failing the suite", async () => {
  await withEnv({ [ENV_BASE_URL]: undefined, [ENV_PROJECT_ID]: undefined, [ENV_TOKEN]: undefined }, async () => {
    const reporter = new TesboReporter();
    const logs = await captureLogs(async () => {
      await reporter.onBegin(fakeConfig, emptySuite);
      await reporter.onEnd({ status: "passed" } as never);
    });
    assert.match(logs, /not configured/);
  });
});

test("requireConfig turns that opt-out into an error", async () => {
  await withEnv({ [ENV_BASE_URL]: undefined, [ENV_PROJECT_ID]: undefined, [ENV_TOKEN]: undefined }, async () => {
    const reporter = new TesboReporter({ requireConfig: true });
    await assert.rejects(() => reporter.onBegin(fakeConfig, emptySuite), /not configured/);
  });
});

test("enabled: false short-circuits before any config is looked at", async () => {
  await withEnv({ [ENV_BASE_URL]: undefined, [ENV_PROJECT_ID]: PROJECT, [ENV_TOKEN]: undefined }, async () => {
    // This env would otherwise be `incomplete` and throw; opting out must win over that.
    const reporter = new TesboReporter({ enabled: false, requireConfig: true });
    await reporter.onBegin(fakeConfig, emptySuite);
  });
});

/* ─────────────────────────── env vars are honoured ─────────────────────────── */

/*
 * Reaches the "no tagged tests" guard, which proves config resolution succeeded from the environment
 * alone and stopped before opening a run — so this test makes no network call.
 */
test("a complete environment resolves, then stops on an untagged suite", async () => {
  await withEnv({ [ENV_BASE_URL]: BASE, [ENV_PROJECT_ID]: PROJECT, [ENV_TOKEN]: TOKEN }, async () => {
    const reporter = new TesboReporter();
    const logs = await captureLogs(async () => {
      await reporter.onBegin(fakeConfig, emptySuite);
      await reporter.onEnd({ status: "passed" } as never);
    });
    assert.match(logs, /no test carries a/);
  });
});

test("an untagged suite is reported as untagged, not as a config problem", async () => {
  await withEnv({ [ENV_BASE_URL]: BASE, [ENV_PROJECT_ID]: PROJECT, [ENV_TOKEN]: TOKEN }, async () => {
    const reporter = new TesboReporter();
    const logs = await captureLogs(async () => {
      await reporter.onBegin(fakeConfig, emptySuite);
      await reporter.onEnd({ status: "passed" } as never);
    });
    assert.equal(logs.includes("not configured"), false);
  });
});

/*
 * strict mode is about the *suite* (untagged tests), requireConfig about the *environment*. Keeping
 * them separate matters: a fully-tagged suite with no credentials and a fully-credentialled run over
 * an untagged suite are different problems with different fixes.
 */
test("strict mode fails an untagged suite even when the config is complete", async () => {
  await withEnv({ [ENV_BASE_URL]: BASE, [ENV_PROJECT_ID]: PROJECT, [ENV_TOKEN]: TOKEN }, async () => {
    const suite = {
      allTests: () => [{ tags: [], annotations: [], titlePath: () => ["file.spec.ts", "a test"] }]
    } as unknown as Suite;
    const reporter = new TesboReporter({ strict: true });
    await assert.rejects(() => reporter.onBegin(fakeConfig, suite), /strict mode/);
  });
});

/* Actual loopback HTTP, not mocked fetch or a real Tesbo/PostgreSQL installation. */
const RUN = "55555555-5555-4555-8555-555555555555";
const CASE = "CLOSE-TC-1";
type CloseFixture = "accepted" | "minimal" | "mismatch" | "denied" | "unavailable" | "disconnect" | "timeout" | "lost-ack" |
  "invalid-json" | "empty" | "null" | "array" | "wrong-run" | "missing-mismatch" | "invalid-mismatch" |
  "invalid-pair" | "invalid-status" | "invalid-already" | "reported-incomplete" | "null-status" |
  "already-incomplete" | "already-unknown" | "already-null-status" | "retry-then-accepted" | "unknown-result";

async function withIngest(
  outcome: CloseFixture,
  body: (baseUrl: string, calls: Array<{ method: string; url: string; body: Record<string, unknown> }>, fixture: { closureApplied: boolean }) => Promise<void>
) {
  const calls: Array<{ method: string; url: string; body: Record<string, unknown> }> = [];
  const fixture = { closureApplied: false };
  const json = (res: ServerResponse, status: number, value: unknown) => {
    res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(value));
  };
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const parsed = chunks.length && req.headers["content-type"]?.includes("application/json")
      ? JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown> : {};
    calls.push({ method: req.method ?? "", url: req.url ?? "", body: parsed });
    if (req.headers.authorization !== `Bearer ${TOKEN}`) { json(res, 403, { error: "Fixture token required" }); return; }
    if (req.url?.endsWith("/cases/resolve")) { json(res, 200, { known: [{ caseId: CASE }], unknown: [] }); return; }
    if (req.url?.endsWith("/runs")) { json(res, 201, { runId: RUN, reused: false }); return; }
    if (req.url?.endsWith("/evidence")) { json(res, 200, { total: 0, skipped: "quota" }); return; }
    if (req.url?.endsWith("/results")) {
      json(res, outcome === "unknown-result" ? 404 : 200, outcome === "unknown-result" ? { error: "Fixture case disappeared" } : { executionId: "fixture", status: "Passed", retryCount: 0 }); return;
    }
    if (!req.url?.endsWith("/close")) { json(res, 404, { error: "Unexpected fixture route" }); return; }
    if (outcome === "denied" || outcome === "unavailable" || outcome === "unknown-result" ||
        outcome === "retry-then-accepted" && calls.filter((call) => call.url.endsWith("/close")).length === 1) {
      json(res, outcome === "denied" ? 403 : 503, { error: "Fixture closure unavailable" }); return;
    }
    if (outcome === "disconnect") { req.socket.destroy(); return; }
    if (outcome === "lost-ack") { fixture.closureApplied = true; req.socket.destroy(); return; }
    if (outcome === "timeout") return; // Real AbortController deadline; cleanup closes the socket.
    if (outcome === "invalid-json") { res.writeHead(200, { "content-type": "application/json" }); res.end("not-json"); return; }
    if (outcome === "empty" || outcome === "null") { json(res, 200, outcome === "empty" ? {} : null); return; }
    if (outcome === "array") { json(res, 200, []); return; }
    if (outcome === "missing-mismatch") { json(res, 200, { runId: RUN }); return; }
    if (outcome === "minimal" || outcome === "already-unknown") {
      json(res, 200, { runId: RUN, mismatch: null, ...(outcome === "already-unknown" ? { alreadyClosed: true } : {}) }); return;
    }
    fixture.closureApplied = true;
    json(res, 200, {
      runId: outcome === "wrong-run" ? PROJECT : RUN,
      mismatch: outcome === "invalid-mismatch" ? "not-a-summary" : outcome === "invalid-pair" ? { total: { reported: "1", stored: 0 } } : outcome === "mismatch" ? { total: { reported: 1, stored: 0 } } : null,
      alreadyClosed: outcome === "invalid-already" ? "yes" : outcome === "already-incomplete" || outcome === "already-null-status",
      closeStatus: outcome === "invalid-status" ? "not-a-close-status" : outcome === "already-incomplete" || outcome === "reported-incomplete" ? "incomplete" : outcome === "null-status" || outcome === "already-null-status" ? null : parsed.status
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await body(`http://127.0.0.1:${(server.address() as AddressInfo).port}`, calls, fixture);
  } finally {
    const stopped = new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    server.closeAllConnections();
    await stopped;
  }
}

function linkedTest(): TestCase {
  return { tags: [`@tesbo.testId("${CASE}")`], annotations: [], titlePath: () => ["close fixture"] } as unknown as TestCase;
}

async function runLifecycle(baseUrl: string, status: FullResult["status"] = "passed", extra: { retries?: number; unlinked?: boolean; evidence?: string } = {}) {
  const reporter = new TesboReporter({ baseUrl, projectId: PROJECT, token: TOKEN, retries: extra.retries ?? 1, timeoutMs: 1_000, attachEvidence: extra.evidence ? "always" : "never" });
  const tagged = linkedTest();
  const unlinked = { tags: [], annotations: [], titlePath: () => ["unlinked fixture"] } as unknown as TestCase;
  const suite = { allTests: () => extra.unlinked ? [tagged, unlinked] : [tagged] } as unknown as Suite;
  return captureLogs(async () => {
    await reporter.onBegin(fakeConfig, suite);
    reporter.onTestEnd(tagged, {
      status: "passed", duration: 1, retry: 0,
      attachments: extra.evidence ? [{ name: "screenshot", path: extra.evidence, contentType: "image/png" }] : []
    } as unknown as TestResult);
    if (extra.unlinked) reporter.onTestEnd(unlinked, { status: "passed", duration: 1, retry: 0, attachments: [] } as unknown as TestResult);
    await reporter.onEnd({ status } as FullResult);
  });
}

for (const outcome of ["denied", "unavailable", "disconnect", "timeout", "lost-ack", "invalid-json", "empty", "null", "array", "wrong-run", "missing-mismatch", "invalid-mismatch", "invalid-pair", "invalid-status", "invalid-already"] as const) {
  test(`close ${outcome} is non-fatal and never claims confirmed closure`, async () => {
    await withEnv({ [ENV_BASE_URL]: undefined, [ENV_PROJECT_ID]: undefined, [ENV_TOKEN]: undefined }, async () => {
      await withIngest(outcome, async (baseUrl, calls, fixture) => {
        const exitCode = process.exitCode;
        const logs = await runLifecycle(baseUrl);
        assert.match(logs, /reporting 1 linked test\(s\) to run/);
        assert.equal(calls.filter((call) => call.url.endsWith("/close")).length, 1);
        if (outcome === "lost-ack") assert.equal(fixture.closureApplied, true, "lost acknowledgement is not proof that the server stayed open");
        assert.match(logs, /closure unconfirmed/);
        assert.doesNotMatch(logs, /\[tesbo\] run .* (?:already )?closed \(/);
        assert.doesNotMatch(logs, /run .* (?:is|remains|stayed|still) open|run .* not closed/);
        assert.match(logs, /1 passed, 0 failed, 0 skipped/);
        assert.match(logs, /1 request\(s\) to Tesbo failed/);
        assert.equal(process.exitCode, exitCode);
        assert.equal(logs.includes(TOKEN), false, "credentials must not be printed");
      });
    });
  });
}

test("confirmed close retains success logging and drains results before sending the summary", async () => {
  await withIngest("accepted", async (baseUrl, calls) => {
    const logs = await runLifecycle(baseUrl);
    assert.match(logs, /run .* closed \(completed\): 1 passed, 0 failed, 0 skipped/);
    assert.doesNotMatch(logs, /closure unconfirmed/);
    assert.deepEqual(calls.map((call) => `${call.method} ${call.url.split("/automation")[1]}`), [
      "POST /cases/resolve", "POST /runs", `POST /runs/${RUN}/results`, `PATCH /runs/${RUN}/close`
    ]);
    assert.deepEqual(calls[calls.length - 1].body, { status: "completed", summary: { total: 1, passed: 1, failed: 0, skipped: 0 } });
  });
});

for (const status of ["interrupted", "timedout"] as const) {
  test(`${status} confirms incomplete closure when acknowledged`, async () => {
    await withIngest("accepted", async (baseUrl, calls) => {
      const logs = await runLifecycle(baseUrl, status);
      assert.equal(calls[calls.length - 1].body.status, "incomplete");
      assert.match(logs, /closed \(incomplete\)/);
      assert.doesNotMatch(logs, /closure unconfirmed/);
    });
  });

  test(`${status} still requests an incomplete close without changing suite status`, async () => {
    await withIngest("denied", async (baseUrl, calls) => {
      const logs = await runLifecycle(baseUrl, status);
      assert.equal(calls[calls.length - 1].body.status, "incomplete");
      assert.match(logs, /closure unconfirmed.*incomplete/);
    });
  });
}

test("an already-closed response reports the server's actual incomplete status, not the requested completed status", async () => {
  await withIngest("already-incomplete", async (baseUrl) => {
    const logs = await runLifecycle(baseUrl);
    assert.match(logs, /already closed \(incomplete\)/);
    assert.doesNotMatch(logs, /closed \(completed\)/);
  });
});

test("a legacy minimal valid close acknowledgement remains accepted", async () => {
  await withIngest("minimal", async (baseUrl) => {
    assert.match(await runLifecycle(baseUrl), /run .* closed \(completed\)/);
  });
});

test("an already-closed response without a status does not invent the requested status", async () => {
  await withIngest("already-unknown", async (baseUrl) => {
    const logs = await runLifecycle(baseUrl);
    assert.match(logs, /already closed \(status not reported\)/);
    assert.doesNotMatch(logs, /closed \(completed\)/);
  });
});

for (const outcome of ["null-status", "already-null-status"] as const) {
  test(`${outcome} accepts a historical nullable status without inventing completed`, async () => {
    await withIngest(outcome, async (baseUrl) => {
      const logs = await runLifecycle(baseUrl);
      assert.match(logs, /closed \(status not reported\)/);
      assert.equal(logs.includes("already closed"), outcome === "already-null-status");
      assert.doesNotMatch(logs, /closed \(completed\)|closure unconfirmed|request\(s\) to Tesbo failed/);
    });
  });
}

test("a supplied server status is used even without the already-closed flag", async () => {
  await withIngest("reported-incomplete", async (baseUrl) => {
    const logs = await runLifecycle(baseUrl);
    assert.match(logs, /closed \(incomplete\)/);
    assert.doesNotMatch(logs, /closed \(completed\)/);
  });
});

test("transient retry followed by an acknowledgement still reports confirmed success", async () => {
  await withIngest("retry-then-accepted", async (baseUrl, calls) => {
    const logs = await runLifecycle(baseUrl, "passed", { retries: 2 });
    assert.equal(calls.filter((call) => call.url.endsWith("/close")).length, 2);
    assert.match(logs, /run .* closed \(completed\)/);
    assert.doesNotMatch(logs, /closure unconfirmed|request\(s\) to Tesbo failed/);
  });
});

test("stored-count mismatch diagnostics remain visible after a confirmed close", async () => {
  await withIngest("mismatch", async (baseUrl) => {
    const logs = await runLifecycle(baseUrl);
    assert.match(logs, /stored counts differ/);
    assert.match(logs, /"reported":1,"stored":0/);
  });
});

test("closure failure does not suppress unlinked, unknown-case or request-failure diagnostics", async () => {
  await withIngest("unknown-result", async (baseUrl) => {
    const logs = await runLifecycle(baseUrl, "passed", { unlinked: true });
    assert.match(logs, /closure unconfirmed/);
    assert.match(logs, /1 test\(s\) not linked/);
    assert.match(logs, /1 result\(s\) had no matching test case/);
    assert.match(logs, /2 request\(s\) to Tesbo failed/);
  });
});

test("an unusable successful close acknowledgement is counted once without replay or response-body logging", async () => {
  await withIngest("invalid-pair", async (baseUrl, calls) => {
    const logs: string[] = [];
    const client = new TesboClient({ baseUrl, projectId: PROJECT, token: TOKEN, retries: 3, timeoutMs: 1_000, log: (line) => logs.push(line) });
    const closed = await client.closeRun(RUN, "completed", { total: 1 });
    assert.equal(closed.ok, false);
    assert.equal(client.failures, 1);
    assert.equal(calls.filter((call) => call.url.endsWith("/close")).length, 1);
    assert.equal(logs.length, 1);
    assert.match(logs[0], /invalid close acknowledgement/);
    assert.doesNotMatch(logs[0], /reported|stored/);
    assert.equal(logs[0].includes(TOKEN), false);
  });
});

test("closure failure retains quota diagnostics and drains evidence before closing", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "tesbo-reporter-evidence-"));
  try {
    const evidence = path.join(dir, "fixture.png");
    await fs.writeFile(evidence, "fixture upload bytes; no browser capture");
    await withIngest("denied", async (baseUrl, calls) => {
      const logs = await runLifecycle(baseUrl, "passed", { evidence });
      assert.deepEqual(calls.slice(-2).map((call) => call.url.split("/").pop()), ["evidence", "close"]);
      assert.match(logs, /closure unconfirmed/);
      assert.match(logs, /1 evidence file\(s\) were skipped: the workspace's storage quota is full/);
      assert.match(logs, /1 request\(s\) to Tesbo failed/);
    });
  } finally {
    await fs.rm(dir, { recursive: true, force: true }); // Only this test's newly-created directory.
  }
});

for (const outcome of ["denied", "null", "lost-ack"] as const) {
  for (const failingTest of [false, true]) {
    test(`a real Playwright ${failingTest ? "failing" : "passing"} suite keeps its own exit code for close ${outcome}`, async () => {
      await withIngest(outcome, async (baseUrl, calls) => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "tesbo-reporter-close-"));
        try {
          const config = path.join(dir, "playwright.config.cjs");
          await fs.writeFile(config, `module.exports = { workers: 1, retries: 0, reporter: [["list"], [${JSON.stringify(path.resolve(__dirname, "../dist/index.js"))}, ${JSON.stringify({ baseUrl, projectId: PROJECT, token: TOKEN, retries: 1, timeoutMs: 1_000, attachEvidence: "never" })}]] };`);
          await fs.writeFile(path.join(dir, "close.spec.cjs"), `const { test } = require(${JSON.stringify(require.resolve("@playwright/test"))}); test("close fixture", { tag: '@tesbo.testId("${CASE}")' }, () => { ${failingTest ? 'throw new Error("Expected fixture failure");' : ""} });`);
          const result = await new Promise<{ code: number | string; output: string }>((resolve, reject) => {
            execFile(process.execPath, [require.resolve("@playwright/test/cli"), "test", "-c", config], { cwd: dir, encoding: "utf8", timeout: 20_000 }, (error, stdout, stderr) => {
              if (error && typeof error.code !== "number") { reject(error); return; }
              resolve({ code: error?.code ?? 0, output: `${stdout}\n${stderr}` });
            });
          });
          assert.equal(result.code, failingTest ? 1 : 0, result.output);
          assert.equal(calls.filter((call) => call.url.endsWith("/close")).length, 1, result.output);
          assert.match(result.output, /reporting 1 linked test\(s\) to run/);
          assert.match(result.output, /closure unconfirmed/);
          assert.doesNotMatch(result.output, /\[tesbo\] run .* closed \(/);
          assert.equal(result.output.includes(TOKEN), false);
        } finally {
          await fs.rm(dir, { recursive: true, force: true }); // Only this test's newly-created directory.
        }
      });
    });
  }
}
