import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { checkDuplication } from "./check-duplication.mjs";

test("real clone detector tolerates existing debt but rejects a new third occurrence", () => {
  const parent = process.platform === "win32" ? path.join(process.env.LOCALAPPDATA, "Temp", "opencode") : os.tmpdir();
  const dir = fs.mkdtempSync(path.join(parent, "clone fixture "));
  const git = (...args) => execFileSync("git", ["-c", "core.hooksPath=unused-test-hooks", ...args], { cwd: dir, stdio: "pipe" });
  const source = "export function compute(input: number) {\n  let value = input;\n" +
    Array.from({ length: 28 }, (_, i) => `  value += input * ${i + 1};`).join("\n") + "\n  return value;\n}\n";
  try {
    fs.mkdirSync(path.join(dir, "src"));
    fs.writeFileSync(path.join(dir, ".jscpd.json"), JSON.stringify({
      path: ["src"], minTokens: 100, minLines: 20, mode: "mild", format: ["typescript"],
      output: "reports", reporters: ["json"], failOnEmpty: true
    }));
    for (const file of ["first.ts", "second.ts"]) fs.writeFileSync(path.join(dir, "src", file), source);
    git("init", "-q");
    git("add", ".");
    git("-c", "user.name=Quality fixture", "-c", "user.email=fixture@example.test", "commit", "-qm", "baseline");

    const existing = checkDuplication("HEAD", { cwd: dir });
    assert.equal(existing.status, 0);
    assert.ok(existing.report.duplicates.length > 0, "fixture must contain actual pre-existing clones");
    assert.equal(existing.newClones.length, 0);

    fs.writeFileSync(path.join(dir, "src", "third.ts"), source);
    const third = checkDuplication("HEAD", { cwd: dir });
    assert.equal(third.status, 1, "adding a third copy must fail even when the clone family already exists");
    assert.ok(third.newClones.length > 0);

    fs.unlinkSync(path.join(dir, "src", "third.ts"));
    fs.writeFileSync(path.join(dir, "src", "second.ts"), "\n\n" + source);
    const shifted = checkDuplication("HEAD", { cwd: dir });
    assert.equal(shifted.status, 0, "line-number shifts must not manufacture new debt");
    assert.equal(shifted.newClones.length, 0);

    fs.unlinkSync(path.join(dir, "src", "second.ts"));
    git("add", "--", "src");
    git("-c", "user.name=Quality fixture", "-c", "user.email=fixture@example.test", "commit", "-qm", "remove old duplicate");
    fs.writeFileSync(path.join(dir, "src", "second.ts"), source);
    const reintroduced = checkDuplication("HEAD", { cwd: dir });
    assert.equal(reintroduced.status, 1, "debt removed from the base must not leave a reusable allowance");
    assert.ok(reintroduced.newClones.length > 0);

    assert.throws(() => checkDuplication("does-not-exist", { cwd: dir }), /base/);
    fs.writeFileSync(path.join(dir, ".jscpd.json"), JSON.stringify({
      path: ["empty"], output: "reports", reporters: ["json"], format: ["typescript"]
    }));
    fs.mkdirSync(path.join(dir, "empty"));
    assert.throws(() => checkDuplication("HEAD", { cwd: dir }), /empty|malformed|ENOENT/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
