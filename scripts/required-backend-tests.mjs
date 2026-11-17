/**
 * Accounting adapter for explicitly required backend suites, not another test
 * executor. Selection belongs to test-impact.json; execution belongs to Jest.
 * No product modules, environment files or database clients are imported here.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { randomUUID, createHash } from "node:crypto";
import { spawnSync, execFileSync } from "node:child_process";
import { normalizePath, validateConfig } from "./test-impact.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const backend = "Tesbo-Backend-Nest";
const demand = (condition, message) => { if (!condition) throw new Error(message); };
const equalSet = (actual, expected, label) => {
  demand(Array.isArray(actual) && actual.length === expected.length &&
    new Set(actual).size === actual.length && actual.every(item => expected.includes(item)),
  `${label}: missing, duplicate or unexpected required suite.`);
};

export function requiredSuites(config, checkId, tracked) {
  validateConfig(config, tracked);
  const suites = config.checks[checkId]?.requiredBackendSuites;
  demand(Array.isArray(suites) && suites.length > 0, `No required backend selection for ${checkId}.`);
  return [...suites].sort();
}

/** Stronger CI preflight does not relax the original opt-in suite guards. */
export function validateInfrastructure(checkId, env) {
  if (!["database-integrity", "review-board-integration"].includes(checkId)) return;
  demand(env.GITHUB_ACTIONS === "true" && env.RUNNER_ENVIRONMENT === "github-hosted",
    "Database selections are restricted to disposable GitHub-hosted CI, never a workstation.");
  const fixtureUrl = (key, protocols, database, port) => {
    let value;
    try { value = new URL(env[key]); } catch { throw new Error(`Missing or invalid ${key}; refusing before connection.`); }
    demand(protocols.includes(value.protocol) && ["localhost", "127.0.0.1", "[::1]"].includes(value.hostname) &&
      !value.search && !value.hash && (database === undefined || value.pathname === `/${database}`) &&
      (port === undefined || value.port === port), `Unsafe ${key}; expected the dedicated loopback CI fixture.`);
    return value;
  };
  fixtureUrl("DATABASE_URL", ["postgres:", "postgresql:"],
    checkId === "database-integrity" ? "tesbo_ci" : "rb_test_ci", "5432");
  if (checkId === "review-board-integration") {
    fixtureUrl("REVIEW_BOARD_TEST_DATABASE_URL", ["postgres:", "postgresql:"], "rb_test_ci", "5432");
    demand(env.DATABASE_URL === env.REVIEW_BOARD_TEST_DATABASE_URL, "Migrator and Review Board must use the same fixture.");
    fixtureUrl("REVIEW_BOARD_TEST_REDIS_URL", ["redis:"], undefined, "56379");
  }
  demand(!env.MIGRATIONS_DIR || env.MIGRATIONS_DIR === "migrations", "Unexpected migration directory for CI fixture.");
  demand(!env.DATABASE_USER || env.DATABASE_USER === "postgres", "Unexpected CI database user override.");
  demand(!env.DATABASE_PASSWORD || env.DATABASE_PASSWORD === "postgres", "Unexpected CI database password override.");
  demand(!Object.keys(env).some(key => /^PG(?:HOST|HOSTADDR|PORT|DATABASE|USER|PASSWORD|SERVICE|SERVICEFILE|OPTIONS)$/i.test(key) && env[key]),
    "Unexpected libpq environment override for CI fixture.");
}

export function validateSelection(selected, expected, cwd) {
  demand(Array.isArray(selected), "Jest discovery must return a JSON array.");
  const relative = selected.map(filename => {
    demand(typeof filename === "string" && path.isAbsolute(filename), "Jest discovery must return absolute paths.");
    return normalizePath(path.relative(cwd, filename));
  });
  equalSet(relative, expected, "Jest discovery");
}

/** Validates Jest 29's built-in formatted JSON, not human console summaries. */
export function accountResults(report, expected, cwd, startedAt) {
  demand(report && typeof report === "object" && !Array.isArray(report), "Missing or malformed Jest report.");
  demand(report.success === true && report.wasInterrupted === false, "Jest failed or was interrupted.");
  demand(Number.isFinite(report.startTime) && report.startTime >= startedAt, "Stale or missing Jest start time.");
  for (const field of ["numFailedTestSuites", "numPendingTestSuites", "numRuntimeErrorTestSuites",
    "numFailedTests", "numPendingTests", "numTodoTests"]) {
    demand(report[field] === 0, `Required execution has nonzero/missing ${field}.`);
  }
  demand(Array.isArray(report.testResults), "Missing per-file Jest results.");
  const names = report.testResults.map(result => {
    demand(typeof result.name === "string" && path.isAbsolute(result.name), "Missing absolute result filename.");
    return normalizePath(path.relative(cwd, result.name));
  });
  equalSet(names, expected, "Jest results");
  let passed = 0;
  for (const result of report.testResults) {
    demand(result.status === "passed" && !result.message && !result.testExecError,
      `Required suite failed: ${result.name}`);
    demand(Number.isFinite(result.startTime) && result.startTime >= report.startTime &&
      Number.isFinite(result.endTime) && result.endTime >= result.startTime, "Incomplete suite timing.");
    demand(Array.isArray(result.assertionResults) && result.assertionResults.length > 0,
      `Required suite has no assertions: ${result.name}`);
    for (const assertion of result.assertionResults) {
      demand(assertion.status === "passed" && Array.isArray(assertion.failureMessages) &&
        assertion.failureMessages.length === 0, `Required assertion did not pass: ${assertion.fullName}`);
      passed++;
    }
  }
  demand(report.numTotalTestSuites === expected.length && report.numPassedTestSuites === expected.length &&
    report.numTotalTests === passed && report.numPassedTests === passed, "Inconsistent Jest aggregate counts.");
  return { selectedFiles: expected.length, accountedFiles: names.length, executedTests: passed,
    passedTests: passed, failedTests: 0, skippedTests: 0, todoTests: 0 };
}

