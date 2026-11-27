import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
import {
  ImpactInputError, normalizePath, matchesPattern, validateConfig, parseGraph,
  affectedConsumers, planImpact, formatMarkdown, parseNulPaths, parseArgs,
  changedPathsFromGit, runCli
} from "./test-impact.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const script = path.join(root, "scripts/test-impact.mjs");
const config = JSON.parse(fs.readFileSync(path.join(root, ".github/test-impact.json"), "utf8"));
const git = spawnSync("git", ["ls-files", "--cached", "-z", "--"], { cwd: root, encoding: "utf8" });
assert.equal(git.status, 0, "Tests require this repository's tracked-file inventory, not runtime fixtures.");
const availablePaths = parseNulPaths(git.stdout);
const plan = (paths, extra = {}) => planImpact({ changedPaths: paths, config, availablePaths, ...extra });
const allSpecs = result => Object.values(result.selectedSpecs).flat();
const hasSpec = (result, spec) => assert.ok(allSpecs(result).includes(spec), `Expected selected spec ${spec}`);
const hasDomain = (result, domain) => assert.ok(result.domains.some(item => item.id === domain), `Expected domain ${domain}`);
const cli = args => spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8" });
const clone = value => JSON.parse(JSON.stringify(value));

function temporary(t) {
  const base = process.platform === "win32" && process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "Temp", "opencode") : os.tmpdir();
  const directory = fs.mkdtempSync(path.join(base, "test-impact-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test("all configured spec/workflow/check evidence is checked in and exists, without reading its contents", () => {
  const evidence = validateConfig(config, availablePaths);
  assert.ok(evidence.length > 100);
  for (const filename of evidence) {
    assert.ok(!filename.split("/").includes(".auth"));
    assert.ok(fs.lstatSync(path.join(root, filename)).isFile(), `Missing mapped file: ${filename}`);
  }
});

test("normalizes Windows separators and ./ while preserving spaces and literal Next segments", () => {
  assert.equal(normalizePath(".\\Tesbo-Frontend\\app\\(app)\\projects\\[id]\\plans\\new file.tsx"),
    "Tesbo-Frontend/app/(app)/projects/[id]/plans/new file.tsx");
  assert.ok(matchesPattern("Tesbo-Frontend/app/(app)/projects/[id]/plans/new file.tsx",
    "Tesbo-Frontend/app/(app)/projects/[id]/plans/**"));
  assert.ok(matchesPattern("a/file.ts", "a/**/*.ts"));
  assert.ok(matchesPattern("a/b/c/file.ts", "a/**/*.ts"));
  assert.ok(!matchesPattern("a/one/two.ts", "a/*.ts"));
  assert.ok(!matchesPattern("app/x/page.tsx", "app/[id]/**"), "Brackets must not become character classes.");
});

test("rejects empty, escaping, absolute, drive, NUL and control-containing repository paths", () => {
  for (const filename of ["", "  ", "../file", "one/../two", "/etc/passwd", "C:\\repo\\file", "\\\\server\\share", "a\0b", "a\nb"]) {
    assert.throws(() => normalizePath(filename), ImpactInputError);
  }
});

test("multi-area changes accumulate owners/checks/API/UI/regression without duplicate spec files", () => {
  const result = plan([
    "Tesbo-Backend-Nest/src/automation/automation.service.ts",
    "Tesbo-Frontend/app/(app)/projects/[id]/bugs/page.tsx",
    "Tesbo-Frontend/components/reports/OverviewTab.tsx"
  ]);
  assert.equal(result.status, "selection-only");
  for (const domain of ["automation", "executions", "bugs", "reports", "attachments", "integrations"]) hasDomain(result, domain);
  for (const spec of ["e2e/api/automation.spec.ts", "e2e/api/transport.spec.ts", "e2e/ui/bugs.spec.ts",
    "e2e/ui/reports.spec.ts", "e2e/regression/ui/tickets-bugs.spec.ts", "e2e/regression/api/tickets-reports.spec.ts"]) hasSpec(result, spec);
  assert.equal(new Set(allSpecs(result)).size, allSpecs(result).length);
  assert.equal(result.counts.selectedSpecFileCount, allSpecs(result).length);
  assert.ok(result.requiredChecks.some(check => check.id === "sdk-quality"));
});

test("shared legacy service is explicitly broad, never a Zyra-only selection", () => {
  const result = plan(["Tesbo-Backend-Nest/src/legacy/legacy.service.ts"]);
  assert.equal(result.owningDomains.length, Object.keys(config.domains).length);
  for (const domain of ["identity", "membership", "entitlements", "testcases", "plans", "executions", "mcp", "automation", "reports", "knowledge", "model-studio"]) hasDomain(result, domain);
  assert.ok(result.rationale.some(item => item.rule === "legacy-shared-owner"));
  // Broad, but a review obligation rather than a standing evidence gap: the Review Board's
  // Postgres/Redis suites now run in the smoke workflow, so no DOMAIN_EVIDENCE_GAP is emitted.
  assert.equal(result.status, "selection-only");
  assert.ok(!result.diagnostics.some(item => item.code === "DOMAIN_EVIDENCE_GAP"));
});

test("new auth/session/tenant role files add shared isolation and billing coverage", () => {
  for (const filename of ["Tesbo-Backend-Nest/src/auth/new-session-policy.ts", "Tesbo-Backend-Nest/src/cache/new-membership-cache.ts",
    "Tesbo-Frontend/lib/workspaceRoles.ts"]) {
    const result = plan([filename]);
    for (const spec of ["e2e/api/auth.spec.ts", "e2e/api/authorization.spec.ts", "e2e/api/rbac.spec.ts",
      "e2e/api/project-access.spec.ts", "e2e/api/workspaces.spec.ts", "e2e/api/billing-lifecycle.spec.ts"]) hasSpec(result, spec);
    assert.ok(result.sharedRiskDomains.length > 10);
  }
});

