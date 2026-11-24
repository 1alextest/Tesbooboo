import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { expect, request as newRequest, test, type APIRequestContext, type APIResponse } from "@playwright/test";
import { env } from "../utils/env";
import { issueMcpTestToken } from "../utils/mcp-access";
import { stageAndApplyMcpTestcases } from "../utils/mcp-proposals";
import { exec, literal, scalar } from "../utils/psql";

const ctx = JSON.parse(fs.readFileSync(path.join(__dirname, "../.auth/context.json"), "utf-8"));
const base = `/api/projects/${ctx.projectId}`;

function bundleOperations(overrides: { title?: string; criterionKeys?: string[] } = {}): {
  criteria: Array<{ key: string; text: string }>;
  operations: Array<Record<string, any>>;
} {
  const requirementOperationId = randomUUID();
  const testcaseOperationId = randomUUID();
  const criteria = [
    { key: "AC-1", text: "The first obligation is observable" },
    { key: "AC-2", text: "The second obligation is observable" },
  ];
  return {
    criteria,
    operations: [
      {
        opType: "requirement_revision", operationId: requirementOperationId,
        title: overrides.title || `E2E native requirement ${Date.now()}`,
        description: "Staged by the Work Package A acceptance fixture.", criteria,
      },
      {
        opType: "testcase_create", operationId: testcaseOperationId,
        draft: { title: `E2E bundle case ${Date.now()}`, description: "Candidate case for the staged requirement." },
      },
      {
        opType: "requirement_case_link", operationId: randomUUID(),
        requirementOperationId, testcaseOperationId,
        criterionKeys: overrides.criterionKeys || ["AC-1"],
      },
    ],
  };
}

async function createApprovedSkill(request: APIRequestContext, skillDocs: string[], module: string, subtype: string, operation: string) {
  const created = await request.post(`${base}/skills`, { data: {
    title: `E2E governed skill ${operation} ${Date.now()}`, module, subtype,
    skillKey: `SKL-${randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`,
    instructions: "Require observable outcomes, exact reviewed sources and explicit uncertainty."
  } });
  expect(created.ok(), await created.text()).toBe(true);
  const doc = await created.json();
  expect(doc, "created skill document").toMatchObject({ documentType: "skill" });
  skillDocs.push(doc.id);
  const submitted = await request.post(`${base}/knowledge-base/documents/${doc.id}/submissions`, {
    data: { expectedRevision: doc.editRevision, submissionKey: randomUUID() }
  });
  expect(submitted.ok(), await submitted.text()).toBe(true);
  const version = await submitted.json();
  const approved = await request.patch(`${base}/skills/${doc.id}/approve`, { data: { versionId: version.id } });
  expect(approved.ok(), await approved.text()).toBe(true);
  const approval = await approved.json();
  expect(approval, "approved skill").toMatchObject({ status: "approved" });
  return { documentId: doc.id as string, versionId: approval.approvedVersionId as string };
}

async function stageRest(request: APIRequestContext, operations: unknown[], requestKey = randomUUID(), title = "E2E requirement change bundle") {
  return request.post(`${base}/requirements/proposals`, { data: { requestKey, operations, title }, failOnStatusCode: false });
}

async function stageMcp(mcp: APIRequestContext, token: string, operations: unknown[], requestKey = randomUUID()) {
  const response = await mcp.post(`${base}/mcp`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { jsonrpc: "2.0", id: 1, method: "tools/call",
      params: { name: "stage_requirement_change_bundle", arguments: { requestKey, operations, title: "E2E requirement bundle over MCP" } } },
  });
  expect(response.ok(), await response.text()).toBe(true);
  const body = await response.json();
  expect(body.error, JSON.stringify(body.error)).toBeUndefined();
  return JSON.parse(body.result.content[0].text);
}

test("requirement change bundles stage inertly, retry idempotently and refuse changed content", async ({ request }) => {
  const mcp = await newRequest.newContext({ baseURL: env.apiBaseUrl, storageState: { cookies: [], origins: [] } });
  let tokenId: string | undefined;
  const tasks: string[] = [];
  try {
    const { operations } = bundleOperations({ title: `E2E inert requirement ${Date.now()}` });
    const key = randomUUID();
    const receiptsBefore = scalar(`SELECT COUNT(*)::int FROM testcase_approval_receipts r JOIN testcases t ON t.id=r.testcase_id WHERE t.project_id=${literal(ctx.projectId)};`);
    const first = await stageRest(request, operations, key);
    expect(first.status(), await first.text()).toBe(201);
    const staged = await first.json();
    tasks.push(staged.id);
    expect(staged).toMatchObject({ taskStatus: "in_review", drafts: [] });
    expect(staged.requirementBundle).toHaveLength(3);
    expect(staged.skillContext).toMatchObject({ status: "unassigned" });
    expect(staged.proposalRevision).toMatch(/^[a-f0-9]{64}$/);
    expect(scalar(`SELECT COUNT(*)::int FROM testcases WHERE project_id=${literal(ctx.projectId)} AND title=${literal(operations[1].draft.title)};`)).toBe("0");
    expect(scalar(`SELECT COUNT(*)::int FROM knowledge_documents WHERE project_id=${literal(ctx.projectId)} AND title=${literal(operations[0].title)};`)).toBe("0");
    expect(scalar(`SELECT COUNT(*)::int FROM testcase_approval_receipts r JOIN testcases t ON t.id=r.testcase_id WHERE t.project_id=${literal(ctx.projectId)};`)).toBe(receiptsBefore);

    const retried = await stageRest(request, operations, key);
    expect(retried.status(), await retried.text()).toBe(201);
    expect((await retried.json()).id).toBe(staged.id);
    const changed = await stageRest(request, bundleOperations({ title: `E2E changed requirement ${Date.now()}` }).operations, key);
    expect(changed.status()).toBe(409);
    expect((await changed.json()).code).toBe("PROPOSAL_REQUEST_CONFLICT");

    const tokenResponse = await issueMcpTestToken(request, `${base}/apikeys`, {
      data: { name: `E2E requirement bundle ${Date.now()}`, scopes: ["read", "write"] },
    });
    expect(tokenResponse.ok(), await tokenResponse.text()).toBe(true);
    const token = await tokenResponse.json();
    tokenId = token.id;
    const overMcp = await stageMcp(mcp, token.token, bundleOperations({ title: `E2E MCP requirement ${Date.now()}` }).operations);
    tasks.push(overMcp.taskId);
    expect(overMcp).toMatchObject({ publication: "unpublished", skillContext: { status: "unassigned" } });
    expect(overMcp.task.requirementBundle).toHaveLength(3);
  } finally {
    if (tokenId) await request.delete(`${base}/apikeys/${tokenId}`, { failOnStatusCode: false });
    for (const id of tasks) exec(`DELETE FROM ai_generation_requests WHERE id=${literal(id)} AND project_id=${literal(ctx.projectId)};`);
    await mcp.dispose();
  }
});

test("requirement change bundles cannot be applied or edited while approved effective skills are unavailable", async ({ request }) => {
  const tasks: string[] = [];
  try {
    const stagedResponse = await stageRest(request, bundleOperations({ title: `E2E blocked requirement ${Date.now()}` }).operations);
    expect(stagedResponse.status()).toBe(201);
    const staged = await stagedResponse.json();
    tasks.push(staged.id);
    const caseCount = scalar(`SELECT COUNT(*)::int FROM testcases WHERE project_id=${literal(ctx.projectId)};`);
    const receiptCount = scalar(`SELECT COUNT(*)::int FROM testcase_approval_receipts r JOIN testcases t ON t.id=r.testcase_id WHERE t.project_id=${literal(ctx.projectId)};`);
    const taskBefore = scalar(`SELECT row_to_json(r)::text FROM ai_generation_requests r WHERE id=${literal(staged.id)};`);

    const save = await request.post(`${base}/agents/zyra/tasks/${staged.id}/save`, {
      data: { expectedProposalRevision: staged.proposalRevision, selectedDraftIndexes: [0] }, failOnStatusCode: false,
    });
    expect(save.status()).toBe(409);
    expect(await save.json()).toMatchObject({ code: "SKILL_CONTEXT_UNAVAILABLE" });
    const remove = await request.delete(`${base}/agents/zyra/tasks/${staged.id}/drafts/0`, { failOnStatusCode: false });
    expect(remove.status()).toBe(409);
    const edit = await request.patch(`${base}/agents/zyra/tasks/${staged.id}/drafts/0`, { data: { title: "Tampered" }, failOnStatusCode: false });
    expect(edit.status()).toBe(409);
    for (const action of ["feedback", "close"]) {
      const response = await request.post(`${base}/agents/zyra/tasks/${staged.id}/${action}`, {
        data: action === "feedback" ? { feedback: "Replace the reviewed bundle" } : {}, failOnStatusCode: false,
      });
      expect(response.status(), await response.text()).toBe(409);
      expect(await response.json()).toMatchObject({ code: "REQUIREMENT_BUNDLE_IMMUTABLE" });
    }
    expect(scalar(`SELECT row_to_json(r)::text FROM ai_generation_requests r WHERE id=${literal(staged.id)};`)).toBe(taskBefore);

    const current = await request.get(`${base}/requirements/proposals/${staged.id}`);
    expect(current.ok(), await current.text()).toBe(true);
    expect(await current.json()).toMatchObject({ taskStatus: "in_review", proposalRevision: staged.proposalRevision, drafts: [] });
    expect(scalar(`SELECT COUNT(*)::int FROM testcases WHERE project_id=${literal(ctx.projectId)};`)).toBe(caseCount);
    expect(scalar(`SELECT COUNT(*)::int FROM testcase_approval_receipts r JOIN testcases t ON t.id=r.testcase_id WHERE t.project_id=${literal(ctx.projectId)};`)).toBe(receiptCount);
  } finally {
    for (const id of tasks) exec(`DELETE FROM ai_generation_requests WHERE id=${literal(id)} AND project_id=${literal(ctx.projectId)};`);
  }
});

