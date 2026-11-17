import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { accountResults, requiredSuites, validateInfrastructure, validateSelection } from "./required-backend-tests.mjs";

const cwd = fileURLToPath(new URL("../", import.meta.url));
const suites = ["Tesbo-Backend-Nest/src/example.spec.ts"];
const startedAt = 100;
const good = () => ({
  success: true, wasInterrupted: false, startTime: 101,
  numFailedTestSuites: 0, numPendingTestSuites: 0, numRuntimeErrorTestSuites: 0,
  numFailedTests: 0, numPendingTests: 0, numTodoTests: 0,
  numTotalTestSuites: 1, numPassedTestSuites: 1, numTotalTests: 1, numPassedTests: 1,
  testResults: [{ name: path.join(cwd, suites[0]), status: "passed", message: "",
    startTime: 102, endTime: 103, assertionResults: [{ fullName: "example passes", status: "passed", failureMessages: [] }] }]
});

test("accounting counts actual assertions only after exact files and completed results agree", () => {
  assert.deepEqual(accountResults(good(), suites, cwd, startedAt),
    { selectedFiles: 1, accountedFiles: 1, executedTests: 1, passedTests: 1, failedTests: 0, skippedTests: 0, todoTests: 0 });
});

test("Jest discovery rejects missing, empty, duplicate, relative, escaping or unexpected selections", () => {
  validateSelection([path.join(cwd, suites[0])], suites, cwd);
  for (const selection of [null, [], [suites[0]], [path.join(cwd, "../outside.spec.ts")],
    [path.join(cwd, suites[0]), path.join(cwd, suites[0])], [path.join(cwd, "other.spec.ts")]]) {
    assert.throws(() => validateSelection(selection, suites, cwd));
  }
});

test("skips, todo, failures, runtime errors, interruption and stale/missing metadata fail closed", async t => {
  const mutations = {
    "partial suite skip": r => { r.numPendingTestSuites = 1; },
    "skipped assertion": r => { r.testResults[0].assertionResults[0].status = "pending"; },
    todo: r => { r.testResults[0].assertionResults[0].status = "todo"; },
    failure: r => { r.testResults[0].assertionResults[0].status = "failed"; },
    "hidden failure message": r => { r.testResults[0].assertionResults[0].failureMessages = ["failed"]; },
    "runtime error": r => { r.numRuntimeErrorTestSuites = 1; },
    interrupted: r => { r.wasInterrupted = true; },
    unsuccessful: r => { r.success = false; },
    stale: r => { r.startTime = 99; },
    "missing metadata": r => { delete r.numTodoTests; },
    "missing result": r => { r.testResults = []; },
    "unexpected result": r => { r.testResults[0].name = path.join(cwd, "other.spec.ts"); },
    "duplicate result": r => { r.testResults.push(r.testResults[0]); },
    "empty suite": r => { r.testResults[0].assertionResults = []; },
    "failed suite": r => { r.testResults[0].status = "failed"; },
    "setup failure message": r => { r.testResults[0].message = "beforeAll failed"; },
    "missing suite end": r => { delete r.testResults[0].endTime; },
    "impossible suite timing": r => { r.testResults[0].endTime = 100; },
    "inconsistent suite totals": r => { r.numTotalTestSuites = 2; },
    "inconsistent test totals": r => { r.numPassedTests = 2; }
  };
  for (const [label, mutate] of Object.entries(mutations)) await t.test(label, () => {
    const report = good();
    mutate(report);
    assert.throws(() => accountResults(report, suites, cwd, startedAt));
  });
  for (const report of [null, [], "", {}, { ...good(), testResults: null }]) {
    assert.throws(() => accountResults(report, suites, cwd, startedAt));
  }
});

const ci = () => ({ GITHUB_ACTIONS: "true", RUNNER_ENVIRONMENT: "github-hosted",
  DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/rb_test_ci",
  REVIEW_BOARD_TEST_DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/rb_test_ci",
  REVIEW_BOARD_TEST_REDIS_URL: "redis://127.0.0.1:56379" });

test("fixture preflight retains exact DB/Redis safety and refuses workstation/override targets without connecting", async t => {
  validateInfrastructure("review-board-integration", ci());
  validateInfrastructure("database-integrity", { ...ci(), DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/tesbo_ci" });
  validateInfrastructure("authorization", {}); // Service-free selections need no infrastructure.
  for (const [key, value] of [
    ["GITHUB_ACTIONS", ""], ["RUNNER_ENVIRONMENT", "self-hosted"], ["DATABASE_URL", ""],
    ["DATABASE_URL", "postgresql://remote:5432/rb_test_ci"], ["DATABASE_URL", "postgresql://localhost:5432/tesbo_ci"],
    ["DATABASE_URL", "postgresql://localhost:5432/rb_test_ci?host=remote"], ["DATABASE_URL", "https://localhost:5432/rb_test_ci"],
    ["REVIEW_BOARD_TEST_DATABASE_URL", ""], ["REVIEW_BOARD_TEST_DATABASE_URL", "postgresql://localhost:5432/rb_sandbox"],
    ["REVIEW_BOARD_TEST_REDIS_URL", ""], ["REVIEW_BOARD_TEST_REDIS_URL", "redis://remote:56379"],
    ["REVIEW_BOARD_TEST_REDIS_URL", "redis://localhost:6379"], ["REVIEW_BOARD_TEST_REDIS_URL", "redis://localhost:56440"],
    ["MIGRATIONS_DIR", "../elsewhere"], ["DATABASE_USER", "real-user"], ["DATABASE_PASSWORD", "real-secret"],
    ["PGHOST", "remote"], ["PGOPTIONS", "-c search_path=other"]
  ]) await t.test(`${key}: ${key === "DATABASE_PASSWORD" ? "redacted" : value}`, () => {
    assert.throws(() => validateInfrastructure("review-board-integration", { ...ci(), [key]: value }));
  });
});

test("required selection reuses validated declarations; generic evidence alone never authorizes execution", () => {
  const config = JSON.parse(fs.readFileSync(path.join(cwd, ".github/test-impact.json"), "utf8"));
  const tracked = spawnSync("git", ["ls-files", "-z"], { cwd, encoding: "utf8" }).stdout.split("\0").filter(Boolean);
  assert.equal(requiredSuites(config, "review-board-integration", tracked).length, 2);
  assert.equal(requiredSuites(config, "database-integrity", tracked).length, 15);
  for (const id of ["backend-quality", "missing", "__proto__", "../authorization"]) {
    assert.throws(() => requiredSuites(config, id, tracked));
  }
});

test("CLI rejects arbitrary filters or unknown checks, and import is side-effect-free", () => {
  for (const args of [[], ["--runTestsByPath", suites[0]], ["authorization", "--testNamePattern=pass"], ["missing"]]) {
    const result = spawnSync(process.execPath, [path.join(cwd, "scripts/required-backend-tests.mjs"), ...args], { cwd, encoding: "utf8" });
    assert.notEqual(result.status, 0);
  }
  const base = process.platform === "win32" ? path.join(process.env.LOCALAPPDATA, "Temp/opencode") : os.tmpdir();
  const directory = fs.mkdtempSync(path.join(base, "required-import-"));
  try {
    const result = spawnSync(process.execPath, ["--input-type=module", "-e",
      `await import(${JSON.stringify(new URL("./required-backend-tests.mjs", import.meta.url).href)});`],
    { cwd: directory, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "");
    assert.deepEqual(fs.readdirSync(directory), []);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