test("entitlement/write-lock additions retain CLAUDE Test Plans but select real billing lifecycle too", () => {
  const result = plan(["Tesbo-Backend-Nest/src/plan-limits/new-entitlement-policy.ts"]);
  for (const spec of ["e2e/api/billing-lifecycle.spec.ts", "e2e/api/billing.spec.ts", "e2e/ui/billing.spec.ts", "e2e/api/plans.spec.ts"]) hasSpec(result, spec);
  assert.ok(result.sharedRiskDomains.includes("automation"));
  const testPlans = plan(["Tesbo-Frontend/components/testplans/PlanCard.tsx"]);
  hasSpec(testPlans, "e2e/api/plans.spec.ts");
  hasSpec(testPlans, "e2e/ui/plans.spec.ts");
  assert.ok(!testPlans.owningDomains.includes("entitlements"), "Do not confuse native Test Plans with subscription plans.");
});

test("migrations and shared frontend API/providers select cross-system consumers additively", () => {
  for (const filename of ["Tesbo-Backend-Nest/migrations/V999_future migration.sql", "Tesbo-Frontend/lib/api.ts",
    "Tesbo-Frontend/components/app/AppDataProvider.tsx"]) {
    const result = plan([filename]);
    for (const domain of ["knowledge", "reports", "automation", "identity", "membership", "entitlements", "mcp", "model-studio"]) hasDomain(result, domain);
  }
  const migration = plan(["Tesbo-Backend-Nest/migrations/V999_future migration.sql"]);
  hasDomain(migration, "database");
  for (const check of ["database-integrity", "migration-names"]) assert.ok(migration.requiredChecks.some(item => item.id === check));
});

test("workers, MCP, SDK, reports and current-development graph/model paths have real mappings", () => {
  for (const [filename, domain, spec] of [
    ["Tesbo-Backend-Nest/src/integration-sync/integration-sync.processor.ts", "integrations", "e2e/api/integrations.spec.ts"],
    ["Tesbo-Backend-Nest/src/rag/rag-embedding.processor.ts", "rag", "e2e/api/kb-embeddings.spec.ts"],
    ["Tesbo-Backend-Nest/src/welcome-email/welcome-email.processor.ts", "notifications", "e2e/api/email-delivery.spec.ts"],
    ["Tesbo-Backend-Nest/src/mcp/mcp.tools.ts", "mcp", "e2e/api/mcp.spec.ts"],
    ["sdk/playwright-reporter/src/client.ts", "automation", "e2e/api/automation.spec.ts"],
    ["Tesbo-Backend-Nest/src/analytics-report/analytics-report.processor.ts", "reports", "e2e/api/reports.spec.ts"],
    ["Tesbo-Backend-Nest/src/behavior-graph/graph-change-review.recovery.processor.ts", "model-studio", "e2e/api/model-studio.spec.ts"],
    ["Tesbo-Frontend/app/(app)/projects/[id]/model-studio/page.tsx", "model-studio", "e2e/ui/model-studio.spec.ts"]
  ]) {
    const result = plan([filename]);
    hasDomain(result, domain);
    hasSpec(result, spec);
  }
});

test("Review Board selections require its runtime checks without a standing evidence gap", () => {
  const result = plan(["Tesbo-Backend-Nest/src/review-board/review-board.processor.ts"]);
  // The DB/Redis suites execute in the smoke workflow, so selecting this domain is a review and
  // check obligation, not a review-required evidence gap.
  assert.equal(result.status, "selection-only");
  assert.ok(result.requiredChecks.some(check => check.id === "api-mcp-contracts"));
  assert.ok(result.requiredChecks.some(check => check.id === "transactional-concurrency"));
  assert.ok(!result.diagnostics.some(item => item.code === "DOMAIN_EVIDENCE_GAP"));
  hasSpec(result, "e2e/ci-smoke.spec.ts");
});

test("native requirement preview files receive explicit KB, authorization and testcase impact, not an unmapped product verdict", () => {
  for (const filename of [
    "Tesbo-Backend-Nest/src/legacy/native-requirement-preview.ts",
    "Tesbo-Backend-Nest/src/legacy/native-requirement-preview.spec.ts"
  ]) {
    const result = plan([filename]);
    assert.equal(result.status, "selection-only");
    assert.deepEqual(result.unmappedPaths, []);
    for (const domain of ["knowledge", "integrations", "testcases", "membership", "identity", "rest"]) hasDomain(result, domain);
    for (const spec of ["e2e/api/knowledge-base.spec.ts", "e2e/api/authorization.spec.ts",
      "e2e/api/testcases.spec.ts", "e2e/ui/requirements.spec.ts"]) hasSpec(result, spec);
    for (const id of ["backend-quality", "playwright-smoke"]) {
      assert.ok(result.requiredChecks.some(check => check.id === id), `Missing ${id} for ${filename}`);
    }
    assert.ok(!result.diagnostics.some(item => item.code === "UNMAPPED_PRODUCT_PATH"));
    assert.equal(result.verification.status, "not-run", "Static selection never proves execution");
  }
  const unrelated = "Tesbo-Backend-Nest/src/legacy/native-requirement-publisher.ts";
  const unknown = plan([unrelated]);
  assert.equal(unknown.status, "review-required", "A future publisher must not inherit preview-only ownership");
  assert.deepEqual(unknown.unmappedPaths, [unrelated]);
});

test("native Skill assignment form retains the Skills page's domain, spec and check ownership", () => {
  const result = plan(["Tesbo-Frontend/components/skills/SkillAssignmentForm.tsx"]);
  const page = plan(["Tesbo-Frontend/app/(app)/projects/[id]/settings/skills/page.tsx"]);
  assert.equal(result.status, "selection-only");
  assert.deepEqual(result.unmappedPaths, []);
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.owningDomains, ["executions", "knowledge", "testcases", "zyra"]);
  assert.deepEqual(result.selectedSpecs, page.selectedSpecs);
  assert.deepEqual(result.requiredChecks.map(check => check.id), page.requiredChecks.map(check => check.id));
  for (const spec of ["e2e/ui/skills.spec.ts", "e2e/api/requirements.spec.ts", "e2e/api/knowledge-base.spec.ts", "e2e/api/testcases.spec.ts",
    "e2e/api/execution-ops.spec.ts", "e2e/api/zyra.spec.ts"]) hasSpec(result, spec);
  for (const id of ["backend-quality", "frontend-quality", "database-integrity", "transactional-concurrency", "playwright-smoke"]) {
    assert.ok(result.requiredChecks.some(check => check.id === id), `Missing ${id} for Skill assignment form`);
  }
  assert.equal(result.verification.status, "not-run", "A mapped form selects evidence without claiming runtime execution");
});

