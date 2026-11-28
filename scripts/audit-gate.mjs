#!/usr/bin/env node
/*
 * High/critical advisory gate with scoped, expiring exceptions.
 *
 * `npm audit --audit-level=high` is the right default and stays in place for the shipped
 * backend and frontend trees. The repository root is different: it holds private dev tooling
 * (dependency-cruiser, jscpd, typescript), so an advisory with no patched release can block
 * every pull request even though the vulnerable code never ships and never receives untrusted
 * input. GHSA-fc5q-39xc-vjpf (picomatch, 2026-11-17) is that case.
 *
 * The exception is not a blanket waiver: it names one advisory for one package and one or more
 * trees, carries a reason and an expiry date, and the gate fails when an exception matches nothing
 * so it cannot outlive the vulnerability it was written for. Every other high/critical advisory
 * still fails.
 *
 * Usage:
 *   node scripts/audit-gate.mjs --dir . --scope root [--exceptions scripts/audit-exceptions.json]
 *                               [--json-output backend-audit-all.json]
 *
 * The pure functions are exported for scripts/audit-gate.test.mjs.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

export const BLOCKING_SEVERITIES = new Set(["high", "critical"]);

/** GHSA ids are the stable identifier; npm's numeric `source` is registry-local. The id is
 *  returned as published, and comparisons are case-insensitive because advisory metadata and
 *  hand-written exceptions disagree on case. */
export function ghsaFromUrl(url) {
  const match = typeof url === "string" ? /GHSA-[a-z0-9-]+/i.exec(url) : null;
  return match ? match[0] : null;
}

const normalizeId = (value) => String(value ?? "").trim().toUpperCase();

/** Exceptions are scoped to the tree whose audit they waive; an entry without a matching scope is
 *  not applied, so an exception written for dev tooling cannot leak into a shipped tree. */
export function exceptionsForScope(exceptions, scope) {
  return (Array.isArray(exceptions) ? exceptions : []).filter(
    (exception) => Array.isArray(exception?.scopes) && exception.scopes.includes(scope)
  );
}

/** Pull the advisory objects out of `npm audit --json`. String entries in `via` only reference
 *  another package's advisory and are reported under that package instead. */
export function advisoriesFromAudit(audit) {
  const advisories = new Map();
  const vulnerabilities = audit && typeof audit === "object" ? audit.vulnerabilities : null;
  for (const [packageName, vulnerability] of Object.entries(vulnerabilities ?? {})) {
    const severity = String(vulnerability?.severity ?? "").toLowerCase();
    for (const entry of Array.isArray(vulnerability?.via) ? vulnerability.via : []) {
      if (!entry || typeof entry !== "object") continue;
      const id = ghsaFromUrl(entry.url);
      if (!id) continue;
      const advisory = {
        id,
        package: packageName,
        severity: String(entry.severity ?? severity).toLowerCase(),
        title: String(entry.title ?? ""),
        range: String(entry.range ?? vulnerability?.range ?? "")
      };
      advisories.set(`${normalizeId(id)}:${packageName}`, advisory);
    }
  }
  return [...advisories.values()];
}

function expiredAt(exception, now) {
  if (typeof exception?.expires !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(exception.expires)) {
    return true;
  }
  // The exception is valid through the end of its expiry day, UTC.
  return `${exception.expires}T23:59:59.999Z` < now.toISOString();
}

export function evaluateAudit({ audit, exceptions = [], now = new Date() }) {
  const advisories = advisoriesFromAudit(audit);
  const blocking = advisories.filter((advisory) => BLOCKING_SEVERITIES.has(advisory.severity));
  const errors = [];
  const warnings = [];
  const allowed = [];
  const used = new Set();

  for (const advisory of blocking) {
    const exception = exceptions.find(
      (candidate) =>
        normalizeId(candidate?.id) === normalizeId(advisory.id) && candidate?.package === advisory.package
    );
    if (!exception) {
      errors.push(
        `${advisory.severity} ${advisory.id} in ${advisory.package}${advisory.range ? ` (${advisory.range})` : ""}: ${advisory.title}`
      );
      continue;
    }
    used.add(exception);
    if (expiredAt(exception, now)) {
      errors.push(
        `exception ${advisory.id} for ${advisory.package} expired on ${exception.expires}; resolve the advisory or renew it with a fresh reason.`
      );
      continue;
    }
    allowed.push(advisory);
    warnings.push(`allowed until ${exception.expires}: ${advisory.id} in ${advisory.package}`);
  }

  for (const exception of exceptions) {
    if (!used.has(exception)) {
      errors.push(
        `stale exception ${exception.id} for ${exception.package}: it matched no high/critical advisory, so remove it.`
      );
    }
  }

  return { ok: errors.length === 0, advisories, blocking, allowed, errors, warnings };
}

function readExceptions(exceptionsPath) {
  if (!fs.existsSync(exceptionsPath)) return [];
  const parsed = JSON.parse(fs.readFileSync(exceptionsPath, "utf8"));
  return Array.isArray(parsed?.exceptions) ? parsed.exceptions : [];
}

/** An audit that could not run must fail the gate, not read as "no vulnerable packages". */
export function parseAuditJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("npm audit did not produce JSON");
  }
  if (parsed && parsed.error) {
    const detail = parsed.error.summary || parsed.error.code || "unknown error";
    throw new Error(`npm audit failed: ${detail}`);
  }
  if (!parsed || typeof parsed.vulnerabilities !== "object" || parsed.vulnerabilities === null) {
    throw new Error("npm audit JSON has no vulnerabilities map");
  }
  return parsed;
}

function runAudit(directory) {
  const result = spawnSync("npm", ["audit", "--json"], {
    cwd: directory,
    encoding: "utf8",
    shell: process.platform === "win32"
  });
  const text = result.stdout && result.stdout.trim() ? result.stdout : "";
  if (!text) {
    throw new Error(
      `npm audit produced no JSON (exit ${result.status}); ${String(result.stderr || "").trim().slice(0, 200)}`
    );
  }
  return parseAuditJson(text);
}

export function main(argv = process.argv.slice(2)) {
  const args = { dir: ".", exceptions: null, scope: "root", jsonOutput: null };
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === "--dir") args.dir = argv[++index];
    else if (argv[index] === "--exceptions") args.exceptions = argv[++index];
    else if (argv[index] === "--scope") args.scope = argv[++index];
    else if (argv[index] === "--json-output") args.jsonOutput = argv[++index];
  }
  const exceptionsPath =
    args.exceptions ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "audit-exceptions.json");
  const audit = runAudit(args.dir);
  if (args.jsonOutput) fs.writeFileSync(args.jsonOutput, `${JSON.stringify(audit, null, 2)}\n`);
  const result = evaluateAudit({
    audit,
    exceptions: exceptionsForScope(readExceptions(exceptionsPath), args.scope)
  });
  for (const warning of result.warnings) console.log(`allowed: ${warning}`);
  for (const error of result.errors) console.error(`FAIL: ${error}`);
  console.log(
    `audit gate (${args.scope}): ${result.blocking.length} high/critical ` +
      `advisor${result.blocking.length === 1 ? "y" : "ies"}, ${result.allowed.length} allowed by exception`
  );
  return result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exit(main());
  } catch (error) {
    console.error(`audit gate: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