test("authorized rejection and producer withdrawal close the bundle without publishing", async ({ request }) => {
  const tasks: string[] = [];
  try {
    const rejectedResponse = await stageRest(request, bundleOperations({ title: `E2E rejected requirement ${Date.now()}` }).operations);
    expect(rejectedResponse.status()).toBe(201);
    const rejected = await rejectedResponse.json();
    tasks.push(rejected.id);
    const decisionBody = { expectedProposalRevision: rejected.proposalRevision, reason: "E2E refusal" };
    const missingRevision = await request.post(`${base}/requirements/proposals/${rejected.id}/reject`, { data: { reason: "E2E refusal" }, failOnStatusCode: false });
    expect(missingRevision.status()).toBe(400);
    expect(await missingRevision.json()).toMatchObject({ code: "PROPOSAL_REVIEW_REQUIRED" });
    const stale = await request.post(`${base}/requirements/proposals/${rejected.id}/reject`, { data: { ...decisionBody, expectedProposalRevision: "0".repeat(64) }, failOnStatusCode: false });
    expect(stale.status()).toBe(409);
    const reject = await request.post(`${base}/requirements/proposals/${rejected.id}/reject`, { data: decisionBody });
    expect(reject.ok(), await reject.text()).toBe(true);
    const closed = await reject.json();
    expect(closed).toMatchObject({ taskStatus: "done", replayed: false, requirementDecision: {
      decision: "rejected", proposalRevision: rejected.proposalRevision, reason: "E2E refusal", reviewedSnapshot: rejected.proposalSnapshot,
    } });
    const repeated = await request.post(`${base}/requirements/proposals/${rejected.id}/reject`, { data: decisionBody, failOnStatusCode: false });
    expect(repeated.ok(), await repeated.text()).toBe(true);
    expect(await repeated.json()).toMatchObject({ replayed: true, requirementDecision: closed.requirementDecision });
    const opposite = await request.post(`${base}/requirements/proposals/${rejected.id}/withdraw`, { data: decisionBody, failOnStatusCode: false });
    expect(opposite.status()).toBe(409);
    expect(await opposite.json()).toMatchObject({ code: "PROPOSAL_REVIEW_CONFLICT" });
    expect(scalar(`SELECT COUNT(*)::int FROM audit_logs WHERE entity_id=${literal(rejected.id)} AND action IN ('requirement_proposal_rejected','requirement_proposal_withdrawn');`)).toBe("1");

    const withdrawnResponse = await stageRest(request, bundleOperations({ title: `E2E withdrawn requirement ${Date.now()}` }).operations);
    expect(withdrawnResponse.status()).toBe(201);
    const withdrawn = await withdrawnResponse.json();
    tasks.push(withdrawn.id);
    const withdraw = await request.post(`${base}/requirements/proposals/${withdrawn.id}/withdraw`, { data: { expectedProposalRevision: withdrawn.proposalRevision, reason: "E2E withdrawal" } });
    expect(withdraw.ok(), await withdraw.text()).toBe(true);
    expect(await withdraw.json()).toMatchObject({ taskStatus: "done", requirementDecision: { decision: "withdrawn", proposalRevision: withdrawn.proposalRevision } });
    expect(scalar(`SELECT COUNT(*)::int FROM testcases WHERE project_id=${literal(ctx.projectId)} AND title LIKE 'E2E bundle case%';`)).toBe("0");
  } finally {
    for (const id of tasks) exec(`DELETE FROM ai_generation_requests WHERE id=${literal(id)} AND project_id=${literal(ctx.projectId)};`);
  }
});

test("a bundle is unreachable from another project and mismatched link criteria are refused", async ({ request }) => {
  const tasks: string[] = [];
  let otherProjectId = "";
  try {
    const stagedResponse = await stageRest(request, bundleOperations({ title: `E2E scoped requirement ${Date.now()}` }).operations);
    expect(stagedResponse.status()).toBe(201);
    const staged = await stagedResponse.json();
    tasks.push(staged.id);
    // Project names are capped at 30 characters; the isolation check needs only a distinct project.
    const created = await request.post(`/api/projects`, { data: { name: `E2E scope ${Date.now()}`, key: `ERS${String(Date.now()).slice(-6)}` } });
    expect(created.ok(), await created.text()).toBe(true);
    otherProjectId = (await created.json()).id;
    const foreign = await request.get(`/api/projects/${otherProjectId}/requirements/proposals/${staged.id}`);
    expect(foreign.status()).toBe(404);

    const mismatch = bundleOperations({ criterionKeys: ["AC-9"] });
    const refused = await stageRest(request, mismatch.operations);
    expect(refused.status()).toBe(400);
  } finally {
    for (const id of tasks) exec(`DELETE FROM ai_generation_requests WHERE id=${literal(id)} AND project_id=${literal(ctx.projectId)};`);
    if (otherProjectId) await request.delete(`/api/projects/${otherProjectId}`, { failOnStatusCode: false });
  }
});