test("an unrelated Skills component stays unmapped even when another changed owner selects every domain", () => {
  const unrelated = "Tesbo-Frontend/components/skills/SkillEligibilityEditor.tsx";
  for (const paths of [[unrelated], [unrelated, "Tesbo-Backend-Nest/src/legacy/legacy.service.ts"]]) {
    const result = plan(paths);
    assert.equal(result.status, "review-required");
    assert.deepEqual(result.unmappedPaths, [unrelated]);
    assert.ok(result.diagnostics.some(item => item.code === "UNMAPPED_PRODUCT_PATH" && item.path === unrelated));
    if (paths.length > 1) {
      assert.equal(result.owningDomains.length, Object.keys(config.domains).length);
      hasSpec(result, "e2e/ui/skills.spec.ts");
    }
  }
});

test("unknown product paths fail review even if a shared-risk pattern adds many tests", () => {
  for (const filename of ["Tesbo-Backend-Nest/src/unowned/feature.ts", "Tesbo-Frontend/lib/unowned.ts",
    "Tesbo-Backend-Nest/src/new-area/new-session.guard.ts", "unexpected-root-product.ts"]) {
    const result = plan([filename]);
    assert.equal(result.status, "review-required");
    assert.deepEqual(result.unmappedPaths, [filename]);
    assert.ok(result.diagnostics.some(item => item.code === "UNMAPPED_PRODUCT_PATH"));
  }
});

test("zero selection cannot pass for an unknown or a mapped-but-uncovered product path", () => {
  const unknown = plan(["Tesbo-Backend-Nest/src/unowned/new.ts"]);
  assert.equal(unknown.counts.selectedSpecFileCount, 0);
  assert.ok(unknown.diagnostics.some(item => item.code === "ZERO_PRODUCT_SELECTION"));
  const empty = clone(config);
  empty.domains.reports.specs = [];
  empty.domains.notifications.specs = [];
  const result = plan(["Tesbo-Backend-Nest/src/analytics-report/analytics-report.format.ts"], { config: empty });
  assert.equal(result.status, "review-required");
  assert.ok(result.diagnostics.some(item => item.code === "ZERO_PRODUCT_SELECTION"));
  assert.throws(() => plan([]), /Changed paths/);
});

test("a verified empty Git comparison is no-changes, never zero-test product coverage or an explicit-input bypass", () => {
  const result = plan([], { verifiedEmptyGitDiff: true });
  assert.equal(result.status, "no-changes");
  assert.equal(result.verification.status, "not-run");
  assert.equal(result.verification.executedTestCount, null);
  assert.equal(result.counts.selectedSpecFileCount, 0);
  assert.deepEqual(result.changedPaths, []);
  assert.deepEqual(result.diagnostics, []);
  assert.match(result.verification.note, /No product coverage is claimed/);
  assert.match(formatMarkdown(result), /Verified Git comparison: no changed tracked paths/);
  assert.throws(() => plan([]), /Changed paths/);
  assert.throws(() => plan([], { verifiedEmptyGitDiff: "true" }), /must be boolean/);
  assert.throws(() => plan(["Tesbo-Backend-Nest/src/automation/automation.service.ts"], { verifiedEmptyGitDiff: true }), /cannot accompany changed paths/);
  assert.throws(() => parseArgs(["--verified-empty-git-diff"]), /Unknown option/);
});

test("docs/tools/test-only inputs yield explicit non-product evidence, not a zero-test green product verdict", () => {
  for (const paths of [["docs/notes with spaces.md"], ["scripts/test-impact.mjs", ".github/test-impact.json"],
    ["e2e/api/auth.spec.ts", "e2e/scripts/coverage-report.ts"], ["sdk/playwright-reporter/README.md"]]) {
    const result = plan(paths);
    assert.equal(result.status, "non-product");
    assert.equal(result.counts.selectedSpecFileCount, 0);
    assert.equal(result.verification.status, "not-run");
    assert.equal(result.nonProductPaths.length, paths.length);
  }
  const mixed = plan(["docs/notes.md", "Tesbo-Backend-Nest/src/automation/automation.service.ts"]);
  assert.equal(mixed.status, "selection-only");
  hasSpec(mixed, "e2e/api/automation.spec.ts");
  const workflows = plan([".github/workflows/anything.yml"]);
  assert.equal(workflows.status, "non-product");
  assert.ok(workflows.requiredChecks.some(check => check.id === "workflow-lint"));
});

test("reviewed mutation configurations require the existing mutation job without claiming product coverage", () => {
  for (const filename of [
    "Tesbo-Backend-Nest/stryker.ci.config.json", "Tesbo-Backend-Nest/jest.mutation.config.cjs",
    "Tesbo-Backend-Nest/stryker.qa-handoff.config.cjs", "Tesbo-Backend-Nest/jest.qa-handoff-mutation.config.cjs",
    "Tesbo-Backend-Nest/stryker.qa-handoff.config.test.cjs"
  ]) {
    const result = plan([filename]);
    assert.equal(result.status, "non-product", filename);
    assert.equal(result.counts.selectedSpecFileCount, 0);
    assert.equal(result.verification.status, "not-run");
    assert.ok(result.requiredChecks.some(check => check.id === "mutation-critical"));
  }
  const workflow = plan([".github/workflows/mutation-quality.yml"]);
  for (const id of ["workflow-lint", "mutation-critical"]) {
    assert.ok(workflow.requiredChecks.some(check => check.id === id));
  }
  const unknown = plan(["Tesbo-Backend-Nest/unknown-runtime.config.cjs"]);
  assert.equal(unknown.nonProductPaths.length, 0);
  assert.equal(unknown.owningDomains.length, Object.keys(config.domains).length);
});

