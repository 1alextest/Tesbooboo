import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

// Compares real product-result attachments emitted by the same nine HTTP acceptance scenarios.
// Expected modes are explicit arguments; neither this check nor the tests infer startup success
// from LANGFUSE_ENABLED. Missing, failed, duplicated or unequal cases make the job fail.
const modes = ["enabled", "disabled", "unset"];
const ids = Array.from({ length: 9 }, (_, index) => `ZYR-OBS-${String(index + 1).padStart(2, "0")}`);
assert.equal(process.argv.length, 5, "Pass enabled=DIR disabled=DIR unset=DIR");
const directories = new Map(process.argv.slice(2).map((arg) => {
  const separator = arg.indexOf("=");
  assert.ok(separator > 0, "Expected mode=directory");
  const mode = arg.slice(0, separator);
  const directory = arg.slice(separator + 1);
  assert.ok(modes.includes(mode) && directory, "Unknown mode or missing directory");
  return [mode, directory];
}));
assert.deepEqual([...directories.keys()].sort(), [...modes].sort(), "Each required mode must occur once");

async function discover(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await discover(target));
    else if (entry.isFile() && entry.name === "observability-product-outcome.json") found.push(target);
  }
  return found;
}

const results = new Map();
for (const mode of modes) {
  const files = await discover(directories.get(mode));
  assert.equal(files.length, ids.length, `${mode} must contain exactly nine result artifacts`);
  const outcomes = new Map();
  for (const file of files) {
    const result = JSON.parse(await readFile(file, "utf8"));
    assert.equal(result.mode, mode, "Result mode must match its declared run");
    assert.equal(result.status, "passed", `${result.testId} did not pass`);
    assert.ok(ids.includes(result.testId), "Unknown acceptance ID");
    assert.ok(!outcomes.has(result.testId), `Duplicate artifact for ${result.testId}`);
    assert.ok(Array.isArray(result.product) && result.product.length > 0, "Missing product outcomes");
    outcomes.set(result.testId, result.product);
  }
  assert.deepEqual([...outcomes.keys()].sort(), ids);
  results.set(mode, outcomes);
}

for (const id of ids) {
  for (const mode of modes.slice(1)) {
    assert.deepEqual(results.get(mode).get(id), results.get("enabled").get(id), `${id}: product outcome changed between enabled and ${mode}`);
  }
}
console.log("Verified 9 real product outcomes are identical across enabled, disabled and unset tracing (27 passing executions).");