test("a coding-agent MCP bundle stages requirement-linked native regression cases for human approval and evidence", async ({ request }) => {
  const suffix = Date.now();
  const skillDocs: string[] = [];
  const taskIds: string[] = [];
  const cycleIds: string[] = [];
  let requirementId = "";
  let mcp: APIRequestContext | undefined;
  let tokenId: string | undefined;
  try {
    const makeSkill = (module: string, subtype: string, operation: string) => createApprovedSkill(request, skillDocs, module, subtype, operation);
    const assign = async (skill: { documentId: string; versionId: string }, module: string, subtype: string, operation: string) => {
      const assigned = await request.post(`${base}/skill-assignments`, { data: { skillDocumentId: skill.documentId, versionId: skill.versionId, module, subtype, operation } });
      expect(assigned.ok(), await assigned.text()).toBe(true);
      const body = await assigned.json();
      expect(body.resolution?.status, `assignment resolution: ${JSON.stringify(body)}`).toBe("resolved");
      return body;
    };

    const requirementSkill = await makeSkill("requirements", "functional", "requirement_revision");
    await assign(requirementSkill, "requirements", "functional", "requirement_revision");
    await assign(requirementSkill, "requirements", "functional", "requirement_case_link");
    const caseSkill = await makeSkill("test_cases", "manual", "testcase_create");
    await assign(caseSkill, "test_cases", "manual", "testcase_create");
    const assignmentRows = JSON.parse(scalar(`SELECT COALESCE(json_agg(json_build_object(
      'module',a.module,'subtype',a.subtype,'operation',a.operation,'status',a.status,
      'type',d.document_type,'kind',v.snapshot_kind,'digest',v.snapshot_metadata->>'contentDigest')),'[]'::json)::text
      FROM skill_assignments a
      JOIN knowledge_documents d ON d.id=a.skill_document_id AND d.project_id=a.project_id
      JOIN knowledge_document_versions v ON v.id=a.skill_version_id AND v.document_id=a.skill_document_id
      WHERE a.project_id=${literal(ctx.projectId)} AND a.status='active';`) || "[]");
    expect(assignmentRows, "active skill assignments").toHaveLength(3);
    const effectiveBeforeStaging = await request.get(`${base}/skills/effective?module=requirements&subtype=functional&operation=requirement_revision`);
    expect(effectiveBeforeStaging.ok(), await effectiveBeforeStaging.text()).toBe(true);
    expect(await effectiveBeforeStaging.json(), `effective skill must resolve before staging: ${JSON.stringify(assignmentRows)}`).toMatchObject({ status: "resolved" });

    const title = `E2E governed requirement ${suffix}`;
    const caseTitle = `E2E governed case ${suffix}`;
    const requirementOperationId = randomUUID(), testcaseOperationId = randomUUID();
    const regressionSteps = [
      { stepNumber: 1, action: "Stage a requirement and case bundle through project-bound MCP",
        expectedResult: "One unpublished review task is returned without an official test case" },
      { stepNumber: 2, action: "Review and apply the exact proposal as an authorized human",
        expectedResult: "One native Draft case is linked to the reviewed requirement revision" }
    ];
    const operations = [
      { opType: "requirement_revision", operationId: requirementOperationId, title, description: "Published through the governed path.", criteria: [{ key: "AC-1", text: "The obligation is observable" }, { key: "AC-2", text: "The second obligation is observable" }] },
      { opType: "testcase_create", operationId: testcaseOperationId, draft: {
        title: caseTitle, description: "Regression case authored alongside application automated tests.",
        preconditions: "Project-owned agent grant and approved requirement/test-case methods are available.",
        steps: regressionSteps,
        postconditions: "Published case identity persists; no result or Passed claim is invented.",
        automationRepo: "1alextest/Tesbooboo",
        automationPath: "e2e/api/requirements.spec.ts",
        automationFramework: "Playwright"
      } },
      { opType: "requirement_case_link", operationId: randomUUID(), requirementOperationId, testcaseOperationId, criterionKeys: ["AC-1"] },
    ];
    const tokenResponse = await issueMcpTestToken(request, `${base}/apikeys`, {
      data: { name: `E2E code-agent linked case ${suffix}`, scopes: ["read", "write"] }
    });
    expect(tokenResponse.ok(), await tokenResponse.text()).toBe(true);
    const agentCredential = await tokenResponse.json();
    tokenId = agentCredential.id;
    mcp = await newRequest.newContext({ baseURL: env.apiBaseUrl, storageState: { cookies: [], origins: [] } });

    // A machine client cannot directly publish native cases, even with write scope.
    const denied = await mcp.post(`${base}/mcp`, {
      headers: { Authorization: `Bearer ${agentCredential.token}` },
      data: { jsonrpc: "2.0", id: 2, method: "tools/call",
        params: { name: "create_testcase", arguments: { title: caseTitle } } }
    });
    expect(denied.ok(), await denied.text()).toBe(true);
    expect((await denied.json()).error?.data?.code).toBe("HUMAN_PUBLICATION_REQUIRED");

    const requestKey = randomUUID();
    const proposed = await stageMcp(mcp, agentCredential.token, operations, requestKey);
    const staged = proposed.task;
    taskIds.push(proposed.taskId);
    expect(proposed).toMatchObject({ publication: "unpublished", taskId: staged.id });
    expect(staged.skillContext).toMatchObject({ status: "resolved" });
    expect(staged.skillContext.assignments).toHaveLength(3);

    // MCP staging is idempotent; it does not create a native requirement, case, link or approval.
    const repeated = await stageMcp(mcp, agentCredential.token, operations, requestKey);
    expect(repeated.taskId).toBe(staged.id);
    const proposedCase = await request.get(`${base}/requirements/proposals/${staged.id}`);
    expect(proposedCase.ok(), await proposedCase.text()).toBe(true);
    expect((await proposedCase.json()).proposalRevision).toBe(staged.proposalRevision);
    expect(scalar(`SELECT COUNT(*)::int FROM testcases WHERE project_id=${literal(ctx.projectId)} AND title=${literal(caseTitle)};`)).toBe("0");
    expect(scalar(`SELECT COUNT(*)::int FROM knowledge_documents WHERE project_id=${literal(ctx.projectId)} AND title=${literal(title)};`)).toBe("0");

    // Warm the exact unfiltered repository shape before this independent publication path commits.
    // Its case must appear without another testcase write, filtered bypass, sleep or TTL workaround.
    const repositoryBeforeResponse = await request.get(`${base}/testcases`, { params: { limit: 500, offset: 0 } });
    expect(repositoryBeforeResponse.ok(), await repositoryBeforeResponse.text()).toBe(true);
    const repositoryBefore = await repositoryBeforeResponse.json();
    expect(repositoryBefore.some((row: { title: string }) => row.title === caseTitle)).toBe(false);
    expect(Buffer.byteLength(JSON.stringify(repositoryBefore), "utf8")).toBeLessThan(190 * 1024);

    const appliedResponse = await request.post(`${base}/requirements/proposals/${staged.id}/apply`, {
      data: { expectedProposalRevision: staged.proposalRevision }
    });
    expect(appliedResponse.ok(), await appliedResponse.text()).toBe(true);
    const applied = await appliedResponse.json();
    requirementId = applied.receipt.requirement.documentId;
    const requirementVersionId = applied.receipt.requirement.versionId as string;
    const caseId = applied.receipt.testcase.id as string;

    const repositoryAfterResponse = await request.get(`${base}/testcases`, { params: { limit: 500, offset: 0 } });
    expect(repositoryAfterResponse.ok(), await repositoryAfterResponse.text()).toBe(true);
    expect(await repositoryAfterResponse.json()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: caseId, title: caseTitle, status: "Draft", approvalCurrent: false }),
    ]));

    // The task payload the review surface reloads carries the exact submitted version identity,
    // and only the bounded identities — never the proposal snapshot or decision digest.
    const reloaded = await (await request.get(`${base}/requirements/proposals/${staged.id}`)).json();
    expect(reloaded.requirementApplyReceipt).toMatchObject({
      requirement: { documentId: requirementId, versionId: requirementVersionId, versionNumber: applied.receipt.requirement.versionNumber },
      testcase: { id: caseId },
      link: { id: applied.receipt.link.id }
    });
    expect(reloaded.requirementApplyReceipt.proposalSnapshot).toBeUndefined();
    expect(reloaded.requirementApplyReceipt.decisionKey).toBeUndefined();

    // A stale submitted version is refused after the requirement content moves on. Restoring the
    // exact reviewed content makes the original version approvable again without rewriting it.
    const changedTitle = `${title} changed`;
    const changed = await request.patch(`${base}/knowledge-base/documents/${requirementId}`, { data: { title: changedTitle } });
    expect(changed.ok(), await changed.text()).toBe(true);
    const staleApproval = await request.post(`${base}/requirements/${requirementId}/approve`, { data: { versionId: requirementVersionId } });
    expect(staleApproval.status()).toBe(409);
    expect((await staleApproval.json()).code).toBe("DOCUMENT_REVISION_CONFLICT");
    const restored = await request.patch(`${base}/knowledge-base/documents/${requirementId}`, { data: { title } });
    expect(restored.ok(), await restored.text()).toBe(true);

    const coverage = async () => (await request.get(`${base}/requirements/${requirementId}/coverage`)).json();
    let readings = await coverage();
    expect(readings.readings).toMatchObject({ authored: true, approved: false, executed: false, passing: false });
    expect(scalar(`SELECT COUNT(*)::int FROM testcases WHERE project_id=${literal(ctx.projectId)} AND title=${literal(caseTitle)};`)).toBe("1");
    expect(scalar(`SELECT COUNT(*)::int FROM requirement_case_links WHERE requirement_id=${literal(requirementId)} AND state='active';`)).toBe("1");

    const approvedRequirement = await request.post(`${base}/requirements/${requirementId}/approve`, { data: { versionId: requirementVersionId } });
    expect(approvedRequirement.ok(), await approvedRequirement.text()).toBe(true);
    const requirementApproval = await approvedRequirement.json();
    expect(requirementApproval.approvedVersionId).toBeTruthy();

    const caseBefore = await (await request.get(`${base}/testcases/${caseId}`)).json();
    expect(caseBefore.status).toBe("Draft");
    expect(JSON.parse(caseBefore.steps)).toEqual(regressionSteps);
    expect(caseBefore.automationRepo).toBe("1alextest/Tesbooboo");
    expect(caseBefore.automationPath).toBe("e2e/api/requirements.spec.ts");
    const approvedCase = await request.post(`${base}/testcases/${caseId}/approve`, {
      data: { expectedRevision: caseBefore.editRevision, expectedApprovalRevision: caseBefore.approvalRevision }
    });
    expect(approvedCase.ok(), await approvedCase.text()).toBe(true);
    const caseAfter = await (await request.get(`${base}/testcases/${caseId}`)).json();

    readings = await coverage();
    const approvedLink = (readings.cases as Array<Record<string, any>>).find((item) => item.requirementVersionId === readings.approvedVersionId) || readings.cases[0];
    // The linked basis is historical data. A current case read must not be substituted for the
    // exact revisions persisted on this not-yet-activated relation.
    expect(approvedLink.testcaseRevision).toMatch(/^[a-f0-9]{64}$/);
    expect(approvedLink.testcaseApprovalRevision).toBeNull();
    const activationState = () => scalar(`SELECT json_build_object(
      'links', (SELECT COALESCE(json_agg(to_jsonb(l) ORDER BY l.id),'[]'::json) FROM requirement_case_links l WHERE l.project_id=${literal(ctx.projectId)} AND l.requirement_id=${literal(requirementId)}),
      'audit', (SELECT COALESCE(json_agg(to_jsonb(a) ORDER BY a.id),'[]'::json) FROM audit_logs a WHERE a.project_id=${literal(ctx.projectId)} AND a.action='requirement_link_reapplied' AND a.entity_name=${literal(requirementId)})
    )::text;`);
    const activationRevisions = { expectedCaseRevision: caseAfter.editRevision, expectedApprovalRevision: caseAfter.approvalRevision };
    const beforeWrongBasis = activationState();
    const wrongBasis = await request.post(`${base}/requirements/${requirementId}/links/${approvedLink.linkId}/reapply`, {
      data: { ...activationRevisions, expectedRequirementVersionId: requirementVersionId }
    });
    expect(wrongBasis.status(), await wrongBasis.text()).toBe(409);
    expect((await wrongBasis.json()).code).toBe("REQUIREMENT_VERSION_CONFLICT");
    expect(activationState()).toBe(beforeWrongBasis);
    const reapplied = await request.post(`${base}/requirements/${requirementId}/links/${approvedLink.linkId}/reapply`, {
      data: { ...activationRevisions, expectedRequirementVersionId: requirementApproval.approvedVersionId }
    });
    expect(reapplied.ok(), await reapplied.text()).toBe(true);
    const activation = await reapplied.json();
    expect(activation).toMatchObject({ replayed: false, link: { requirementVersionId: requirementApproval.approvedVersionId } });
    const afterActivation = activationState();
    const replayed = await request.post(`${base}/requirements/${requirementId}/links/${approvedLink.linkId}/reapply`, {
      data: { ...activationRevisions, expectedRequirementVersionId: requirementApproval.approvedVersionId }
    });
    expect(replayed.ok(), await replayed.text()).toBe(true);
    expect(await replayed.json()).toEqual({ ...activation, replayed: true });
    expect(activationState()).toBe(afterActivation);
    expect(JSON.parse(afterActivation).audit).toHaveLength(1);
    readings = await coverage();
    expect(readings.readings).toMatchObject({ authored: true, approved: true, executed: false, passing: false });
    expect(readings.cases.find((item: Record<string, any>) => item.linkId === activation.link.id)).toMatchObject({
      testcaseRevision: caseAfter.editRevision, testcaseApprovalRevision: caseAfter.approvalRevision,
      requirementVersionId: requirementApproval.approvedVersionId
    });

    // Fixture setup only: the human publication/approval decisions above were API calls. The
    // persisted attempt is created in the native Run/execution tables so the coverage reader is
    // exercised against real evidence, not a stubbed payload.
    const attempt = async (status: string, at: string) => {
      const runId = scalar(`INSERT INTO cycles(project_id,name) VALUES (${literal(ctx.projectId)},${literal(`E2E coverage ${status} ${suffix}`)}) RETURNING id;`);
      cycleIds.push(runId);
      const itemId = scalar(`INSERT INTO cycle_items(cycle_id,testcase_id,snapshot_approval_revision) VALUES (${literal(runId)},${literal(caseId)},${literal(caseAfter.approvalRevision)}) RETURNING id;`);
      const executionId = scalar(`INSERT INTO executions(cycle_item_id,status,executed_by,executed_at)
            SELECT ${literal(itemId)},${literal(status)},pm.user_id,${literal(at)}::timestamptz
              FROM project_members pm WHERE pm.project_id=${literal(ctx.projectId)}
             ORDER BY CASE pm.role WHEN 'owner' THEN 0 ELSE 1 END, pm.user_id LIMIT 1 RETURNING id;`);
      return { runId, executionId };
    };
    const passedAttempt = await attempt("Passed", new Date().toISOString());
    readings = await coverage();
    expect(readings.readings).toMatchObject({ approved: true, executed: true, passing: true, mixed: false });
    expect(readings.cases[0].latestAttempt).toMatchObject({
      status: "Passed", executionId: passedAttempt.executionId, cycleId: passedAttempt.runId
    });

    await attempt("Failed", new Date(Date.now() + 1000).toISOString());
    readings = await coverage();
    expect(readings.readings).toMatchObject({ executed: true, passing: false, mixed: true });
    expect(readings.cases[0].latestAttempt.status).toBe("Failed");

    // Defect-fix follow-up: the same coding agent updates the established native case through
    // the existing MCP unpublished proposal owner. A human Save keeps its identity, requirement
    // link and past execution evidence; its changed definition cannot inherit the old approval.
    const historicalAttempts = () => scalar(`SELECT COALESCE(json_agg(
      json_build_object('status', e.status, 'approvalRevision', item.snapshot_approval_revision,
                        'executionId', e.id, 'runId', item.cycle_id)
      ORDER BY e.executed_at)::text, '[]')
      FROM executions e JOIN cycle_items item ON item.id=e.cycle_item_id
      WHERE item.testcase_id=${literal(caseId)};`);
    const immutableAttemptHistory = historicalAttempts();
    const revisedSteps = [...regressionSteps, {
      stepNumber: 3, action: "Retry after a failed source or stale-review response",
      expectedResult: "The existing reviewed task is reloaded; no duplicate official case is added"
    }];
    const revised = await stageAndApplyMcpTestcases(request, mcp!, agentCredential.token, ctx.projectId, [{
      opType: "update", testcaseId: caseId, expectedRevision: caseAfter.editRevision,
      reason: "Coding-agent regression coverage improved after a defect fix",
      fields: { steps: revisedSteps, description: "Existing regression case with explicit recovery behaviour." }
    }]);
    expect(revised.staged.publication).toBe("unpublished");
    taskIds.push(revised.staged.taskId);
    const amendedCase = await (await request.get(`${base}/testcases/${caseId}`)).json();
    expect(amendedCase.id).toBe(caseId);
    expect(amendedCase.editRevision).not.toBe(caseAfter.editRevision);
    expect(amendedCase.approvalCurrent).toBe(false);
    expect(JSON.parse(amendedCase.steps)).toEqual(revisedSteps);
    expect(scalar(`SELECT COUNT(*)::int FROM testcases WHERE project_id=${literal(ctx.projectId)} AND title=${literal(caseTitle)};`)).toBe("1");
    expect(scalar(`SELECT COUNT(*)::int FROM requirement_case_links WHERE requirement_id=${literal(requirementId)} AND state='active';`)).toBe("1");
    expect(scalar(`SELECT COUNT(*)::int FROM executions e JOIN cycle_items item ON item.id=e.cycle_item_id WHERE item.testcase_id=${literal(caseId)};`)).toBe("2");
    expect(historicalAttempts()).toBe(immutableAttemptHistory);
    readings = await coverage();
    expect(readings.readings).toMatchObject({ authored: true, approved: false, passing: false });
    const beforeChangedCaseReplay = activationState();
    const changedCaseReplay = await request.post(`${base}/requirements/${requirementId}/links/${approvedLink.linkId}/reapply`, {
      data: { ...activationRevisions, expectedRequirementVersionId: requirementApproval.approvedVersionId }
    });
    expect(changedCaseReplay.status(), await changedCaseReplay.text()).toBe(409);
    expect((await changedCaseReplay.json()).code).toBe("CASE_REVISION_CONFLICT");
    expect(activationState()).toBe(beforeChangedCaseReplay);

    // A real new requirement revision clears the current approval without rewriting old link or
    // execution history. Neither that interval nor the later new approval may replay the old link
    // as evidence of a current activation, even for a legacy client without requirement CAS.
    const currentRequirement = await (await request.get(`${base}/knowledge-base/documents/${requirementId}`)).json();
    const changedRequirement = await stageRest(request, [{
      ...operations[0], operationId: randomUUID(), documentId: requirementId,
      expectedRevision: currentRequirement.editRevision, title: `${title} revised after activation`
    }]);
    expect(changedRequirement.ok(), await changedRequirement.text()).toBe(true);
    const changedTask = await changedRequirement.json();
    taskIds.push(changedTask.id);
    const changedApplied = await request.post(`${base}/requirements/proposals/${changedTask.id}/apply`, {
      data: { expectedProposalRevision: changedTask.proposalRevision }
    });
    expect(changedApplied.ok(), await changedApplied.text()).toBe(true);
    const changedReceipt = await changedApplied.json();
    const beforeClearedReplay = activationState();
    const clearedReplay = await request.post(`${base}/requirements/${requirementId}/links/${approvedLink.linkId}/reapply`, {
      data: activationRevisions
    });
    expect(clearedReplay.status(), await clearedReplay.text()).toBe(409);
    expect((await clearedReplay.json()).code).toBe("REQUIREMENT_NOT_APPROVED");
    expect(activationState()).toBe(beforeClearedReplay);
    const changedApproval = await request.post(`${base}/requirements/${requirementId}/approve`, {
      data: { versionId: changedReceipt.receipt.requirement.versionId }
    });
    expect(changedApproval.ok(), await changedApproval.text()).toBe(true);
    expect((await changedApproval.json()).approvedVersionId).not.toBe(requirementApproval.approvedVersionId);
    const beforeMovedReplay = activationState();
    const movedReplay = await request.post(`${base}/requirements/${requirementId}/links/${approvedLink.linkId}/reapply`, {
      data: activationRevisions
    });
    expect(movedReplay.status(), await movedReplay.text()).toBe(409);
    expect((await movedReplay.json()).code).toBe("LINK_NOT_ACTIVE");
    const staleDisplayedBasis = await request.post(`${base}/requirements/${requirementId}/links/${activation.link.id}/reapply`, {
      data: { ...activationRevisions, expectedRequirementVersionId: requirementApproval.approvedVersionId }
    });
    expect(staleDisplayedBasis.status(), await staleDisplayedBasis.text()).toBe(409);
    expect((await staleDisplayedBasis.json()).code).toBe("REQUIREMENT_VERSION_CONFLICT");
    expect(activationState()).toBe(beforeMovedReplay);
    expect(historicalAttempts()).toBe(immutableAttemptHistory);

    // Explicit carry-forward is a proposal, not a machine publication or implicit approval.
    const approvedAmended = await request.post(`${base}/testcases/${caseId}/approve`, {
      data: { expectedRevision: amendedCase.editRevision, expectedApprovalRevision: amendedCase.approvalRevision }
    });
    expect(approvedAmended.ok(), await approvedAmended.text()).toBe(true);
    const currentCase = await (await request.get(`${base}/testcases/${caseId}`)).json();
    const currentDoc = await (await request.get(`${base}/knowledge-base/documents/${requirementId}`)).json();
    const selection = { linkId: activation.link.id, requirementVersionId: activation.link.requirementVersionId,
      testcaseId: caseId, testcaseRevision: currentCase.editRevision,
      testcaseApprovalRevision: currentCase.approvalRevision, criterionKeys: ["AC-1"] };
    const currentRevisions = { expectedCaseRevision: currentCase.editRevision, expectedApprovalRevision: currentCase.approvalRevision };
    const noAuthority = await request.post(`${base}/requirements/${requirementId}/links/${selection.linkId}/reapply`, {
      data: { ...currentRevisions, expectedRequirementVersionId: currentDoc.reviewedVersionId }
    });
    expect(noAuthority.status()).toBe(409);
    expect((await noAuthority.json()).code).toBe("SKILL_LINK_REVIEW_REQUIRED");
    expect(activationState()).toBe(beforeMovedReplay);
    const carry = await stageMcp(mcp!, agentCredential.token, [{
      ...operations[0], operationId: randomUUID(), documentId: requirementId,
      expectedRevision: currentDoc.editRevision, title: `${title} explicitly carried`, carryForwardLinks: [selection]
    }]);
    taskIds.push(carry.taskId);
    expect(carry.publication).toBe("unpublished");
    expect(carry.task.requirementBundle[0].carryForwardLinks[0]).toMatchObject(selection);
    expect(carry.task.skillContext.assignments).toHaveLength(2);
    expect(activationState()).toBe(beforeMovedReplay);
    const carryApplied = await request.post(`${base}/requirements/proposals/${carry.taskId}/apply`, {
      data: { expectedProposalRevision: carry.task.proposalRevision }
    });
    expect(carryApplied.ok(), await carryApplied.text()).toBe(true);
    const carryReceipt = await carryApplied.json();
    expect(carryReceipt.receipt.testcase).toBeNull();
    const carryApproved = await request.post(`${base}/requirements/${requirementId}/approve`, {
      data: { versionId: carryReceipt.receipt.requirement.versionId }
    });
    expect(carryApproved.ok(), await carryApproved.text()).toBe(true);
    const carryApproval = await carryApproved.json();
    readings = await coverage();
    expect(readings.readings.approved).toBe(false);
    expect(readings.pendingCarryForwardCases).toEqual(expect.arrayContaining([expect.objectContaining({
      linkId: selection.linkId, approved: false, executed: false, passing: false
    })]));
    const rebindRequest = { ...currentRevisions, expectedRequirementVersionId: carryApproval.approvedVersionId };
    const reboundResponse = await request.post(`${base}/requirements/${requirementId}/links/${selection.linkId}/reapply`, { data: rebindRequest });
    expect(reboundResponse.ok(), await reboundResponse.text()).toBe(true);
    const rebound = await reboundResponse.json();
    expect(rebound).toMatchObject({ replayed: false, link: { testcaseId: caseId, requirementVersionId: carryApproval.approvedVersionId } });
    const reboundState = activationState();
    const retryRebind = await request.post(`${base}/requirements/${requirementId}/links/${selection.linkId}/reapply`, { data: rebindRequest });
    expect(retryRebind.ok(), await retryRebind.text()).toBe(true);
    expect(await retryRebind.json()).toEqual({ ...rebound, replayed: true });
    expect(activationState()).toBe(reboundState);
    readings = await coverage();
    expect(readings.readings).toMatchObject({ authored: true, approved: true, executed: false, passing: false });
    expect(readings.pendingCarryForwardCases).toHaveLength(0);
    expect(historicalAttempts()).toBe(immutableAttemptHistory);
    expect(scalar(`SELECT COUNT(*)::int FROM testcases WHERE project_id=${literal(ctx.projectId)} AND title=${literal(caseTitle)};`)).toBe("1");
  } finally {
    if (mcp) await mcp.dispose();
    if (tokenId) await request.delete(`${base}/apikeys/${tokenId}`, { failOnStatusCode: false });
    for (const id of taskIds) exec(`DELETE FROM ai_generation_requests WHERE id=${literal(id)} AND project_id=${literal(ctx.projectId)};`);
    if (requirementId) {
      exec(`DELETE FROM requirement_case_links WHERE project_id=${literal(ctx.projectId)} AND requirement_id=${literal(requirementId)};`);
      exec(`DELETE FROM requirement_profiles WHERE document_id=${literal(requirementId)};`);
      exec(`UPDATE knowledge_documents SET reviewed_version_id=NULL WHERE id=${literal(requirementId)} AND project_id=${literal(ctx.projectId)};`);
      exec(`DELETE FROM knowledge_documents WHERE id=${literal(requirementId)} AND project_id=${literal(ctx.projectId)};`);
    }
    for (const id of skillDocs) { exec(`UPDATE knowledge_documents SET reviewed_version_id=NULL WHERE id=${literal(id)} AND project_id=${literal(ctx.projectId)};`); exec(`DELETE FROM knowledge_documents WHERE id=${literal(id)} AND project_id=${literal(ctx.projectId)};`); }
    for (const id of cycleIds) {
      exec(`DELETE FROM executions WHERE cycle_item_id IN (SELECT id FROM cycle_items WHERE cycle_id=${literal(id)});`);
      exec(`DELETE FROM cycle_items WHERE cycle_id=${literal(id)};`);
      exec(`DELETE FROM cycles WHERE id=${literal(id)} AND project_id=${literal(ctx.projectId)};`);
    }
  }
});


