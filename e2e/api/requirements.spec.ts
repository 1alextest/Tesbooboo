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
    expect(staged.skillContext).toMatchObject({ status: "unavailable" });
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
    expect(overMcp).toMatchObject({ publication: "unpublished", skillContext: { status: "unavailable" } });
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
