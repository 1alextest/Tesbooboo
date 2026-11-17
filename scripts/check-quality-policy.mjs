import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { changedPaths, readGitFile, resolveBase } from "./git-quality.mjs";

export function validateLintBaseline(current, previous) {
  const issues = [];
  if (!current || typeof current !== "object" || Array.isArray(current)) return ["Lint baseline must be a file/rule/count object."];
  for (const [file, rules] of Object.entries(current)) {
    if (!file || !rules || typeof rules !== "object" || Array.isArray(rules)) {
      issues.push(`Invalid baseline entry: ${file}`);
      continue;
    }
    for (const [rule, count] of Object.entries(rules)) {
      const permitted = Object.hasOwn(previous || {}, file) && Object.hasOwn(previous[file], rule) ? previous[file][rule] : 0;
      if (!rule || !Number.isSafeInteger(count) || count < 1) issues.push(`Invalid allowance ${file} / ${rule}. Remove retired allowances.`);
      else if (!Number.isSafeInteger(permitted) || count > permitted) issues.push(`Baseline expansion: ${file} / ${rule}: ${permitted} -> ${count}. Fix the violation; a PR cannot self-authorize more debt.`);
    }
  }
  return issues;
}

export function main(args = process.argv.slice(2)) {
  if (args.length !== 2 || args[0] !== "--base") throw new Error("Usage: node scripts/check-quality-policy.mjs --base <git-ref>");
  const base = resolveBase(args[1]);
  const errors = [];
  for (const scope of ["backend", "frontend"]) {
    const filename = `.github/lint-baselines/${scope}.json`;
    const previous = readGitFile(base, filename);
    if (previous === null) throw new Error(`Trusted ${scope} lint baseline is missing from the base; review bootstrap explicitly.`);
    errors.push(...validateLintBaseline(JSON.parse(fs.readFileSync(filename, "utf8")), JSON.parse(previous)));
  }
  const policyFiles = new Set([".dependency-cruiser.cjs", ".jscpd.json", ".github/test-impact.json", "scripts/check-lint-baseline.mjs", "scripts/check-quality-policy.mjs"]);
  const changedPolicies = changedPaths(base).filter((name) => policyFiles.has(name) || name.startsWith(".github/lint-baselines/"));
  const report = {
    base,
    errors,
    changedPolicies,
    reviewRequired: changedPolicies.length > 0,
    limitation: "Policy changes require independent review. This gate does not grant approval, enforce repository rulesets, or identify semantic duplication."
  };
  fs.mkdirSync("reports/quality", { recursive: true });
  fs.writeFileSync("reports/quality/policy.json", JSON.stringify(report, null, 2) + "\n");
  for (const error of errors) console.error(error);
  console.log(`Quality policy: ${errors.length} baseline expansions/invalid entries; ${changedPolicies.length} policy changes require review.`);
  if (errors.length) process.exitCode = 1;
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