test("skill assignment overlap is refused in both insertion orders without losing the current assignment", async ({ request }) => {
  const docs: string[] = [];
  try {
    const skill = await createApprovedSkill(request, docs, "requirements", "functional", "overlap");
    const assign = (subtype: string, operation: string) => request.post(`${base}/skill-assignments`, {
      data: { skillDocumentId: skill.documentId, versionId: skill.versionId, module: "requirements", subtype, operation }, failOnStatusCode: false,
    });
    for (const wildcardFirst of [false, true]) {
      const first = await assign(wildcardFirst ? "*" : "functional", wildcardFirst ? "*" : "requirement_revision");
      expect(first.ok(), await first.text()).toBe(true);
      const active = (await first.json()).assignment;
      const before = await request.get(`${base}/skills/effective?module=requirements&subtype=functional&operation=requirement_revision`);
      const pin = await before.json();
      expect(pin.status).toBe("resolved");
      const refused = await assign(wildcardFirst ? "functional" : "*", wildcardFirst ? "requirement_revision" : "*");
      expect(refused.status(), await refused.text()).toBe(409);
      expect(await refused.json()).toMatchObject({ code: "SKILL_ASSIGNMENT_CONFLICT" });
      const after = await request.get(`${base}/skills/effective?module=requirements&subtype=functional&operation=requirement_revision`);
      expect(await after.json()).toMatchObject({ status: "resolved", digest: pin.digest });
      expect(scalar(`SELECT COUNT(*) FROM skill_assignments WHERE project_id=${literal(ctx.projectId)} AND skill_document_id=${literal(skill.documentId)} AND status='active';`)).toBe("1");
      const inactive = await request.patch(`${base}/skill-assignments/${active.id}/deactivate`, { data: {} });
      expect(inactive.ok(), await inactive.text()).toBe(true);
    }
  } finally {
    for (const id of docs) {
      exec(`UPDATE knowledge_documents SET reviewed_version_id=NULL WHERE id=${literal(id)} AND project_id=${literal(ctx.projectId)};`);
      exec(`DELETE FROM knowledge_documents WHERE id=${literal(id)} AND project_id=${literal(ctx.projectId)};`);
    }
  }
});