test("shared E2E setup/utils/fixtures/config/dependency edits widen impact instead of masquerading as test-only", () => {
  for (const filename of [
    "e2e/global-setup.ts", "e2e/.env.example", "e2e/utils/env.ts", "e2e/utils/reports-fixture.ts",
    "e2e/regression/fixtures.ts", "e2e/fixtures/new-fixture.ts", "e2e/playwright.config.ts",
    "e2e/playwright.ci-smoke.config.ts", "e2e/playwright.headed.config.ts", "e2e/package.json", "e2e/package-lock.json"
  ]) {
    const result = plan([filename]);
    assert.equal(result.nonProductPaths.length, 0, `${filename} must widen selection.`);
    assert.equal(result.owningDomains.length, Object.keys(config.domains).length);
    assert.equal(result.counts.selectedSpecFileCount, new Set(Object.values(config.domains).flatMap(domain => domain.specs)).size);
    assert.ok(result.rationale.some(item => item.rule === "shared-e2e-harness"));
    assert.ok(result.requiredChecks.some(check => check.id === "reporter-safety"));
    assert.ok(result.requiredChecks.some(check => check.id === "playwright-smoke"));
    hasSpec(result, "e2e/api/auth.spec.ts");
    hasSpec(result, "e2e/api/billing-lifecycle.spec.ts");
    hasSpec(result, "e2e/api/automation.spec.ts");
    hasSpec(result, "e2e/ui/zyra.spec.ts");
  }
  const spec = plan(["e2e/api/auth.spec.ts"]);
  assert.equal(spec.status, "non-product");
  assert.equal(spec.counts.selectedSpecFileCount, 0);
  for (const id of ["reporter-safety", "playwright-smoke"]) assert.ok(spec.requiredChecks.some(check => check.id === id));
  const unknown = plan(["e2e/unknown-runtime-helper.ts"]);
  assert.equal(unknown.status, "review-required", "Do not reintroduce a catch-all E2E exemption.");
  assert.ok(unknown.unmappedPaths.includes("e2e/unknown-runtime-helper.ts"));
});

test("SDK test/helper/packed-consumer edits are non-product with SDK checks, even without graph nodes", () => {
  const graph = { modules: [{ source: "sdk/playwright-reporter/src/client.ts", dependencies: [] }] };
  const paths = [
    "sdk/playwright-reporter/src/index.test.ts", "sdk/playwright-reporter/scripts/package-consumer.cjs",
    "sdk/playwright-reporter/scripts/package-consumer.test.cjs", "sdk/playwright-reporter/test-support/reporter.cjs",
    "sdk/playwright-reporter/test-support/reporter.d.cts", "sdk/playwright-reporter/test-support/consumer/consumer.cts",
    "sdk/playwright-reporter/test-support/consumer/consumer.mts"
  ];
  const result = plan(paths, { graph });
  assert.equal(result.status, "non-product");
  assert.equal(result.nonProductPaths.length, paths.length);
  assert.equal(result.counts.selectedSpecFileCount, 0);
  assert.ok(result.requiredChecks.some(check => check.id === "sdk-quality"));
  assert.ok(!result.diagnostics.some(item => item.code === "GRAPH_PATH_NOT_PRESENT"));
  const production = plan(["sdk/playwright-reporter/src/client.ts"], { graph });
  assert.equal(production.status, "selection-only");
  for (const domain of ["automation", "executions", "attachments", "rest"]) hasDomain(production, domain);
  hasSpec(production, "e2e/api/automation.spec.ts");
  const missingProduction = plan(["sdk/playwright-reporter/src/deleted-production.mts"], { graph });
  assert.equal(missingProduction.status, "review-required");
  assert.ok(missingProduction.diagnostics.some(item => item.code === "GRAPH_PATH_NOT_PRESENT"));
});

test("tooling requires the current architecture-quality job and current check descriptions include new contracts", () => {
  for (const filename of ["scripts/test-impact.mjs", "scripts/check-architecture.mjs", ".github/test-impact.json",
    ".dependency-cruiser.cjs", ".jscpd.json", "package.json"]) {
    const result = plan([filename]);
    assert.equal(result.status, "non-product");
    const check = result.requiredChecks.find(item => item.id === "architecture-quality");
    assert.ok(check, filename);
    assert.equal(check.workflow, ".github/workflows/core-quality.yml");
    assert.equal(check.job, "architecture-quality");
    for (const evidence of [".dependency-cruiser.cjs", "scripts/check-architecture.mjs", "scripts/check-quality-policy.mjs"]) {
      assert.ok(check.evidence.includes(evidence));
    }
  }
  assert.match(config.checks["migration-names"].description, /append-only/);
  assert.match(config.checks["sdk-quality"].description, /packed\/installed-tarball/);
});

test("dependency graph uses resolved aliases, reverse TRANSITIVE consumers, cycles and multiple owners", () => {
  const changed = "Tesbo-Frontend/lib/executionMetrics.ts";
  const graph = { modules: [
    { source: changed, dependencies: [] },
    { source: "Tesbo-Frontend/components/reports/shared.tsx", dependencies: [
      { module: "@/lib/executionMetrics", resolved: changed },
      { module: "react", resolved: "node_modules/react/index.js" },
      { module: "node:fs", coreModule: true }
    ] },
    { source: "Tesbo-Frontend/components/reports/OverviewTab.tsx", dependencies: [
      { resolved: "Tesbo-Frontend/components/reports/shared.tsx" }
    ] },
    { source: "Tesbo-Frontend/components/testruns/runDisplay.tsx", dependencies: [
      { resolved: changed }, { resolved: "Tesbo-Frontend/components/reports/OverviewTab.tsx" }
    ] }
  ] };
  const closure = affectedConsumers([changed], graph);
  assert.deepEqual(closure.consumers, [
    "Tesbo-Frontend/components/reports/OverviewTab.tsx", "Tesbo-Frontend/components/reports/shared.tsx",
    "Tesbo-Frontend/components/testruns/runDisplay.tsx"
  ]);
  const result = plan([changed], { graph });
  hasDomain(result, "reports");
  assert.ok(result.rationale.some(item => item.source === "consumer" && item.rule === "frontend-reports"));
  assert.ok(!result.affectedConsumers.some(filename => filename.startsWith("node_modules")));
  const cyclic = { modules: [
    { source: "a.ts", dependencies: [{ resolved: "b.ts" }] },
    { source: "b.ts", dependencies: [{ resolved: "a.ts" }] }
  ] };
  assert.deepEqual(affectedConsumers(["a.ts"], cyclic).consumers, ["b.ts"]);
});

