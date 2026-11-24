/**
 * Transitional, bounded lint gate.
 * All ESLint rules stay enabled. Existing, explicitly inventoried errors are
 * tracked per file + rule, and any new error fails. Remove entries as debt is
 * corrected; never increase the baseline without independent review.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const scope = process.argv[2];
if (!["backend", "frontend"].includes(scope)) {
  console.error("Usage: node scripts/check-lint-baseline.mjs backend|frontend");
  process.exit(2);
}
const root = path.resolve(process.cwd(), "..");
const baselinePath = path.join(root, ".github", "lint-baselines", scope + ".json");
const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
const executable = path.join(process.cwd(), "node_modules", "eslint", "bin", "eslint.js");
const args = scope === "backend" ? ['src/**/*.ts'] : ["."];
const result = spawnSync(process.execPath, [executable, ...args, "--format", "json"], {
  cwd: process.cwd(),
  encoding: "utf8",
  maxBuffer: 32 * 1024 * 1024
});
if (result.error || ![0, 1].includes(result.status)) {
  console.error("ESLint failed to execute:", result.error?.message || result.stderr || result.status);
  process.exit(1);
}
let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  console.error("ESLint did not produce a valid JSON report:", result.stderr || result.stdout.slice(0, 1000));
  process.exit(1);
}
const actual = {};
const newProblems = [];
let totalErrors = 0;
let totalWarnings = 0;
for (const fileResult of report) {
  const filename = path.relative(process.cwd(), fileResult.filePath).replaceAll(path.sep, "/");
  totalWarnings += fileResult.warningCount || 0;
  for (const msg of fileResult.messages || []) {
    if (msg.severity !== 2) continue;
    totalErrors++;
    const rule = msg.ruleId || "(parser/error)";
    const group = actual[filename] ||= {};
    group[rule] = (group[rule] || 0) + 1;
    const permitted = baseline[filename]?.[rule] || 0;
    if (group[rule] > permitted) {
      newProblems.push(`${filename}:${msg.line}:${msg.column} [${rule}] ${msg.message}`);
    }
  }
}
if (newProblems.length) {
  console.error("New lint errors exceed the frozen baseline:");
  for (const message of newProblems) console.error("  " + message);
  console.error("Fix these errors; do not increase the baseline just to make CI green.");
  process.exit(1);
}
const baselineTotal = Object.values(baseline).reduce(
  (sum, rules) => sum + Object.values(rules).reduce((n, count) => n + count, 0), 0
);
console.log(`${scope}: ${totalErrors} known lint errors (baseline maximum: ${baselineTotal}), ${totalWarnings} warnings; 0 NEW errors.`);
if (totalErrors > 0) {
  console.warn("Legacy lint errors remain unresolved. Full ESLint analysis ran; this gate tracks them instead of disabling rules.");
}
