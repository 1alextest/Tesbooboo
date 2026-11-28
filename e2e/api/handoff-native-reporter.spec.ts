import { execFile, execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { env } from "../utils/env";
import { approveTestcase } from "../utils/testcase-approval";
import { createProject, screensApi, screensTenant } from "../utils/screens-tenant";

const runExecutable = promisify(execFile);
const stored = JSON.parse(fs.readFileSync(path.join(__dirname, "../.auth/context.json"), "utf8")) as { projectId: string };
const originRepo = "1alextest/Tesbooboo";
const referenceOracle = "The requirement exposes exactly one current approved link for the selected case and criteria.";

function runClosureProblems(detail: any): string[] {
  const problems: string[] = [];
  if (detail?.status !== "Completed") problems.push("run is not Completed");
  if (detail?.closeStatus !== "completed") problems.push("close status is not completed");
  if (!detail?.closedAt) problems.push("closedAt is absent");
  if (!detail?.endedAt) problems.push("endedAt is absent");
  return problems;
}

// Reconcile the complete observed attachment population, not just a matching
// packet. Playwright may add its own error-context.md on a failed attempt.
type ReportAttachment = { name: string; path?: string; contentType: string };
type NativeEvidence = { id: string; fileName: string; kind: string; contentType: string };
function reconcilePacketEvidence(
  attachments: ReportAttachment[],
  evidence: NativeEvidence[]
): { packet: NativeEvidence; observed: Array<{ file: ReportAttachment; native: NativeEvidence }> } {
  const files = attachments.filter(item => item.path);
  const packets = files.filter(item => item.name === "approved-handoff-evidence.json"
    && item.contentType === "application/json");
  expect(packets, "Exactly one packet identity attachment in the actual child report").toHaveLength(1);
  const expectedNames = files.map(item => path.basename(item.path!));
  expect(new Set(expectedNames).size, "Unique child attachment file identities").toBe(files.length);
  expect(evidence, "All observed child file attachments must be retained").toHaveLength(files.length);
  expect(new Set(evidence.map(item => item.id)).size, "Unique native evidence identities").toBe(evidence.length);
  const observed = files.map(file => {
    const matches = evidence.filter(item => item.fileName === path.basename(file.path!));
    expect(matches, "Exactly one native attachment for " + file.name).toHaveLength(1);
    expect(matches[0]).toMatchObject({ kind: "log", contentType: file.contentType });
    return { file, native: matches[0] };
  });
  const packet = observed.find(item => item.file === packets[0])!.native;
  return { packet, observed };
}

test("AUT-HANDOFF-01 requires authoritative Run closure, not only stored results", () => {
  const closed = { status: "Completed", closeStatus: "completed", closedAt: "2026-11-27T00:00:00Z", endedAt: "2026-11-27T00:00:00Z" };
  expect(runClosureProblems(closed)).toEqual([]);
  expect(runClosureProblems({ ...closed, status: "In Progress" })).toContain("run is not Completed");
  expect(runClosureProblems({ ...closed, closeStatus: "incomplete" })).toContain("close status is not completed");
  expect(runClosureProblems({ ...closed, closedAt: null })).toContain("closedAt is absent");
  expect(runClosureProblems({ ...closed, endedAt: undefined })).toContain("endedAt is absent");
});

test("AUT-HANDOFF-01 reconciles packet evidence and additional failure context without hiding duplicates", () => {
  const packet = { name: "approved-handoff-evidence.json", path: "output/packet.json", contentType: "application/json" };
  const context = { name: "error-context", path: "output/error-context.md", contentType: "text/markdown" };
  const nativePacket = { id: "packet", fileName: "packet.json", kind: "log", contentType: packet.contentType };
  const nativeContext = { id: "context", fileName: "error-context.md", kind: "log", contentType: context.contentType };
  expect(reconcilePacketEvidence([packet], [nativePacket]).packet).toEqual(nativePacket);
  const both = reconcilePacketEvidence([packet, context], [nativeContext, nativePacket]);
  expect(both.packet).toEqual(nativePacket);
  expect(both.observed.map(item => item.native)).toEqual([nativePacket, nativeContext]);
  expect(() => reconcilePacketEvidence([packet, context], [nativePacket])).toThrow();
  expect(() => reconcilePacketEvidence([packet, context], [nativeContext, nativeContext])).toThrow();
  expect(() => reconcilePacketEvidence([packet, packet], [nativePacket, nativeContext])).toThrow();
  expect(() => reconcilePacketEvidence([packet, context], [nativePacket, { ...nativeContext, fileName: "unexpected.md" }])).toThrow();
});

type CleanupStep = { label: string; action: () => Promise<string | undefined> };

async function runCleanupSteps(steps: CleanupStep[]): Promise<string[]> {
  const failures: string[] = [];
  for (const step of steps) {
    try {
      const failure = await step.action();
      if (failure) failures.push(step.label + ": " + failure);
    } catch {
      // Never copy a transport error, response body, or credential into CI output.
      failures.push(step.label + ": operation threw");
    }
  }
  return failures;
}

test("AUT-HANDOFF-01 cleanup reports non-success and still attempts remaining compensations", async () => {
  const called: string[] = [];
  const failures = await runCleanupSteps([
    { label: "credential", action: async () => { called.push("credential"); return "delete HTTP 403"; } },
    { label: "run", action: async () => { called.push("run"); throw new Error("synthetic transport failure"); } },
    { label: "case", action: async () => { called.push("case"); return "readback HTTP 200"; } },
    { label: "temp", action: async () => { called.push("temp"); return undefined; } },
  ]);
  expect(called).toEqual(["credential", "run", "case", "temp"]);
  expect(failures).toEqual(["credential: delete HTTP 403", "run: operation threw", "case: readback HTTP 200"]);
  expect(await runCleanupSteps([{ label: "ok", action: async () => undefined }])).toEqual([]);
});

test("AUT-HANDOFF-01 diagnostic distinguishes the actual uniqueness assertion from report metadata", async () => {
  const { handoffFailureMatches } = await import(path.join(__dirname, "../../scripts/qa-handoff-fixture.mjs"));
  const label = "exactly one current approved link for the selected case and criteria";
  const matches = (value: any) => handoffFailureMatches(value, label, ["Expected length: 1", "Received length: 2"]);
  const report = (message: string) => ({
    config: { metadata: { gitDiff: label } },
    stats: { expected: 0, unexpected: 1 },
    suites: [{ suites: [{ specs: [{ tests: [{ results: [{ status: "failed", errors: [{ message }] }] }] }] }] }],
  });
  expect(matches(report("Error: Coverage read HTTP status (body deliberately withheld)"))).toBe(false);
  expect(matches(report("Error: unrelated setup\n> expect(matching, '" + label + "').toHaveLength(1);\nExpected length: 1\nReceived length: 2"))).toBe(false);
  expect(matches(report("Error: " + label + "\nExpected length: 1\nReceived length: 3"))).toBe(false);
  expect(matches(report("Error: " + label + "\nExpected length: 1\nReceived length: 2"))).toBe(true);
});

type DisposableTargetProof = {
  api: string; database: string; backendDatabase: string; hosted: string;
  runId: string; attempt: string; backendRunId: string; backendAttempt: string;
  pid: string; listeners: string; backendCwd: string; expectedCwd: string; command: string[];
};

function disposableTargetMatches(p: DisposableTargetProof): boolean {
  try {
    const api = new URL(p.api);
    const db = new URL(p.database);
    const listeners = p.listeners.trim().split(/\r?\n/).filter(Boolean);
    const owners = listeners.flatMap(row => Array.from(row.matchAll(/\bpid=(\d+)\b/g), match => match[1]));
    return p.hosted === "true"
      && /^\d+$/.test(p.runId) && /^\d+$/.test(p.attempt)
      && p.backendRunId === p.runId && p.backendAttempt === p.attempt
      && api.origin === "http://127.0.0.1:7000" && api.pathname === "/" // DevSkim: ignore DS162092
      && !api.username && !api.password && !api.search && !api.hash
      && (db.protocol === "postgresql:" || db.protocol === "postgres:")
      && ["localhost", "127.0.0.1"].includes(db.hostname) && db.port === "5432" // DevSkim: ignore DS162092
      && db.pathname === "/tesbo_ci" && !db.search && !db.hash
      && p.backendDatabase === p.database
      && /^\d+$/.test(p.pid) && listeners.length > 0
      && listeners.every(row => /\bpid=\d+\b/.test(row))
      && owners.length > 0 && owners.every(owner => owner === p.pid)
      && p.backendCwd === p.expectedCwd
      && p.command.length === 2 && p.command[0].split("/").pop() === "node"
      && p.command[1] === "dist/main.js";
  } catch {
    return false;
  }
}

// Bind this mutation-capable pilot to the existing hosted disposable job's
// backend process, rather than an address that could be a local tunnel.
// This is a fixture admission check, not attestation against a compromised
// runner. Other local environments need their own reviewed admission proof.
// Do not log process environments or database connection strings.
function verifyDisposableTarget(): void {
  let verified = false;
  try {
    const pid = fs.readFileSync("/tmp/tesbo-backend.pid", "utf8").trim();
    if (!/^\d+$/.test(pid) || process.env.GITHUB_ACTIONS !== "true") throw new Error("No hosted fixture");
    const processRoot = "/proc/" + pid;
    const entries = fs.readFileSync(processRoot + "/environ", "utf8").split("\0");
    const readVariable = (name: string) => {
      const values = entries.filter(item => item.startsWith(name + "="));
      return values.length === 1 ? values[0].slice(name.length + 1) : "";
    };
    verified = disposableTargetMatches({
      api: env.apiBaseUrl, database: env.dbUrl, backendDatabase: readVariable("DATABASE_URL"),
      hosted: process.env.GITHUB_ACTIONS ?? "", runId: process.env.GITHUB_RUN_ID ?? "",
      attempt: process.env.GITHUB_RUN_ATTEMPT ?? "", backendRunId: readVariable("GITHUB_RUN_ID"),
      backendAttempt: readVariable("GITHUB_RUN_ATTEMPT"), pid,
      listeners: execFileSync("ss", ["-H", "-ltnp", "sport = :7000"], { encoding: "utf8", timeout: 5_000 }),
      backendCwd: fs.realpathSync(processRoot + "/cwd"),
      expectedCwd: fs.realpathSync(path.resolve(__dirname, "../../Tesbo-Backend-Nest")),
      command: fs.readFileSync(processRoot + "/cmdline", "utf8").split("\0").filter(Boolean),
    });
  } catch {
    // Missing or ambiguous process evidence is not permission to mutate.
  }
  expect(verified, "Native reporter fixture requires the current hosted disposable backend and database").toBe(true);
}

test("AUT-HANDOFF-01 rejects loopback aliases without current disposable process authority", () => {
  const proof: DisposableTargetProof = {
    api: "http://127.0.0.1:7000", database: "postgresql://localhost:5432/tesbo_ci", // DevSkim: ignore DS162092
    backendDatabase: "postgresql://localhost:5432/tesbo_ci", hosted: "true", // DevSkim: ignore DS162092
    runId: "123", attempt: "1", backendRunId: "123", backendAttempt: "1", pid: "41",
    listeners: 'LISTEN 0 511 *:7000 *:* users:(("node",pid=41,fd=12))',
    backendCwd: "/workspace/Tesbo-Backend-Nest", expectedCwd: "/workspace/Tesbo-Backend-Nest",
    command: ["node", "dist/main.js"],
  };
  expect(disposableTargetMatches(proof)).toBe(true);
  expect(disposableTargetMatches({ ...proof, listeners: 'LISTEN 0 511 127.0.0.1:7000 0.0.0.0:* users:(("ssh",pid=42,fd=12))' }), "loopback tunnel").toBe(false); // DevSkim: ignore DS162092
  expect(disposableTargetMatches({ ...proof, backendDatabase: "postgresql://remote.invalid:5432/tesbo_ci" }), "foreign database").toBe(false);
  expect(disposableTargetMatches({ ...proof, backendRunId: "122" }), "previous job").toBe(false);
  expect(disposableTargetMatches({ ...proof, listeners: proof.listeners + '\nLISTEN 0 511 *:7000 *:* users:(("node",pid=42,fd=13))' }), "ambiguous owners").toBe(false);
  expect(disposableTargetMatches({ ...proof, listeners: "LISTEN 0 511 *:7000 *:*" }), "no process ownership").toBe(false);
  expect(disposableTargetMatches({ ...proof, api: "http://127.0.0.1:7000/proxy" }), "unexpected base path").toBe(false); // DevSkim: ignore DS162092
  expect(disposableTargetMatches({ ...proof, hosted: "false" }), "not hosted").toBe(false);
  expect(disposableTargetMatches({ ...proof, backendCwd: "/other" }), "wrong cwd").toBe(false);
  expect(disposableTargetMatches({ ...proof, database: "postgresql://localhost:5432/tesbo_prod", backendDatabase: "postgresql://localhost:5432/tesbo_prod" }), "alternate database").toBe(false); // DevSkim: ignore DS162092
});

test("AUT-HANDOFF-01 refuses the shared journey before any API call without hosted admission", async () => {
  const previous = process.env.GITHUB_ACTIONS;
  const calls: string[] = [];
  const forbidden = new Proxy({} as APIRequestContext, {
    get: (_target, method) => async () => {
      calls.push(String(method));
      throw new Error("Unexpected fixture API action");
    },
  });
  try {
    process.env.GITHUB_ACTIONS = "false";
    const failure = await runHandoffJourney(forbidden, false).then(() => undefined, (error: unknown) => error);
    expect(calls, "Unadmitted synthetic execution must make zero API calls").toEqual([]);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain(
      "Native reporter fixture requires the current hosted disposable backend and database"
    );
  } finally {
    if (previous === undefined) delete process.env.GITHUB_ACTIONS;
    else process.env.GITHUB_ACTIONS = previous;
  }
});


// Reuse the actual governed publication and pinned Git/investigation bridge.
// All decisions here are made by a disposable test actor after hosted-target
// admission. No human review of customer or persistent TESBOPROJECT data is implied.
async function governedPacket(human: APIRequestContext, projectId: string, trackCase: (id: string) => void) {
  const base = "/api/projects/" + projectId;
  const targetPath = "tests/journey.spec.mjs";
  const title = "Disposable governed handoff " + randomUUID();
  const requirementOperationId = randomUUID();
  const testcaseOperationId = randomUUID();
  const criterionKeys = ["AC-1"];
  const createSkill = async (module: string, subtype: string, operation: string) => {
    const created = await human.post(base + "/skills", { data: {
      title: "Fixture method " + operation,
      module, subtype, skillKey: "SKL-" + randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase(),
      instructions: "Use observable outcomes, retain exact reviewed identities and preserve failed observations."
    } });
    expect(created.ok(), "Disposable Skill creation").toBe(true);
    const doc = await created.json();
    const submitted = await human.post(base + "/knowledge-base/documents/" + doc.id + "/submissions", { data: {
      expectedRevision: doc.editRevision, submissionKey: randomUUID()
    } });
    expect(submitted.ok(), "Disposable Skill submission").toBe(true);
    const version = await submitted.json();
    const approved = await human.patch(base + "/skills/" + doc.id + "/approve", { data: { versionId: version.id } });
    expect(approved.ok(), "Disposable exact Skill approval").toBe(true);
    const reviewed = await approved.json();
    return { skillDocumentId: doc.id, versionId: reviewed.approvedVersionId };
  };
  const assign = async (skill: { skillDocumentId: string; versionId: string }, module: string, subtype: string, operation: string) => {
    const assigned = await human.post(base + "/skill-assignments", { data: { ...skill, module, subtype, operation } });
    expect(assigned.ok(), "Disposable exact Skill assignment").toBe(true);
    expect((await assigned.json()).resolution?.status).toBe("resolved");
  };
  const reqSkill = await createSkill("requirements", "functional", "requirement_revision");
  await assign(reqSkill, "requirements", "functional", "requirement_revision");
  await assign(reqSkill, "requirements", "functional", "requirement_case_link");
  const caseSkill = await createSkill("test_cases", "manual", "testcase_create");
  await assign(caseSkill, "test_cases", "manual", "testcase_create");

  const stagedResponse = await human.post(base + "/requirements/proposals", { data: {
    requestKey: randomUUID(), title, operations: [
      { opType: "requirement_revision", operationId: requirementOperationId, title,
        description: "Disposable exact approved-link observation", criteria: [{ key: "AC-1", text: referenceOracle }] },
      { opType: "testcase_create", operationId: testcaseOperationId, draft: {
        title: title + " case", automationRepo: originRepo, automationPath: targetPath,
        automationFramework: "Playwright",
        steps: [{ stepNumber: 1, action: "Read the approved requirement coverage", expectedResult: referenceOracle }]
      } },
      { opType: "requirement_case_link", operationId: randomUUID(), requirementOperationId, testcaseOperationId, criterionKeys }
    ]
  } });
  expect(stagedResponse.status(), "Governed bundle staged").toBe(201);
  const task = await stagedResponse.json();
  expect(task.skillContext).toMatchObject({ status: "resolved" });
  expect(task.skillContext.assignments).toHaveLength(3);
  const appliedResponse = await human.post(base + "/requirements/proposals/" + task.id + "/apply", {
    data: { expectedProposalRevision: task.proposalRevision }
  });
  expect(appliedResponse.ok(), "Exact bundle applied by disposable reviewer").toBe(true);
  const applied = await appliedResponse.json();
  const requirementId = applied.receipt.requirement.documentId as string;
  const submittedVersionId = applied.receipt.requirement.versionId as string;
  const testcaseId = applied.receipt.testcase.id as string;
  trackCase(testcaseId);
  const approval = await human.post(base + "/requirements/" + requirementId + "/approve", { data: { versionId: submittedVersionId } });
  expect(approval.ok(), "Exact requirement submission approved").toBe(true);
  const requirementVersionId = (await approval.json()).approvedVersionId as string;
  const currentCase = await approveTestcase(human, projectId, testcaseId);
  const coveragePath = base + "/requirements/" + requirementId + "/coverage";
  const readCoverage = async () => {
    const response = await human.get(coveragePath);
    expect(response.status(), "Native requirement coverage").toBe(200);
    return response.json();
  };
  const before = await readCoverage();
  const currentLinks = before.cases.filter((item: any) => item.testcaseId === testcaseId
    && item.requirementVersionId === requirementVersionId && JSON.stringify(item.criterionKeys) === JSON.stringify(criterionKeys));
  expect(currentLinks).toHaveLength(1);
  const activated = await human.post(base + "/requirements/" + requirementId + "/links/" + currentLinks[0].linkId + "/reapply", { data: {
    expectedRequirementVersionId: requirementVersionId, expectedCaseRevision: currentCase.editRevision,
    expectedApprovalRevision: currentCase.approvalRevision
  } });
  expect(activated.ok(), "Exact case/requirement link activated").toBe(true);
  const linkId = (await activated.json()).link.id as string;
  expect((await readCoverage()).readings).toMatchObject({ authored: true, approved: true, executed: false, passing: false });

  const { createHandoffFixture } = await import(path.join(__dirname, "../../scripts/qa-handoff-fixture.mjs"));
  const { prepareHandoff, createHandoffRequest } = await import(path.join(__dirname, "../../scripts/qa-approved-handoff.mjs"));
  // The existing earlier smoke step owns this exact pinned checkout. Do not
  // silently substitute an unpinned checker or skip the governed test.
  const harnessRoot = process.env.QA_INVESTIGATION_HARNESS_ROOT
    || (process.env.RUNNER_TEMP && path.join(process.env.RUNNER_TEMP, "qa-investigation-harness"));
  expect(harnessRoot && fs.existsSync(harnessRoot), "Existing pinned investigation checkout is required").toBeTruthy();
  const fixture = await createHandoffFixture({
    repository: originRepo, targetPath, harnessRoot, plan: {
      key: "AC-1", title, oracle: referenceOracle,
      risk: "A second current approved link escapes the uniqueness assertion",
      action: "Read the approved coverage and inspect the selected logical group",
      observation: "Controlled disposable investigation input, not production behavior"
    }
  });
  try {
    let confirmations = 0;
    const packet = await prepareHandoff({ ...fixture.selected, projectId, taskId: task.id }, {
      request: createHandoffRequest(env.apiBaseUrl, human),
      checkTarget: fixture.checkTarget,
      confirm: async (preview: any, digest: string) => {
        expect(preview.native).toMatchObject({
          projectId, taskId: task.id, receiptId: applied.receipt.id, proposalRevision: task.proposalRevision,
          requirementId, requirementVersionId, linkId, testcaseId,
          testcaseRevision: currentCase.editRevision, testcaseApprovalRevision: currentCase.approvalRevision,
          criterionKeys, criteria: [{ key: "AC-1", text: referenceOracle }],
          testcase: { id: testcaseId, externalId: currentCase.externalId, automationPath: targetPath }
        });
        expect(preview.target).toEqual({ repository: originRepo, branch: "main",
          revision: fixture.selected.repoRevision, path: targetPath });
        expect(preview.investigation.risks).toHaveLength(1);
        expect(preview.investigation.risks[0].oracle).toBe(referenceOracle);
        expect(digest).toBe(createHash("sha256").update(JSON.stringify(preview)).digest("hex"));
        confirmations++;
        return true;
      }
    });
    expect(confirmations).toBe(1);
    return { packet, currentCase, requirementId, requirementVersionId, linkId, coveragePath, readCoverage, fixture };
  } catch (error) {
    await fixture.cleanup();
    throw error;
  }
}

/**
 * End-to-end reporter seam, not a claim of human approval of a live requirement:
 * the case is Draft then approved through the real native API by the disposable
 * test actor; the handoff's requirement/receipt/link are synthetic, identified
 * as such. A separate governed scenario must exercise a real approved packet.
 */
async function readRunInInterface(
  page: Page,
  projectId: string,
  currentCase: { id: string; externalId: string; title: string },
  detail: any,
  execution: { executionId: string; status: string },
  observed: ReturnType<typeof reconcilePacketEvidence>["observed"]
) {
  // Reuse the same native Runs produced by the actual reporter. The separate
  // execution UI suite owns generic ingest/viewer behavior, not this joined seam.
  await page.goto(new URL("/projects/" + projectId + "/cycles", env.webBaseUrl).href);
  await expect(page.getByRole("heading", { name: "Test Runs", exact: true })).toBeVisible();
  const read = page.waitForResponse(response => response.request().method() === "GET"
    && new URL(response.url()).pathname === "/api/cycles/" + detail.runId);
  await page.getByRole("link", { name: detail.name, exact: true }).click();
  const response = await read;
  expect(response.ok(), "Opening the Run must read its exact persisted identity").toBe(true);
  expect((await response.json()).id).toBe(detail.runId);
  await expect(page.getByRole("heading", { name: detail.name, exact: true })).toBeVisible();
  // Automation-origin runs are not reopened by the generic run writer.
  await expect(page.getByRole("button", { name: "Reopen", exact: true })).toHaveCount(0);
  await expect(page.getByTitle("Results in this run were reported by an automation SDK, not entered by hand")).toBeVisible();
  await expect(page.getByTitle(detail.commitSha, { exact: true })).toBeVisible();
  await expect(page.getByText(detail.branch, { exact: true })).toBeVisible();

  // Reload rather than trusting state left in the client after the first read.
  await page.reload();
  const row = page.getByRole("row").filter({ has: page.getByRole("cell", { name: currentCase.externalId, exact: true }) });
  await expect(row).toHaveCount(1);
  await expect(row.getByText(execution.status, { exact: true })).toBeVisible();
  await test.info().attach("native-run-summary-" + detail.runId, {
    body: await page.screenshot(), contentType: "image/png"
  });
  await row.getByRole("button", { name: currentCase.title, exact: true }).click();
  await expect(page.getByTestId("result-meta")).toContainText("Automated");
  if (execution.status === "Failed") {
    await expect(page.getByTestId("result-meta")).toContainText("exactly one current approved link for the selected case and criteria");
  } else {
    await expect(page.getByText("Failure reported by automation", { exact: true })).toHaveCount(0);
  }
  await expect(page.getByText("Evidence(" + observed.length + ")", { exact: true })).toBeVisible();
  const retained = [];
  for (const item of observed) {
    const href = "/api/cycles/" + detail.runId + "/executions/" + execution.executionId
      + "/attachments/" + item.native.id + "/download";
    const link = page.locator('a[href$="' + href + '"]');
    await expect(link).toHaveCount(1);
    await expect(link).toContainText(item.native.fileName);
    const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
    expect(await download.failure(), "The evidence link must deliver a file").toBeNull();
    const downloaded = await download.path();
    expect(downloaded).not.toBeNull();
    const bytes = await readFile(downloaded!);
    expect(bytes, "Browser-downloaded bytes for " + item.native.fileName).toEqual(await readFile(item.file.path!));
    retained.push({ id: item.native.id, fileName: item.native.fileName, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
  await test.info().attach("native-run-evidence-" + detail.runId, {
    body: await page.screenshot(), contentType: "image/png"
  });
  // CI retains this bounded readback after disposable record cleanup. It is
  // engineering evidence, never a persistent TESBOPROJECT execution receipt.
  await test.info().attach("native-run-readback-" + detail.runId + ".json", {
    body: Buffer.from(JSON.stringify({ projectId, testcaseId: currentCase.id, externalId: currentCase.externalId,
      runId: detail.runId, executionId: execution.executionId, status: execution.status, source: detail.source,
      closeStatus: detail.closeStatus, closedAt: detail.closedAt, commitSha: detail.commitSha,
      branch: detail.branch, evidence: retained })),
    contentType: "application/json"
  });
}

async function runHandoffJourney(human: APIRequestContext, governed: boolean, page?: Page) {
  // Both entrypoints share admission before case approval or credential issuance.
  verifyDisposableTarget();
  test.setTimeout(240_000); // DevSkim: ignore DS172411
  let projectId = stored.projectId;
  let ownedProjectId: string | undefined;
  let bugId: string | undefined;
  let manualRetestId: string | undefined;
  let nativePacket: Awaited<ReturnType<typeof governedPacket>> | undefined;
  const runIds: string[] = [];
  let testcaseId: string | undefined;
  let credentialId: string | undefined;
  let temp: string | undefined;
  let primaryFailed = false;

  const requirementId = randomUUID();
  const requirementVersionId = randomUUID();
  const linkId = randomUUID();
  const targetRevision = "c".repeat(40);
  let currentCase: any;
  const fixtureCredential = randomUUID(); // DevSkim: ignore DS173237
  const server = createServer((req, res) => {
    if (req.headers.authorization !== "Bearer " + fixtureCredential) {
      res.writeHead(401).end();
      return;
    }
    if (nativePacket) {
      // Read the real application for every child attempt. Only the controlled
      // faulty response is altered, in this isolated transport; no bad link
      // is written to the governed project.
      const selection = nativePacket;
      void selection.readCoverage().then(body => {
        const selected = body.cases.filter((row: any) => row.linkId === selection.linkId);
        if (selected.length !== 1) {
          res.writeHead(409).end();
          return;
        }
        const cases = req.url === "/fault"
          ? [...body.cases, { ...selected[0], linkId: randomUUID() }]
          : body.cases;
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ...body, cases }));
      }).catch(() => res.writeHead(503).end());
      return;
    }
    const row = {
      linkId, testcaseId, requirementVersionId, criterionKeys: ["AC-1"], approved: true,
      testcaseRevision: currentCase?.editRevision, testcaseApprovalRevision: currentCase?.approvalRevision,
    };
    const cases = req.url === "/fault" ? [row, { ...row, linkId: randomUUID() }] : [row];
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ requirementId, approvedVersionId: requirementVersionId, cases }));
  });

  try {
    if (governed) {
      // Use a fresh project in the existing disposable screens tenant; avoid
      // changing the smoke project's effective Skill assignments.
      const project = await createProject(human, { name: "QA journey " + Date.now() });
      projectId = project.id;
      ownedProjectId = project.id;
      nativePacket = await governedPacket(human, projectId, id => { testcaseId = id; });
      currentCase = nativePacket.currentCase;
    } else {
      const created = await human.post("/api/projects/" + projectId + "/testcases", {
        data: {
          title: "Disposable generated reporter " + Date.now(),
          automationRepo: originRepo,
          automationPath: "tests/journey.spec.mjs",
          automationFramework: "Playwright",
          status: "Draft",
        },
      });
      expect(created.status(), "Disposable draft must be created").toBe(201);
      const draft = await created.json();
      testcaseId = draft.id;
      expect(testcaseId).toBeTruthy();
      // Register the created ID before approval so a failed review is still cleaned up.
      currentCase = await approveTestcase(human, projectId, testcaseId!);
    }
    expect(currentCase.status).toBe("Approved");
    expect(currentCase.externalId).toBeTruthy();
    expect(currentCase.editRevision).toMatch(/^[a-f0-9]{64}$/);
    expect(currentCase.approvalRevision).toMatch(/^[a-f0-9]{64}$/);

    const issued = await human.post("/api/projects/" + projectId + "/apikeys", {
      data: { name: "Disposable reporter " + Date.now(), scopes: ["read", "write"] },
    });
    expect(issued.ok(), "The native disposable token must be issued").toBe(true);
    const credential = await issued.json();
    credentialId = credential.id;
    expect(credential.token).toBeTruthy();

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve); // DevSkim: ignore DS162092
    });
    const coverageOrigin = "http://127.0.0.1:" + (server.address() as AddressInfo).port; // DevSkim: ignore DS162092

    const packetBody = {
      schemaVersion: 1, purpose: "prepare_automation_change",
      native: {
        projectId, taskId: randomUUID(), receiptId: randomUUID(),
        proposalRevision: "a".repeat(64), selectedIndex: 0,
        requirementId, requirementVersionId, linkId,
        testcaseId, testcaseRevision: currentCase.editRevision,
        testcaseApprovalRevision: currentCase.approvalRevision,
        criterionKeys: ["AC-1"], criteria: [{ key: "AC-1", text: "Exactly one current approved case link" }],
        testcase: {
          id: testcaseId, externalId: currentCase.externalId, title: currentCase.title,
          automationRepo: originRepo, automationPath: "tests/journey.spec.mjs",
          automationFramework: "Playwright", automationTestName: "Generated native reporter verification",
        },
      },
      target: { repository: originRepo, branch: "development", revision: targetRevision, path: "tests/journey.spec.mjs" },
      investigation: {
        id: "CONTROLLED-AUT-HANDOFF", upstreamCase: "DISPOSABLE-01",
        targetPath: "tests/journey.spec.mjs", targetBlob: "d".repeat(40),
        repoRevision: targetRevision, harnessRevision: "a468921c2bead820520a97df897168487b2b4985", // DevSkim: ignore DS173237
        risks: [{ id: "R1", oracle: referenceOracle }],
      },
    };
    const packet = nativePacket?.packet ?? { ...packetBody,
      selectionDigest: createHash("sha256").update(JSON.stringify(packetBody)).digest("hex") };
    const selectionDigest = packet.selectionDigest;

    // The packet is passed through the actual reference generator, not a
    // handwritten imitation of its test or its Tesbo reporter marker.
    temp = await mkdtemp(path.join(__dirname, "../.native-handoff-"));
    const packetPath = path.join(temp, "packet.json");
    const evidencePath = path.join(temp, "approved-handoff-evidence.json");
    await writeFile(packetPath, JSON.stringify(packet));
    await writeFile(evidencePath, JSON.stringify({ selectionDigest, target: packet.target }));
    const generatorUrl = pathToFileURL(path.resolve(__dirname, "../../scripts/qa-handoff-generated-change.mjs")).href;
    const generatorScript = [
      "import fs from 'node:fs';",
      "import path from 'node:path';",
      "import { writeGeneratedChange } from " + JSON.stringify(generatorUrl) + ";",
      "const packet = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));",
      "const item = writeGeneratedChange(packet, process.argv[2]);",
      "fs.mkdirSync(path.dirname(item.path), {recursive: true});",
      "fs.writeFileSync(item.path, item.content);",
    ].join("\n");
    await runExecutable(process.execPath, ["--input-type=module", "-e", generatorScript, packetPath, temp], {
      cwd: temp, timeout: 30_000,
    });
    const generatedPath = path.join(temp, packet.target.path);
    const generatedDigest = createHash("sha256").update(await readFile(generatedPath)).digest("hex");

    const reporterPath = path.resolve(__dirname, "../../sdk/playwright-reporter/dist/index.js");
    const cliPath = path.resolve(__dirname, "../node_modules/@playwright/test/cli.js");
    const config = [
      "import { defineConfig } from '@playwright/test';",
      "export default defineConfig({",
      " testDir: '.', testMatch: '**/*.spec.mjs', workers: 1, retries: 0, timeout: 30000,",
      " reporter: [['list'], ['json', { outputFile: 'report.json' }],",
      "  [" + JSON.stringify(reporterPath) + ", { strict: true, requireConfig: true,",
      "   attachEvidence: 'always', runName: process.env.TESBO_JOURNEY_RUN_NAME,",
      "   buildVersion: process.env.GIT_COMMIT }]],",
      "});",
    ].join("\n");
    await writeFile(path.join(temp, "playwright.config.mjs"), config);
    await mkdir(path.join(temp, "tests"), { recursive: true });

    async function execute(pathname: "/good" | "/fault", expectedPass: boolean) {
      const runName = "Disposable generated " + (expectedPass ? "pass " : "fault ") + randomUUID();
      const commitSha = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: path.join(__dirname, "../.."), encoding: "utf8"
      }).trim();
      const branch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME;
      expect(branch, "The hosted fixture must identify its actual source branch").toBeTruthy();
      const childEnv = {
        ...process.env,
        GITHUB_ACTIONS: "", GITHUB_RUN_ID: "", // two distinct native Runs, not shards of the CI run
        GIT_COMMIT: commitSha, GIT_BRANCH: branch,
        TESBO_JOURNEY_RUN_NAME: runName,
        TESBO_BASE_URL: env.apiBaseUrl, TESBO_PROJECT_ID: projectId, TESBO_API_TOKEN: credential.token,
        TESBO_JOURNEY_API_ORIGIN: coverageOrigin, TESBO_JOURNEY_COVERAGE_URL: coverageOrigin + pathname,
        TESBO_JOURNEY_TOKEN: fixtureCredential, TESBO_JOURNEY_EVIDENCE_PATH: evidencePath,
        NO_PROXY: "127.0.0.1,localhost", no_proxy: "127.0.0.1,localhost", // DevSkim: ignore DS162092
      };
      // Re-execute the same emitted spec; a previous report or modified oracle
      // cannot count as a fresh retest of this selection.
      expect(createHash("sha256").update(await readFile(generatedPath)).digest("hex")).toBe(generatedDigest);
      await rm(path.join(temp!, "report.json"), { force: true });
      let succeeded = false;
      let stdout = "";
      try {
        const output = await runExecutable(process.execPath, [
          cliPath, "test", "tests/journey.spec.mjs", "--config=playwright.config.mjs",
        ], { cwd: temp!, env: childEnv, timeout: 90_000 });
        stdout = output.stdout;
        succeeded = true;
      } catch (error) {
        stdout = String((error as { stdout?: string }).stdout ?? "");
      }
      const match = /\[tesbo\] reporting 1 linked test\(s\) to run ([0-9a-f-]{36})/i.exec(stdout);
      if (match) runIds.push(match[1]);
      // Record observed native identity even if the child verdict is wrong.
      expect(succeeded, "The generated assertion should distinguish the controlled " + pathname).toBe(expectedPass);
      expect(match, "The existing Tesbo reporter must create a real native Run").not.toBeNull();
      const runId = match![1];

      const nativeRead = await human.get("/api/projects/" + projectId + "/automation/runs/" + runId);
      expect(nativeRead.ok(), "The reporter-created Run must be readable through the existing API").toBe(true);
      const detail = await nativeRead.json();
      expect(detail).toMatchObject({ name: runName, commitSha, branch, buildVersion: commitSha });
      expect(runClosureProblems(detail), "The reporter must leave a Completed, closed Run with closure timestamps").toEqual([]);
      expect(detail.summary.total).toBe(1);
      expect(detail.summary[expectedPass ? "passed" : "failed"]).toBe(1);
      expect(detail.results).toHaveLength(1);
      expect(detail.source).toBe("automation");
      const row = detail.results.find((item: any) => item.caseId === currentCase.externalId);
      expect(row, "Exactly the native approved case must receive the execution").toBeTruthy();
      expect(row.status).toBe(expectedPass ? "Passed" : "Failed");
      expect(row.reportedBy).toBe("automation");
      const output = JSON.parse(await readFile(path.join(temp!, "report.json"), "utf8"));
      const { handoffReportResult, handoffFailureMatches } = await import(path.join(__dirname, "../../scripts/qa-handoff-fixture.mjs"));
      const result = handoffReportResult(output, expectedPass ? "passed" : "failed");
      expect(result, "The shared report owner must admit exactly the expected actual result").not.toBeNull();
      if (!expectedPass) {
        expect(handoffFailureMatches(output, "exactly one current approved link for the selected case and criteria",
          ["Expected length: 1", "Received length: 2"]),
        "The sole actual failed result must identify the reviewed uniqueness assertion and the seeded two-link fault").toBe(true);
      }
      const reconciled = reconcilePacketEvidence(result.attachments ?? [], row.evidence);

      const regularRead = await human.get("/api/cycles/" + runId + "/executions");
      expect(regularRead.ok()).toBe(true);
      const executions = await regularRead.json();
      expect(executions).toHaveLength(1);
      expect(executions[0]).toMatchObject({ externalId: currentCase.externalId, reportedBy: "automation" });
      expect(executions[0].evidenceCount).toBe(row.evidence.length);

      // Compare every observed child file, including Playwright's failure context,
      // with the bytes stored for that exact native attachment. Never compare a
      // context file to the packet identity bytes.
      for (const item of reconciled.observed) {
        const fileRead = await human.get("/api/cycles/" + runId + "/executions/" + row.executionId
          + "/attachments/" + item.native.id + "/download");
        expect(fileRead.ok(), "Native evidence must be retrievable for " + item.file.name).toBe(true);
        expect(Buffer.from(await fileRead.body()), "Stored bytes for " + item.file.name)
          .toEqual(await readFile(item.file.path!));
      }
      if (page) await readRunInInterface(page, projectId, currentCase, detail, row, reconciled.observed);
      expect(reconciled.packet.id).toBeTruthy();
      return { runId, executionId: row.executionId as string, evidenceId: reconciled.packet.id, detail };
    }

    const correctRun = await execute("/good", true);
    const defectRun = await execute("/fault", false);
    expect(defectRun.runId).not.toBe(correctRun.runId);
    if (nativePacket) {
      const project = "/api/projects/" + projectId;
      const bug = await human.post(project + "/bugs", { data: {
        title: "Controlled duplicate-link failure " + randomUUID(),
        links: [{ testcaseId, cycleId: defectRun.runId, executionId: defectRun.executionId }]
      } });
      expect(bug.status(), "Link actual failed child execution to Bug").toBe(201);
      bugId = (await bug.json()).id as string;
      const readFailure = async () => {
        const response = await human.get(project + "/automation/runs/" + defectRun.runId);
        expect(response.status()).toBe(200);
        return response.json();
      };
      const original = await readFailure();
      expect(original.results).toEqual(defectRun.detail.results);
      const preview = await human.get("/api/cycles/" + defectRun.runId + "/retests/preview", {
        params: { executionIds: defectRun.executionId }
      });
      expect(preview.status()).toBe(200);
      const reviewed = await preview.json();
      expect(reviewed.occurrences).toHaveLength(1);
      const source = reviewed.occurrences[0];
      expect(source).toMatchObject({
        sourceExecutionId: defectRun.executionId, testcaseId, eligible: true, definitionChanged: false,
        sourceResult: { status: "Failed", reported_by: "automation" },
        sourceApprovalRevision: currentCase.approvalRevision
      });
      expect(source.sourceEvidence).toEqual(expect.arrayContaining([expect.objectContaining({ id: defectRun.evidenceId })]));
      expect(source.sourceBugLinks).toEqual([expect.objectContaining({ bugId })]);
      // Reuse the approved native failure and its pinned investigation checkout.
      // Preparation is a read-only decision aid, not execution authority.
      const { prepareNativeRetestAutomation, createHandoffRequest } = await import(path.join(__dirname, "../../scripts/qa-approved-handoff.mjs"));
      const { fixture } = nativePacket;
      const retestUrl = "/api/cycles/" + defectRun.runId + "/retests";
      const readRetests = async () => {
        const response = await human.get(retestUrl);
        expect(response.status()).toBe(200);
        return response.json();
      };
      const beforePreparation = await readRetests();
      const basis = { ...fixture.selected, projectId, sourceCycleId: defectRun.runId,
        sourceExecutionId: defectRun.executionId };
      let confirmations = 0;
      const prepared = await prepareNativeRetestAutomation(basis, {
        request: createHandoffRequest(env.apiBaseUrl, human, "retest"),
        checkTarget: fixture.checkTarget,
        confirm: async (packet: any, digest: string, comparison: any) => {
          confirmations++;
          expect(packet).toMatchObject({
            purpose: "prepare_native_retest_automation", executionAuthorized: false,
            native: { projectId, sourceCycleId: defectRun.runId, sourceExecutionId: defectRun.executionId,
              sourceCycleItemId: source.sourceCycleItemId, sourcePreviewDigest: reviewed.previewDigest,
              targetApprovalRevision: currentCase.approvalRevision,
              testcase: { id: testcaseId, externalId: currentCase.externalId,
                automationRepo: originRepo, automationPath: nativePacket!.packet.target.path }
            },
            target: nativePacket!.packet.target
          });
          expect(packet.native.sourceEvidenceIds).toContain(defectRun.evidenceId);
          expect(packet.native.sourceBugLinks).toEqual([expect.objectContaining({ bugId, executionId: defectRun.executionId })]);
          expect(comparison.sourceDefinition).toEqual(source.sourceDefinition);
          expect(comparison.currentReviewedDefinition).toEqual(source.currentCase.reviewedContent);
          expect(digest).toBe(createHash("sha256").update(JSON.stringify(packet)).digest("hex"));
          return true;
        }
      });
      expect(confirmations).toBe(1);
      expect(prepared.executionAuthorized).toBe(false);
      expect(prepared.selectionDigest).toMatch(/^[a-f0-9]{64}$/);
      expect(await readRetests()).toEqual(beforePreparation);
      expect((await readFailure()).results).toEqual(original.results);

      const manualIntent = {
        requestKey: randomUUID(), executionIds: [defectRun.executionId], expectedPreviewDigest: reviewed.previewDigest,
        name: "Reviewed manual retest " + randomUUID(), environment: "controlled-fixture"
      };
      const refused = await human.post(retestUrl, {
        data: { ...manualIntent, executionMode: "automation" }, failOnStatusCode: false
      });
      expect(refused.status()).toBe(409);
      expect(await refused.json()).toMatchObject({ code: "RETEST_AUTOMATION_UNAVAILABLE" });
      const unknownBinding = await human.post(retestUrl, {
        data: { ...manualIntent, automationBinding: { selectionDigest: prepared.selectionDigest } }, failOnStatusCode: false
      });
      expect(unknownBinding.status()).toBe(400);
      expect(await readRetests()).toEqual(beforePreparation);
      const outcome = await human.get(retestUrl + "/requests/" + manualIntent.requestKey, { failOnStatusCode: false });
      expect(outcome.status()).toBe(404);
      const retest = await human.post(retestUrl, { data: { ...manualIntent, executionMode: "manual" } });
      expect(retest.status()).toBe(201);
      const receipt = await retest.json();
      manualRetestId = receipt.cycleId as string;
      // Explicit manual intent has the same v1 identity as omitting mode.
      const replay = await human.post(retestUrl, { data: manualIntent });
      expect(replay.ok()).toBe(true);
      expect(await replay.json()).toMatchObject({ cycleId: manualRetestId, requestDigest: receipt.requestDigest,
        manifestDigest: receipt.manifestDigest, replayed: true });
      expect(receipt.manifest.occurrences).toHaveLength(1);
      expect(receipt.manifest.occurrences[0]).toMatchObject(source);
      const readManual = async () => {
        const response = await human.get("/api/cycles/" + manualRetestId + "/executions");
        expect(response.status()).toBe(200);
        return response.json();
      };
      const pending = await readManual();
      expect(pending).toHaveLength(1);
      expect(pending[0]).toMatchObject({
        id: receipt.manifest.occurrences[0].executionId, status: "Untested", executedAt: null, evidenceCount: 0
      });

      // Remove only the injected transport fault; rerun the actual generated
      // test and reporter. This is a new automation Run, NOT execution of the
      // separately reviewed native manual retest.
      const corrected = await execute("/good", true);
      expect(new Set([correctRun.runId, defectRun.runId, corrected.runId, manualRetestId]).size).toBe(4);
      expect(new Set([correctRun.executionId, defectRun.executionId, corrected.executionId, pending[0].id]).size).toBe(4);
      const linked = await human.post("/api/bugs/" + bugId + "/links", { data: {
        testcaseId, cycleId: corrected.runId, executionId: corrected.executionId
      } });
      expect(linked.ok()).toBe(true);
      const bugRead = await human.get("/api/bugs/" + bugId);
      expect(bugRead.status()).toBe(200);
      const links = (await bugRead.json()).links;
      expect(links).toHaveLength(2);
      expect(links).toEqual(expect.arrayContaining([
        expect.objectContaining({ cycleId: defectRun.runId, executionId: defectRun.executionId, testcaseId }),
        expect.objectContaining({ cycleId: corrected.runId, executionId: corrected.executionId, testcaseId })
      ]));
      expect((await readFailure()).results).toEqual(original.results);
      const correctedRead = await human.get(project + "/automation/runs/" + corrected.runId);
      expect(correctedRead.status()).toBe(200);
      expect((await correctedRead.json()).results).toEqual(corrected.detail.results);
      expect(await readManual()).toEqual(pending);
      const retained = await human.get("/api/cycles/" + manualRetestId);
      expect(retained.status()).toBe(200);
      expect(await retained.json()).toMatchObject({ source: "manual", retestSourceCycleId: defectRun.runId, retestManifest: receipt.manifest });
      if (page) {
        await page.goto(new URL("/projects/" + projectId + "/cycles/" + manualRetestId, env.webBaseUrl).href);
        const row = page.getByRole("row").filter({ has: page.getByRole("cell", { name: currentCase.externalId, exact: true }) });
        await expect(row).toHaveCount(1);
        await expect(row.getByText("Untested", { exact: true })).toBeVisible();
        await expect(page.getByTestId("run-retest-origin")).toBeVisible();
        await expect(page.getByTitle("Results in this run were reported by an automation SDK, not entered by hand")).toHaveCount(0);
        const sourceRead = page.waitForResponse(response => response.request().method() === "GET"
          && new URL(response.url()).pathname === "/api/cycles/" + defectRun.runId);
        await page.getByTestId("run-retest-origin").getByRole("link", { name: defectRun.detail.name, exact: true }).click();
        const sourceResponse = await sourceRead;
        expect(sourceResponse.ok()).toBe(true);
        expect((await sourceResponse.json()).id).toBe(defectRun.runId);
        await expect(page.getByRole("heading", { name: defectRun.detail.name, exact: true })).toBeVisible();
        await expect(page.getByRole("row").filter({ has: page.getByRole("cell", { name: currentCase.externalId, exact: true }) })
          .getByText("Failed", { exact: true })).toBeVisible();
      }
      const originalFile = await human.get("/api/cycles/" + defectRun.runId + "/executions/" + defectRun.executionId
        + "/attachments/" + defectRun.evidenceId + "/download");
      expect(originalFile.status()).toBe(200);
      expect(Buffer.from(await originalFile.body())).toEqual(await readFile(evidencePath));
      const finalCoverage = await nativePacket.readCoverage();
      expect(finalCoverage.readings).toMatchObject({ approved: true, executed: true, passing: true, mixed: true });
      const currentLink = finalCoverage.cases.filter((row: any) => row.linkId === nativePacket!.linkId);
      expect(currentLink).toHaveLength(1);
      expect(currentLink[0].latestAttempt).toMatchObject({
        status: "Passed", cycleId: corrected.runId, executionId: corrected.executionId
      });
      const unchangedCase = await human.get(project + "/testcases/" + testcaseId);
      expect(unchangedCase.status()).toBe(200);
      expect(await unchangedCase.json()).toMatchObject({
        id: testcaseId, approvalCurrent: true, approvalRevision: currentCase.approvalRevision,
        editRevision: currentCase.editRevision
      });
    }
  } catch (error) {
    primaryFailed = true;
    throw error;
  } finally {
    const steps: CleanupStep[] = [];
    const project = "/api/projects/" + projectId;
    // Revoke first, then attempt every other cleanup even when one fails.
    if (credentialId) {
      const id = credentialId;
      steps.push({ label: "credential " + id, action: async () => {
        const removed = await human.delete(project + "/apikeys/" + id, { failOnStatusCode: false });
        if (!removed.ok()) return "delete HTTP " + removed.status();
        const listed = await human.get(project + "/apikeys", { failOnStatusCode: false });
        if (!listed.ok()) return "list readback HTTP " + listed.status();
        const rows = await listed.json();
        if (!Array.isArray(rows) || !rows.every(item => typeof item?.id === "string")) return "invalid credential list readback";
        if (rows.some(item => item.id === id)) return "credential still listed after deletion";
        return undefined;
      } });
    }
    if (bugId) {
      const endpoint = "/api/bugs/" + bugId;
      steps.push({ label: "fixture Bug " + bugId, action: async () => {
        const removed = await human.delete(endpoint, { failOnStatusCode: false });
        if (!removed.ok()) return "delete HTTP " + removed.status();
        const readback = await human.get(endpoint, { failOnStatusCode: false });
        return readback.status() === 404 ? undefined : "readback HTTP " + readback.status();
      } });
    }
    if (manualRetestId) {
      const endpoint = "/api/cycles/" + manualRetestId;
      steps.push({ label: "fixture manual retest " + manualRetestId, action: async () => {
        const removed = await human.delete(endpoint, { failOnStatusCode: false });
        if (!removed.ok()) return "delete HTTP " + removed.status();
        const readback = await human.get(endpoint, { failOnStatusCode: false });
        return readback.status() === 404 ? undefined : "readback HTTP " + readback.status();
      } });
    }
    for (const runId of new Set(runIds)) {
      steps.push({ label: "run " + runId, action: async () => {
        const removed = await human.delete("/api/cycles/" + runId, { failOnStatusCode: false });
        if (!removed.ok()) return "delete HTTP " + removed.status();
        const readback = await human.get(project + "/automation/runs/" + runId, { failOnStatusCode: false });
        return readback.status() === 404 ? undefined : "readback HTTP " + readback.status();
      } });
    }
    if (testcaseId && !ownedProjectId) {
      const endpoint = project + "/testcases/" + testcaseId;
      steps.push({ label: "case " + testcaseId, action: async () => {
        const removed = await human.delete(endpoint, { failOnStatusCode: false });
        if (!removed.ok()) return "delete HTTP " + removed.status();
        const readback = await human.get(endpoint, { failOnStatusCode: false });
        return readback.status() === 404 ? undefined : "readback HTTP " + readback.status();
      } });
    }
    if (ownedProjectId) {
      const endpoint = "/api/projects/" + ownedProjectId;
      // This project was created only after disposable process admission, and
      // owns all of the governed fixture's Skills, proposal and requirement.
      steps.push({ label: "governed fixture project " + ownedProjectId, action: async () => {
        const removed = await human.delete(endpoint, { failOnStatusCode: false });
        if (!removed.ok()) return "delete HTTP " + removed.status();
        const readback = await human.get(endpoint, { failOnStatusCode: false });
        return readback.status() === 404 ? undefined : "readback HTTP " + readback.status();
      } });
    }
    if (nativePacket) {
      const fixture = nativePacket.fixture;
      steps.push({ label: "pinned Git investigation fixture", action: async () => {
        await fixture.cleanup();
        return fs.existsSync(fixture.repo) ? "fixture checkout still exists" : undefined;
      } });
    }
    steps.push({ label: "loopback server", action: async () => {
      if (server.listening) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      return server.listening ? "still listening" : undefined;
    } });
    if (temp) {
      const directory = temp;
      steps.push({ label: "generated fixture directory", action: async () => {
        await rm(directory, { recursive: true, force: true });
        return fs.existsSync(directory) ? "directory still exists" : undefined;
      } });
    }
    const failures = await runCleanupSteps(steps);
    if (failures.length) {
      const description = failures.join("; ");
      // Preserve the original assertion while recording secondary cleanup failure.
      test.info().annotations.push({ type: "fixture-cleanup-failure", description });
      console.error("Native reporter fixture cleanup incomplete: " + description);
      if (!primaryFailed) throw new Error("Native reporter fixture cleanup incomplete: " + description);
    }
  }
}

test("AUT-HANDOFF-01 generated Playwright assertion reaches native Run, execution and evidence on pass and fault", async ({ request: human }) => {
  await runHandoffJourney(human, false);
});

test("AUT-HANDOFF-01 governed packet reaches actual generated pass, Bug-linked fault and corrected automation attempt readable in Test Runs without inventing manual retest execution", async ({ browser }) => {
  test.setTimeout(240_000); // DevSkim: ignore DS172411
  verifyDisposableTarget();
  expect(new URL(env.webBaseUrl).origin, "Browser readback is confined to the existing hosted disposable frontend").toBe("http://127.0.0.1:3000"); // DevSkim: ignore DS137138,DS162092
  const tenant = screensTenant();
  expect(tenant, "Reuse the governed fixture's screens identity for browser readback").not.toBeNull();
  const human = await screensApi();
  let context: Awaited<ReturnType<typeof browser.newContext>> | undefined;
  try {
    context = await browser.newContext({ storageState: tenant!.storageStatePath, acceptDownloads: true });
    await runHandoffJourney(human, true, await context.newPage());
  } finally {
    try { await context?.close(); } finally { await human.dispose(); }
  }
});