test("atomic Skill assignment routes commit mixed targets once and retain their exact receipt", async ({ request }) => {
  const docs: string[] = [];
  const subtype = `batch-${randomUUID().slice(0, 8)}`;
  try {
    const previous = await createApprovedSkill(request, docs, "requirements", subtype, "previous");
    const chosen = await createApprovedSkill(request, docs, "requirements", subtype, "chosen");
    const assign = async (operation: string) => {
      const response = await request.post(`${base}/skill-assignments`, { data: {
        skillDocumentId: previous.documentId, versionId: previous.versionId,
        module: "requirements", subtype, operation,
      } });
      expect(response.status(), await response.text()).toBe(201);
      return (await response.json()).assignment;
    };
    const replaced = await assign("replace");
    const neighbor = await assign("neighbor");
    const key = randomUUID();
    const command = {
      requestKey: key, skillDocumentId: chosen.documentId, versionId: chosen.versionId,
      targets: [
        { module: "requirements", subtype, operation: "replace", expectedAssignmentId: replaced.id },
        { module: "requirements", subtype, operation: "add", expectedAssignmentId: null },
      ],
    };
    const saved = await request.post(`${base}/skill-assignment-batches`, { data: command });
    expect(saved.status(), await saved.text()).toBe(201);
    const result = await saved.json();
    expect(result).toMatchObject({ replayed: false, receipt: {
      schemaVersion: 1, requestKey: key, projectId: ctx.projectId,
      skillDocumentId: chosen.documentId, skillVersionId: chosen.versionId,
      principalKind: "human_session",
    } });
    expect(result.receipt.targets).toHaveLength(2);
    expect(result.receipt.targets).toEqual(expect.arrayContaining([
      expect.objectContaining({ outcome: "replaced", before: expect.objectContaining({ id: replaced.id }), after: expect.objectContaining({ skillVersionId: chosen.versionId }) }),
      expect.objectContaining({ outcome: "added", before: null, after: expect.objectContaining({ skillVersionId: chosen.versionId }) }),
    ]));
    const ledger = () => scalar(`SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id)::text FROM skill_assignments a WHERE a.project_id=${literal(ctx.projectId)} AND a.subtype=${literal(subtype)};`);
    const committedLedger = ledger();
    expect(scalar(`SELECT status FROM skill_assignments WHERE id=${literal(replaced.id)};`)).toBe("inactive");
    expect(scalar(`SELECT status||':'||skill_version_id::text FROM skill_assignments WHERE id=${literal(neighbor.id)};`)).toBe(`active:${previous.versionId}`);
    for (const operation of ["replace", "add"]) {
      const effective = await request.get(`${base}/skills/effective`, { params: { module: "requirements", subtype, operation } });
      expect(effective.status(), await effective.text()).toBe(200);
      expect(await effective.json()).toMatchObject({ status: "resolved", assignments: [expect.objectContaining({ skillVersionId: chosen.versionId })] });
    }
    const recovered = await request.get(`${base}/skill-assignment-batches/${key}`);
    expect(recovered.status(), await recovered.text()).toBe(200);
    expect(await recovered.json()).toEqual({ receipt: result.receipt, replayed: true });
    const replay = await request.post(`${base}/skill-assignment-batches`, { data: {
      ...command, targets: [...command.targets].reverse().map(target => ({ ...target, subtype: ` ${target.subtype} `, precedence: 0 })),
    } });
    expect(replay.status(), await replay.text()).toBe(201);
    expect(await replay.json()).toEqual({ receipt: result.receipt, replayed: true });
    const changed = await request.post(`${base}/skill-assignment-batches`, {
      data: { ...command, versionId: previous.versionId }, failOnStatusCode: false,
    });
    expect(changed.status(), await changed.text()).toBe(409);
    expect(await changed.json()).toMatchObject({ code: "SKILL_ASSIGNMENT_REQUEST_CONFLICT" });
    expect(ledger()).toBe(committedLedger);

    // A command receipt is historical evidence, not a live eligibility pointer.
    // Revocation must not erase the acknowledged outcome or turn readback into a write.
    const addedId = result.receipt.targets.find((target: { outcome: string }) => target.outcome === "added").after.id;
    const revoked = await request.patch(`${base}/skill-assignments/${addedId}/deactivate`, { data: {} });
    expect(revoked.ok(), await revoked.text()).toBe(true);
    const historical = await request.get(`${base}/skill-assignment-batches/${key}`);
    expect(historical.status(), await historical.text()).toBe(200);
    expect(await historical.json()).toEqual({ receipt: result.receipt, replayed: true });
    expect(scalar(`SELECT status FROM skill_assignments WHERE id=${literal(addedId)};`)).toBe("inactive");
  } finally {
    for (const id of docs) {
      exec(`UPDATE knowledge_documents SET reviewed_version_id=NULL WHERE id=${literal(id)} AND project_id=${literal(ctx.projectId)};`);
      exec(`DELETE FROM knowledge_documents WHERE id=${literal(id)} AND project_id=${literal(ctx.projectId)};`);
    }
  }
});

