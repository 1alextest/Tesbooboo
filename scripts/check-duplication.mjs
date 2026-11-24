import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runJscpd } from "jscpd";
import { resolveBase } from "./git-quality.mjs";

/**
 * Reuse the detector's occurrence-aware base comparison instead of inventing
 * another similarity engine or a global percentage budget that new code dilutes.
 */
export function checkDuplication(ref, { cwd = process.cwd(), config = ".jscpd.json" } = {}) {
  const base = resolveBase(ref, { cwd });
  const settings = JSON.parse(fs.readFileSync(path.resolve(cwd, config), "utf8"));
  if (typeof settings.output !== "string" || !settings.output) throw new Error("Clone report output must be explicitly configured.");
  const reportPath = path.resolve(cwd, settings.output, "jscpd-report.json");
  if (path.relative(cwd, reportPath).startsWith("..") || path.isAbsolute(path.relative(cwd, reportPath))) {
    throw new Error("Clone reports must stay inside the analysis directory.");
  }
  fs.rmSync(reportPath, { force: true }); // Only our generated report; never read stale evidence.
  const result = runJscpd([
    "--config", config, "--baseline-from-ref", base,
    "--fail-on-new-clones", "0", "--fail-on-empty", "--no-colors", "--no-tips", "--workers", "2"
  ], { cwd, encoding: "utf8", maxBuffer: 16 * 1024 * 1024, timeout: 120_000 });
  if (result.error || result.signal || ![0, 1].includes(result.status)) {
    throw new Error(`Clone detector failed to execute: ${result.error?.message || result.signal || result.stderr || result.status}`);
  }
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  if (!Array.isArray(report.duplicates) || !Number.isSafeInteger(report.statistics?.total?.newClones) ||
      !(report.statistics.total.sources > 0) || report.duplicates.some((clone) => typeof clone.isNew !== "boolean")) {
    throw new Error("Clone detector produced an empty/malformed report; refusing a green result.");
  }
  // Human-readable findings without dumping potentially sensitive code fragments.
  const newClones = report.duplicates.filter((clone) => clone.isNew);
  return { base, status: result.status, report, newClones, stderr: result.stderr };
}

export function main(args = process.argv.slice(2)) {
  if (args.length !== 2 || args[0] !== "--base") throw new Error("Usage: npm run quality:duplication -- --base <git-ref>");
  const result = checkDuplication(args[1]);
  for (const clone of result.newClones) {
    console.error(`New substantial clone: ${clone.firstFile.name}:${clone.firstFile.start} <-> ${clone.secondFile.name}:${clone.secondFile.start}. Extend the existing owner or explain a narrowly reviewed exception.`);
  }
  if (result.stderr) process.stderr.write(result.stderr);
  console.log(`Duplication: ${result.report.statistics.total.sources} files; ${result.report.duplicates.length} total clones; ${result.newClones.length} new. Existing clones are visible debt, not verified reuse.`);
  if (result.status !== 0 || result.newClones.length) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
