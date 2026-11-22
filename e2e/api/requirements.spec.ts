import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { expect, request as newRequest, test, type APIRequestContext } from "@playwright/test";
import { env } from "../utils/env";
import { issueMcpTestToken } from "../utils/mcp-access";
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

test("governed skills allow protected publication, exact approval and separate coverage readings", async ({ request }) => {
  const suffix = Date.now();
  const skillDocs: string[] = [];
  const taskIds: string[] = [];
  const cycleIds: string[] = [];
  let requirementId = "";
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
    const operations = [
      { opType: "requirement_revision", operationId: requirementOperationId, title, description: "Published through the governed path.", criteria: [{ key: "AC-1", text: "The obligation is observable" }, { key: "AC-2", text: "The second obligation is observable" }] },
      { opType: "testcase_create", operationId: testcaseOperationId, draft: { title: caseTitle, description: "Candidate case for the governed requirement." } },
      { opType: "requirement_case_link", operationId: randomUUID(), requirementOperationId, testcaseOperationId, criterionKeys: ["AC-1"] },
    ];
    const stagedResponse = await stageRest(request, operations);
    expect(stagedResponse.status(), await stagedResponse.text()).toBe(201);
    const staged = await stagedResponse.json();
    taskIds.push(staged.id);
    expect(staged.skillContext).toMatchObject({ status: "resolved" });
    expect(staged.skillContext.assignments).toHaveLength(3);

    const appliedResponse = await request.post(`${base}/requirements/proposals/${staged.id}/apply`, {
      data: { expectedProposalRevision: staged.proposalRevision }
    });
    expect(appliedResponse.ok(), await appliedResponse.text()).toBe(true);
    const applied = await appliedResponse.json();
    requirementId = applied.receipt.requirement.documentId;
    const requirementVersionId = applied.receipt.requirement.versionId as string;
    const caseId = applied.receipt.testcase.id as string;

    const coverage = async () => (await request.get(`${base}/requirements/${requirementId}/coverage`)).json();
    let readings = await coverage();
    expect(readings.readings).toMatchObject({ authored: true, approved: false, executed: false, passing: false });
    expect(scalar(`SELECT COUNT(*)::int FROM testcases WHERE project_id=${literal(ctx.projectId)} AND title=${literal(caseTitle)};`)).toBe("1");
    expect(scalar(`SELECT COUNT(*)::int FROM requirement_case_links WHERE requirement_id=${literal(requirementId)} AND state='active';`)).toBe("1");

    const approvedRequirement = await request.post(`${base}/requirements/${requirementId}/approve`, { data: { versionId: requirementVersionId } });
    expect(approvedRequirement.ok(), await approvedRequirement.text()).toBe(true);
    expect((await approvedRequirement.json()).approvedVersionId).toBeTruthy();

    const caseBefore = await (await request.get(`${base}/testcases/${caseId}`)).json();
    const approvedCase = await request.post(`${base}/testcases/${caseId}/approve`, {
      data: { expectedRevision: caseBefore.editRevision, expectedApprovalRevision: caseBefore.approvalRevision }
    });
    expect(approvedCase.ok(), await approvedCase.text()).toBe(true);
    const caseAfter = await (await request.get(`${base}/testcases/${caseId}`)).json();

    readings = await coverage();
    const approvedLink = (readings.cases as Array<Record<string, any>>).find((item) => item.requirementVersionId === readings.approvedVersionId) || readings.cases[0];
    const reapplied = await request.post(`${base}/requirements/${requirementId}/links/${approvedLink.linkId}/reapply`, {
      data: { expectedCaseRevision: caseAfter.editRevision, expectedApprovalRevision: caseAfter.approvalRevision }
    });
    expect(reapplied.ok(), await reapplied.text()).toBe(true);
    readings = await coverage();
    expect(readings.readings).toMatchObject({ authored: true, approved: true, executed: false, passing: false });

    // Fixture setup only: the human publication/approval decisions above were API calls. The
    // persisted attempt is created in the native Run/execution tables so the coverage reader is
    // exercised against real evidence, not a stubbed payload.
    const attempt = async (status: string, at: string) => {
      const runId = scalar(`INSERT INTO cycles(project_id,name) VALUES (${literal(ctx.projectId)},${literal(`E2E coverage ${status} ${suffix}`)}) RETURNING id;`);
      cycleIds.push(runId);
      const itemId = scalar(`INSERT INTO cycle_items(cycle_id,testcase_id,snapshot_approval_revision) VALUES (${literal(runId)},${literal(caseId)},${literal(caseAfter.approvalRevision)}) RETURNING id;`);
      exec(`INSERT INTO executions(cycle_item_id,status,executed_by,executed_at)
            SELECT ${literal(itemId)},${literal(status)},pm.user_id,${literal(at)}::timestamptz
              FROM project_members pm WHERE pm.project_id=${literal(ctx.projectId)}
             ORDER BY CASE pm.role WHEN 'owner' THEN 0 ELSE 1 END, pm.user_id LIMIT 1;`);
    };
    await attempt("Passed", new Date().toISOString());
    readings = await coverage();
    expect(readings.readings).toMatchObject({ approved: true, executed: true, passing: true, mixed: false });

    await attempt("Failed", new Date(Date.now() + 1000).toISOString());
    readings = await coverage();
    expect(readings.readings).toMatchObject({ executed: true, passing: false, mixed: true });
    expect(readings.cases[0].latestAttempt.status).toBe("Failed");
  } finally {
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