test("machine tokens cannot create or read human Skill assignment command receipts", async ({ request }) => {
  const docs: string[] = [];
  let machine: APIRequestContext | undefined;
  let tokenId: string | undefined;
  const subtype = `machine-${randomUUID().slice(0, 8)}`;
  try {
    const skill = await createApprovedSkill(request, docs, "requirements", subtype, "human boundary");
    const command = { requestKey: randomUUID(), skillDocumentId: skill.documentId, versionId: skill.versionId,
      targets: [{ module: "requirements", subtype, operation: "human", expectedAssignmentId: null }],
    };
    const human = await request.post(`${base}/skill-assignment-batches`, { data: command });
    expect(human.status(), await human.text()).toBe(201);
    const original = await human.json();
    const issued = await issueMcpTestToken(request, `${base}/apikeys`, {
      data: { name: `E2E batch principal ${Date.now()}`, scopes: ["read", "write"] },
    });
    expect(issued.ok(), await issued.text()).toBe(true);
    const token = await issued.json(); tokenId = token.id;
    machine = await newRequest.newContext({ baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] }, extraHTTPHeaders: { Authorization: `Bearer ${token.token}` },
    });
    const before = scalar(`SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id)::text FROM skill_assignments a WHERE a.project_id=${literal(ctx.projectId)} AND a.subtype=${literal(subtype)};`);
    const receiptCount = scalar(`SELECT COUNT(*) FROM skill_assignment_requests WHERE project_id=${literal(ctx.projectId)};`);
    for (const response of [
      await machine.post(`${base}/skill-assignment-batches`, { data: command, failOnStatusCode: false }),
      await machine.post(`${base}/skill-assignment-batches`, { data: { ...command, requestKey: randomUUID() }, failOnStatusCode: false }),
      await machine.get(`${base}/skill-assignment-batches/${command.requestKey}`, { failOnStatusCode: false }),
    ]) {
      expect(response.status(), await response.text()).toBe(403);
      expect(await response.json()).toMatchObject({ code: "HUMAN_REVIEW_REQUIRED" });
    }
    // Activity is a legitimate project read surface, including for this machine token.
    // Its audit reference must not become an alternate read of the actor-owned receipt.
    const activity = await machine.get(`${base}/activity`, { params: {
      entityType: "skill_assignment_request", entityId: original.receipt.id,
    } });
    expect(activity.status(), await activity.text()).toBe(200);
    const feed = await activity.json();
    expect(feed.total).toBe(1);
    expect(feed.list).toHaveLength(1);
    expect(JSON.parse(feed.list[0].diff)).toEqual({
      receiptId: original.receipt.id, skillDocumentId: skill.documentId, versionId: skill.versionId, targetCount: 1,
    });
    expect(JSON.stringify(feed)).not.toContain(command.requestKey);
    expect(JSON.stringify(feed)).not.toContain(original.receipt.requestDigest);
    expect(scalar(`SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id)::text FROM skill_assignments a WHERE a.project_id=${literal(ctx.projectId)} AND a.subtype=${literal(subtype)};`)).toBe(before);
    expect(scalar(`SELECT COUNT(*) FROM skill_assignment_requests WHERE project_id=${literal(ctx.projectId)};`)).toBe(receiptCount);
    const readback = await request.get(`${base}/skill-assignment-batches/${command.requestKey}`);
    expect(readback.status(), await readback.text()).toBe(200);
    expect(await readback.json()).toEqual({ receipt: original.receipt, replayed: true });
  } finally {
    if (tokenId) await request.delete(`${base}/apikeys/${tokenId}`, { failOnStatusCode: false });
    await machine?.dispose();
    for (const id of docs) {
      exec(`UPDATE knowledge_documents SET reviewed_version_id=NULL WHERE id=${literal(id)} AND project_id=${literal(ctx.projectId)};`);
      exec(`DELETE FROM knowledge_documents WHERE id=${literal(id)} AND project_id=${literal(ctx.projectId)};`);
    }
  }
});

test("generic KB writes cannot bypass active Skill assignments and recovery never reactivates them", async ({ request }) => {
  const docs: string[] = [];
  const folders: string[] = [];
  let machine: APIRequestContext | undefined;
  let tokenId: string | undefined;
  try {
    const skill = await createApprovedSkill(request, docs, "requirements", "functional", "KB boundary");
    const assigned = await request.post(`${base}/skill-assignments`, { data: {
      skillDocumentId: skill.documentId, versionId: skill.versionId, module: "requirements", subtype: "functional", operation: "requirement_revision",
    } });
    expect(assigned.ok(), await assigned.text()).toBe(true);
    const assignment = (await assigned.json()).assignment;
    const root = scalar(`SELECT id FROM knowledge_folders WHERE project_id=${literal(ctx.projectId)} AND is_root=true LIMIT 1;`);
    let parentId = root;
    for (const name of ["Skill parent", "Skill child"]) {
      const made = await request.post(`${base}/knowledge-base/folders`, { data: { name: `${name} ${Date.now()}`, parentFolderId: parentId } });
      expect(made.ok(), await made.text()).toBe(true);
      parentId = (await made.json()).id; folders.push(parentId);
    }
    const moved = await request.patch(`${base}/knowledge-base/documents/${skill.documentId}/move`, { data: { folderId: parentId } });
    expect(moved.ok(), await moved.text()).toBe(true);
    const ordinary = await request.post(`${base}/knowledge-base/documents`, { data: { title: `Ordinary sibling ${Date.now()}`, folderId: parentId, contentText: "Ordinary KB content" } });
    expect(ordinary.ok(), await ordinary.text()).toBe(true);
    docs.push((await ordinary.json()).id);
    const issued = await issueMcpTestToken(request, `${base}/apikeys`, { data: { name: `E2E Skill KB boundary ${Date.now()}`, scopes: ["read", "write"] } });
    expect(issued.ok(), await issued.text()).toBe(true);
    const token = await issued.json(); tokenId = token.id;
    machine = await newRequest.newContext({ baseURL: env.apiBaseUrl, storageState: { cookies: [], origins: [] }, extraHTTPHeaders: { Authorization: `Bearer ${token.token}` } });
    const protectedRefusal = await machine.patch(`${base}/skill-assignments/${assignment.id}/deactivate`, { data: {}, failOnStatusCode: false });
    expect(protectedRefusal.status()).toBe(403);
    expect(await protectedRefusal.json()).toMatchObject({ code: "HUMAN_REVIEW_REQUIRED" });
    const docUrl = `${base}/knowledge-base/documents/${skill.documentId}`;
    const pin = await (await request.get(`${base}/skills/effective?module=requirements&subtype=functional&operation=requirement_revision`)).json();
    expect(pin.status).toBe("resolved");
    for (const actor of [request, machine]) {
      for (const refusal of [
        await actor.delete(docUrl, { failOnStatusCode: false }),
        await actor.patch(docUrl, { data: { documentType: "general" }, failOnStatusCode: false }),
        await actor.delete(`${base}/knowledge-base/folders/${folders[0]}`, { failOnStatusCode: false }),
      ]) {
        expect(refusal.status(), await refusal.text()).toBe(409);
        expect(await refusal.json()).toMatchObject({ code: "SKILL_ASSIGNMENT_ACTIVE" });
      }
      const noop = await actor.patch(`${docUrl}/restore`, { data: {}, failOnStatusCode: false });
      expect(noop.ok(), await noop.text()).toBe(true);
      for (const documentType of [null, "", false, 0, "skill"]) {
        const unchanged = await actor.patch(docUrl, { data: { documentType }, failOnStatusCode: false });
        expect(unchanged.ok(), await unchanged.text()).toBe(true);
        expect(await unchanged.json()).toMatchObject({ documentType: "skill" });
      }
    }
    expect(scalar(`SELECT COUNT(*) FROM knowledge_documents WHERE id IN (${docs.map(literal).join(",")}) AND is_deleted=false;`)).toBe("2");
    const after = await (await request.get(`${base}/skills/effective?module=requirements&subtype=functional&operation=requirement_revision`)).json();
    expect(after).toMatchObject({ status: "resolved", digest: pin.digest });

    // Fixture a legacy trash state that predates the guard. Neither direct nor ancestor restore
    // may make its still-active assignment effective again. This is disposable CI setup only.
    exec(`BEGIN; UPDATE knowledge_folders SET is_deleted=true,deleted_at=now(),deletion_reason='manual' WHERE id IN (${folders.map(literal).join(",")}); UPDATE knowledge_documents SET is_deleted=true,deleted_at=now() WHERE id IN (${docs.map(literal).join(",")}); COMMIT;`);
    for (const actor of [request, machine]) {
      for (const restore of [
        await actor.patch(`${docUrl}/restore`, { data: {}, failOnStatusCode: false }),
        await actor.patch(`${base}/knowledge-base/folders/${folders[0]}/restore`, { data: {}, failOnStatusCode: false }),
      ]) {
        expect(restore.status(), await restore.text()).toBe(409);
        expect(await restore.json()).toMatchObject({ code: "SKILL_ASSIGNMENT_ACTIVE" });
      }
    }
    expect(scalar(`SELECT COUNT(*) FROM knowledge_documents WHERE id IN (${docs.map(literal).join(",")}) AND is_deleted=true;`)).toBe("2");
    const deactivate = await request.patch(`${base}/skill-assignments/${assignment.id}/deactivate`, { data: {} });
    expect(deactivate.ok(), await deactivate.text()).toBe(true);
    const restore = await machine.patch(`${base}/knowledge-base/folders/${folders[0]}/restore`, { data: {} });
    expect(restore.ok(), await restore.text()).toBe(true);
    expect(await restore.json()).toMatchObject({ restoredFolders: 2, restoredDocuments: 2 });
    const unavailable = await (await request.get(`${base}/skills/effective?module=requirements&subtype=functional&operation=requirement_revision`)).json();
    expect(unavailable.status).toBe("unassigned");
    expect(scalar(`SELECT status||':'||skill_version_id::text FROM skill_assignments WHERE id=${literal(assignment.id)};`)).toBe(`inactive:${skill.versionId}`);
    for (const change of [
      await machine.patch(docUrl, { data: { documentType: "general" } }),
      await machine.patch(docUrl, { data: { documentType: "skill" } }),
      await machine.delete(docUrl),
      await machine.patch(`${docUrl}/restore`, { data: {} }),
    ]) expect(change.ok(), await change.text()).toBe(true);
    expect((await (await request.get(`${base}/skills/effective?module=requirements&subtype=functional&operation=requirement_revision`)).json()).status).toBe("unassigned");
  } finally {
    if (tokenId) await request.delete(`${base}/apikeys/${tokenId}`, { failOnStatusCode: false });
    await machine?.dispose();
    for (const id of docs) {
      exec(`UPDATE knowledge_documents SET reviewed_version_id=NULL WHERE id=${literal(id)} AND project_id=${literal(ctx.projectId)};`);
      exec(`DELETE FROM knowledge_documents WHERE id=${literal(id)} AND project_id=${literal(ctx.projectId)};`);
    }
    for (const id of folders.reverse()) exec(`DELETE FROM knowledge_folders WHERE id=${literal(id)} AND project_id=${literal(ctx.projectId)};`);
  }
});

