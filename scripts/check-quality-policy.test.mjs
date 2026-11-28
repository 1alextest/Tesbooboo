import assert from "node:assert/strict";
import { test } from "node:test";
import { validateLintBaseline, validateLintBaselineShape } from "./check-quality-policy.mjs";
import { resolveBase, changedPaths, readGitFile } from "./git-quality.mjs";

test("lint allowances may shrink or retire but may not grow or move to another file/rule", () => {
  const baseline = { "a.ts": { unsafe: 2 }, "b.ts": { unused: 1 } };
  assert.deepEqual(validateLintBaseline(baseline, baseline), []);
  assert.deepEqual(validateLintBaseline({ "a.ts": { unsafe: 1 } }, baseline), []);
  assert.deepEqual(validateLintBaseline({}, baseline), []);
  assert.match(validateLintBaseline({ "a.ts": { unsafe: 3 } }, baseline).join(), /expansion/);
  assert.match(validateLintBaseline({ "c.ts": { unsafe: 1 } }, baseline).join(), /expansion/);
  assert.match(validateLintBaseline({ "a.ts": { other: 1 } }, baseline).join(), /expansion/);
  assert.match(validateLintBaseline({ "a.ts": { constructor: 1 } }, baseline).join(), /expansion/);
});

test("invalid and zero allowances cannot silently disable a quality check", () => {
  for (const current of [null, [], 1, { "a.ts": [] }, { "a.ts": { unsafe: 0 } }, { "a.ts": { unsafe: -1 } }, { "a.ts": { unsafe: "2" } }]) {
    assert.ok(validateLintBaseline(current, {}).length);
  }
});

test("a first baseline is held to structural checks, not the predecessor comparison it cannot have", () => {
  // The base carries no lint baseline on a first promotion, so validateLintBaseline would reject
  // every entry as expansion against an implicit zero. The bootstrap path validates the file's
  // shape instead and records the scope for review; it must still reject malformed allowances.
  const first = { "a.ts": { unsafe: 2 } };
  assert.deepEqual(validateLintBaselineShape(first), []);
  for (const current of [null, [], 1, { "a.ts": [] }, { "a.ts": { unsafe: 0 } }, { "a.ts": { unsafe: -1 } }, { "a.ts": { unsafe: "2" } }, { "": { unsafe: 1 } }]) {
    assert.ok(validateLintBaselineShape(current).length, JSON.stringify(current));
  }
});

test("all gates share a verified base and NUL-safe tracked-change inventory", () => {
  const base = resolveBase("HEAD");
  assert.match(base, /^[a-f\d]{40}$/i);
  assert.ok(Array.isArray(changedPaths(base)));
  assert.match(readGitFile(base, "package.json"), /license/);
  assert.equal(readGitFile(base, "this-file-does-not-exist.json"), null);
  assert.throws(() => readGitFile(base, "../outside"), /relative/);
  assert.throws(() => changedPaths("--bad"), /verified/);
});

test("missing history, option-like refs and malformed refs fail rather than return a green empty plan", () => {
  for (const ref of ["", "--help", "bad\nref", "not-a-real-ci-base-ref-903712"]) {
    assert.throws(() => resolveBase(ref), /base/);
  }
});