test("dependency-cruiser external package leaf records may be unresolved/duplicated without hiding internal aliases", () => {
  const npm = { source: "@nestjs/common", couldNotResolve: true, followable: false, dependencyTypes: ["unknown"], dependencies: [] };
  const graph = { modules: [
    { source: "Tesbo-Backend-Nest/src/automation/automation.service.ts", dependencies: [
      { module: "@nestjs/common", resolved: "@nestjs/common", couldNotResolve: true, followable: false, dependencyTypes: ["unknown"] }
    ] },
    npm, clone(npm)
  ] };
  assert.deepEqual(affectedConsumers(["Tesbo-Backend-Nest/src/automation/automation.service.ts"], graph).consumers, []);
  assert.throws(() => parseGraph({ modules: [npm] }), /no internal repository modules/);
  for (const resolved of ["@/lib/api", "../lib/api", "sdk/playwright-reporter/src/client.ts", "Tesbo-Frontend/lib/api.ts"]) {
    const broken = clone(graph);
    broken.modules[0].dependencies[0] = { module: resolved, resolved, couldNotResolve: true, followable: false, dependencyTypes: ["unknown"] };
    assert.throws(() => parseGraph(broken), ImpactInputError);
  }
});

test("resolved declared backend aliases retain normal reverse transitive consumer edges", () => {
  const changed = "Tesbo-Backend-Nest/src/automation/features/nested/policies/result-order.ts";
  const consumer = "Tesbo-Backend-Nest/src/automation/automation.service.ts";
  const controller = "Tesbo-Backend-Nest/src/automation/automation.controller.ts";
  const graph = {
    quality: { projectAliases: [
      { root: "Tesbo-Backend-Nest", patterns: ["@server/*"] },
      { root: "Tesbo-Frontend", patterns: ["@/*"] },
      { root: "sdk/playwright-reporter", patterns: [] }
    ] },
    modules: [
      { source: changed, dependencies: [] },
      { source: consumer, dependencies: [{ module: "@server/automation/features/nested/policies/result-order", resolved: changed, couldNotResolve: false }] },
      { source: controller, dependencies: [{ module: "@server/automation/automation.service", resolved: consumer, couldNotResolve: false }] }
    ]
  };
  assert.deepEqual(affectedConsumers([changed], graph).consumers, [controller, consumer]);
  const result = plan([changed], { graph });
  assert.equal(result.status, "selection-only");
  hasDomain(result, "automation");
  assert.deepEqual(result.affectedConsumers, [controller, consumer]);
});

test("unresolved imports matching the source project's declared aliases cannot masquerade as npm leaves", () => {
  const source = "Tesbo-Backend-Nest/src/automation/automation.service.ts";
  assert.equal(matchesPattern("@server/features/not-found", "@server/*"), false,
    "Domain globs deliberately differ from TypeScript aliases; do not reuse their single-segment wildcard matcher.");
  for (const [pattern, specifier] of [
    ["@server/*", "@server/missing"], ["@server/*", "@server/nested/missing"],
    ["@server/*", "@server/features/not-found"],
    ["@server/exact", "@server/exact"], ["server/*/policy", "server/nested/module/policy"]
  ]) {
    const graph = {
      quality: { projectAliases: [{ root: "Tesbo-Backend-Nest", patterns: [pattern] }] },
      modules: [
        { source, dependencies: [
          { module: specifier, resolved: specifier, couldNotResolve: true, followable: false, dependencyTypes: ["unknown"] }
        ] },
        { source: specifier, dependencies: [], couldNotResolve: true, followable: false, dependencyTypes: ["unknown"] }
      ]
    };
    assert.throws(() => parseGraph(graph), /Unresolved declared project alias/);
    const onlyResolved = clone(graph);
    delete onlyResolved.modules[0].dependencies[0].module;
    assert.throws(() => parseGraph(onlyResolved), /Unresolved declared project alias/);
  }
});

test("declared aliases are source-project-scoped; the same name remains a legitimate npm leaf elsewhere", () => {
  const source = "Tesbo-Frontend/lib/executionMetrics.ts";
  const graph = {
    quality: { projectAliases: [
      { root: "Tesbo-Backend-Nest", patterns: ["@server/*"] },
      { root: "Tesbo-Frontend", patterns: ["@/*"] }
    ] },
    modules: [
      { source, dependencies: [
        { module: "@server/metrics", resolved: "@server/metrics", couldNotResolve: true, followable: false, dependencyTypes: ["unknown"] },
        { module: "react", resolved: "react", couldNotResolve: true, followable: false, dependencyTypes: ["unknown"] }
      ] },
      { source: "@server/metrics", dependencies: [], couldNotResolve: true, followable: false, dependencyTypes: ["unknown"] },
      { source: "react", dependencies: [], couldNotResolve: true, followable: false, dependencyTypes: ["unknown"] }
    ]
  };
  assert.deepEqual(affectedConsumers([source], graph).consumers, []);
  const siblingPrefix = clone(graph);
  siblingPrefix.modules[0].source = "Tesbo-Backend-Nest-other/src/client.ts";
  assert.doesNotThrow(() => parseGraph(siblingPrefix), "A root prefix without a segment boundary is not that project.");
  const nestedProject = clone(graph);
  nestedProject.modules[0].source = "Tesbo-Backend-Nest/nested/src/client.ts";
  nestedProject.quality.projectAliases.push({ root: "Tesbo-Backend-Nest/nested", patterns: [] });
  assert.doesNotThrow(() => parseGraph(nestedProject), "The most-specific project's empty alias set overrides its enclosing project.");
});

