// Shared by the checkout lifecycle tests and the installed-package consumer smoke.
// Keep this outside src/dist: it is test infrastructure, not part of the published SDK.
const { createServer } = require("node:http");
const { execFile } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");

const PROJECT = "41dba2a2-a60b-4917-8d63-9f8a86986703";
const TOKEN = "tsbo_f89c09aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const RUN = "55555555-5555-4555-8555-555555555555";
const CASE = "CLOSE-TC-1";

/** Actual loopback HTTP, not mocked fetch or a real Tesbo/PostgreSQL installation. */
async function withIngest(outcome, body) {
  const calls = [];
  const fixture = { closureApplied: false };
  const json = (res, status, value) => {
    res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(value));
  };
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const parsed = chunks.length && req.headers["content-type"]?.includes("application/json")
      ? JSON.parse(Buffer.concat(chunks).toString()) : {};
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
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  try {
    await body(`http://127.0.0.1:${server.address().port}`, calls, fixture);
  } finally {
    const stopped = new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    server.closeAllConnections();
    await stopped;
  }
}

/** Never invoke a shell: Node, npm's JS entrypoint and Playwright all accept argument arrays. */
function runNode(args, { cwd, env = process.env, timeout = 20_000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, args, { cwd, env, encoding: "utf8", timeout, shell: false, maxBuffer: 2 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error && typeof error.code !== "number") { reject(error); return; }
      resolve({ code: error?.code ?? 0, output: `${stdout}\n${stderr}` });
    });
  });
}

/** One browser-free test; callers choose checkout paths or installed package names explicitly. */
async function runPlaywrightFixture({ dir, reporter, playwrightCli, playwrightTest, reporterOptions, failingTest = false, env }) {
  const config = path.join(dir, "playwright.config.cjs");
  await fs.writeFile(config, `module.exports = { workers: 1, retries: 0, reporter: [["list"], [${JSON.stringify(reporter)}, ${JSON.stringify(reporterOptions)}]] };`);
  await fs.writeFile(path.join(dir, "close.spec.cjs"), `const { test } = require(${JSON.stringify(playwrightTest)}); test("close fixture", { tag: '@tesbo.testId("${CASE}")' }, () => { ${failingTest ? 'throw new Error("Expected fixture failure");' : ""} });`);
  return runNode([playwrightCli, "test", "-c", config], { cwd: dir, env });
}

module.exports = { PROJECT, TOKEN, RUN, CASE, withIngest, runNode, runPlaywrightFixture };
