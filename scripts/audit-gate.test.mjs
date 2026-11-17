import assert from "node:assert/strict";
import test from "node:test";
import {
  advisoriesFromAudit,
  evaluateAudit,
  exceptionsForScope,
  ghsaFromUrl,
  parseAuditJson
} from "./audit-gate.mjs";

const NOW = new Date("2026-11-17T12:00:00.000Z");

function auditFixture({ packageName = "picomatch", severity = "high", id = "GHSA-fc5q-39xc-vjpf" } = {}) {
  return {
    auditReportVersion: 2,
    vulnerabilities: {
      [packageName]: {
        name: packageName,
        severity,
        isDirect: false,
        via: [
          {
            source: 1113909,
            name: packageName,
            dependency: packageName,
            title: "picomatch vulnerable to ReDoS through single-branch repeated extglobs",
            url: `https://github.com/advisories/${id}`,
            severity,
            range: "<=4.0.7"
          },
          "dependency-cruiser"
        ],
        effects: ["dependency-cruiser"],
        range: "<=4.0.7",
        nodes: [`node_modules/${packageName}`],
        fixAvailable: false
      },
      "dependency-cruiser": {
        name: "dependency-cruiser",
        severity,
        isDirect: true,
        via: [packageName],
        effects: [],
        range: "*",
        nodes: ["node_modules/dependency-cruiser"],
        fixAvailable: false
      }
    },
    metadata: { vulnerabilities: { high: 2 } }
  };
}

const exception = {
  id: "GHSA-fc5q-39xc-vjpf",
  package: "picomatch",
  reason: "no patched release; dev-only",
  expires: "2027-02-17"
};

test("reads GHSA ids from advisory urls", () => {
  assert.equal(ghsaFromUrl("https://github.com/advisories/GHSA-fc5q-39xc-vjpf"), "GHSA-fc5q-39xc-vjpf");
  assert.equal(ghsaFromUrl("https://github.com/advisories/GHSA-FC5Q-39XC-VJPF"), "GHSA-FC5Q-39XC-VJPF");
  assert.equal(ghsaFromUrl("https://example.com/not-an-advisory"), null);
  assert.equal(ghsaFromUrl(undefined), null);
});

test("counts an advisory once even when several packages reference it", () => {
  const advisories = advisoriesFromAudit(auditFixture());
  assert.equal(advisories.length, 1);
  assert.equal(advisories[0].package, "picomatch");
  assert.equal(advisories[0].severity, "high");
});

test("fails a high advisory with no exception", () => {
  const result = evaluateAudit({ audit: auditFixture(), exceptions: [], now: NOW });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /GHSA-fc5q-39xc-vjpf/);
});

test("allows exactly the matching, unexpired exception and reports it", () => {
  const result = evaluateAudit({ audit: auditFixture(), exceptions: [exception], now: NOW });
  assert.equal(result.ok, true);
  assert.equal(result.allowed.length, 1);
  assert.match(result.warnings[0], /allowed until 2027-02-17/);
});

test("fails when the exception has expired", () => {
  const result = evaluateAudit({
    audit: auditFixture(),
    exceptions: [{ ...exception, expires: "2026-11-16" }],
    now: NOW
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /expired on 2026-11-16/);
});

test("fails a stale exception that no advisory matches", () => {
  const result = evaluateAudit({
    audit: auditFixture(),
    exceptions: [exception, { ...exception, id: "GHSA-aaaa-bbbb-cccc" }],
    now: NOW
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /stale exception GHSA-aaaa-bbbb-cccc/);
});

test("keeps failing a different advisory on the same package", () => {
  const result = evaluateAudit({
    audit: auditFixture({ id: "GHSA-zzzz-zzzz-zzzz" }),
    exceptions: [exception],
    now: NOW
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /GHSA-zzzz-zzzz-zzzz/);
});

test("does not fail on moderate or low advisories", () => {
  const result = evaluateAudit({
    audit: auditFixture({ packageName: "left-pad", severity: "moderate", id: "GHSA-low1-low2-low3" }),
    exceptions: [],
    now: NOW
  });
  assert.equal(result.ok, true);
  assert.equal(result.blocking.length, 0);
});

test("applies an exception only in the trees it names", () => {
  const scoped = { ...exception, scopes: ["root", "backend"] };
  assert.equal(exceptionsForScope([scoped], "root").length, 1);
  assert.equal(exceptionsForScope([scoped], "backend").length, 1);
  assert.equal(exceptionsForScope([scoped], "frontend").length, 0);
  const frontend = evaluateAudit({
    audit: auditFixture(),
    exceptions: exceptionsForScope([scoped], "frontend"),
    now: NOW
  });
  assert.equal(frontend.ok, false);
});

test("does not apply an exception that names no scopes", () => {
  assert.equal(exceptionsForScope([exception], "root").length, 0);
});

test("a malformed expiry is treated as expired rather than trusted", () => {
  const result = evaluateAudit({
    audit: auditFixture(),
    exceptions: [{ ...exception, expires: "November 2027" }],
    now: NOW
  });
  assert.equal(result.ok, false);
});

test("an audit that failed to run never reads as clean", () => {
  assert.throws(() => parseAuditJson('{"error":{"code":"ENOLOCK","summary":"This command requires an existing lockfile."}}'), /ENOLOCK|lockfile/);
  assert.throws(() => parseAuditJson("not json"), /did not produce JSON/);
  assert.throws(() => parseAuditJson('{"metadata":{}}'), /no vulnerabilities map/);
  assert.deepEqual(parseAuditJson('{"vulnerabilities":{}}').vulnerabilities, {});
});