test("optional graph alias metadata accepts empty declarations and rejects malformed types, roots and patterns", () => {
  const modules = [{ source: "Tesbo-Backend-Nest/src/automation/automation.service.ts", dependencies: [] }];
  for (const quality of [
    {}, { note: "No declared aliases" }, { projectAliases: [] },
    { projectAliases: [{ root: "Tesbo-Backend-Nest", patterns: [] }] }
  ]) assert.doesNotThrow(() => parseGraph({ modules, quality }));
  assert.doesNotThrow(() => parseGraph({ modules }), "Existing graphs without metadata remain supported.");
  for (const quality of [
    null, [], "invalid", { projectAliases: null }, { projectAliases: {} }, { projectAliases: "invalid" },
    { projectAliases: [null] }, { projectAliases: [{}] },
    { projectAliases: [{ root: "Tesbo-Backend-Nest", patterns: null }] },
    { projectAliases: [{ root: "Tesbo-Backend-Nest", patterns: [""] }] },
    { projectAliases: [{ root: "Tesbo-Backend-Nest", patterns: [7] }] },
    { projectAliases: [{ root: "Tesbo-Backend-Nest", patterns: ["@server/**"] }] },
    { projectAliases: [{ root: "Tesbo-Backend-Nest", patterns: ["@server/../*"] }] },
    { projectAliases: [{ root: "Tesbo-Backend-Nest", patterns: ["@server/\0*"] }] },
    { projectAliases: [{ root: "../outside", patterns: ["@server/*"] }] },
    { projectAliases: [{ root: "C:\\outside", patterns: ["@server/*"] }] },
    { projectAliases: [{ root: "Tesbo-Backend-*", patterns: [] }] },
    { projectAliases: [{ root: "Tesbo-Backend-Nest", patterns: [], typo: true }] },
    { projectAliases: [{ root: "Tesbo-Backend-Nest", patterns: [] }, { root: "Tesbo-Backend-Nest", patterns: [] }] }
  ]) assert.throws(() => parseGraph({ modules, quality }), ImpactInputError);
});

test("graph closure does not hide an unknown changed owner or unknown consumer", () => {
  const unknown = "Tesbo-Frontend/lib/unknown.ts";
  const known = "Tesbo-Frontend/components/reports/shared.tsx";
  for (const graph of [
    { modules: [{ source: unknown, dependencies: [] }, { source: known, dependencies: [{ resolved: unknown }] }] },
    { modules: [{ source: known, dependencies: [] }, { source: unknown, dependencies: [{ resolved: known }] }] }
  ]) {
    const result = plan([graph.modules[0].source], { graph });
    assert.equal(result.status, "review-required");
    assert.ok(result.unmappedPaths.includes(unknown));
    hasDomain(result, "reports");
  }
});

test("a passive bootstrap graph consumer is not a direct global configuration edit", () => {
  const changed = "Tesbo-Backend-Nest/src/automation/automation.service.ts";
  const graph = { modules: [
    { source: changed, dependencies: [] },
    { source: "Tesbo-Backend-Nest/src/app.module.ts", dependencies: [{ resolved: changed }] },
    { source: "Tesbo-Backend-Nest/src/main.ts", dependencies: [{ resolved: "Tesbo-Backend-Nest/src/app.module.ts" }] }
  ] };
  const result = plan([changed], { graph });
  assert.equal(result.status, "selection-only");
  assert.ok(!result.sharedRiskDomains.includes("review-board"));
  assert.ok(!result.rationale.some(item => item.rule === "shared-startup-risk"));
  const direct = plan(["Tesbo-Backend-Nest/src/app.module.ts"]);
  assert.ok(direct.sharedRiskDomains.includes("review-board"), "A directly edited application registration remains broad.");
});

test("missing changed graph nodes are incomplete evidence, including deleted modules", () => {
  const result = plan(["Tesbo-Backend-Nest/src/automation/deleted file.ts"], {
    graph: { modules: [{ source: "Tesbo-Backend-Nest/src/main.ts", dependencies: [] }] }
  });
  assert.equal(result.status, "review-required");
  assert.ok(result.diagnostics.some(item => item.code === "GRAPH_PATH_NOT_PRESENT"));
});

test("malformed, empty, duplicate, absolute, unresolved and missing-resolved graphs fail closed", () => {
  for (const graph of [null, {}, { modules: [] },
    { modules: [{ source: "a.ts" }] },
    { modules: [{ source: "a.ts", dependencies: [] }, { source: "a.ts", dependencies: [] }] },
    { modules: [{ source: "C:\\source.ts", dependencies: [] }] },
    { modules: [{ source: "a.ts", dependencies: [{ module: "@/unknown", couldNotResolve: true }] }] },
    { modules: [{ source: "a.ts", dependencies: [{ module: "@/missing-resolved" }] }] },
    { modules: [{ source: "a.ts", dependencies: [{ resolved: "../outside.ts" }] }] },
    { modules: [{ source: "e2e/.auth/context.json", dependencies: [] }] }
  ]) assert.throws(() => parseGraph(graph), ImpactInputError);
});

test("invalid config version, typo, unknown domain/check, stale and sensitive spec mappings fail closed", () => {
  const mutations = [
    value => { value.version = 0; },
    value => { value.domain = {}; },
    value => { value.rules[0].domains = ["missing"]; },
    value => { value.rules.push(clone(value.rules[0])); },
    value => { value.domains.reports.checks = ["missing"]; },
    value => { value.domains.reports.specs = ["e2e/api/nonexistent.spec.ts"]; },
    value => { value.domains.reports.specs = ["e2e/.auth/context.json"]; },
    value => { value.checks["backend-quality"].evidence = ["e2e/.auth/state.json"]; },
    value => { value.rules[0].patterns = ["../outside/**"]; }
  ];
  for (const mutate of mutations) {
    const altered = clone(config);
    mutate(altered);
    assert.throws(() => validateConfig(altered, availablePaths), ImpactInputError);
  }
  assert.throws(() => validateConfig(config, []), /missing/);
});

test("stable output ignores input/rule/module/dependency order and deduplicates normalized paths", () => {
  const paths = ["Tesbo-Frontend/components/reports/OverviewTab.tsx",
    "Tesbo-Backend-Nest/src/automation/automation.service.ts",
    ".\\Tesbo-Frontend\\components\\reports\\OverviewTab.tsx"];
  const altered = clone(config);
  altered.rules.reverse();
  altered.sharedRisks.reverse();
  const first = plan(paths);
  assert.deepEqual(first, plan([...paths].reverse(), { config: altered }));
  assert.deepEqual(first.changedPaths, [...new Set(first.changedPaths)].sort());
  assert.equal(first.verification.executedTestCount, null);
  assert.equal(first.verification.selectedTestCount, null);
  assert.equal(first.verification.status, "not-run");
});

