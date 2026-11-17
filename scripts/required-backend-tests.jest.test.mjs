import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
import { test } from "node:test";
import { executeSelection } from "./required-backend-tests.mjs";

// This file runs in backend-quality, which installs the lockfile-owned Jest.
// Root-only pure tooling tests need neither Jest nor a database.
const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(path.join(root, "Tesbo-Backend-Nest/package.json"));
const jest = require.resolve("jest/bin/jest");

function fixture(t, source) {
  const base = process.platform === "win32" ? path.join(process.env.LOCALAPPDATA, "Temp/opencode") : os.tmpdir();
  const cwd = fs.mkdtempSync(path.join(base, "required Jest fixture "));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  fs.mkdirSync(path.join(cwd, "Tesbo-Backend-Nest/src"), { recursive: true });
  fs.mkdirSync(path.join(cwd, ".github"));
  fs.writeFileSync(path.join(cwd, ".github/test-impact.json"), "{}");
  fs.writeFileSync(path.join(cwd, "Tesbo-Backend-Nest/jest.config.cjs"),
    'module.exports = { testEnvironment: "node", testMatch: ["**/*.spec.ts"], transform: {} };');
  const suites = ["Tesbo-Backend-Nest/src/sample.spec.ts"];
  fs.writeFileSync(path.join(cwd, suites[0]), source);
  const git = args => execFileSync("git", args, { cwd, stdio: "pipe" });
  git(["init", "-q"]);
  git(["-c", "user.name=CI fixture", "-c", "user.email=ci@example.test", "commit", "--allow-empty", "-qm", "fixture"]);
  const directory = fs.mkdtempSync(path.join(cwd, "evidence-"));
  return { cwd, suites, directory, jest, checkId: "fixture", env: { ...process.env, FORCE_COLOR: "0" } };
}

test("actual installed Jest passes complete assertions and rejects skipped/todo/setup/collection failures", async t => {
  for (const [label, source, passes] of [
    ["positive", 'test("passes", () => expect(2 + 2).toBe(4));', true],
    ["partial skip", 'test("passes", () => {}); test.skip("skips", () => {});', false],
    ["whole suite skip", 'describe.skip("skips", () => { test("test", () => {}); });', false],
    ["todo", 'test("passes", () => {}); test.todo("unfinished");', false],
    ["assertion failure", 'test("fails", () => expect(1).toBe(2));', false],
    ["beforeAll failure", 'beforeAll(() => { throw Error("setup failed"); }); test("blocked", () => {});', false],
    ["collection error", 'throw Error("collection failed");', false],
    ["empty file", '', false]
  ]) await t.test(label, () => {
    const input = fixture(t, source);
    if (passes) {
      const result = executeSelection(input);
      assert.equal(result.status, "passed");
      assert.equal(result.verification.executedTests, 1);
      assert.equal(result.headCommit.length, 40);
      assert.equal(result.manifestSha256.length, 64);
    } else assert.throws(() => executeSelection(input));
    const receipt = JSON.parse(fs.readFileSync(path.join(input.directory, "receipt.json"), "utf8"));
    assert.equal(receipt.status, passes ? "passed" : "failed");
    assert.ok(fs.existsSync(path.join(input.directory, "jest.json")), "Keep failed as well as successful raw evidence.");
  });
});

test("adapter rejects fresh-path missing/malformed/partial/stale reports, child failures and aborted discovery", async t => {
  for (const scenario of ["missing", "empty", "malformed", "partial", "stale", "child-nonzero", "signal", "timeout",
    "discovery-missing", "discovery-extra", "discovery-malformed"]) await t.test(scenario, () => {
    const input = fixture(t, 'test("passes", () => {});');
    let calls = 0;
    const run = (program, args, options) => {
      calls++;
      if (calls === 1 && scenario.startsWith("discovery-")) return {
        status: 0, stdout: scenario === "discovery-malformed" ? "not json" :
          JSON.stringify(scenario === "discovery-missing" ? [] : [path.join(input.cwd, input.suites[0]), path.join(input.cwd, "extra.spec.ts")])
      };
      if (calls === 1) return spawnSync(program, args, options);
      if (scenario === "timeout") return { status: null, error: new Error("ETIMEDOUT") };
      if (scenario === "signal") return { status: null, signal: "SIGTERM" };
      const report = args[args.indexOf("--outputFile") + 1];
      if (scenario === "empty") fs.writeFileSync(report, "");
      else if (scenario === "malformed") fs.writeFileSync(report, "{");
      else if (scenario === "partial") fs.writeFileSync(report, JSON.stringify({ success: true, testResults: [] }));
      else if (scenario === "stale" || scenario === "child-nonzero") {
        const result = spawnSync(program, args, options);
        assert.equal(result.status, 0);
        if (scenario === "child-nonzero") return { status: 9 };
        const json = JSON.parse(fs.readFileSync(report, "utf8"));
        json.startTime = 1;
        fs.writeFileSync(report, JSON.stringify(json));
      }
      return { status: 0 };
    };
    assert.throws(() => executeSelection({ ...input, run }));
    const receipt = JSON.parse(fs.readFileSync(path.join(input.directory, "receipt.json"), "utf8"));
    assert.equal(receipt.status, "failed");
    assert.equal(receipt.verification, null);
    if (scenario.startsWith("discovery-")) assert.equal(calls, 1, "Never execute an incomplete selection.");
  });
});

test("a pre-existing raw report cannot certify a later invocation", t => {
  const input = fixture(t, 'test("passes", () => {});');
  fs.writeFileSync(path.join(input.directory, "jest.json"), "{}");
  assert.throws(() => executeSelection(input), /already exists/);
});