/** A fresh exclusive directory prevents a previous run's report certifying this one. */
export function executeSelection({ checkId, suites, cwd, jest, directory, env = process.env, run = spawnSync }) {
  const receipt = { version: 1, invocation: randomUUID(), checkId, suites, status: "failed",
    startedAt: new Date().toISOString(), verification: null, children: [] };
  const record = () => fs.writeFileSync(path.join(directory, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
  const child = (args, label, capture = false) => {
    const result = run(process.execPath, [jest, "--runInBand", "--ci", "--watch=false", "--runTestsByPath",
      ...suites.map(suite => path.resolve(cwd, suite)), ...args], {
      cwd: path.join(cwd, backend), env, timeout: 20 * 60 * 1000, maxBuffer: 64 * 1024 * 1024,
      encoding: "utf8", stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit"
    });
    receipt.children.push({ label, exitCode: result.status ?? null, signal: result.signal ?? null,
      error: result.error?.message ?? null });
    if (capture && result.stderr) fs.writeFileSync(path.join(directory, "discovery.stderr.log"), result.stderr);
    record();
    demand(!result.error && !result.signal && result.status === 0, `${label} failed (${result.signal || (result.status ?? "spawn error")}).`);
    return result;
  };
  try {
    receipt.headCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf8" }).trim();
    receipt.trackedWorktreeChanges = execFileSync("git", ["diff", "--name-only", "--no-renames", "-z", "HEAD", "--"],
      { cwd, encoding: "utf8" }).split("\0").filter(Boolean);
    receipt.manifestSha256 = createHash("sha256").update(fs.readFileSync(path.join(cwd, ".github/test-impact.json"))).digest("hex");
    record();
    validateInfrastructure(checkId, env);
    const discovery = JSON.parse(child(["--listTests", "--json"], "Jest discovery", true).stdout);
    fs.writeFileSync(path.join(directory, "selection.json"), JSON.stringify(discovery, null, 2) + "\n");
    validateSelection(discovery, suites, cwd);
    const reportPath = path.join(directory, "jest.json");
    demand(!fs.existsSync(reportPath), "Report already exists before execution.");
    const startedAt = Date.now();
    // Even a nonzero child may leave valuable JSON evidence. Never discard it.
    let failure;
    try { child(["--json", "--outputFile", reportPath], "Jest execution"); } catch (error) { failure = error; }
    const counts = accountResults(JSON.parse(fs.readFileSync(reportPath, "utf8")), suites, cwd, startedAt);
    if (failure) throw failure;
    receipt.status = "passed";
    receipt.verification = counts;
    console.log(`${checkId}: ${counts.selectedFiles} files selected / ${counts.accountedFiles} accounted; ` +
      `${counts.executedTests} executed / ${counts.passedTests} passed / 0 skipped / 0 todo.`);
    return receipt;
  } catch (error) {
    receipt.error = error.message;
    throw error;
  } finally {
    receipt.completedAt = new Date().toISOString();
    record();
  }
}

export function main(args = process.argv.slice(2)) {
  const preflight = args[0] === "--preflight";
  demand(args.length === (preflight ? 2 : 1) && /^[a-z][a-z0-9-]*$/.test(args.at(-1)),
    "Usage: node scripts/required-backend-tests.mjs [--preflight] <check-id>");
  const checkId = args.at(-1);
  const tracked = execFileSync("git", ["ls-files", "--cached", "-z", "--"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
  const config = JSON.parse(fs.readFileSync(path.join(root, ".github/test-impact.json"), "utf8"));
  const suites = requiredSuites(config, checkId, tracked);
  for (const suite of suites) demand(fs.lstatSync(path.join(root, suite)).isFile(), `Missing regular suite file: ${suite}`);
  if (preflight) {
    validateInfrastructure(checkId, process.env);
    console.log(`${checkId}: fixture preflight passed; no database connection or test execution.`);
    return;
  }
  const require = createRequire(path.join(root, backend, "package.json"));
  const jest = require.resolve("jest/bin/jest");
  const parent = path.join(root, "reports/quality/required-backend");
  fs.mkdirSync(parent, { recursive: true });
  const directory = fs.mkdtempSync(path.join(parent, `${checkId}-`));
  console.log(`Required execution evidence: ${directory}`);
  return executeSelection({ checkId, suites, cwd: root, jest, directory });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(`required-backend-tests: ${error.message}`); process.exitCode = 1; }
}