test("Markdown includes rationale, checks, changed paths, consumers, limitations and truthful static counts", () => {
  const output = formatMarkdown(plan(["Tesbo-Frontend/components/reports/OverviewTab.tsx"]));
  for (const text of ["NOT RUN", "Static spec-file", "## Rationale", "## Required checks",
    "## Changed paths", "## Affected consumers", "## Limitations", "not instructions to edit"]) assert.ok(output.includes(text));
});

test("NUL Git paths preserve deletion/rename sides and filenames containing spaces", () => {
  assert.deepEqual(parseNulPaths("old path.ts\0new path.ts\0old path.ts\0"), ["new path.ts", "old path.ts"]);
  assert.deepEqual(parseNulPaths(""), []);
  assert.throws(() => parseNulPaths("line-delimited.ts\n"), /NUL/);
});

test("Git base selection delegates refs/diffs to the shared safe Git owner and keeps deletion/rename paths", () => {
  const calls = [];
  const base = "a".repeat(40);
  const cwd = "C:\\a worktree with spaces";
  const ref = "refs/heads/base with spaces; echo unsafe";
  const result = changedPathsFromGit({
    base: ref, cwd,
    resolve(value, options) { calls.push(["resolve", value, options]); return base; },
    readChanges(value, options) {
      calls.push(["diff", value, options]);
      return ["Tesbo-Backend-Nest/src/legacy/zyra-old file.ts", "Tesbo-Backend-Nest/src/legacy/zyra-new file.ts",
        "Tesbo-Backend-Nest/src/automation/deleted.ts", "Tesbo-Frontend/components/reports/OverviewTab.tsx",
        "Tesbo-Backend-Nest/src/automation/deleted.ts"];
    }
  });
  assert.deepEqual(calls, [["resolve", ref, { cwd }], ["diff", base, { cwd }]]);
  assert.equal(result.baseCommit, base);
  assert.equal(result.paths.length, 4);
  const selection = plan(result.paths);
  hasDomain(selection, "automation");
  hasDomain(selection, "zyra");
  assert.ok(selection.changedPaths.includes("Tesbo-Backend-Nest/src/legacy/zyra-old file.ts"));
  assert.ok(selection.changedPaths.includes("Tesbo-Backend-Nest/src/legacy/zyra-new file.ts"));
});

test("Git base missing/invalid refs and malformed shared-owner results fail", () => {
  for (const base of ["", "-x", "a\0b"]) assert.throws(() => changedPathsFromGit({ base, resolve() { assert.fail("Must not call Git"); } }), ImpactInputError);
  assert.throws(() => changedPathsFromGit({ base: "missing", resolve() { throw new ImpactInputError("missing ref"); } }), /missing ref/);
  assert.throws(() => changedPathsFromGit({ base: "HEAD", resolve() { return "not a commit"; } }), /commit ID/);
  assert.throws(() => changedPathsFromGit({ base: "HEAD", resolve() { return "a".repeat(40); }, readChanges() { return null; } }), /Git changed paths/);
});

test("CLI argument validation disallows implicit empty selection, ambiguous sources and unknown flags", () => {
  for (const args of [[], ["--base"], ["--path"], ["--base", "HEAD", "docs/a.md"], ["--wat"], ["--format", "xml", "docs/a.md"],
    ["--base", "HEAD", "--base", "HEAD"], ["--graph", "--base", "HEAD"]]) assert.throws(() => parseArgs(args), ImpactInputError);
  assert.deepEqual(parseArgs(["--path", "docs/a b.md"]).paths, ["docs/a b.md"]);
  assert.deepEqual(parseArgs(["--", "-literal.md"]).paths, ["-literal.md"]);
});

test("CLI dry run emits a truthful plan without collection or fixture imports", () => {
  const result = cli(["Tesbo-Backend-Nest/src/automation/automation.service.ts"]);
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.status, "selection-only");
  assert.equal(output.input.mode, "explicit-paths");
  assert.match(output.input.headCommit, /^[a-f0-9]{40,64}$/);
  assert.equal(output.verification.executedTestCount, null);
  hasSpec(output, "e2e/api/automation.spec.ts");
});

test("CLI unknown product path, missing input/ref/config/graph and malformed graph fail closed", t => {
  const directory = temporary(t);
  const malformed = path.join(directory, "malformed.json");
  fs.writeFileSync(malformed, "{");
  for (const args of [
    [], ["--base", "nonexistent-test-impact-ref-918341"],
    ["--config", path.join(directory, "missing.json"), "docs/a.md"],
    ["--config", malformed, "docs/a.md"],
    ["--graph", path.join(directory, "missing-graph.json"), "docs/a.md"],
    ["--graph", malformed, "docs/a.md"]
  ]) {
    const result = cli(args);
    assert.equal(result.status, 2, `${args}: ${result.stderr}`);
    assert.equal(JSON.parse(result.stdout).status, "invalid-input");
  }
  const unknown = cli(["Tesbo-Frontend/lib/new-unowned-module.ts"]);
  assert.equal(unknown.status, 1);
  assert.equal(JSON.parse(unknown.stdout).status, "review-required");
});