test("apply re-reads testcase storage after the task wait and refuses a disabled capability", async ({ request }) => {
  expect(env.dbUrl, "the capability wait needs a direct database connection").toBeTruthy();
  const skillDocs: string[] = [];
  const taskIds: string[] = [];
  const beforeSettings = scalar(`SELECT settings::text FROM projects WHERE id=${literal(ctx.projectId)};`) || "{}";
  const blocker = new Client({ connectionString: env.dbUrl });
  let applyPromise: Promise<APIResponse> | undefined;
  let requirementTitle = "";
  let caseTitle = "";
  try {
    const makeSkill = (module: string, subtype: string, operation: string) => createApprovedSkill(request, skillDocs, module, subtype, operation);
    const assign = async (skill: { documentId: string; versionId: string }, module: string, subtype: string, operation: string) => {
      const assigned = await request.post(`${base}/skill-assignments`, { data: { skillDocumentId: skill.documentId, versionId: skill.versionId, module, subtype, operation } });
      expect(assigned.ok(), await assigned.text()).toBe(true);
    };
    const requirementSkill = await makeSkill("requirements", "functional", "requirement_revision");
    await assign(requirementSkill, "requirements", "functional", "requirement_revision");
    await assign(requirementSkill, "requirements", "functional", "requirement_case_link");
    const caseSkill = await makeSkill("test_cases", "manual", "testcase_create");
    await assign(caseSkill, "test_cases", "manual", "testcase_create");

    const { operations } = bundleOperations({ title: `E2E capability wait ${Date.now()}` });
    requirementTitle = operations[0].title;
    caseTitle = operations[1].draft.title;
    const stagedResponse = await stageRest(request, operations);
    expect(stagedResponse.status(), await stagedResponse.text()).toBe(201);
    const staged = await stagedResponse.json();
    taskIds.push(staged.id);

    await blocker.connect();
    await blocker.query("BEGIN");
    await blocker.query("SELECT id FROM ai_generation_requests WHERE id=$1 FOR UPDATE", [staged.id]);
    applyPromise = request.post(`${base}/requirements/proposals/${staged.id}/apply`, {
      data: { expectedProposalRevision: staged.proposalRevision }, failOnStatusCode: false,
    });
    // The preflight is non-locking, so observe the apply actually waiting on the task row before
    // changing the setting. Otherwise a loaded runner could disable it before the preflight and a
    // preflight 403 would pass for the post-wait recheck.
    const waitDeadline = Date.now() + 15000;
    let sawWait = false;
    while (Date.now() < waitDeadline) {
      if (scalar("SELECT COUNT(*)::int FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE '%ai_generation_requests%FOR UPDATE%';") !== "0") {
        sawWait = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(sawWait, "the apply never reached the task-row wait").toBe(true);
    // jsonb_set does not create a path through a JSON null intermediate, so replace each level.
    exec(`UPDATE projects SET settings=jsonb_set(COALESCE(settings,'{}'::jsonb),'{zyraAgent}',
      jsonb_set(COALESCE(NULLIF(settings->'zyraAgent','null'::jsonb),'{}'::jsonb),'{capabilities}',
        jsonb_set(COALESCE(NULLIF(settings#>'{zyraAgent,capabilities}','null'::jsonb),'{}'::jsonb),'{testcaseStorage}','false'::jsonb,true),true),true)
      WHERE id=${literal(ctx.projectId)};`);
    expect(JSON.parse(scalar(`SELECT settings::text FROM projects WHERE id=${literal(ctx.projectId)};`)).zyraAgent.capabilities.testcaseStorage).toBe(false);
    await blocker.query("COMMIT");

    const refused = await applyPromise;
    // Restore the shared project immediately after the apply resolves, before the slower count
    // assertions, so other selected specs cannot observe testcase storage disabled.
    exec(`UPDATE projects SET settings=${literal(beforeSettings)}::jsonb WHERE id=${literal(ctx.projectId)};`);
    expect(refused.status(), await refused.text()).toBe(403);
    expect((await refused.json()).error).toContain("Testcase proposal storage is disabled");
    expect(scalar(`SELECT task_status FROM ai_generation_requests WHERE id=${literal(staged.id)};`)).toBe("in_review");
    expect(scalar(`SELECT COUNT(*)::int FROM knowledge_documents WHERE project_id=${literal(ctx.projectId)} AND title=${literal(requirementTitle)};`)).toBe("0");
    expect(scalar(`SELECT COUNT(*)::int FROM testcases WHERE project_id=${literal(ctx.projectId)} AND title=${literal(caseTitle)};`)).toBe("0");
    expect(scalar(`SELECT COUNT(*)::int FROM requirement_case_links l JOIN knowledge_documents d ON d.id=l.requirement_id AND d.project_id=l.project_id WHERE l.project_id=${literal(ctx.projectId)} AND d.title=${literal(requirementTitle)};`)).toBe("0");
  } finally {
    await blocker.query("ROLLBACK").catch(() => undefined);
    await blocker.end().catch(() => undefined);
    exec(`UPDATE projects SET settings=${literal(beforeSettings)}::jsonb WHERE id=${literal(ctx.projectId)};`);
    // A failed assertion can release the blocker before the apply finishes; await it before
    // deleting fixtures so a success path cannot publish after teardown.
    await applyPromise?.catch(() => undefined);
    for (const id of taskIds) exec(`DELETE FROM ai_generation_requests WHERE id=${literal(id)} AND project_id=${literal(ctx.projectId)};`);
    if (requirementTitle) {
      exec(`DELETE FROM requirement_case_links WHERE project_id=${literal(ctx.projectId)} AND requirement_id IN (SELECT id FROM knowledge_documents WHERE project_id=${literal(ctx.projectId)} AND title=${literal(requirementTitle)});`);
      exec(`DELETE FROM requirement_profiles WHERE document_id IN (SELECT id FROM knowledge_documents WHERE project_id=${literal(ctx.projectId)} AND title=${literal(requirementTitle)});`);
      exec(`UPDATE knowledge_documents SET reviewed_version_id=NULL WHERE project_id=${literal(ctx.projectId)} AND title=${literal(requirementTitle)};`);
      exec(`DELETE FROM knowledge_documents WHERE project_id=${literal(ctx.projectId)} AND title=${literal(requirementTitle)};`);
    }
    if (caseTitle) exec(`DELETE FROM testcases WHERE project_id=${literal(ctx.projectId)} AND title=${literal(caseTitle)};`);
    for (const id of skillDocs) {
      exec(`DELETE FROM skill_assignments WHERE project_id=${literal(ctx.projectId)} AND skill_document_id=${literal(id)};`);
      exec(`UPDATE knowledge_documents SET reviewed_version_id=NULL WHERE id=${literal(id)} AND project_id=${literal(ctx.projectId)};`);
      exec(`DELETE FROM knowledge_documents WHERE id=${literal(id)} AND project_id=${literal(ctx.projectId)};`);
    }
  }
});

test("an agent-staged governed manual candidate is inert and only an owner applies the exact pinned revision", async ({ request }) => {
  const suffix = Date.now();
  const skillDocs: string[] = [];
  const taskIds: string[] = [];
  let documentId = "";
  let tokenId = "";
  let machine: APIRequestContext | undefined;
  const metadata = {
    schemaVersion: "tesbo-governed-document/1", audience: "internal", subtype: "manual", confidentiality: "internal",
    distribution: "internal", sourceAuthority: { kind: "internal", label: "Project owner", reference: null },
    effectivity: { from: null, to: null }, enforcementRefs: [],
  };
  try {
    const skill = await createApprovedSkill(request, skillDocs, "user_manuals", "internal", "manual_revision");
    const assigned = await request.post(`${base}/skill-assignments`, { data: {
      skillDocumentId: skill.documentId, versionId: skill.versionId,
      module: "user_manuals", subtype: "internal", operation: "manual_revision",
    } });
    expect(assigned.status(), await assigned.text()).toBe(201);

    const root = await (await request.get(`${base}/knowledge-base/folders/tree`)).json();
    const created = await request.post(`${base}/knowledge-base/documents`, { data: {
      title: `E2E agent manual ${suffix}`, folderId: root.id, documentType: "user_manual",
      contentText: "Base manual body", contentHtml: "<p>Base manual body</p>",
      contentJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Base manual body" }] }] },
      governedMetadata: metadata,
    } });
    expect(created.status(), await created.text()).toBe(201);
    const target = await created.json();
    documentId = target.id;

    const issued = await request.post(`${base}/apikeys`, { data: { name: `E2E document proposal ${suffix}`, scopes: ["read", "write"] } });
    expect(issued.status(), await issued.text()).toBe(201);
    const token = await issued.json();
    tokenId = token.id;
    // A token context with no session cookies: the producer must be the machine identity itself.
    machine = await newRequest.newContext({
      baseURL: env.apiBaseUrl, storageState: { cookies: [], origins: [] },
      extraHTTPHeaders: { Authorization: `Bearer ${token.token}` },
    });

    const requestKey = randomUUID();
    const payload = {
      requestKey, operation: "update", documentId: target.id, expectedRevision: target.editRevision,
      document: {
        title: `${target.title} revised`, contentText: "Revised manual body",
        governedMetadata: { ...metadata, confidentiality: "confidential" },
      },
      reason: "Security update",
    };
    const stagedResponse = await machine.post(`${base}/knowledge-base/document-proposals`, { data: payload, failOnStatusCode: false });
    expect(stagedResponse.status(), await stagedResponse.text()).toBe(201);
    const staged = await stagedResponse.json();
    taskIds.push(staged.id);
    expect(staged, "the candidate pins the exact base and Skill basis").toMatchObject({
      proposalRevision: expect.stringMatching(/^[a-f0-9]{64}$/),
      managedDocumentProposal: {
        operation: "update", documentType: "user_manual",
        target: { documentId: target.id, editRevision: target.editRevision },
        skillApplicability: { status: "current" },
      },
    });
    const replay = await machine.post(`${base}/knowledge-base/document-proposals`, { data: payload, failOnStatusCode: false });
    expect(replay.status()).toBe(201);
    expect((await replay.json()).id).toBe(staged.id);

    // Staging changes nothing on the governed target.
    const untouched = await (await request.get(`${base}/knowledge-base/documents/${target.id}`)).json();
    expect(untouched).toMatchObject({ contentText: "Base manual body", editRevision: target.editRevision, status: "draft" });
    const listed = await (await request.get(`${base}/knowledge-base/document-proposals`)).json();
    expect(listed.list.some((task: { id: string }) => task.id === staged.id)).toBe(true);
    expect((await request.get(`${base}/knowledge-base/document-proposals/${staged.id}`)).status()).toBe(200);
    expect((await request.get(`/api/projects/${randomUUID()}/knowledge-base/document-proposals/${staged.id}`, { failOnStatusCode: false })).status()).toBe(404);

    // A machine identity may stage, but only a human session may decide.
    const tokenApply = await machine.post(`${base}/knowledge-base/document-proposals/${staged.id}/apply`, {
      data: { expectedProposalRevision: staged.proposalRevision }, failOnStatusCode: false,
    });
    expect(tokenApply.status()).toBe(403);
    expect((await tokenApply.json()).code).toBe("HUMAN_REVIEW_REQUIRED");
    const staleDecision = await request.post(`${base}/knowledge-base/document-proposals/${staged.id}/apply`, {
      data: { expectedProposalRevision: "0".repeat(64) }, failOnStatusCode: false,
    });
    expect(staleDecision.status()).toBe(409);
    expect((await staleDecision.json()).code).toBe("PROPOSAL_REVIEW_CONFLICT");

    const appliedResponse = await request.post(`${base}/knowledge-base/document-proposals/${staged.id}/apply`, {
      data: { expectedProposalRevision: staged.proposalRevision }, failOnStatusCode: false,
    });
    expect(appliedResponse.status(), await appliedResponse.text()).toBe(201);
    const applied = await appliedResponse.json();
    expect(applied.receipt.document).toMatchObject({ documentId: target.id, status: "draft", operation: "update" });
    expect(applied.receipt.proposalRevision).toBe(staged.proposalRevision);
    const readback = await (await request.get(`${base}/knowledge-base/documents/${target.id}`)).json();
    expect(readback).toMatchObject({ contentText: "Revised manual body", status: "draft", reviewedVersionId: null });
    expect(readback.governedMetadata).toMatchObject({ confidentiality: "confidential" });
    // Omitted representations are not nulled: the rich body the agent did not propose survives.
    expect(readback.contentHtml).toBe("<p>Base manual body</p>");
    expect(readback.contentJson).toEqual({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Base manual body" }] }] });
    const replayApply = await request.post(`${base}/knowledge-base/document-proposals/${staged.id}/apply`, {
      data: { expectedProposalRevision: staged.proposalRevision }, failOnStatusCode: false,
    });
    expect(replayApply.status()).toBe(201);
    const replayReceipt = await replayApply.json();
    expect(replayReceipt.replayed).toBe(true);
    expect(replayReceipt.receipt.document.documentId).toBe(target.id);
    const rejectedAfterApply = await request.post(`${base}/knowledge-base/document-proposals/${staged.id}/reject`, {
      data: { expectedProposalRevision: staged.proposalRevision, reason: "Too late" }, failOnStatusCode: false,
    });
    expect(rejectedAfterApply.status()).toBe(409);

    // Rejection is bound to the exact reviewed revision; a changed expectation cannot close a
    // different candidate, and the same decision replays its own receipt.
    const current = await (await request.get(`${base}/knowledge-base/documents/${target.id}`)).json();
    const secondPayload = {
      requestKey: randomUUID(), operation: "update", documentId: target.id, expectedRevision: current.editRevision,
      document: { title: current.title, contentText: "Rejected manual body", governedMetadata: current.governedMetadata },
      reason: "Second candidate",
    };
    const secondResponse = await machine.post(`${base}/knowledge-base/document-proposals`, { data: secondPayload, failOnStatusCode: false });
    expect(secondResponse.status(), await secondResponse.text()).toBe(201);
    const second = await secondResponse.json();
    taskIds.push(second.id);
    const wrongReject = await request.post(`${base}/knowledge-base/document-proposals/${second.id}/reject`, {
      data: { expectedProposalRevision: "f".repeat(64) }, failOnStatusCode: false,
    });
    expect(wrongReject.status()).toBe(409);
    const reject = () => request.post(`${base}/knowledge-base/document-proposals/${second.id}/reject`, {
      data: { expectedProposalRevision: second.proposalRevision, reason: "Not needed" }, failOnStatusCode: false,
    });
    const rejectedResponse = await reject();
    expect(rejectedResponse.status(), await rejectedResponse.text()).toBe(201);
    const rejected = await rejectedResponse.json();
    expect(rejected.receipt).toMatchObject({ action: "managed_document_reject", proposalRevision: second.proposalRevision });
    expect(await (await reject()).json()).toMatchObject({ replayed: true, receipt: { id: rejected.receipt.id } });
    expect((await (await request.get(`${base}/knowledge-base/documents/${target.id}`)).json()).contentText).toBe("Revised manual body");

    // A candidate that proposes exactly the current state records no change instead of claiming a
    // new Draft revision.
    const latest = await (await request.get(`${base}/knowledge-base/documents/${target.id}`)).json();
    const noChangeResponse = await machine.post(`${base}/knowledge-base/document-proposals`, {
      data: {
        requestKey: randomUUID(), operation: "update", documentId: target.id, expectedRevision: latest.editRevision,
        document: {
          title: latest.title, contentText: latest.contentText, contentHtml: latest.contentHtml,
          contentJson: latest.contentJson, governedMetadata: latest.governedMetadata,
        },
      }, failOnStatusCode: false,
    });
    expect(noChangeResponse.status(), await noChangeResponse.text()).toBe(201);
    const noChange = await noChangeResponse.json();
    taskIds.push(noChange.id);
    const noChangeApply = await request.post(`${base}/knowledge-base/document-proposals/${noChange.id}/apply`, {
      data: { expectedProposalRevision: noChange.proposalRevision }, failOnStatusCode: false,
    });
    expect(noChangeApply.status(), await noChangeApply.text()).toBe(201);
    expect((await noChangeApply.json()).receipt.document).toMatchObject({ operation: "no_change", status: "draft" });
    // edit_revision is a computed digest, not a column: read it back through the API.
    const afterNoChange = await (await request.get(`${base}/knowledge-base/documents/${target.id}`)).json();
    expect(afterNoChange).toMatchObject({ editRevision: latest.editRevision, contentText: latest.contentText });
  } finally {
    await machine?.dispose();
    for (const id of taskIds) exec(`DELETE FROM ai_generation_requests WHERE id=${literal(id)} AND project_id=${literal(ctx.projectId)};`);
    if (tokenId) await request.delete(`${base}/apikeys/${tokenId}`, { failOnStatusCode: false });
    if (documentId) {
      exec(`UPDATE knowledge_documents SET reviewed_version_id=NULL WHERE id=${literal(documentId)};`);
      exec(`DELETE FROM knowledge_documents WHERE id=${literal(documentId)} AND project_id=${literal(ctx.projectId)};`);
    }
    for (const id of skillDocs) {
      exec(`DELETE FROM skill_assignments WHERE project_id=${literal(ctx.projectId)} AND skill_document_id=${literal(id)};`);
      exec(`UPDATE knowledge_documents SET reviewed_version_id=NULL WHERE id=${literal(id)} AND project_id=${literal(ctx.projectId)};`);
      exec(`DELETE FROM knowledge_documents WHERE id=${literal(id)} AND project_id=${literal(ctx.projectId)};`);
    }
  }
});