test("CLI reports no-changes for an actual verified clean --base HEAD comparison, while missing/invalid refs still fail", t => {
  const directory = temporary(t);
  const env = { ...process.env };
  for (const key of ["GIT_INDEX_FILE", "GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR"]) delete env[key];
  const repositoryGit = args => execFileSync("git", args, { cwd: root, encoding: "utf8", env });
  const head = repositoryGit(["rev-parse", "--verify", "HEAD^{commit}"]).trim();
  const common = repositoryGit(["rev-parse", "--git-common-dir"]).trim();
  env.GIT_ALTERNATE_OBJECT_DIRECTORIES = path.resolve(root, common, "objects");
  const fixtureGit = (args, input) => execFileSync("git", args, { cwd: directory, encoding: "utf8", env, input });
  // Reuse an existing commit as the fixture's HEAD: no new commit, checkout,
  // repository-wide file copy, or changes to the real worktree/index.
  fixtureGit(["init", "--quiet", "--initial-branch=impact-fixture"]);
  fixtureGit(["update-ref", "refs/heads/impact-fixture", head]);
  fixtureGit(["read-tree", "HEAD"]);
  fixtureGit(["update-index", "--skip-worktree", "-z", "--stdin"], fixtureGit(["ls-files", "-z"]));
  const workflow = ".github/workflows/core-quality.yml";
  const spec = "e2e/api/health.spec.ts";
  for (const filename of [workflow, spec]) {
    const target = path.join(directory, filename);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, fixtureGit(["cat-file", "blob", `${head}:${filename}`]));
  }
  fs.writeFileSync(path.join(directory, ".github/test-impact.json"), JSON.stringify({
    version: 1, policy: "Disposable static no-changes fixture; no product verification.",
    checks: { backend: { workflow, job: "backend-quality", description: "Existing check.", evidence: [] } },
    domains: { health: { description: "Existing health evidence.", specs: [spec], checks: ["backend"] } },
    rules: [{ id: "health", patterns: ["Tesbo-Backend-Nest/src/health/**"], domains: ["health"], reason: "Fixture owner." }],
    sharedRisks: [], nonProduct: []
  }));
  const run = args => spawnSync(process.execPath, [script, ...args], { cwd: directory, env, encoding: "utf8" });
  const result = run(["--base", "HEAD"]);
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.status, "no-changes");
  assert.deepEqual(output.changedPaths, []);
  assert.equal(output.input.mode, "git-base");
  assert.equal(output.input.baseCommit, head);
  assert.equal(output.input.headCommit, head);
  assert.equal(output.verification.status, "not-run");
  assert.equal(output.verification.executedTestCount, null);
  assert.equal(output.counts.selectedSpecFileCount, 0);
  const markdown = run(["--base", "HEAD", "--format", "markdown"]);
  assert.equal(markdown.status, 0, markdown.stderr);
  assert.match(markdown.stdout, /no-changes/);
  assert.match(markdown.stdout, /No product coverage is claimed/);
  for (const args of [[], ["--base", "nonexistent-fixture-base"], ["--verified-empty-git-diff"]]) {
    const failure = run(args);
    assert.equal(failure.status, 2);
    assert.equal(JSON.parse(failure.stdout).status, "invalid-input");
  }
});

test("CLI writes JSON/Markdown artifacts only when requested and refuses overwriting existing files", t => {
  const directory = temporary(t);
  for (const format of ["json", "markdown"]) {
    const output = path.join(directory, `plan with spaces.${format}`);
    const result = cli(["docs/a b.md", "--format", format, "--output", output]);
    assert.equal(result.status, 0, result.stderr);
    const contents = fs.readFileSync(output, "utf8");
    assert.ok(format === "json" ? JSON.parse(contents).status === "non-product" : contents.includes("**non-product**"));
    const repeated = cli(["docs/a b.md", "--format", format, "--output", output]);
    assert.equal(repeated.status, 2);
    assert.equal(fs.readFileSync(output, "utf8"), contents);
  }
});

test("CLI accepts the optional graph and never reads .auth/env as graph or config input", t => {
  const directory = temporary(t);
  const graph = path.join(directory, "graph with spaces.json");
  fs.writeFileSync(graph, JSON.stringify({ modules: [
    { source: "Tesbo-Frontend/lib/executionMetrics.ts", dependencies: [] },
    { source: "Tesbo-Frontend/components/reports/shared.tsx", dependencies: [
      { module: "@/lib/executionMetrics", resolved: "Tesbo-Frontend/lib/executionMetrics.ts" }
    ] }
  ] }));
  const result = cli(["Tesbo-Frontend/lib/executionMetrics.ts", "--graph", graph]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).affectedConsumers, ["Tesbo-Frontend/components/reports/shared.tsx"]);
  const auth = path.join(directory, ".auth");
  fs.mkdirSync(auth);
  fs.writeFileSync(path.join(auth, "context.json"), "DO NOT READ");
  fs.writeFileSync(path.join(directory, ".env"), "DO NOT READ");
  fs.writeFileSync(path.join(directory, ".ENV.local"), "DO NOT READ");
  const authLink = path.join(directory, "innocent-looking-graph");
  fs.symlinkSync(auth, authLink, process.platform === "win32" ? "junction" : "dir");
  for (const args of [
    ["--graph", path.join(auth, "context.json"), "docs/a.md"],
    ["--config", path.join(directory, ".env"), "docs/a.md"],
    ["--config", path.join(directory, ".ENV.local"), "docs/a.md"],
    ["--graph", path.join(authLink, "context.json"), "docs/a.md"]
  ]) {
    const blocked = cli(args);
    assert.equal(blocked.status, 2);
    assert.match(JSON.parse(blocked.stdout).diagnostics[0].message, /cannot read environment or runtime/);
  }
});

test("ESM import is side-effect-free outside any repository; imports are builtins and the canonical safe Git helper only", t => {
  const directory = temporary(t);
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", `await import(${JSON.stringify(pathToFileURL(script).href)})`],
    { cwd: directory, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
  const source = fs.readFileSync(script, "utf8");
  const imports = [...source.matchAll(/^import .+ from "([^"]+)";$/gm)].map(match => match[1]);
  assert.ok(imports.length >= 4 && imports.every(value => value.startsWith("node:") || value === "./git-quality.mjs"));
  assert.ok(imports.includes("./git-quality.mjs"), "Reuse the repository's Git owner.");
  assert.ok(!/\bimport\s*\(/.test(source), "No hidden dynamic product/fixture imports.");
});

test("runCli can be embedded without touching process exit state", () => {
  const lines = [];
  const output = { write(value) { lines.push(value); } };
  const oldExit = process.exitCode;
  const code = runCli(["--help"], { cwd: root, stdout: output, stderr: output });
  assert.equal(code, 0);
  assert.equal(process.exitCode, oldExit);
  assert.ok(lines.join("").includes("No tests run"));
});
