import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { expect, test, request as newRequestContext, type APIRequestContext } from "@playwright/test";
import { env } from "../utils/env";
import { approveMcpTestClient, issueMcpTestToken } from "../utils/mcp-access";
import { approveTestcase, createApprovedTestcase } from "../utils/testcase-approval";
import { testcaseEditState } from "../utils/testcase-edit-state";
import { loginAs, provisionRbacTenant } from "../utils/rbac-tenant";
import { exec, literal, scalar } from "../utils/psql";
import { stageAndApplyMcpTestcases, testcaseUpdateProposal, type TestcaseProposalOperation } from "../utils/mcp-proposals";

const ctx = JSON.parse(fs.readFileSync(path.join(__dirname, "../.auth/context.json"), "utf-8"));
// Account B: a second, fully independent account/org/project (see global-setup.ts and
// api/authorization.spec.ts, which establishes this same fixture pair for cross-tenant checks).
const ctxB = JSON.parse(fs.readFileSync(path.join(__dirname, "../.auth/context-b.json"), "utf-8"));

async function createCase(request: import("@playwright/test").APIRequestContext, data: Record<string, unknown> = {}) {
  const res = await request.post(`/api/projects/${ctx.projectId}/testcases`, {
    data: { title: `E2E ${Date.now()}`, ...data },
  });
  return res.json();
}

async function deleteCase(request: import("@playwright/test").APIRequestContext, id: string) {
  await request.delete(`/api/projects/${ctx.projectId}/testcases/${id}`, { failOnStatusCode: false });
}

async function createSuiteRest(request: import("@playwright/test").APIRequestContext, data: Record<string, unknown> = {}) {
  const res = await request.post(`/api/projects/${ctx.projectId}/suites`, {
    data: { name: `E2E Suite ${Date.now()}`, ...data },
  });
  return res.json();
}

async function deleteSuiteRest(request: import("@playwright/test").APIRequestContext, id: string) {
  await request.delete(`/api/suites/${id}`, { failOnStatusCode: false });
}

async function createBugRest(request: import("@playwright/test").APIRequestContext, data: Record<string, unknown> = {}) {
  const res = await request.post(`/api/projects/${ctx.projectId}/bugs`, {
    data: { title: `E2E Bug ${Date.now()}`, ...data },
  });
  return res.json();
}

async function deleteBugRest(request: import("@playwright/test").APIRequestContext, id: string) {
  await request.delete(`/api/bugs/${id}`, { failOnStatusCode: false });
}

async function createPlanRest(request: import("@playwright/test").APIRequestContext, data: Record<string, unknown> = {}) {
  const res = await request.post(`/api/projects/${ctx.projectId}/plans`, {
    data: { name: `E2E Plan ${Date.now()}`, ...data },
  });
  return res.json();
}

async function deletePlanRest(request: import("@playwright/test").APIRequestContext, id: string) {
  await request.delete(`/api/plans/${id}`, { failOnStatusCode: false });
}

async function createCycleRest(request: import("@playwright/test").APIRequestContext, data: Record<string, unknown> = {}) {
  const res = await request.post(`/api/projects/${ctx.projectId}/cycles`, {
    data: { name: `E2E Cycle ${Date.now()}`, ...data },
  });
  return res.json();
}

async function deleteCycleRest(request: import("@playwright/test").APIRequestContext, id: string) {
  await request.delete(`/api/cycles/${id}`, { failOnStatusCode: false });
}

async function addCycleTestCaseRest(request: import("@playwright/test").APIRequestContext, cycleId: string, testcaseId: string) {
  await approveTestcase(request, ctx.projectId, testcaseId);
  const attached = await request.post(`/api/cycles/${cycleId}/testcases`, { data: { testcaseId } });
  expect(attached.ok(), await attached.text()).toBeTruthy();
}

async function getCycleExecutionsRest(request: import("@playwright/test").APIRequestContext, cycleId: string) {
  const res = await request.get(`/api/cycles/${cycleId}/executions`);
  return res.json();
}

async function getKbRootFolderId(request: import("@playwright/test").APIRequestContext, projectId: string = ctx.projectId) {
  const res = await request.get(`/api/projects/${projectId}/knowledge-base/folders/tree`);
  return (await res.json()).id as string;
}

async function createKbDocumentRest(
  request: import("@playwright/test").APIRequestContext,
  folderId: string,
  data: Record<string, unknown> = {},
) {
  const res = await request.post(`/api/projects/${ctx.projectId}/knowledge-base/documents`, {
    data: { title: `E2E KB Doc ${Date.now()}`, folderId, ...data },
  });
  return res.json();
}

async function deleteKbDocumentRest(request: import("@playwright/test").APIRequestContext, id: string) {
  await request.delete(`/api/projects/${ctx.projectId}/knowledge-base/documents/${id}`, { failOnStatusCode: false });
}

async function createKbFolderRest(request: import("@playwright/test").APIRequestContext, data: Record<string, unknown> = {}) {
  const res = await request.post(`/api/projects/${ctx.projectId}/knowledge-base/folders`, {
    data: { name: `E2E KB Folder ${Date.now()}`, ...data },
  });
  return res.json();
}

async function deleteKbFolderRest(request: import("@playwright/test").APIRequestContext, id: string) {
  await request.delete(`/api/projects/${ctx.projectId}/knowledge-base/folders/${id}`, { failOnStatusCode: false });
}

/**
 * Calls the MCP JSON-RPC endpoint and unwraps the tool's JSON payload from the
 * `content: [{ type: "text", text }]` envelope every tool response is wrapped in
 * (mcp.service.ts callTool).
 *
 * Takes a cookie-free APIRequestContext, not the suite's shared `request` fixture: AuthMiddleware
 * only falls back to the Authorization bearer header "when there is no valid browser session"
 * (auth.middleware.ts), and the shared fixture carries account A's session cookie from
 * global-setup.ts's storageState. Sent together, the cookie wins, req.apiToken stays null, and
 * McpController rejects the call — a real MCP client never presents a session cookie, so this
 * mirrors what one actually sends.
 */
async function callMcpTool(
  request: import("@playwright/test").APIRequestContext,
  token: string,
  toolName: string,
  args: Record<string, unknown> = {},
) {
  const res = await request.post(`/api/projects/${ctx.projectId}/mcp`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: toolName, arguments: args } },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.error).toBeUndefined();
  return JSON.parse(body.result.content[0].text);
}

/** Same call as callMcpTool, but for cases expected to fail — returns the JSON-RPC error object. */
async function callMcpToolExpectError(
  request: import("@playwright/test").APIRequestContext,
  token: string,
  toolName: string,
  args: Record<string, unknown> = {},
) {
  const res = await request.post(`/api/projects/${ctx.projectId}/mcp`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: toolName, arguments: args } },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.error).toBeDefined();
  return body.error as { code: number; message: string; data?: { code?: string; stagingAvailable?: boolean; httpStatus?: number } };
}

/** Suites are published by the real signed-in human editor; cached machine writers refuse first. */
async function publishHumanSuiteChange(
  human: APIRequestContext, machine: APIRequestContext, token: string, tool: "create_suite" | "update_suite", args: Record<string, unknown>
) {
  const before = await callMcpTool(machine, token, "list_suites");
  const denied = await callMcpToolExpectError(machine, token, tool, args);
  expect(denied.data?.code).toBe("HUMAN_PUBLICATION_REQUIRED");
  expect(await callMcpTool(machine, token, "list_suites")).toEqual(before);
  const { suiteId, ...body } = args;
  const written = tool === "create_suite"
    ? await human.post(`/api/projects/${ctx.projectId}/suites`, { data: body })
    : await human.patch(`/api/suites/${suiteId}`, { data: body });
  expect(written.ok(), await written.text()).toBeTruthy();
  const id = tool === "create_suite" ? (await written.json()).id : suiteId;
  return callMcpTool(machine, token, "get_suite", { suiteId: id });
}

/** Successful case-field regressions now exercise unpublished staging and an explicit human Save. */
async function publishReviewedCaseChange(
  human: APIRequestContext, machine: APIRequestContext, token: string, legacyTool: string, args: Record<string, unknown>,
) {
  const denied = await callMcpToolExpectError(machine, token, legacyTool, args);
  expect(denied.data).toMatchObject({ code: "HUMAN_PUBLICATION_REQUIRED", stagingAvailable: true });
  let operation: TestcaseProposalOperation;
  if (legacyTool === "create_testcase") {
    operation = { opType: "create", draft: args };
  } else {
    const { testcaseId, expectedRevision, ...supplied } = args;
    const opType = legacyTool === "archive_testcase" ? "archive" : "update";
    const fields = legacyTool === "archive_testcase" ? {} : legacyTool === "restore_testcase" ? { status: "Draft" } : supplied;
    operation = await testcaseUpdateProposal(human, ctx.projectId, String(testcaseId), fields, opType);
    if (expectedRevision !== undefined && operation.opType !== "create") operation.expectedRevision = String(expectedRevision);
  }
  const { published } = await stageAndApplyMcpTestcases(human, machine, token, ctx.projectId, [operation]);
  const id = published.testcases[0].id;
  const current = await human.get(`/api/projects/${ctx.projectId}/testcases/${id}`);
  expect(current.ok(), await current.text()).toBe(true);
  return current.json();
}

/** Batch success exposes the native human Save response, with no legacy per-item result emulation. */
async function publishReviewedOperations(
  human: APIRequestContext, machine: APIRequestContext, token: string, legacyTool: string,
  legacyArgs: Record<string, unknown>, operations: TestcaseProposalOperation[],
) {
  const denied = await callMcpToolExpectError(machine, token, legacyTool, legacyArgs);
  expect(denied.data).toMatchObject({ code: "HUMAN_PUBLICATION_REQUIRED", stagingAvailable: true });
  return (await stageAndApplyMcpTestcases(human, machine, token, ctx.projectId, operations)).published;
}

/** Validation controls first prove the cached writer is refused, then exercise the real proposal inlet. */
async function expectRejectedCaseProposal(
  human: APIRequestContext, machine: APIRequestContext, token: string, legacyTool: string, args: Record<string, unknown> = {},
) {
  const denied = await callMcpToolExpectError(machine, token, legacyTool, args);
  if (denied.code === -32002) return denied; // Scope denial remains ahead of all candidate work.
  expect(denied.data).toMatchObject({ code: "HUMAN_PUBLICATION_REQUIRED", stagingAvailable: true });
  let operation: Record<string, unknown>;
  if (legacyTool === "create_testcase") operation = { opType: "create", draft: args };
  else {
    const { testcaseId, expectedRevision, ...supplied } = args;
    let targetRevision = expectedRevision;
    if (!Object.prototype.hasOwnProperty.call(args, "expectedRevision")) {
      const current = testcaseId ? await human.get(`/api/projects/${ctx.projectId}/testcases/${testcaseId}`) : null;
      targetRevision = current?.ok() ? (await current.json()).editRevision : "0".repeat(64);
    }
    const fields = legacyTool === "archive_testcase" ? {} : legacyTool === "restore_testcase" ? { status: "Draft" } : supplied;
    operation = { opType: legacyTool === "archive_testcase" ? "archive" : "update", testcaseId, expectedRevision: targetRevision, fields };
  }
  return callMcpToolExpectError(machine, token, "stage_testcase_changes", { requestKey: `E2E refusal ${Date.now()}-${Math.random()}`, operations: [operation] });
}

test("MCP-P07 disposable proposal review lifecycle preserves project and run boundaries", async () => {
  // A separate synthetic tenant is the only allowed target. No Nesberry token,
  // production case or existing project membership is ever reused by this test.
  const tenant = await provisionRbacTenant("mcp-lifecycle");
  test.skip(!tenant, "requires direct SQL control for the disposable tenant; remote agents must be connected separately");
  const projectId = tenant!.mainProjectId;
  const owner = await loginAs(tenant!.owner);
  const machine = await newRequestContext.newContext({
    baseURL: env.apiBaseUrl, storageState: { cookies: [], origins: [] }
  });
  const title = `E2E isolated MCP lifecycle ${Date.now()}`;
  const caseUrl = (id: string) => `/api/projects/${projectId}/testcases/${id}`;
  const counts = () => ({
    runs: Number(scalar(`SELECT COUNT(*)::int FROM cycles WHERE project_id=${literal(projectId)};`)),
    executions: Number(scalar(`SELECT COUNT(*)::int FROM executions e
      JOIN cycle_items ci ON ci.id=e.cycle_item_id JOIN cycles c ON c.id=ci.cycle_id
      WHERE c.project_id=${literal(projectId)};`))
  });
  const prior = counts();
  let tokenId: string | undefined, caseId: string | undefined, modelId: string | undefined;
  try {
    const issue = await issueMcpTestToken(owner, `/api/projects/${projectId}/apikeys`, {
      data: { name: `E2E isolated MCP QA ${Date.now()}`, scopes: ["read", "write"] }
    });
    expect(issue.ok(), await issue.text()).toBeTruthy();
    const issued = await issue.json();
    tokenId = issued.id;
    const token = issued.token as string;
    const headers = { Authorization: `Bearer ${token}` };
    const rpc = async (method: string, params: Record<string, unknown> = {}, url = "/api/mcp") => {
      const res = await machine.post(url, {
        headers, data: { jsonrpc: "2.0", id: 1, method, params }
      });
      expect(res.ok(), `${method}: ${res.status()} ${await res.text()}`).toBeTruthy();
      return res.json();
    };
    const call = async (name: string, args: Record<string, unknown> = {}) => {
      const body = await rpc("tools/call", { name, arguments: args });
      expect(body.error).toBeUndefined();
      expect(body.result?.isError).toBe(false);
      return JSON.parse(body.result.content[0].text);
    };
    const rejected = async (name: string, args: Record<string, unknown> = {}) => {
      const body = await rpc("tools/call", { name, arguments: args });
      expect(body.error).toBeDefined();
      return body.error as { code: number; message: string; data?: { code?: string; stagingAvailable?: boolean } };
    };
    const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {} });
    expect(init.result.serverInfo.name).toBe("tesbo-mcp");
    const catalog = (await rpc("tools/list")).result.tools as Array<{ name: string }>;
    // Credential-visible catalog: the retired direct testcase publishers are hidden, so this is
    // fewer than the full registry even though the token has write scope.
    expect(catalog).toHaveLength(52);
    expect(new Set(catalog.map(item => item.name)).size).toBe(52);
    expect(catalog.map(item => item.name)).toContain("list_qa_graph_changes");
    expect(catalog.map(item => item.name)).toEqual(
      expect.arrayContaining([
        "create_behavior_model",
        "save_behavior_model_revision",
        "link_behavior_model_case",
        "get_behavior_model_coverage",
        "archive_behavior_model",
        "run_behavior_model",
      ]),
    );
    const foreign = await rpc("tools/list", {}, `/api/projects/${tenant!.secondProjectId}/mcp`);
    expect(foreign.error?.code).toBe(-32001); // token cannot switch project via URL

    const citation = { type: "jira_ticket", id: "E2E-123", title: "Disposable QA source ticket" };
    const createFields = {
      title, description: "Disposable QA lifecycle proof", status: "Draft",
      attachments: "Initial Notes", postconditions: "Environment unchanged",
      estimatedDuration: "45m", sourceRefs: [citation]
    };
    for (const name of ["create_testcase", "update_testcase", "archive_testcase", "restore_testcase", "duplicate_testcase",
      "bulk_create_testcases", "bulk_update_testcases", "bulk_archive_testcases", "link_requirement_to_testcase",
      "unlink_requirement_from_testcase", "clone_test_suite", "create_suite", "update_suite"]) {
      expect(catalog.map(item => item.name)).not.toContain(name);
      const denied = await rejected(name, createFields);
      expect(denied.data).toMatchObject({ code: "HUMAN_PUBLICATION_REQUIRED", stagingAvailable: true });
    }
    const created = await stageAndApplyMcpTestcases(owner, machine, token, projectId, [{ opType: "create", draft: createFields }]);
    expect(created.staged.task.proposalProvenance).toMatchObject({ kind: "api_token", tokenId, issuerId: tenant!.owner.userId });
    expect(created.staged.task.proposalProvenance.actorId).not.toBe(tenant!.owner.userId);
    expect(created.staged.task.proposalProvenance.actorId).toBeTruthy();
    expect(created.published.saveReceipt).toMatchObject({ reviewerId: tenant!.owner.userId, principalKind: "human_session" });
    caseId = created.published.testcases[0].id;
    const original = await call("get_testcase", { testcaseId: caseId });
    expect(original).toMatchObject({
      id: caseId, title, status: "Draft", attachments: "Initial Notes",
      postconditions: "Environment unchanged", estimatedDuration: "45m",
      sourceRefs: [citation]
    });
    expect(original.editRevision).toMatch(/^[a-f0-9]{64}$/);

    await stageAndApplyMcpTestcases(owner, machine, token, projectId, [{
      opType: "update", testcaseId: caseId!, expectedRevision: original.editRevision, fields: {
        attachments: "Reviewed Notes", postconditions: "All fixtures cleaned",
        estimatedDuration: "1h", sourceRefs: [{ type: "testcase", id: caseId, title: title }],
        description: "Verified by the connected machine over native MCP"
      }
    }]);
    const amended = await call("get_testcase", { testcaseId: caseId });
    expect(amended.editRevision).not.toBe(original.editRevision);
    const persisted = await owner.get(caseUrl(caseId!));
    expect(persisted.ok()).toBeTruthy();
    expect(await persisted.json()).toMatchObject({
      attachments: "Reviewed Notes", postconditions: "All fixtures cleaned",
      estimatedDuration: "1h", sourceRefs: [{ type: "testcase", id: caseId }],
      description: "Verified by the connected machine over native MCP"
    });
    // Malformed citations are refused, not silently dropped by the legacy sanitizer.
    const badRefs = await rejected("stage_testcase_changes", { requestKey: `bad-refs-${Date.now()}`, operations: [{
      opType: "update", testcaseId: caseId, expectedRevision: amended.editRevision, fields: { sourceRefs: [{ type: "nope", id: "x" }] }
    }] });
    expect(badRefs.message).toMatch(/sourceRefs/i);
    const stale = await rejected("stage_testcase_changes", { requestKey: `stale-${Date.now()}`, operations: [{
      opType: "update", testcaseId: caseId, expectedRevision: original.editRevision, fields: { attachments: "Stale overwrite" }
    }] });
    expect(stale.data?.code).toBe("PROPOSAL_TARGET_CONFLICT");
    expect(stale.message).toMatch(/changed before this proposal was staged/);
    expect((await (await owner.get(caseUrl(caseId!))).json()).attachments).toBe("Reviewed Notes");

    // Model Studio authoring runs through the same native owner as the REST routes. A mapping is an
    // accepted relationship, never coverage or execution, and archive keeps the history.
    const modelName = `E2E MCP model ${Date.now()}`;
    const draft = {
      schemaVersion: "tesbo-fsm-draft/1",
      semantics: "SEQUENTIAL_FSM",
      initialStateId: "start",
      states: [
        { id: "start", label: "Start" },
        { id: "done", label: "Done" }
      ],
      transitions: [
        { id: "finish", from: "start", to: "done", action: "Submit", expectedObservation: "Accepted" }
      ]
    };
    const createdModel = await call("create_behavior_model", { name: modelName, model: draft });
    modelId = createdModel.id;
    expect(createdModel).toMatchObject({ name: modelName });
    expect(createdModel.latestRevision).toMatchObject({ revisionNumber: 1, status: "draft" });
    const nextDraft = {
      ...draft,
      states: [...draft.states, { id: "retry", label: "Retry" }],
      transitions: [
        ...draft.transitions,
        { id: "retry_edge", from: "done", to: "start", action: "Retry", expectedObservation: "Restarts" }
      ]
    };
    const savedRevision = await call("save_behavior_model_revision", {
      modelId,
      baseRevisionId: createdModel.latestRevision.id,
      model: nextDraft
    });
    expect(savedRevision).toMatchObject({ revisionNumber: 2, parentRevisionId: createdModel.latestRevision.id });
    const staleBase = await rejected("save_behavior_model_revision", {
      modelId,
      baseRevisionId: createdModel.latestRevision.id,
      model: draft
    });
    expect(staleBase.message).toMatch(/changed since/i);
    const mapping = await call("link_behavior_model_case", {
      modelId,
      revisionId: savedRevision.id,
      testcaseId: caseId,
      elementIds: ["start"],
      testcaseRevision: amended.editRevision
    });
    expect(mapping).toMatchObject({ testcaseId: caseId, elementIds: ["start"], coverageAssertion: "none" });
    const coverage = await call("get_behavior_model_coverage", { modelId });
    expect(coverage).toMatchObject({ coverageAssertion: "none", executionAssertion: "none" });
    expect(coverage.links.map((row: { testcaseId: string }) => row.testcaseId)).toContain(caseId);

    // Governed run over MCP. The tool cannot approve — an agent cannot become its own reviewer —
    // so an unapproved revision is refused, and approval happens through the product first.
    const unapprovedRun = await rejected("run_behavior_model", { modelId, revisionId: savedRevision.id });
    expect(unapprovedRun.message).toMatch(/Approve this revision/i);
    const approveRevision = await owner.post(
      `/api/projects/${projectId}/model-studio/models/${modelId}/revisions/${savedRevision.id}/approve`,
      { data: { expectedHash: savedRevision.contentHash } }
    );
    expect(approveRevision.status(), await approveRevision.text()).toBe(201);
    const unapprovedCaseRun = await rejected("run_behavior_model", { modelId, revisionId: savedRevision.id, caseIds: [caseId] });
    expect(unapprovedCaseRun.message).toMatch(/Approve/i);
    // Approval is bound to both the edited content and the current approval basis; the fixture
    // helper reads both and performs the exact human review.
    const reviewResponse = await owner.get(caseUrl(caseId!));
    expect(reviewResponse.status(), await reviewResponse.text()).toBe(200);
    const caseReview = await reviewResponse.json();
    expect(caseReview.editRevision).toBe(amended.editRevision);
    expect(caseReview.approvalRevision).toMatch(/^[a-f0-9]{64}$/);
    const approvedCase = await approveTestcase(owner, projectId, caseId!);
    expect(approvedCase.status).toBe("Approved");
    // Recording the approval changes the case's edit revision, so the accepted mapping has to be
    // replaced—not replayed—on the approved basis before a governed run may use it.
    const unlinked = await owner.delete(`/api/projects/${projectId}/model-studio/models/${modelId}/revisions/${savedRevision.id}/links/${mapping.id}`);
    expect(unlinked.ok(), await unlinked.text()).toBeTruthy();
    const remapped = await call("link_behavior_model_case", {
      modelId, revisionId: savedRevision.id, testcaseId: caseId, elementIds: ["start"],
      testcaseRevision: approvedCase.editRevision
    });
    expect(remapped).toMatchObject({ testcaseId: caseId, testcaseRevision: approvedCase.editRevision });

    const governedRun = await call("run_behavior_model", { modelId, revisionId: savedRevision.id, caseIds: [caseId] });
    expect(governedRun).toMatchObject({
      coverageAssertion: "none",
      executionAssertion: "governed-run",
      requested: 1,
      added: 1,
      skipped: 0,
      run: { id: governedRun.cycleId }
    });
    expect(governedRun.manifest.cases[0]).toMatchObject({ testcaseId: caseId, sources: ["linked"] });
    // Remove the native run chain so the lifecycle's "no new run or execution" proof still holds.
    exec(
      `DELETE FROM executions WHERE cycle_item_id IN (SELECT id FROM cycle_items WHERE cycle_id = ${literal(governedRun.cycleId)});`
    );
    exec(`DELETE FROM cycle_items WHERE cycle_id = ${literal(governedRun.cycleId)};`);
    exec(`DELETE FROM cycles WHERE id = ${literal(governedRun.cycleId)};`);

    expect((await call("archive_behavior_model", { modelId })).ok).toBe(true);
    const archivedCoverage = await rejected("get_behavior_model_coverage", { modelId });
    expect(archivedCoverage.message).toMatch(/not found/i);

    await stageAndApplyMcpTestcases(owner, machine, token, projectId, [
      await testcaseUpdateProposal(owner, projectId, caseId!, {}, "archive")
    ]);
    expect((await call("get_testcase", { testcaseId: caseId })).status).toBe("Archived");
    expect((await call("get_testcase", { testcaseId: caseId })).postconditions).toBe("All fixtures cleaned");
    const hidden = await call("list_testcases", { search: title });
    expect(hidden.rows.some((item: { id: string }) => item.id === caseId)).toBe(false);
    const archived = await call("list_testcases", { search: title, includeArchived: true });
    expect(archived.rows.some((item: { id: string }) => item.id === caseId)).toBe(true);
    const graph = await call("list_qa_graph_changes", { limit: 10 });
    expect(Array.isArray(graph.entries)).toBe(true);
    const noSource = await rejected("capture_qa_graph_change", {});
    expect(noSource.message).toMatch(/source binding|not configured/i);
    expect(counts()).toEqual(prior); // no fake run/execution from source discovery or case edits
  } finally {
    if (modelId) exec(`DELETE FROM mbt_models WHERE id = ${literal(modelId)} AND project_id = ${literal(projectId)};`);
    if (caseId) await owner.delete(caseUrl(caseId), { failOnStatusCode: false });
    if (tokenId) await owner.delete(`/api/projects/${projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
    await machine.dispose();
    await owner.dispose();
  }
});

test("write-scoped project tokens require an owner/manager and carry explicit target identity", async () => {
  const tenant = await provisionRbacTenant("mcp-lifecycle");
  test.skip(!tenant, "requires direct SQL control for the disposable tenant");
  const projectId = tenant!.mainProjectId;
  const owner = await loginAs(tenant!.owner);
  const manager = await loginAs(tenant!.manager);
  const qa = await loginAs(tenant!.qa);
  const issued: Array<{ id: string; token: string; projectId: string; projectName: string; organizationId: string; mcpPath: string }> = [];
  const issue = async (who: APIRequestContext, scopes: string[]) => {
    const res = await who.post(`/api/projects/${projectId}/apikeys`, {
      data: { name: `E2E role gate ${Date.now()} ${Math.random().toString(36).slice(2, 8)}`, scopes }
    });
    const body = await res.json().catch(() => null);
    if (res.ok()) issued.push(body);
    return { status: res.status(), body };
  };
  try {
    const ownerWrite = await issue(owner, ["read", "write"]);
    expect(ownerWrite.status).toBe(201);
    const ownerToken = issued.at(-1)!;
    // The one-time secret names the project, workspace and MCP target explicitly.
    expect(ownerToken).toMatchObject({
      projectId,
      projectName: expect.any(String),
      organizationId: tenant!.organizationId,
      mcpPath: `/api/projects/${projectId}/mcp`
    });
    expect(ownerToken.token).toMatch(/^tsbo_/);

    expect((await issue(manager, ["read", "write"])).status).toBe(201);
    const qaWrite = await issue(qa, ["read", "write"]);
    expect(qaWrite.status).toBe(403);
    expect(JSON.stringify(qaWrite.body)).toMatch(/owners and managers/i);
    expect((await issue(qa, ["read"])).status).toBe(201);
    const qaReadToken = issued.at(-1)!;
    await approveMcpTestClient(owner, projectId, { ...qaReadToken, scopes: ["read"] });

    // The read-only token can discover the project but is refused a write at the MCP scope guard.
    const machine = await newRequestContext.newContext({ baseURL: env.apiBaseUrl, storageState: { cookies: [], origins: [] } });
    try {
      const call = async (name: string, args: Record<string, unknown>) => {
        const res = await machine.post("/api/mcp", {
          headers: { Authorization: `Bearer ${qaReadToken.token}` },
          data: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }
        });
        expect(res.ok(), `${name}: ${res.status()} ${await res.text()}`).toBeTruthy();
        return res.json();
      };
      const listed = await call("list_projects", {});
      expect(listed.result.isError).toBe(false);
      expect(JSON.parse(listed.result.content[0].text).projects.map((p: { id: string }) => p.id)).toEqual([projectId]);
      const denied = await call("create_testcase", { title: "Read token must not write" });
      expect(denied.error?.code).toBe(-32002);
    } finally {
      await machine.dispose();
    }

    // A member cannot disable the owner's write credential; the owner can.
    expect((await qa.delete(`/api/projects/${projectId}/apikeys/${ownerToken.id}`)).status()).toBe(403);
    expect((await owner.delete(`/api/projects/${projectId}/apikeys/${ownerToken.id}`)).ok()).toBeTruthy();
    issued.splice(issued.indexOf(ownerToken), 1);
  } finally {
    for (const token of issued) await owner.delete(`/api/projects/${projectId}/apikeys/${token.id}`, { failOnStatusCode: false });
    await Promise.all([owner.dispose(), manager.dispose(), qa.dispose()]);
  }
});

test("MCP-P07 revision preconditions refuse stale and malformed edits without overwriting human Notes", async ({ request }) => {
  const created = await createCase(request, { attachments: "Original Notes" });
  const url = `/api/projects/${ctx.projectId}/testcases/${created.id}`;
  const mcp = await newRequestContext.newContext({ baseURL: env.apiBaseUrl, storageState: { cookies: [], origins: [] } });
  let tokenId: string | undefined;
  try {
    const response = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
      data: { name: `E2E edit revision ${Date.now()}`, scopes: ["read", "write"] }
    });
    expect(response.ok()).toBeTruthy();
    const issued = await response.json();
    tokenId = issued.id;
    const initial = await callMcpTool(mcp, issued.token, "get_testcase", { testcaseId: created.id });
    expect(initial.editRevision).toMatch(/^[a-f0-9]{64}$/);
    expect((await request.put(url, { data: { attachments: "Human edited Notes" } })).ok()).toBeTruthy();
    const committed = await (await request.get(url)).json();
    const stale = await expectRejectedCaseProposal(request, mcp, issued.token, "update_testcase", {
      testcaseId: created.id, expectedRevision: initial.editRevision, attachments: "Stale machine Notes"
    });
    expect(stale.message).toMatch(/changed before this proposal was staged/);
    expect(testcaseEditState(await (await request.get(url)).json())).toEqual(testcaseEditState(committed));
    for (const expectedRevision of [null, "", 7, true, [], {}]) {
      const invalid = await expectRejectedCaseProposal(request, mcp, issued.token, "update_testcase", {
        testcaseId: created.id, expectedRevision, title: "Must not change"
      });
      expect(invalid.message).toContain("expectedRevision");
      expect(testcaseEditState(await (await request.get(url)).json())).toEqual(testcaseEditState(committed));
    }
    const saved = await publishReviewedCaseChange(request, mcp, issued.token, "update_testcase", {
      testcaseId: created.id, expectedRevision: committed.editRevision, description: "Reviewed update"
    });
    expect(saved.attachments).toBe("Human edited Notes");
    expect(saved.description).toBe("Reviewed update");
    expect(saved.editRevision).not.toBe(committed.editRevision);
  } finally {
    await deleteCase(request, created.id);
    if (tokenId) await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
    await mcp.dispose();
  }
});

test("MCP-P07 postconditions preserve omission, clear explicitly and refuse invalid types", async ({ request }) => {
  const created = await createCase(request, { postconditions: "Initial final state" });
  const url = `/api/projects/${ctx.projectId}/testcases/${created.id}`;
  const mcp = await newRequestContext.newContext({ baseURL: env.apiBaseUrl, storageState: { cookies: [], origins: [] } });
  let tokenId: string | undefined;
  try {
    const response = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
      data: { name: `E2E postconditions ${Date.now()}`, scopes: ["read", "write"] }
    });
    expect(response.ok()).toBeTruthy();
    const issued = await response.json();
    tokenId = issued.id;

    const initial = await callMcpTool(mcp, issued.token, "get_testcase", { testcaseId: created.id });
    expect(initial.postconditions).toBe("Initial final state");

    // Omission preserves the stored value; an unrelated edit must not clear it.
    const omitted = await publishReviewedCaseChange(request, mcp, issued.token, "update_testcase", {
      testcaseId: created.id, description: "Unrelated edit", expectedRevision: initial.editRevision
    });
    expect(omitted.postconditions).toBe("Initial final state");

    // "" is the explicit clear; null is not.
    const cleared = await publishReviewedCaseChange(request, mcp, issued.token, "update_testcase", {
      testcaseId: created.id, postconditions: "", expectedRevision: omitted.editRevision
    });
    expect(cleared.postconditions).toBe("");

    for (const postconditions of [null, 8, true, [], {}]) {
      const invalid = await expectRejectedCaseProposal(request, mcp, issued.token, "update_testcase", {
        testcaseId: created.id, postconditions, expectedRevision: cleared.editRevision
      });
      expect(invalid.message).toMatch(/postconditions/i);
    }
    expect((await (await request.get(url)).json()).postconditions).toBe("");
  } finally {
    await deleteCase(request, created.id);
    if (tokenId) await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
    await mcp.dispose();
  }
});

test.describe("MCP initialize", () => {
  test("advertises top-level instructions orienting a client to the whole server", async ({ request }) => {
    let tokenId: string | undefined;
    // Same reasoning as callMcpTool: a cookie-free context, since a real MCP client never sends
    // account A's browser session cookie alongside its bearer token.
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP token ${Date.now()}`, scopes: ["read"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const res = await mcpApi.post(`/api/projects/${ctx.projectId}/mcp`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { jsonrpc: "2.0", id: 1, method: "initialize" },
      });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.error).toBeUndefined();
      // A non-trivial paragraph, not just present-but-empty — this is what a client is expected to
      // surface to its model as a session-level hint, per the MCP spec's `instructions` field.
      expect(typeof body.result.instructions).toBe("string");
      expect(body.result.instructions.length).toBeGreaterThan(100);
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      await mcpApi.dispose();
    }
  });
});

/*
 * "[MCP] Ensure MCP changes are automatically picked up by Dev/Stage clients".
 *
 * Stage was already running the severity fix (its /health gitSha matched origin/dev). What went
 * stale was the client: MCP clients fetch tools/list once per session and keep it, the server told
 * them the list never changes (listChanged: false), it reported the same serverInfo.version on
 * every build, and a blue/green deploy swaps the process behind the same URL without breaking a
 * single request — so a client connected before the deploy kept the old free-text `severity` schema
 * until someone restarted it.
 *
 * The fix is Streamable HTTP's own session mechanism: initialize issues an Mcp-Session-Id bound to
 * a fingerprint of the tool set, and a request carrying an id from a different fingerprint gets 404,
 * which the spec requires a client to answer by re-initializing. A different build is simulated
 * here by a session id with another fingerprint prefix — exactly what a pre-deploy client holds.
 */
test.describe("MCP sessions keep a client's tool list current across deploys", () => {
  const STALE_SESSION = "0000000000000000.11111111-2222-4333-8444-555555555555";

  type Rpc = { status: number; headers: Record<string, string>; body: any };

  async function withToken(
    request: APIRequestContext,
    scopes: string[],
    fn: (mcpApi: APIRequestContext, token: string, createdIds: string[]) => Promise<void>,
  ) {
    // Cookie-free for the same reason as callMcpTool: a real MCP client never sends a browser session.
    const mcpApi = await newRequestContext.newContext({ baseURL: env.apiBaseUrl, storageState: { cookies: [], origins: [] } });
    const createdIds: string[] = [];
    let tokenId: string | undefined;
    try {
      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP session token ${Date.now()}`, scopes },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      await fn(mcpApi, tokenBody.token as string, createdIds);
    } finally {
      for (const id of createdIds) await deleteCase(request, id);
      if (tokenId) await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      await mcpApi.dispose();
    }
  }

  /** One raw JSON-RPC POST to the dynamic endpoint, with an optional session id. */
  async function rpc(api: APIRequestContext, token: string, body: Record<string, unknown>, session?: string): Promise<Rpc> {
    const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: "application/json, text/event-stream" };
    if (session) headers["Mcp-Session-Id"] = session;
    const res = await api.post("/api/mcp", { headers, data: { jsonrpc: "2.0", ...body }, failOnStatusCode: false });
    const text = await res.text();
    return { status: res.status(), headers: res.headers(), body: text ? JSON.parse(text) : null };
  }

  async function initialize(api: APIRequestContext, token: string, session?: string): Promise<Rpc> {
    return rpc(api, token, { id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "e2e", version: "1" } } }, session);
  }

  test("initialize issues a session id and reports the build it is connected to", async ({ request }) => {
    await withToken(request, ["read"], async (api, token) => {
      const init = await initialize(api, token);
      expect(init.status).toBeLessThan(300);
      expect(init.body.error).toBeUndefined();
      expect(init.body.result.protocolVersion, "a supported client version is echoed back").toBe("2025-06-18");
      const session = init.headers["mcp-session-id"];
      expect(session, "initialize must hand the client a session id").toMatch(/^[0-9a-f]{16}\.[0-9a-f-]{36}$/);

      // serverInfo.version names the same deploy /health does — the check a person runs to see
      // which build their client is actually talking to.
      const health = await (await api.get("/health")).json();
      expect(init.body.result.serverInfo.version).toBe(`0.1.0+${health.gitSha}.${session.split(".")[0]}`);

      const second = await initialize(api, token);
      expect(second.headers["mcp-session-id"], "every initialize gets its own id").not.toBe(session);
    });
  });

  test("MCP-P07 current session discovery exposes the exact proposal schema and scoped fingerprint", async ({ request }) => {
    await withToken(request, ["read", "write"], async (api, token) => {
      const init = await initialize(api, token);
      const session = init.headers["mcp-session-id"];
      const list = await rpc(api, token, { id: 2, method: "tools/list" }, session);
      expect(list.status).toBeLessThan(300);
      type Schema = { type?: string; enum?: string[]; required?: string[]; properties?: Record<string, Schema>;
        items?: { oneOf?: Schema[] } };
      const tools = list.body.result.tools as Array<{ name: string; inputSchema: Schema }>;
      const names = tools.map(t => t.name);
      // This test runs only in the explicitly enabled isolated preview profile. Counts are the
      // credential-visible catalog: retired direct publishers are hidden, and the governed-run
      // tool from the Model Studio work is visible to a write token.
      expect(names, "freshly initialized deployed preview catalog").toHaveLength(52);
      expect(new Set(names).size, "MCP names must be unique").toBe(52);
      expect(names).toEqual(expect.arrayContaining([
        "list_qa_graph_changes", "capture_qa_graph_change", "preview_behavior_model_draft", "create_behavior_model",
        "save_behavior_model_revision", "link_behavior_model_case", "get_behavior_model_coverage", "archive_behavior_model",
        "run_behavior_model",
        "stage_testcase_changes", "list_testcase_proposals", "get_testcase_proposal_task"
      ]));
      for (const name of ["create_testcase", "update_testcase", "archive_testcase", "restore_testcase", "duplicate_testcase",
        "bulk_create_testcases", "bulk_update_testcases", "bulk_archive_testcases", "link_requirement_to_testcase",
        "unlink_requirement_from_testcase", "clone_test_suite", "create_suite", "update_suite"]) expect(names).not.toContain(name);
      const operations = tools.find(t => t.name === "stage_testcase_changes")?.inputSchema.properties?.operations.items?.oneOf;
      const create = operations?.[0].properties?.draft.properties;
      const update = operations?.[1].properties?.fields.properties;
      expect(create?.severity?.enum, "current severity vocabulary").toEqual(["Critical", "High", "Medium", "Low"]);
      for (const fields of [create, update]) {
        for (const field of ["postconditions", "attachments", "estimatedDuration"]) expect(fields?.[field]?.type).toBe("string");
        expect(fields?.sourceRefs?.type).toBe("array");
      }
      expect(operations?.[1].required).toContain("expectedRevision");
      expect(operations?.[1].properties?.expectedRevision?.type).toBe("string");
      const fingerprint = createHash("sha256").update(JSON.stringify({ tools, instructions: init.body.result.instructions })).digest("hex").slice(0, 16);
      expect(String(init.body.result.serverInfo.version).split(".").at(-1)).toBe(fingerprint);
      expect(session).toMatch(new RegExp("^" + fingerprint + "\\."));
    });
  });

  test("MCP-P07 a stale session runs nothing and reinitializing enables reviewed staging", async ({ request }) => {
    await withToken(request, ["read", "write"], async (api, token, createdIds) => {
      const listed = await rpc(api, token, { id: 2, method: "tools/list" }, STALE_SESSION);
      expect(listed.status, "the spec's signal to re-initialize").toBe(404);
      expect(listed.body.error.code).toBe(-32004);
      expect(listed.body.id).toBe(2);

      // A stale client's tools/call must not run against the new code with the old schema's
      // arguments — that is the path that produced "severity not saved".
      const title = `E2E MCP stale session ${Date.now()}`;
      const called = await rpc(api, token, { id: 3, method: "tools/call", params: { name: "create_testcase", arguments: { title, severity: "Major" } } }, STALE_SESSION);
      expect(called.status).toBe(404);
      const found = await request.get(`/api/projects/${ctx.projectId}/testcases?search=${encodeURIComponent(title)}`);
      expect(JSON.stringify(await found.json()), "a rejected stale call must create nothing").not.toContain(title);

      // Recovery exactly as a client does it: initialize (it may still send the stale header),
      // then carry on with the new id.
      const init = await initialize(api, token, STALE_SESSION);
      expect(init.status).toBeLessThan(300);
      const fresh = init.headers["mcp-session-id"];
      expect(fresh).toBeTruthy();
      expect(fresh).not.toBe(STALE_SESSION);

      const staged = await rpc(api, token, { id: 4, method: "tools/call", params: {
        name: "stage_testcase_changes", arguments: { requestKey: `recovered-${Date.now()}`, operations: [
          { opType: "create", draft: { title, severity: "high" } }
        ] }
      } }, fresh);
      expect(staged.status).toBeLessThan(300);
      expect(staged.body.error).toBeUndefined();
      const proposal = JSON.parse(staged.body.result.content[0].text);
      expect(proposal.publication).toBe("unpublished");
      const unchanged = await request.get(`/api/projects/${ctx.projectId}/testcases?search=${encodeURIComponent(title)}`);
      expect(JSON.stringify(await unchanged.json())).not.toContain(title);
      const taskUrl = `/api/projects/${ctx.projectId}/agents/zyra/tasks/${proposal.taskId}`;
      const reviewed = await request.get(taskUrl);
      expect(reviewed.ok(), await reviewed.text()).toBe(true);
      const revision = (await reviewed.json()).proposalRevision;
      const applied = await request.post(`${taskUrl}/save`, { data: { expectedProposalRevision: revision, selectedDraftIndexes: [0] } });
      expect(applied.ok(), await applied.text()).toBe(true);
      const saved = await applied.json();
      expect(saved.saveReceipt.principalKind).toBe("human_session");
      createdIds.push(saved.testcases[0].id);
      const stored = await (await request.get(`/api/projects/${ctx.projectId}/testcases/${saved.testcases[0].id}`)).json();
      expect(stored.severity, "severity is canonicalized and persisted only after human Save").toBe("High");
    });
  });

  test("MCP-P07 modern 2026 stateless clients receive an explicit version refusal without changing legacy MCP", async ({ request }) => {
    await withToken(request, ["read"], async (api, token) => {
      for (const url of ["/api/mcp", `/api/projects/${ctx.projectId}/mcp`]) {
        const payload = {
          jsonrpc: "2.0", id: 101, method: "server/discover",
          params: { _meta: {
            "io.modelcontextprotocol/protocolVersion": "2026-07-28",
            "io.modelcontextprotocol/clientCapabilities": {}
          } }
        };
        const modern = await api.post(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            "MCP-Protocol-Version": "2026-07-28",
            "Mcp-Method": "server/discover",
            Accept: "application/json"
          },
          data: payload, failOnStatusCode: false
        });
        expect(modern.status(), "legacy server must not pretend to speak stateless MCP").toBe(400);
        expect(await modern.json()).toEqual({
          jsonrpc: "2.0", id: 101,
          error: { code: -32022, message: "Unsupported protocol version",
            data: { supported: ["2025-06-18", "2024-11-05"], requested: "2026-07-28" } }
        });
        const modernList = await api.post(url, {
          headers: { Authorization: `Bearer ${token}`, "MCP-Protocol-Version": "2026-07-28" },
          data: { ...payload, id: 102, method: "tools/list" }, failOnStatusCode: false
        });
        expect(modernList.status()).toBe(400);
        expect((await modernList.json()).error.code).toBe(-32022);

        // The same token still uses the existing approved legacy method, with
        // unchanged HTTP status and catalog authorization. No new OAuth grant.
        const legacy = await api.post(url, {
          headers: { Authorization: `Bearer ${token}` },
          data: { jsonrpc: "2.0", id: 103, method: "tools/list" },
          failOnStatusCode: false
        });
        expect(legacy.status()).toBe(201);
        const listed = await legacy.json();
        expect(listed.error).toBeUndefined();
        expect(listed.result.tools.length).toBeGreaterThan(0);
      }
    });
  });

  test("a client that never sends a session id is served exactly as before", async ({ request }) => {
    await withToken(request, ["read"], async (api, token) => {
      const list = await rpc(api, token, { id: 1, method: "tools/list" });
      expect(list.status).toBe(201);
      expect(list.body.result.tools.length).toBeGreaterThan(10);
      // A client that names no protocol version keeps getting the long-standing default.
      const init = await rpc(api, token, { id: 2, method: "initialize" });
      expect(init.body.result.protocolVersion).toBe("2024-11-05");
    });
  });

  test("notifications get 202 with no body; GET and DELETE get 405", async ({ request }) => {
    await withToken(request, ["read"], async (api, token) => {
      const session = (await initialize(api, token)).headers["mcp-session-id"];
      const note = await rpc(api, token, { method: "notifications/initialized" }, session);
      expect(note.status).toBe(202);
      expect(note.body).toBeNull();

      for (const path of ["/api/mcp", `/api/projects/${ctx.projectId}/mcp`]) {
        const get = await api.get(path, { headers: { Authorization: `Bearer ${token}` }, failOnStatusCode: false });
        expect(get.status(), `GET ${path}`).toBe(405);
        expect(get.headers()["allow"]).toBe("POST");
        const del = await api.delete(path, { headers: { Authorization: `Bearer ${token}`, "Mcp-Session-Id": session }, failOnStatusCode: false });
        expect(del.status(), `DELETE ${path}`).toBe(405);
      }
    });
  });

  test("a session id is not a credential: unauthenticated calls are refused, and it never crosses projects", async ({ request }) => {
    await withToken(request, ["read"], async (api, token) => {
      const session = (await initialize(api, token)).headers["mcp-session-id"];

      const anon = await api.post("/api/mcp", { headers: { "Mcp-Session-Id": session }, data: { jsonrpc: "2.0", id: 1, method: "tools/list" }, failOnStatusCode: false });
      expect(anon.status(), "a session id without a token").toBe(401);
      const anonGet = await api.get("/api/mcp", { failOnStatusCode: false });
      expect(anonGet.status(), "GET without a token is refused before the 405").toBe(401);

      // Account B's token presenting account A's session id acts in B's project only — the token
      // alone decides the project.
      const asB = await newRequestContext.newContext({ baseURL: env.apiBaseUrl, storageState: path.join(__dirname, "../.auth/state-b.json") });
      let bTokenId: string | undefined;
      let aCaseId: string | undefined;
      try {
        const aCase = await createCase(request, { title: `E2E MCP session A-only ${Date.now()}` });
        aCaseId = aCase.id;
        const bTokenRes = await issueMcpTestToken(asB, `/api/projects/${ctxB.projectId}/apikeys`, { data: { name: `E2E MCP session B ${Date.now()}`, scopes: ["read"] } });
        expect(bTokenRes.ok()).toBeTruthy();
        const bToken = await bTokenRes.json();
        bTokenId = bToken.id;

        const got = await rpc(api, bToken.token, { id: 1, method: "tools/call", params: { name: "get_testcase", arguments: { testcaseId: aCaseId } } }, session);
        expect(got.body.error, "B must not read A's test case through A's session").toBeDefined();

        const aScoped = await api.post(`/api/projects/${ctx.projectId}/mcp`, {
          headers: { Authorization: `Bearer ${bToken.token}`, "Mcp-Session-Id": session },
          data: { jsonrpc: "2.0", id: 2, method: "tools/list" },
          failOnStatusCode: false,
        });
        expect((await aScoped.json()).error?.code, "B's token on A's project URL stays denied").toBe(-32001);
      } finally {
        if (aCaseId) await deleteCase(request, aCaseId);
        if (bTokenId) await asB.delete(`/api/projects/${ctxB.projectId}/apikeys/${bTokenId}`, { failOnStatusCode: false });
        await asB.dispose();
      }
    });
  });
});

test.describe("MCP list_testcases and the repository total agree on Archived cases", () => {
  test("includeArchived lets an MCP caller reach the same total the repository summary counts", async ({
    request,
  }) => {
    const title = `E2E MCP archived ${Date.now()}`;
    const created = await createCase(request, { title, status: "Archived" });
    let tokenId: string | undefined;
    // storageState must be given explicitly and empty: playwright.config.ts's top-level `use`
    // sets a default storageState (account A's session cookie) that @playwright/test's `request`
    // namespace otherwise merges into every newContext() call made during a test run — leaving it
    // unset here silently re-attaches the cookie AuthMiddleware needs this context to not have.
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP token ${Date.now()}`, scopes: ["read"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      // Same call the repository table and the REST list make: Archived is excluded by default,
      // matching legacy.service.ts's listTestCases (shared by the REST endpoint and this tool).
      const withoutArchived = await callMcpTool(mcpApi, token, "list_testcases", { search: title });
      expect(withoutArchived.total).toBe(0);
      expect(withoutArchived.rows.some((r: { id: string }) => r.id === created.id)).toBe(false);

      // includeArchived is the fix under test: previously undeclared on the tool's inputSchema, so
      // no MCP caller could ask for it and there was no way to match the repository header's total.
      const withArchived = await callMcpTool(mcpApi, token, "list_testcases", {
        search: title,
        includeArchived: true,
      });
      expect(withArchived.total).toBe(1);
      expect(withArchived.rows.some((r: { id: string }) => r.id === created.id)).toBe(true);

      // The repository summary total (the UI header tile) already counts this Archived case into its
      // "Archived" bucket — includeArchived:true is what lets an MCP caller see the same dataset.
      const summaryRes = await request.get(`/api/projects/${ctx.projectId}/reports/repository-summary`);
      expect(summaryRes.ok()).toBeTruthy();
      const summary = await summaryRes.json();
      const archivedBucket = summary.byStatus.find((s: { name: string }) => s.name === "Archived");
      expect(archivedBucket?.count ?? 0).toBeGreaterThanOrEqual(1);
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      await deleteCase(request, created.id);
      await mcpApi.dispose();
    }
  });
});

/*
 * MCP's create_testcase gives a calling LLM no schema for the shape of a step object, and unlike
 * Zyra's chat/task-board paths — which run their AI-generated steps through LegacyService's
 * safeSteps() synonym normalizer before persisting — the create path MCP and REST share
 * (insertTestCaseWithClient) stored `steps` verbatim. A step written under a plausible-but-wrong
 * key (`expected` instead of `expectedResult`, `step` instead of `action`) round-tripped through
 * the API untouched but rendered as blank Action/Expected Result text areas in the editor, which
 * only ever reads the literal `action`/`expectedResult` keys (testcases/page.tsx). Fixed by
 * normalizing create_testcase's `steps` argument through the same safeSteps() mapping before the
 * insert, mirroring Zyra.
 */
test.describe("MCP create_testcase normalizes step field synonyms", () => {
  test("a step written under synonym keys still persists with the exact action/expectedResult keys the editor reads", async ({
    request,
  }) => {
    const title = `E2E MCP Steps Synonyms ${Date.now()}`;
    let tokenId: string | undefined;
    let createdId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP Steps token ${Date.now()}`, scopes: ["write"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const created = await publishReviewedCaseChange(request, mcpApi, token, "create_testcase", {
        title,
        // Deliberately the synonym keys safeSteps() maps, not the canonical ones — the shape an
        // MCP-calling LLM guessing from an undocumented `steps: array` schema would plausibly send.
        steps: [
          { stepNumber: 1, step: "Open the login page", expected: "Login form is visible" },
          { stepNumber: 2, action: "Submit valid credentials", expectedResult: "User lands on the dashboard" },
        ],
      });
      createdId = created.id;
      expect(createdId).toBeTruthy();

      // `rawSteps` is a JSON-encoded string, not an array — the test case editor's parseSteps()
      // (testcases/page.tsx) only accepts a string for this field, so that's the corrected
      // contract create_testcase's storage now matches (see "MCP create_testcase stores steps in
      // the shape the test case editor can read" below for the regression this fixes).
      function assertNormalized(rawSteps: unknown) {
        expect(typeof rawSteps).toBe("string");
        const steps = JSON.parse(rawSteps as string) as Array<{ stepNumber: number; action: string; expectedResult: string }>;
        expect(steps).toHaveLength(2);
        const [first, second] = steps;
        expect(first.action).toBe("Open the login page");
        expect(first.expectedResult).toBe("Login form is visible");
        // A well-formed step (already using the canonical keys) must pass through unchanged —
        // normalization must not corrupt input that was already correct.
        expect(second.action).toBe("Submit valid credentials");
        expect(second.expectedResult).toBe("User lands on the dashboard");
      }

      // The tool's own response reflects the normalized shape...
      assertNormalized(created.steps);

      // ...and so does what's actually persisted, fetched back through the same REST endpoint the
      // test case editor uses — proving this isn't just an artifact of the tool's return value.
      const fetched = await request.get(`/api/projects/${ctx.projectId}/testcases/${createdId}`);
      expect(fetched.ok()).toBeTruthy();
      assertNormalized((await fetched.json()).steps);
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      if (createdId) await deleteCase(request, createdId);
      await mcpApi.dispose();
    }
  });
});

/*
 * "[Zyra] Test Steps, Actions, and Expected Results Are Missing After Saving Generated Test Cases" —
 * a Zyra/MCP-generated test case saved fine, but its steps showed as one blank Action/Expected
 * Result pair in the Test Case Repository.
 *
 * Root cause: the create/edit modal pre-stringifies `steps` into a JSON string before every save
 * (testcases/page.tsx), and the shared row writers (insertTestCaseWithClient/
 * updateTestCaseWithClient) unconditionally JSON.stringify whatever they're given — so the modal's
 * already-a-string input gets encoded a second time, landing in the jsonb column as a JSON string
 * scalar, which is exactly the one shape the modal's own parseSteps() knows how to read back. MCP's
 * create_testcase instead handed over a real array (via safeSteps()), which got encoded only once
 * and stored as a genuine jsonb array — a shape parseSteps() silently discards, substituting one
 * blank step regardless of how many steps actually exist. Fixed by pre-stringifying steps once in
 * create_testcase (mcp.tools.ts), matching what the modal already sends, without changing the modal,
 * safeSteps' synonym normalization, or anything Zyra generates.
 */
test.describe("MCP create_testcase stores steps in the shape the test case editor can read", () => {
  test("multiple steps — including quotes, backslashes and unicode — persist with the right count, order and content", async ({
    request,
  }) => {
    const title = `E2E MCP Steps Shape ${Date.now()}`;
    let tokenId: string | undefined;
    let createdId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP Steps Shape token ${Date.now()}`, scopes: ["write"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      // Deliberately more than one step (the observed bug always collapsed to exactly one) and
      // content that would break a naive re-encode: an apostrophe, a quote, a literal backslash,
      // and non-ASCII text.
      const steps = [
        { stepNumber: 1, action: `Enter O'Brien's "test" value`, expectedResult: `Rejects with a literal backslash: C:\\temp` },
        { stepNumber: 2, action: "Second step", expectedResult: "Second result" },
        { stepNumber: 3, action: "Third step with unicode: héllo 世界", expectedResult: "Renders unchanged" },
      ];
      const created = await publishReviewedCaseChange(request, mcpApi, token, "create_testcase", { title, steps });
      createdId = created.id;
      expect(createdId).toBeTruthy();

      const fetched = await request.get(`/api/projects/${ctx.projectId}/testcases/${createdId}`);
      expect(fetched.ok()).toBeTruthy();
      const rawSteps = (await fetched.json()).steps;
      // The exact contract the editor's parseSteps() requires: a string, not an array.
      expect(typeof rawSteps).toBe("string");
      expect(JSON.parse(rawSteps)).toEqual(steps);
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      if (createdId) await deleteCase(request, createdId);
      await mcpApi.dispose();
    }
  });

  test("an empty steps array persists as an empty, editor-readable list, not the one-blank-step fallback", async ({
    request,
  }) => {
    const title = `E2E MCP Steps Empty ${Date.now()}`;
    let tokenId: string | undefined;
    let createdId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP Steps Empty token ${Date.now()}`, scopes: ["write"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const created = await publishReviewedCaseChange(request, mcpApi, token, "create_testcase", { title, steps: [] });
      createdId = created.id;
      expect(createdId).toBeTruthy();

      const fetched = await request.get(`/api/projects/${ctx.projectId}/testcases/${createdId}`);
      const rawSteps = (await fetched.json()).steps;
      expect(typeof rawSteps).toBe("string");
      expect(JSON.parse(rawSteps)).toEqual([]);
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      if (createdId) await deleteCase(request, createdId);
      await mcpApi.dispose();
    }
  });
});

/*
 * "[MCP] Test case created by MCP is not adding Severity" — severity was never dropped: MCP stored
 * whatever string the caller sent, and a calling LLM given a bare `severity: string` schema sent
 * "Major". testcases.severity has no CHECK constraint, so that persisted, and the Test Case Detail
 * Severity dropdown — which only offers Critical/High/Medium/Low — showed its "Select" placeholder
 * because the stored value matches none of its options. The MCP test-case tools now advertise that
 * vocabulary as an enum, map a value onto it case-insensitively, and refuse anything else by name
 * instead of storing it. An omitted severity stays unset exactly as before.
 */
/*
 * Notes are testcases.attachments TEXT in the existing editor, not file uploads.
 * A typed MCP client must discover the field and round-trip it through the
 * same legacy writer and Test Case Detail API, without rewriting Context.
 */
test.describe("MCP create postconditions use existing test-case field", () => {
  test("single and bulk create retain postconditions on the normal REST case reader", async ({ request }) => {
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl, storageState: { cookies: [], origins: [] }
    });
    let tokenId: string | undefined;
    const caseIds: string[] = [];
    try {
      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP postconditions ${Date.now()}`, scopes: ["read", "write"] }
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;
      const one = await publishReviewedCaseChange(request, mcpApi, token, "create_testcase", {
        title: `E2E MCP postconditions single ${Date.now()}`,
        description: "Readable case intent",
        postconditions: "No source records changed"
      });
      caseIds.push(one.id);
      const afterOne = await request.get(`/api/projects/${ctx.projectId}/testcases/${one.id}`);
      expect(afterOne.ok()).toBeTruthy();
      expect(await afterOne.json()).toMatchObject({
        postconditions: "No source records changed",
        description: "Readable case intent"
      });
      const drafts = [
        { title: `E2E MCP postconditions first ${Date.now()}`, postconditions: "Audit remains intact" },
        { title: `E2E MCP postconditions second ${Date.now()}`, postconditions: "" }
      ];
      const many = await publishReviewedOperations(request, mcpApi, token, "bulk_create_testcases", { testcases: drafts },
        drafts.map(draft => ({ opType: "create", draft })));
      caseIds.push(...many.testcases.map((item: { id: string }) => item.id));
      expect(many.savedCount).toBe(2);
      const first = await request.get(`/api/projects/${ctx.projectId}/testcases/${many.testcases[0].id}`);
      expect(first.ok()).toBeTruthy();
      expect((await first.json()).postconditions).toBe("Audit remains intact");
    } finally {
      for (const id of caseIds) await deleteCase(request, id);
      if (tokenId) await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      await mcpApi.dispose();
    }
  });
});

test.describe("MCP source capture ownership", () => {
  test("write-scoped MCP client cannot invent a source repo or bypass missing project binding", async ({ request }) => {
    const api = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl, storageState: { cookies: [], origins: [] }
    });
    let tokenId: string | undefined;
    try {
      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E graph capture ${Date.now()}`, scopes: ["read", "write"] }
      });
      expect(tokenRes.ok()).toBeTruthy();
      const info = await tokenRes.json();
      tokenId = info.id;
      const catalog = await api.post(`/api/projects/${ctx.projectId}/mcp`, {
        headers: { Authorization: `Bearer ${info.token}` },
        data: { jsonrpc: "2.0", id: 2, method: "tools/list" }
      });
      expect(catalog.ok()).toBeTruthy();
      const names = (await catalog.json()).result.tools.map((item: { name: string }) => item.name);
      expect(names).toContain("capture_qa_graph_change");
      const injected = await callMcpToolExpectError(api, info.token, "capture_qa_graph_change", {
        checkoutRoot: "/untrusted", executionAssertion: "passed"
      });
      expect(injected.message).toMatch(/does not accept client-supplied/i);
      const missing = await callMcpToolExpectError(api, info.token, "capture_qa_graph_change", {});
      expect(missing.message).toMatch(/source binding|not configured/i);
    } finally {
      if (tokenId) await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, {
        failOnStatusCode: false
      });
      await api.dispose();
    }
  });
});

test.describe("MCP graph change-review discovery", () => {
  test("a read-scoped agent discovers and inspects existing graph history without writing", async ({ request }) => {
    const api = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl, storageState: { cookies: [], origins: [] }
    });
    let tokenId: string | undefined;
    try {
      const tokenResponse = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E graph review read ${Date.now()}`, scopes: ["read"] }
      });
      expect(tokenResponse.ok()).toBeTruthy();
      const tokenInfo = await tokenResponse.json();
      tokenId = tokenInfo.id;
      const catalogResponse = await api.post(`/api/projects/${ctx.projectId}/mcp`, {
        headers: { Authorization: `Bearer ${tokenInfo.token}` },
        data: { jsonrpc: "2.0", id: 2, method: "tools/list" }
      });
      expect(catalogResponse.ok()).toBeTruthy();
      const names = (await catalogResponse.json()).result.tools.map((x: { name: string }) => x.name);
      expect(names).toContain("list_qa_graph_changes");
      const result = await callMcpTool(api, tokenInfo.token, "list_qa_graph_changes", { limit: 10 });
      expect(Array.isArray(result.entries)).toBe(true);
      expect(result.entries.every((entry: { reviewReceipt?: {
        evidence?: { coverageAssertion: string; executionAssertion: string }
      } }) => !entry.reviewReceipt ||
        (entry.reviewReceipt.evidence?.coverageAssertion === "none" &&
         entry.reviewReceipt.evidence?.executionAssertion === "none"))).toBe(true);
      const bad = await callMcpToolExpectError(api, tokenInfo.token, "list_qa_graph_changes", {
        beforeId: "1 OR TRUE"
      });
      expect(bad.message).toMatch(/beforeId/);
    } finally {
      if (tokenId) await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, {
        failOnStatusCode: false
      });
      await api.dispose();
    }
  });
});

test.describe("MCP Notes use the existing test case field", () => {
  test("catalog advertises Notes and create/update/read-back preserves other case content", async ({ request }) => {
    const api = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl, storageState: { cookies: [], origins: [] },
    });
    let tokenId: string | undefined;
    let caseId: string | undefined;
    try {
      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP Notes ${Date.now()}`, scopes: ["read", "write"] }
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const catalogRes = await api.post(`/api/projects/${ctx.projectId}/mcp`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { jsonrpc: "2.0", id: 2, method: "tools/list" }
      });
      const catalog = (await catalogRes.json()).result.tools;
      for (const name of ["create_testcase", "update_testcase", "bulk_create_testcases"]) {
        expect(catalog.find((item: { name: string }) => item.name === name)).toBeUndefined();
      }
      const operationSchemas = catalog.find((item: { name: string }) => item.name === "stage_testcase_changes")
        .inputSchema.properties.operations.items.oneOf;
      expect(operationSchemas[0].properties.draft.properties.attachments.type).toBe("string");
      expect(operationSchemas[1].properties.fields.properties.attachments.type).toBe("string");

      const notes = "Technical support: café 🧪\\nEvidence: independent observation";
      const created = await publishReviewedCaseChange(request, api, token, "create_testcase", {
        title: `E2E MCP Notes case ${Date.now()}`, description: "Human-readable purpose",
        preconditions: "Authorized project member", attachments: notes
      });
      caseId = created.id;
      expect(caseId).toBeTruthy();
      let persisted = await (await request.get(`/api/projects/${ctx.projectId}/testcases/${caseId}`)).json();
      expect(persisted.attachments).toBe(notes);
      expect(persisted.description).toBe("Human-readable purpose");
      const originalSources = persisted.sourceRefs;
      const originalSuite = persisted.suiteId;

      await publishReviewedCaseChange(request, api, token, "update_testcase", { testcaseId: caseId, title: "Reworded purpose" });
      persisted = await (await request.get(`/api/projects/${ctx.projectId}/testcases/${caseId}`)).json();
      expect(persisted.attachments).toBe(notes);
      expect(persisted.sourceRefs).toEqual(originalSources);
      expect(persisted.suiteId).toBe(originalSuite);
      await publishReviewedCaseChange(request, api, token, "update_testcase", { testcaseId: caseId, attachments: "" });
      persisted = await (await request.get(`/api/projects/${ctx.projectId}/testcases/${caseId}`)).json();
      expect(persisted.attachments).toBe("");
      expect(persisted.description).toBe("Human-readable purpose");
      expect(persisted.title).toBe("Reworded purpose");

      const invalid = await expectRejectedCaseProposal(request, api, token, "update_testcase", {
        testcaseId: caseId, attachments: null
      });
      expect(invalid.message).toMatch(/attachments.*Notes/i);
      expect((await (await request.get(`/api/projects/${ctx.projectId}/testcases/${caseId}`)).json()).attachments).toBe("");
    } finally {
      if (caseId) await deleteCase(request, caseId);
      if (tokenId) await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      await api.dispose();
    }
  });

  test("MCP-P07 mixed Notes input refuses atomic staging and valid siblings require human Save", async ({ request }) => {
    const api = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl, storageState: { cookies: [], origins: [] }
    });
    let tokenId: string | undefined;
    const ids: string[] = [];
    try {
      const response = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP Notes bulk ${Date.now()}`, scopes: ["write"] }
      });
      expect(response.ok()).toBeTruthy();
      const tokenBody = await response.json();
      tokenId = tokenBody.id;
      const notes = "First Notes";
      const drafts = [
        { title: `E2E Notes first ${Date.now()}`, attachments: notes },
        { title: `E2E Notes invalid ${Date.now()}`, attachments: false },
        { title: `E2E Notes last ${Date.now()}`, attachments: "" }
      ];
      const denied = await callMcpToolExpectError(api, tokenBody.token, "bulk_create_testcases", { testcases: drafts });
      expect(denied.data?.code).toBe("HUMAN_PUBLICATION_REQUIRED");
      const invalid = await callMcpToolExpectError(api, tokenBody.token, "stage_testcase_changes", {
        requestKey: `invalid-notes-${Date.now()}`, operations: drafts.map(draft => ({ opType: "create", draft }))
      });
      expect(invalid.message).toMatch(/attachments.*Notes/i);
      for (const draft of drafts) {
        const found = await request.get(`/api/projects/${ctx.projectId}/testcases`, { params: { search: draft.title } });
        expect((await found.json()).filter((item: { title: string }) => item.title === draft.title)).toHaveLength(0);
      }
      const result = await publishReviewedOperations(request, api, tokenBody.token, "bulk_create_testcases", { testcases: [drafts[0], drafts[2]] },
        [drafts[0], drafts[2]].map(draft => ({ opType: "create", draft })));
      ids.push(...result.testcases.map((item: { id: string }) => item.id));
      expect(result.savedCount).toBe(2);
      const first = await (await request.get(`/api/projects/${ctx.projectId}/testcases/${result.testcases[0].id}`)).json();
      const last = await (await request.get(`/api/projects/${ctx.projectId}/testcases/${result.testcases[1].id}`)).json();
      expect(first.attachments).toBe(notes);
      expect([null, ""]).toContain(last.attachments);
    } finally {
      for (const id of ids) await deleteCase(request, id);
      if (tokenId) await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      await api.dispose();
    }
  });
});

test.describe("MCP test case severity uses the vocabulary Test Case Detail can display", () => {
  async function withWriteToken(
    request: APIRequestContext,
    fn: (mcpApi: APIRequestContext, token: string, createdIds: string[]) => Promise<void>,
  ) {
    const mcpApi = await newRequestContext.newContext({ baseURL: env.apiBaseUrl, storageState: { cookies: [], origins: [] } });
    const createdIds: string[] = [];
    let tokenId: string | undefined;
    try {
      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP Severity token ${Date.now()}`, scopes: ["write"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      await fn(mcpApi, tokenBody.token as string, createdIds);
    } finally {
      for (const id of createdIds) await deleteCase(request, id);
      if (tokenId) await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      await mcpApi.dispose();
    }
  }

  async function fetchCase(request: APIRequestContext, id: string) {
    const res = await request.get(`/api/projects/${ctx.projectId}/testcases/${id}`);
    expect(res.ok()).toBeTruthy();
    return res.json();
  }

  test("create_testcase persists the exact severity given, in the response and in what Test Case Detail reads", async ({ request }) => {
    await withWriteToken(request, async (mcpApi, token, createdIds) => {
      for (const severity of ["Critical", "High", "Medium", "Low"]) {
        const created = await publishReviewedCaseChange(request, mcpApi, token, "create_testcase", { title: `E2E MCP Severity ${severity} ${Date.now()}`, severity });
        createdIds.push(created.id);
        expect(created.severity).toBe(severity);
        expect((await fetchCase(request, created.id)).severity).toBe(severity);
      }
    });
  });

  test("create_testcase maps a differently-cased severity onto the canonical value", async ({ request }) => {
    await withWriteToken(request, async (mcpApi, token, createdIds) => {
      const created = await publishReviewedCaseChange(request, mcpApi, token, "create_testcase", { title: `E2E MCP Severity case ${Date.now()}`, severity: "  critical " });
      createdIds.push(created.id);
      expect(created.severity).toBe("Critical");
      expect((await fetchCase(request, created.id)).severity).toBe("Critical");
    });
  });

  test("create_testcase without severity leaves it unset, as before", async ({ request }) => {
    await withWriteToken(request, async (mcpApi, token, createdIds) => {
      const omitted = await publishReviewedCaseChange(request, mcpApi, token, "create_testcase", { title: `E2E MCP Severity omitted ${Date.now()}` });
      createdIds.push(omitted.id);
      expect(omitted.severity).toBeNull();
      expect((await fetchCase(request, omitted.id)).severity).toBeFalsy();

      const blank = await publishReviewedCaseChange(request, mcpApi, token, "create_testcase", { title: `E2E MCP Severity blank ${Date.now()}`, severity: "" });
      createdIds.push(blank.id);
      expect(blank.severity).toBeNull();
    });
  });

  // The regression: before the fix this call succeeded and stored "Major", which Test Case
  // Detail renders as "Select".
  test("create_testcase refuses a severity outside the vocabulary and creates nothing", async ({ request }) => {
    await withWriteToken(request, async (mcpApi, token) => {
      const title = `E2E MCP Severity invalid ${Date.now()}`;
      const error = await expectRejectedCaseProposal(request, mcpApi, token, "create_testcase", { title, severity: "Major" });
      expect(error.message).toContain("severity");
      expect(error.message).toContain("Critical, High, Medium, Low");
      const list = await (await request.get(`/api/projects/${ctx.projectId}/testcases`, { params: { search: title } })).json();
      expect(list.filter((tc: { title: string }) => tc.title === title)).toHaveLength(0);
    });
  });

  test("create_testcase's other fields are saved exactly as before alongside a severity", async ({ request }) => {
    await withWriteToken(request, async (mcpApi, token, createdIds) => {
      const title = `E2E MCP Severity other fields ${Date.now()}`;
      const steps = [{ stepNumber: 1, action: "Open the post", expectedResult: "Post is editable" }];
      const created = await publishReviewedCaseChange(request, mcpApi, token, "create_testcase", {
        title,
        description: "desc",
        preconditions: "pre",
        steps,
        testData: "data",
        priority: "P1",
        severity: "High",
        type: "Regression",
        automationStatus: "Automated",
        component: "Buzz",
        status: "Draft",
      });
      createdIds.push(created.id);
      const fetched = await fetchCase(request, created.id);
      expect(fetched).toMatchObject({
        title,
        description: "desc",
        preconditions: "pre",
        testData: "data",
        priority: "P1",
        severity: "High",
        type: "Regression",
        automationStatus: "Automated",
        component: "Buzz",
        status: "Draft",
      });
      expect(JSON.parse(fetched.steps)).toEqual(steps);
    });
  });

  test("MCP-P07 a malformed severity refuses the whole proposal batch before valid drafts are separately reviewed", async ({ request }) => {
    await withWriteToken(request, async (mcpApi, token, createdIds) => {
      const stamp = Date.now();
      const drafts = [
        { title: `E2E MCP Bulk Severity ok ${stamp}`, severity: "medium" },
        { title: `E2E MCP Bulk Severity bad ${stamp}`, severity: "Blocker" },
        { title: `E2E MCP Bulk Severity none ${stamp}` }
      ];
      const denied = await callMcpToolExpectError(mcpApi, token, "bulk_create_testcases", { testcases: drafts });
      expect(denied.data?.code).toBe("HUMAN_PUBLICATION_REQUIRED");
      const invalid = await callMcpToolExpectError(mcpApi, token, "stage_testcase_changes", {
        requestKey: `invalid-severity-${stamp}`, operations: drafts.map(draft => ({ opType: "create", draft }))
      });
      expect(invalid.message).toContain("severity");
      for (const draft of drafts) {
        const found = await request.get(`/api/projects/${ctx.projectId}/testcases`, { params: { search: draft.title } });
        expect((await found.json()).filter((item: { title: string }) => item.title === draft.title)).toHaveLength(0);
      }
      const result = await publishReviewedOperations(request, mcpApi, token, "bulk_create_testcases", { testcases: [drafts[0], drafts[2]] },
        [drafts[0], drafts[2]].map(draft => ({ opType: "create", draft })));
      createdIds.push(...result.testcases.map((item: { id: string }) => item.id));
      expect(result.savedCount).toBe(2);
      expect((await fetchCase(request, result.testcases[0].id)).severity).toBe("Medium");
      expect((await fetchCase(request, result.testcases[1].id)).severity).toBeFalsy();
    });
  });

  test("update_testcase sets a canonical severity, refuses an unknown one, and leaves it alone when omitted", async ({ request }) => {
    await withWriteToken(request, async (mcpApi, token, createdIds) => {
      const created = await publishReviewedCaseChange(request, mcpApi, token, "create_testcase", { title: `E2E MCP Severity update ${Date.now()}`, severity: "Low" });
      createdIds.push(created.id);

      const updated = await publishReviewedCaseChange(request, mcpApi, token, "update_testcase", { testcaseId: created.id, severity: "high" });
      expect(updated.severity).toBe("High");

      const error = await expectRejectedCaseProposal(request, mcpApi, token, "update_testcase", { testcaseId: created.id, severity: "Major" });
      expect(error.message).toContain("severity");
      expect((await fetchCase(request, created.id)).severity).toBe("High");

      const untouched = await publishReviewedCaseChange(request, mcpApi, token, "update_testcase", { testcaseId: created.id, component: "Buzz" });
      expect(untouched.severity).toBe("High");
      expect(untouched.component).toBe("Buzz");
    });
  });

  test("tools/list advertises the severity vocabulary on every test case write tool", async ({ request }) => {
    await withWriteToken(request, async (mcpApi, token) => {
      const res = await mcpApi.post(`/api/projects/${ctx.projectId}/mcp`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
      });
      expect(res.ok()).toBeTruthy();
      const tools = (await res.json()).result.tools as Array<{ name: string; inputSchema: any }>;
      const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
      const expected = ["Critical", "High", "Medium", "Low"];
      expect(byName.create_testcase.inputSchema.properties.severity.enum).toEqual(expected);
      expect(byName.update_testcase.inputSchema.properties.severity.enum).toEqual(expected);
      expect(byName.bulk_create_testcases.inputSchema.properties.testcases.items.properties.severity.enum).toEqual(expected);
    });
  });
});

test.describe("MCP search_knowledge_base", () => {
  test("finds a Knowledge Base document created via REST, scoped to the token's project", async ({ request }) => {
    const title = `E2E MCP KB ${Date.now()}`;
    let tokenId: string | undefined;
    let documentId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const treeRes = await request.get(`/api/projects/${ctx.projectId}/knowledge-base/folders/tree`);
      expect(treeRes.ok()).toBeTruthy();
      const rootFolderId = (await treeRes.json()).id;

      const docRes = await request.post(`/api/projects/${ctx.projectId}/knowledge-base/documents`, {
        data: { title, folderId: rootFolderId, contentText: "Steps to reset a forgotten password" },
      });
      expect(docRes.ok()).toBeTruthy();
      documentId = (await docRes.json()).id;

      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP KB token ${Date.now()}`, scopes: ["read"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const found = await callMcpTool(mcpApi, token, "search_knowledge_base", { q: title });
      expect(found.list.some((item: { id: string; type: string }) => item.id === documentId && item.type === "document")).toBe(
        true,
      );

      const empty = await callMcpTool(mcpApi, token, "search_knowledge_base", { q: `no-such-title-${Date.now()}` });
      expect(empty.total).toBe(0);
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      if (documentId) {
        await request.delete(`/api/projects/${ctx.projectId}/knowledge-base/documents/${documentId}`, {
          failOnStatusCode: false,
        });
      }
      await mcpApi.dispose();
    }
  });

  test("rejects a call missing the required q argument", async ({ request }) => {
    let tokenId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP KB validation token ${Date.now()}`, scopes: ["read"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const error = await callMcpToolExpectError(mcpApi, token, "search_knowledge_base", {});
      expect(error.message).toMatch(/"q"/i);
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      await mcpApi.dispose();
    }
  });
});

/*
 * MCP write access to Knowledge Base: create/update/move documents and folders. Every tool is a
 * thin passthrough to the same LegacyService methods the REST knowledge-base endpoints already
 * use (mcp.tools.ts), so the role/ownership gate (kbRequireMutateAccess — a qa_engineer may only
 * mutate what they created; owner/manager may mutate anything) and the KB-specific business rules
 * (root folder immovable, no moving a folder into its own subtree, sync-mirror read-only lock,
 * duplicate sibling names) are unchanged and already covered end-to-end at the REST layer in
 * api/knowledge-base.spec.ts. What's new here is the MCP transport and attribution (ctx.userId,
 * since knowledge_documents/knowledge_folders.created_by references users(id) like bugs.reported_by
 * — see mcp.tools.ts's module doc comment), so these tests focus on that: the tools actually
 * persist through to REST, required-argument validation, and not-found/guard handling.
 */
test.describe("MCP Knowledge Base write tools", () => {
  test("creates, updates, and moves a document and a folder, persisted via REST", async ({ request }) => {
    const stamp = Date.now();
    let tokenId: string | undefined;
    let folderAId: string | undefined;
    let folderBId: string | undefined;
    let documentId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const treeRes = await request.get(`/api/projects/${ctx.projectId}/knowledge-base/folders/tree`);
      expect(treeRes.ok()).toBeTruthy();
      const rootFolderId = (await treeRes.json()).id;

      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP KB write token ${stamp}`, scopes: ["write"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      // create_knowledge_folder: two sibling folders under root.
      const folderA = await callMcpTool(mcpApi, token, "create_knowledge_folder", {
        name: `E2E MCP KB Folder A ${stamp}`,
        parentFolderId: rootFolderId,
      });
      folderAId = folderA.id;
      const folderB = await callMcpTool(mcpApi, token, "create_knowledge_folder", {
        name: `E2E MCP KB Folder B ${stamp}`,
        parentFolderId: rootFolderId,
      });
      folderBId = folderB.id;

      const fetchedFolderA = await request.get(`/api/projects/${ctx.projectId}/knowledge-base/folders/${folderAId}`);
      expect(fetchedFolderA.ok()).toBeTruthy();
      expect((await fetchedFolderA.json()).name).toBe(`E2E MCP KB Folder A ${stamp}`);

      // create_knowledge_document: inside folder A.
      const doc = await callMcpTool(mcpApi, token, "create_knowledge_document", {
        title: `E2E MCP KB Doc ${stamp}`,
        folderId: folderAId,
        contentText: "Original content",
      });
      documentId = doc.id;
      const fetchedDoc = await request.get(`/api/projects/${ctx.projectId}/knowledge-base/documents/${documentId}`);
      expect(fetchedDoc.ok()).toBeTruthy();
      let docBody = await fetchedDoc.json();
      expect(docBody.folderId).toBe(folderAId);
      expect(docBody.contentText).toBe("Original content");

      // update_knowledge_document: title and content change, persisted.
      await callMcpTool(mcpApi, token, "update_knowledge_document", {
        documentId,
        title: `E2E MCP KB Doc Updated ${stamp}`,
        contentText: "Updated content",
      });
      docBody = await (await request.get(`/api/projects/${ctx.projectId}/knowledge-base/documents/${documentId}`)).json();
      expect(docBody.title).toBe(`E2E MCP KB Doc Updated ${stamp}`);
      expect(docBody.contentText).toBe("Updated content");

      // move_knowledge_document: from folder A to folder B.
      await callMcpTool(mcpApi, token, "move_knowledge_document", { documentId, folderId: folderBId });
      docBody = await (await request.get(`/api/projects/${ctx.projectId}/knowledge-base/documents/${documentId}`)).json();
      expect(docBody.folderId).toBe(folderBId);

      // update_knowledge_folder: rename folder A.
      await callMcpTool(mcpApi, token, "update_knowledge_folder", {
        folderId: folderAId,
        name: `E2E MCP KB Folder A Renamed ${stamp}`,
      });
      const renamedFolderA = await (
        await request.get(`/api/projects/${ctx.projectId}/knowledge-base/folders/${folderAId}`)
      ).json();
      expect(renamedFolderA.name).toBe(`E2E MCP KB Folder A Renamed ${stamp}`);

      // move_knowledge_folder: nest folder A under folder B.
      await callMcpTool(mcpApi, token, "move_knowledge_folder", { folderId: folderAId, parentFolderId: folderBId });
      const movedFolderA = await (
        await request.get(`/api/projects/${ctx.projectId}/knowledge-base/folders/${folderAId}`)
      ).json();
      expect(movedFolderA.parentFolderId).toBe(folderBId);

      // Guard: folder B cannot be moved into its own subtree (folder A is now its child).
      const subtreeError = await callMcpToolExpectError(mcpApi, token, "move_knowledge_folder", {
        folderId: folderBId,
        parentFolderId: folderAId,
      });
      expect(subtreeError.message).toMatch(/cannot be moved into itself or one of its subfolders/i);

      // Guard: the project's root folder cannot be moved at all.
      const rootMoveError = await callMcpToolExpectError(mcpApi, token, "move_knowledge_folder", {
        folderId: rootFolderId,
        parentFolderId: folderAId,
      });
      expect(rootMoveError.message).toMatch(/root folder cannot be moved/i);
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      if (documentId) {
        await request.delete(`/api/projects/${ctx.projectId}/knowledge-base/documents/${documentId}`, {
          failOnStatusCode: false,
        });
      }
      // Folder A is nested under folder B by the time cleanup runs; delete the child before the parent.
      if (folderAId) {
        await request.delete(`/api/projects/${ctx.projectId}/knowledge-base/folders/${folderAId}`, {
          failOnStatusCode: false,
        });
      }
      if (folderBId) {
        await request.delete(`/api/projects/${ctx.projectId}/knowledge-base/folders/${folderBId}`, {
          failOnStatusCode: false,
        });
      }
      await mcpApi.dispose();
    }
  });

  test("rejects each Knowledge Base write tool call missing its required argument(s)", async ({ request }) => {
    let tokenId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP KB validation token ${Date.now()}`, scopes: ["write"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      expect((await callMcpToolExpectError(mcpApi, token, "create_knowledge_document", { folderId: "f1" })).message).toMatch(
        /"title"/i,
      );
      expect((await callMcpToolExpectError(mcpApi, token, "create_knowledge_document", { title: "T" })).message).toMatch(
        /"folderId"/i,
      );
      expect((await callMcpToolExpectError(mcpApi, token, "update_knowledge_document", { title: "T" })).message).toMatch(
        /"documentId"/i,
      );
      expect(
        (await callMcpToolExpectError(mcpApi, token, "move_knowledge_document", { documentId: "d1" })).message,
      ).toMatch(/"folderId"/i);
      expect(
        (await callMcpToolExpectError(mcpApi, token, "move_knowledge_document", { folderId: "f1" })).message,
      ).toMatch(/"documentId"/i);
      expect((await callMcpToolExpectError(mcpApi, token, "create_knowledge_folder", {})).message).toMatch(/"name"/i);
      expect(
        (await callMcpToolExpectError(mcpApi, token, "update_knowledge_folder", { name: "N" })).message,
      ).toMatch(/"folderId"/i);
      expect(
        (await callMcpToolExpectError(mcpApi, token, "move_knowledge_folder", { folderId: "f1" })).message,
      ).toMatch(/"parentFolderId"/i);
      expect(
        (await callMcpToolExpectError(mcpApi, token, "move_knowledge_folder", { parentFolderId: "f2" })).message,
      ).toMatch(/"folderId"/i);
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      await mcpApi.dispose();
    }
  });

  test("rejects update/move on a Knowledge Base document or folder that does not exist", async ({ request }) => {
    const ghostId = "00000000-0000-0000-0000-000000000000";
    let tokenId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP KB not-found token ${Date.now()}`, scopes: ["write"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      expect(
        (
          await callMcpToolExpectError(mcpApi, token, "update_knowledge_document", { documentId: ghostId, title: "x" })
        ).message,
      ).toMatch(/document not found/i);
      expect(
        (
          await callMcpToolExpectError(mcpApi, token, "move_knowledge_document", { documentId: ghostId, folderId: ghostId })
        ).message,
      ).toMatch(/document not found|folder not found/i);
      expect(
        (await callMcpToolExpectError(mcpApi, token, "update_knowledge_folder", { folderId: ghostId, name: "x" })).message,
      ).toMatch(/folder not found/i);
      expect(
        (
          await callMcpToolExpectError(mcpApi, token, "move_knowledge_folder", {
            folderId: ghostId,
            parentFolderId: ghostId,
          })
        ).message,
      ).toMatch(/folder not found/i);
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      await mcpApi.dispose();
    }
  });
});

/*
 * MCP read/write access to a test case by id: get_testcase, update_testcase, archive_testcase,
 * restore_testcase. All four close a create-only gap: MCP could previously create a test case but
 * never read, edit, archive, or restore one after the fact. update/archive/restore all wrap
 * LegacyService methods (updateTestCase, getTestCase) that take no project argument of their own —
 * they derive the project from the row found by id — so, exactly like record_execution_result,
 * the tool itself must check the test case's project against the token before calling them;
 * otherwise a token could reach into another project's test case by id alone.
 */
test.describe("MCP get_testcase", () => {
  test("returns the full detail of a test case created via REST", async ({ request }) => {
    const created = await createCase(request, {
      title: `E2E MCP Get ${Date.now()}`,
      description: "Full description",
      priority: "High",
    });
    let tokenId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP get_testcase token ${Date.now()}`, scopes: ["read"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const fetched = await callMcpTool(mcpApi, token, "get_testcase", { testcaseId: created.id });
      expect(fetched.id).toBe(created.id);
      expect(fetched.title).toBe(created.title);
      expect(fetched.description).toBe("Full description");
      expect(fetched.priority).toBe("High");
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      await deleteCase(request, created.id);
      await mcpApi.dispose();
    }
  });

  test("rejects get_testcase missing testcaseId, on a test case that does not exist, and across projects", async ({
    request,
  }) => {
    const ghostId = "00000000-0000-0000-0000-000000000000";
    const asB = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: path.join(__dirname, "../.auth/state-b.json"),
    });
    let tokenId: string | undefined;
    let bCaseId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const bCaseRes = await asB.post(`/api/projects/${ctxB.projectId}/testcases`, {
        data: { title: `E2E MCP Get Cross-Project ${Date.now()}` },
      });
      expect(bCaseRes.ok()).toBeTruthy();
      bCaseId = (await bCaseRes.json()).id;

      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP get_testcase validation token ${Date.now()}`, scopes: ["read"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      expect((await callMcpToolExpectError(mcpApi, token, "get_testcase", {})).message).toMatch(/"testcaseId"/i);
      expect((await callMcpToolExpectError(mcpApi, token, "get_testcase", { testcaseId: ghostId })).message).toMatch(
        /not found/i,
      );

      const crossProjectError = await callMcpToolExpectError(mcpApi, token, "get_testcase", { testcaseId: bCaseId });
      expect(crossProjectError.code).toBe(-32001); // RpcCode.ProjectScopeDenied
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      if (bCaseId) {
        await asB.delete(`/api/projects/${ctxB.projectId}/testcases/${bCaseId}`, { failOnStatusCode: false });
      }
      await asB.dispose();
      await mcpApi.dispose();
    }
  });
});

test.describe("MCP update_testcase", () => {
  test("updates a test case created via REST, persisted through the same REST endpoint", async ({ request }) => {
    const created = await createCase(request, { title: `E2E MCP Update ${Date.now()}` });
    let tokenId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP update token ${Date.now()}`, scopes: ["write"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const newTitle = `E2E MCP Update Retitled ${Date.now()}`;
      const updated = await publishReviewedCaseChange(request, mcpApi, token, "update_testcase", {
        testcaseId: created.id,
        title: newTitle,
        priority: "High",
      });
      expect(updated.title).toBe(newTitle);
      expect(updated.priority).toBe("High");

      const fetched = await request.get(`/api/projects/${ctx.projectId}/testcases/${created.id}`);
      expect(fetched.ok()).toBeTruthy();
      const fetchedBody = await fetched.json();
      expect(fetchedBody.title).toBe(newTitle);
      expect(fetchedBody.priority).toBe("High");

      // Omitted fields keep their current value rather than being cleared (updateTestCaseWithClient's
      // COALESCE contract) — description was never sent above, so it must still be absent, not null-ed.
      expect(fetchedBody.description ?? null).toBe(created.description ?? null);
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      await deleteCase(request, created.id);
      await mcpApi.dispose();
    }
  });

  test("rejects update_testcase for a test case belonging to another project", async ({ request }) => {
    // Account B's own session — a token minted against project A must not be able to reach a
    // test case that lives in project B, even though both are addressed by the same MCP endpoint
    // shape. This is the case updateTestCase has no way to catch itself.
    const asB = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: path.join(__dirname, "../.auth/state-b.json"),
    });
    let tokenId: string | undefined;
    let bCaseId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const bCaseRes = await asB.post(`/api/projects/${ctxB.projectId}/testcases`, {
        data: { title: `E2E MCP Cross-Project ${Date.now()}` },
      });
      expect(bCaseRes.ok()).toBeTruthy();
      bCaseId = (await bCaseRes.json()).id;

      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP cross-project token ${Date.now()}`, scopes: ["write"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const updateError = await expectRejectedCaseProposal(request, mcpApi, token, "update_testcase", {
        testcaseId: bCaseId,
        title: "Retitled by project A's token",
      });
      expect(updateError).toMatchObject({ code: -32003, data: { httpStatus: 404 } });

      // Untouched: still readable, under its original title, via account B's own session.
      const stillThere = await asB.get(`/api/projects/${ctxB.projectId}/testcases/${bCaseId}`);
      expect(stillThere.ok()).toBeTruthy();
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      if (bCaseId) {
        await asB.delete(`/api/projects/${ctxB.projectId}/testcases/${bCaseId}`, { failOnStatusCode: false });
      }
      await asB.dispose();
      await mcpApi.dispose();
    }
  });

  test("rejects update_testcase missing testcaseId, on a test case that does not exist, and for a read-scoped token", async ({
    request,
  }) => {
    const ghostId = "00000000-0000-0000-0000-000000000000";
    const created = await createCase(request, { title: `E2E MCP Update Scope ${Date.now()}` });
    let writeTokenId: string | undefined;
    let readTokenId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const writeTokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP update_testcase validation token ${Date.now()}`, scopes: ["write"] },
      });
      expect(writeTokenRes.ok()).toBeTruthy();
      const writeTokenBody = await writeTokenRes.json();
      writeTokenId = writeTokenBody.id;
      const writeToken = writeTokenBody.token as string;

      expect((await expectRejectedCaseProposal(request, mcpApi, writeToken, "update_testcase", { title: "x" })).message).toMatch(
        /testcaseId/i,
      );
      expect(
        (await expectRejectedCaseProposal(request, mcpApi, writeToken, "update_testcase", { testcaseId: ghostId, title: "x" })).message,
      ).toMatch(/not found/i);

      const readTokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP update_testcase read-only token ${Date.now()}`, scopes: ["read"] },
      });
      expect(readTokenRes.ok()).toBeTruthy();
      const readTokenBody = await readTokenRes.json();
      readTokenId = readTokenBody.id;
      const readToken = readTokenBody.token as string;

      const scopeError = await expectRejectedCaseProposal(request, mcpApi, readToken, "update_testcase", {
        testcaseId: created.id,
        title: "Should be refused",
      });
      expect(scopeError.code).toBe(-32002); // RpcCode.ScopeDenied

      // Untouched by the refused call.
      const fetched = await (await request.get(`/api/projects/${ctx.projectId}/testcases/${created.id}`)).json();
      expect(fetched.title).toBe(created.title);
    } finally {
      if (writeTokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${writeTokenId}`, { failOnStatusCode: false });
      }
      if (readTokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${readTokenId}`, { failOnStatusCode: false });
      }
      await deleteCase(request, created.id);
      await mcpApi.dispose();
    }
  });
});

/*
 * archive_testcase/restore_testcase: the dedicated, non-destructive lifecycle tools. Both are thin
 * wrappers over updateTestCase({status: ...}) — the same status change the app's own Archive/
 * Restore buttons make — so no row is ever deleted, only status flips between "Archived" and
 * "Draft" (restore always lands on "Draft"; the app does not remember what status a case had
 * before it was archived, see the tool's own description).
 */
test.describe("MCP archive_testcase and restore_testcase", () => {
  test("archives and then restores a test case, changing only its status and default-list visibility", async ({
    request,
  }) => {
    const title = `E2E MCP Archive ${Date.now()}`;
    const created = await createCase(request, { title, priority: "High" });
    let tokenId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP archive token ${Date.now()}`, scopes: ["read", "write"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const archived = await publishReviewedCaseChange(request, mcpApi, token, "archive_testcase", { testcaseId: created.id });
      expect(archived.status).toBe("Archived");
      // Nothing else about the row changed — this is a status flip, not a rewrite.
      expect(archived.priority).toBe("High");

      const fetchedArchived = await (await request.get(`/api/projects/${ctx.projectId}/testcases/${created.id}`)).json();
      expect(fetchedArchived.status).toBe("Archived");

      const withoutArchived = await callMcpTool(mcpApi, token, "list_testcases", { search: title });
      expect(withoutArchived.rows.some((r: { id: string }) => r.id === created.id)).toBe(false);
      const withArchived = await callMcpTool(mcpApi, token, "list_testcases", { search: title, includeArchived: true });
      expect(withArchived.rows.some((r: { id: string }) => r.id === created.id)).toBe(true);

      const restored = await publishReviewedCaseChange(request, mcpApi, token, "restore_testcase", { testcaseId: created.id });
      // Matches the app's own Restore/Unarchive action: always back to "Draft", not whatever
      // status the case had before it was archived (there is no stored prior status).
      expect(restored.status).toBe("Draft");
      expect(restored.priority).toBe("High");

      const backInDefaultList = await callMcpTool(mcpApi, token, "list_testcases", { search: title });
      expect(backInDefaultList.rows.some((r: { id: string }) => r.id === created.id)).toBe(true);
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      await deleteCase(request, created.id);
      await mcpApi.dispose();
    }
  });

  test("rejects archive_testcase and restore_testcase for a test case belonging to another project", async ({
    request,
  }) => {
    const asB = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: path.join(__dirname, "../.auth/state-b.json"),
    });
    let tokenId: string | undefined;
    let bCaseId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const bCaseRes = await asB.post(`/api/projects/${ctxB.projectId}/testcases`, {
        data: { title: `E2E MCP Archive Cross-Project ${Date.now()}` },
      });
      expect(bCaseRes.ok()).toBeTruthy();
      bCaseId = (await bCaseRes.json()).id;

      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP archive cross-project token ${Date.now()}`, scopes: ["write"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const archiveError = await expectRejectedCaseProposal(request, mcpApi, token, "archive_testcase", { testcaseId: bCaseId });
      expect(archiveError).toMatchObject({ code: -32003, data: { httpStatus: 404 } });
      const restoreError = await expectRejectedCaseProposal(request, mcpApi, token, "restore_testcase", { testcaseId: bCaseId });
      expect(restoreError).toMatchObject({ code: -32003, data: { httpStatus: 404 } });

      const stillThere = await (await asB.get(`/api/projects/${ctxB.projectId}/testcases/${bCaseId}`)).json();
      expect(stillThere.status).not.toBe("Archived");
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      if (bCaseId) {
        await asB.delete(`/api/projects/${ctxB.projectId}/testcases/${bCaseId}`, { failOnStatusCode: false });
      }
      await asB.dispose();
      await mcpApi.dispose();
    }
  });

  test("rejects archive_testcase and restore_testcase missing testcaseId, on a test case that does not exist, and for a read-scoped token", async ({
    request,
  }) => {
    const ghostId = "00000000-0000-0000-0000-000000000000";
    const created = await createCase(request, { title: `E2E MCP Archive Scope ${Date.now()}` });
    let writeTokenId: string | undefined;
    let readTokenId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const writeTokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP archive validation token ${Date.now()}`, scopes: ["write"] },
      });
      expect(writeTokenRes.ok()).toBeTruthy();
      const writeTokenBody = await writeTokenRes.json();
      writeTokenId = writeTokenBody.id;
      const writeToken = writeTokenBody.token as string;

      expect((await expectRejectedCaseProposal(request, mcpApi, writeToken, "archive_testcase", {})).message).toMatch(/testcaseId/i);
      expect((await expectRejectedCaseProposal(request, mcpApi, writeToken, "restore_testcase", {})).message).toMatch(/testcaseId/i);
      expect(
        (await expectRejectedCaseProposal(request, mcpApi, writeToken, "archive_testcase", { testcaseId: ghostId })).message,
      ).toMatch(/not found/i);
      expect(
        (await expectRejectedCaseProposal(request, mcpApi, writeToken, "restore_testcase", { testcaseId: ghostId })).message,
      ).toMatch(/not found/i);

      const readTokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP archive read-only token ${Date.now()}`, scopes: ["read"] },
      });
      expect(readTokenRes.ok()).toBeTruthy();
      const readTokenBody = await readTokenRes.json();
      readTokenId = readTokenBody.id;
      const readToken = readTokenBody.token as string;

      const archiveScopeError = await expectRejectedCaseProposal(request, mcpApi, readToken, "archive_testcase", {
        testcaseId: created.id,
      });
      expect(archiveScopeError.code).toBe(-32002); // RpcCode.ScopeDenied
      const restoreScopeError = await expectRejectedCaseProposal(request, mcpApi, readToken, "restore_testcase", {
        testcaseId: created.id,
      });
      expect(restoreScopeError.code).toBe(-32002);

      const fetched = await (await request.get(`/api/projects/${ctx.projectId}/testcases/${created.id}`)).json();
      expect(fetched.status).not.toBe("Archived");
    } finally {
      if (writeTokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${writeTokenId}`, { failOnStatusCode: false });
      }
      if (readTokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${readTokenId}`, { failOnStatusCode: false });
      }
      await deleteCase(request, created.id);
      await mcpApi.dispose();
    }
  });
});

/*
 * MCP read/write access to suites: list_suites, get_suite, update_suite. list_suites/get_suite
 * close a read-only gap (MCP could create a suite but never list or inspect one); update_suite
 * closes the same create-only gap update_testcase closed for test cases. updateSuite() takes no
 * project argument of its own either — it derives the project from the row via requireSuiteAccess
 * — so update_suite (and get_suite, since there is no dedicated getSuite() method) must check
 * project ownership themselves, same as update_testcase.
 */
test.describe("MCP list_suites, get_suite, and update_suite", () => {
  test("lists suites created via REST, scoped to the token's project", async ({ request }) => {
    const stamp = Date.now();
    const asB = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: path.join(__dirname, "../.auth/state-b.json"),
    });
    let tokenId: string | undefined;
    let suiteId: string | undefined;
    let childSuiteId: string | undefined;
    let bSuiteId: string | undefined;
    let testcaseId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const suite = await createSuiteRest(request, { name: `E2E MCP List Suite ${stamp}` });
      suiteId = suite.id;
      const childSuite = await createSuiteRest(request, { name: `E2E MCP List Suite Child ${stamp}`, parentId: suiteId });
      childSuiteId = childSuite.id;
      const testcase = await createCase(request, { title: `E2E MCP Suite Count ${stamp}`, suiteId: childSuiteId });
      testcaseId = testcase.id;

      // A suite in account B's own project must never appear in account A's list_suites.
      const bSuiteRes = await asB.post(`/api/projects/${ctxB.projectId}/suites`, {
        data: { name: `E2E MCP Cross-Project Suite ${stamp}` },
      });
      expect(bSuiteRes.ok()).toBeTruthy();
      bSuiteId = (await bSuiteRes.json()).id;

      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP list_suites token ${stamp}`, scopes: ["read"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const listed = await callMcpTool(mcpApi, token, "list_suites", {});
      const suites = listed.suites as Array<{ id: string; parentId: string | null; testCaseCount: number; recursiveTestCaseCount: number }>;
      const listedSuite = suites.find((s) => s.id === suiteId);
      const listedChild = suites.find((s) => s.id === childSuiteId);
      expect(listedSuite).toBeTruthy();
      expect(listedChild).toBeTruthy();
      expect(listedChild?.parentId).toBe(suiteId);
      expect(listedChild?.testCaseCount).toBe(1);
      // recursiveTestCaseCount rolls up the whole subtree — the parent's own direct count is 0
      // (its only test case lives on the child), but the subtree total is 1.
      expect(listedSuite?.testCaseCount).toBe(0);
      expect(listedSuite?.recursiveTestCaseCount).toBe(1);
      expect(suites.some((s) => s.id === bSuiteId)).toBe(false);
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      if (testcaseId) await deleteCase(request, testcaseId);
      if (childSuiteId) await deleteSuiteRest(request, childSuiteId);
      if (suiteId) await deleteSuiteRest(request, suiteId);
      if (bSuiteId) await asB.delete(`/api/suites/${bSuiteId}`, { failOnStatusCode: false });
      await asB.dispose();
      await mcpApi.dispose();
    }
  });

  test("gets a suite by id, and renaming it does not move it to the project root", async ({ request }) => {
    const stamp = Date.now();
    let tokenId: string | undefined;
    let parentId: string | undefined;
    let suiteId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const parent = await createSuiteRest(request, { name: `E2E MCP Get Suite Parent ${stamp}` });
      parentId = parent.id;
      const suite = await createSuiteRest(request, { name: `E2E MCP Get Suite ${stamp}`, parentId });
      suiteId = suite.id;

      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP get/update_suite token ${stamp}`, scopes: ["read", "write"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const fetched = await callMcpTool(mcpApi, token, "get_suite", { suiteId });
      expect(fetched.id).toBe(suiteId);
      expect(fetched.parentId).toBe(parentId);

      // The human native owner preserves fields omitted at the actual write.
      // Machine publication remains refused for the same rename.
      const renamed = await publishHumanSuiteChange(request, mcpApi, token, "update_suite", {
        suiteId,
        name: `E2E MCP Get Suite Renamed ${stamp}`,
      });
      expect(renamed.name).toBe(`E2E MCP Get Suite Renamed ${stamp}`);
      expect(renamed.parentId).toBe(parentId);

      // An explicit null does move it to the root.
      const rootedResult = await publishHumanSuiteChange(request, mcpApi, token, "update_suite", { suiteId, parentId: null });
      expect(rootedResult.parentId).toBeNull();
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      if (suiteId) await deleteSuiteRest(request, suiteId);
      if (parentId) await deleteSuiteRest(request, parentId);
      await mcpApi.dispose();
    }
  });

  test("rejects get_suite and update_suite for a suite belonging to another project", async ({ request }) => {
    const asB = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: path.join(__dirname, "../.auth/state-b.json"),
    });
    let tokenId: string | undefined;
    let bSuiteId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const bSuiteRes = await asB.post(`/api/projects/${ctxB.projectId}/suites`, {
        data: { name: `E2E MCP Suite Cross-Project ${Date.now()}` },
      });
      expect(bSuiteRes.ok()).toBeTruthy();
      bSuiteId = (await bSuiteRes.json()).id;

      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP suite cross-project token ${Date.now()}`, scopes: ["read", "write"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const getError = await callMcpToolExpectError(mcpApi, token, "get_suite", { suiteId: bSuiteId });
      expect(getError.code).toBe(-32001); // RpcCode.ProjectScopeDenied
      const updateError = await callMcpToolExpectError(mcpApi, token, "update_suite", {
        suiteId: bSuiteId,
        name: "Renamed by project A's token",
      });
      expect(updateError.data?.code).toBe("HUMAN_PUBLICATION_REQUIRED");

      const stillThere = await (await asB.get(`/api/projects/${ctxB.projectId}/suites`)).json();
      expect(stillThere.some((s: { id: string; name: string }) => s.id === bSuiteId && s.name.startsWith("E2E MCP Suite Cross-Project"))).toBe(
        true,
      );
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      if (bSuiteId) await asB.delete(`/api/suites/${bSuiteId}`, { failOnStatusCode: false });
      await asB.dispose();
      await mcpApi.dispose();
    }
  });

  test("rejects get_suite and update_suite missing suiteId, on a suite that does not exist, and update_suite for a read-scoped token", async ({
    request,
  }) => {
    const ghostId = "00000000-0000-0000-0000-000000000000";
    const suite = await createSuiteRest(request, { name: `E2E MCP Suite Scope ${Date.now()}` });
    let writeTokenId: string | undefined;
    let readTokenId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const writeTokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP suite validation token ${Date.now()}`, scopes: ["read", "write"] },
      });
      expect(writeTokenRes.ok()).toBeTruthy();
      const writeTokenBody = await writeTokenRes.json();
      writeTokenId = writeTokenBody.id;
      const writeToken = writeTokenBody.token as string;

      expect((await callMcpToolExpectError(mcpApi, writeToken, "get_suite", {})).message).toMatch(/"suiteId"/i);
      expect((await callMcpToolExpectError(mcpApi, writeToken, "update_suite", { name: "x" })).data?.code).toBe("HUMAN_PUBLICATION_REQUIRED");
      expect((await callMcpToolExpectError(mcpApi, writeToken, "get_suite", { suiteId: ghostId })).message).toMatch(
        /not found/i,
      );
      expect(
        (await callMcpToolExpectError(mcpApi, writeToken, "update_suite", { suiteId: ghostId, name: "x" })).data?.code,
      ).toBe("HUMAN_PUBLICATION_REQUIRED");

      const readTokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP suite read-only token ${Date.now()}`, scopes: ["read"] },
      });
      expect(readTokenRes.ok()).toBeTruthy();
      const readTokenBody = await readTokenRes.json();
      readTokenId = readTokenBody.id;
      const readToken = readTokenBody.token as string;

      const scopeError = await callMcpToolExpectError(mcpApi, readToken, "update_suite", {
        suiteId: suite.id,
        name: "Should be refused",
      });
      expect(scopeError.code).toBe(-32002); // RpcCode.ScopeDenied
    } finally {
      if (writeTokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${writeTokenId}`, { failOnStatusCode: false });
      }
      if (readTokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${readTokenId}`, { failOnStatusCode: false });
      }
      await deleteSuiteRest(request, suite.id);
      await mcpApi.dispose();
    }
  });
});

/*
 * MCP read/write access to bugs: list_bugs, get_bug, update_bug. list_bugs/get_bug close a
 * read-only gap (MCP could report a bug but never list or inspect one); update_bug closes the
 * same create-only gap update_testcase/update_suite closed elsewhere. updateBug() and getBug()
 * both take no project argument of their own either — getBug() has no ownership check inside it
 * at all, and updateBug() derives the project from the row via requireBugAccess — so both tools
 * must check project ownership themselves before calling in, same as the test case/suite tools.
 */
test.describe("MCP list_bugs, get_bug, and update_bug", () => {
  test("lists and gets bugs created via REST, scoped to the token's project", async ({ request }) => {
    const stamp = Date.now();
    const asB = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: path.join(__dirname, "../.auth/state-b.json"),
    });
    let tokenId: string | undefined;
    let bugId: string | undefined;
    let bBugId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const bug = await createBugRest(request, { title: `E2E MCP List Bug ${stamp}`, status: "Open" });
      bugId = bug.id;

      // A bug in account B's own project must never appear in account A's list_bugs.
      const bBugRes = await asB.post(`/api/projects/${ctxB.projectId}/bugs`, {
        data: { title: `E2E MCP Cross-Project Bug ${stamp}` },
      });
      expect(bBugRes.ok()).toBeTruthy();
      bBugId = (await bBugRes.json()).id;

      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP list/get_bug token ${stamp}`, scopes: ["read"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const listed = await callMcpTool(mcpApi, token, "list_bugs", { status: "Open" });
      const bugs = listed.bugs as Array<{ id: string }>;
      expect(bugs.some((b) => b.id === bugId)).toBe(true);
      expect(bugs.some((b) => b.id === bBugId)).toBe(false);

      const fetched = await callMcpTool(mcpApi, token, "get_bug", { bugId });
      expect(fetched.id).toBe(bugId);
      expect(fetched.title).toBe(`E2E MCP List Bug ${stamp}`);
      expect(Array.isArray(fetched.links)).toBe(true);
      expect(Array.isArray(fetched.attachments)).toBe(true);
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      if (bugId) await deleteBugRest(request, bugId);
      if (bBugId) await asB.delete(`/api/bugs/${bBugId}`, { failOnStatusCode: false });
      await asB.dispose();
      await mcpApi.dispose();
    }
  });

  test("updates a bug's fields, including explicitly clearing priority and unassigning", async ({ request }) => {
    const stamp = Date.now();
    const bug = await createBugRest(request, {
      title: `E2E MCP Update Bug ${stamp}`,
      severity: "Low",
      priority: "P3",
    });
    let tokenId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP update_bug token ${stamp}`, scopes: ["write"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const updated = await callMcpTool(mcpApi, token, "update_bug", {
        bugId: bug.id,
        status: "Closed",
        severity: "Critical",
      });
      expect(updated.status).toBe("Closed");
      expect(updated.severity).toBe("Critical");
      // Omitted priority keeps its current value (not cleared) — the explicit-clear convention
      // is only triggered by null/"", never by omission.
      expect(updated.priority).toBe("P3");

      const fetchedAfterUpdate = await (await request.get(`/api/bugs/${bug.id}`)).json();
      expect(fetchedAfterUpdate.status).toBe("Closed");
      expect(fetchedAfterUpdate.severity).toBe("Critical");

      // Explicit null clears priority back to untriaged — this is what "pass null or "" to clear
      // it" in the tool's description means, and it must not be confused with omitting the field.
      const cleared = await callMcpTool(mcpApi, token, "update_bug", { bugId: bug.id, priority: null });
      expect(cleared.priority).toBeNull();
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      await deleteBugRest(request, bug.id);
      await mcpApi.dispose();
    }
  });

  test("rejects get_bug and update_bug for a bug belonging to another project", async ({ request }) => {
    const asB = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: path.join(__dirname, "../.auth/state-b.json"),
    });
    let tokenId: string | undefined;
    let bBugId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const bBugRes = await asB.post(`/api/projects/${ctxB.projectId}/bugs`, {
        data: { title: `E2E MCP Bug Cross-Project ${Date.now()}` },
      });
      expect(bBugRes.ok()).toBeTruthy();
      bBugId = (await bBugRes.json()).id;

      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP bug cross-project token ${Date.now()}`, scopes: ["read", "write"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const getError = await callMcpToolExpectError(mcpApi, token, "get_bug", { bugId: bBugId });
      expect(getError.code).toBe(-32001); // RpcCode.ProjectScopeDenied
      const updateError = await callMcpToolExpectError(mcpApi, token, "update_bug", {
        bugId: bBugId,
        status: "Closed",
      });
      expect(updateError.code).toBe(-32001);

      const stillThere = await (await asB.get(`/api/bugs/${bBugId}`)).json();
      expect(stillThere.status).not.toBe("Closed");
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      if (bBugId) await asB.delete(`/api/bugs/${bBugId}`, { failOnStatusCode: false });
      await asB.dispose();
      await mcpApi.dispose();
    }
  });

  test("rejects get_bug and update_bug missing bugId, on a bug that does not exist, and update_bug for a read-scoped token", async ({
    request,
  }) => {
    const ghostId = "00000000-0000-0000-0000-000000000000";
    const bug = await createBugRest(request, { title: `E2E MCP Bug Scope ${Date.now()}` });
    let writeTokenId: string | undefined;
    let readTokenId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const writeTokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP bug validation token ${Date.now()}`, scopes: ["read", "write"] },
      });
      expect(writeTokenRes.ok()).toBeTruthy();
      const writeTokenBody = await writeTokenRes.json();
      writeTokenId = writeTokenBody.id;
      const writeToken = writeTokenBody.token as string;

      expect((await callMcpToolExpectError(mcpApi, writeToken, "get_bug", {})).message).toMatch(/"bugId"/i);
      expect((await callMcpToolExpectError(mcpApi, writeToken, "update_bug", { status: "Closed" })).message).toMatch(
        /"bugId"/i,
      );
      expect((await callMcpToolExpectError(mcpApi, writeToken, "get_bug", { bugId: ghostId })).message).toMatch(
        /not found/i,
      );
      expect(
        (await callMcpToolExpectError(mcpApi, writeToken, "update_bug", { bugId: ghostId, status: "Closed" })).message,
      ).toMatch(/not found/i);

      const readTokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP bug read-only token ${Date.now()}`, scopes: ["read"] },
      });
      expect(readTokenRes.ok()).toBeTruthy();
      const readTokenBody = await readTokenRes.json();
      readTokenId = readTokenBody.id;
      const readToken = readTokenBody.token as string;

      const scopeError = await callMcpToolExpectError(mcpApi, readToken, "update_bug", {
        bugId: bug.id,
        status: "Closed",
      });
      expect(scopeError.code).toBe(-32002); // RpcCode.ScopeDenied
    } finally {
      if (writeTokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${writeTokenId}`, { failOnStatusCode: false });
      }
      if (readTokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${readTokenId}`, { failOnStatusCode: false });
      }
      await deleteBugRest(request, bug.id);
      await mcpApi.dispose();
    }
  });
});

/*
 * MCP read access to test cycles: list_test_cycles, get_test_cycle. Both close a read-only gap —
 * MCP could create a cycle (create_cycle_from_plan) but never list or inspect one afterwards.
 * getCycle()/listCycles() both take a real project argument the tool trusts (list_test_cycles), or
 * derive the project from the row via requireCycleAccess (get_test_cycle needs its own ownership
 * check first, same as get_suite/get_bug, since requireCycleAccess checks the caller's org access
 * to whatever project the cycle happens to be in, not that it matches this token's own project).
 */
test.describe("MCP list_test_cycles and get_test_cycle", () => {
  test("lists and gets a test cycle created via REST, with its linked plan attached, scoped to the token's project", async ({
    request,
  }) => {
    const stamp = Date.now();
    const asB = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: path.join(__dirname, "../.auth/state-b.json"),
    });
    let tokenId: string | undefined;
    let planId: string | undefined;
    let cycleId: string | undefined;
    let bCycleId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const plan = await createPlanRest(request, { name: `E2E MCP Cycle Plan ${stamp}` });
      planId = plan.id;
      const cycle = await createCycleRest(request, {
        name: `E2E MCP Cycle ${stamp}`,
        planId,
        environment: "Staging",
      });
      cycleId = cycle.id;

      // A cycle in account B's own project must never appear in account A's list_test_cycles.
      const bCycleRes = await asB.post(`/api/projects/${ctxB.projectId}/cycles`, {
        data: { name: `E2E MCP Cross-Project Cycle ${stamp}` },
      });
      expect(bCycleRes.ok()).toBeTruthy();
      bCycleId = (await bCycleRes.json()).id;

      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP list/get_test_cycle token ${stamp}`, scopes: ["read"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const listed = await callMcpTool(mcpApi, token, "list_test_cycles", {});
      const cycles = listed.cycles as Array<{ id: string; environment: string }>;
      expect(cycles.some((c) => c.id === cycleId && c.environment === "Staging")).toBe(true);
      expect(cycles.some((c) => c.id === bCycleId)).toBe(false);

      const fetched = await callMcpTool(mcpApi, token, "get_test_cycle", { cycleId });
      expect(fetched.id).toBe(cycleId);
      expect(fetched.planId).toBe(planId);
      expect(fetched.plan).toBeTruthy();
      expect(fetched.plan.id).toBe(planId);
      expect(fetched.plan.name).toBe(`E2E MCP Cycle Plan ${stamp}`);
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      if (cycleId) await deleteCycleRest(request, cycleId);
      if (planId) await deletePlanRest(request, planId);
      if (bCycleId) await asB.delete(`/api/cycles/${bCycleId}`, { failOnStatusCode: false });
      await asB.dispose();
      await mcpApi.dispose();
    }
  });

  test("gets a test cycle with no plan as plan: null, without failing", async ({ request }) => {
    const cycle = await createCycleRest(request, { name: `E2E MCP Cycle No Plan ${Date.now()}` });
    let tokenId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP no-plan token ${Date.now()}`, scopes: ["read"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const fetched = await callMcpTool(mcpApi, token, "get_test_cycle", { cycleId: cycle.id });
      expect(fetched.planId ?? null).toBeNull();
      expect(fetched.plan).toBeNull();
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      await deleteCycleRest(request, cycle.id);
      await mcpApi.dispose();
    }
  });

  test("rejects get_test_cycle missing cycleId, on a cycle that does not exist, and across projects", async ({
    request,
  }) => {
    const ghostId = "00000000-0000-0000-0000-000000000000";
    const asB = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: path.join(__dirname, "../.auth/state-b.json"),
    });
    let tokenId: string | undefined;
    let bCycleId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const bCycleRes = await asB.post(`/api/projects/${ctxB.projectId}/cycles`, {
        data: { name: `E2E MCP Cycle Cross-Project ${Date.now()}` },
      });
      expect(bCycleRes.ok()).toBeTruthy();
      bCycleId = (await bCycleRes.json()).id;

      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP cycle validation token ${Date.now()}`, scopes: ["read"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      expect((await callMcpToolExpectError(mcpApi, token, "get_test_cycle", {})).message).toMatch(/"cycleId"/i);
      expect((await callMcpToolExpectError(mcpApi, token, "get_test_cycle", { cycleId: ghostId })).message).toMatch(
        /not found/i,
      );

      const crossProjectError = await callMcpToolExpectError(mcpApi, token, "get_test_cycle", { cycleId: bCycleId });
      expect(crossProjectError.code).toBe(-32001); // RpcCode.ProjectScopeDenied
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      if (bCycleId) await asB.delete(`/api/cycles/${bCycleId}`, { failOnStatusCode: false });
      await asB.dispose();
      await mcpApi.dispose();
    }
  });
});

/*
 * MCP read/write access to executions: list_executions, get_execution, update_execution_result.
 * list_executions/get_execution close a read-only gap — MCP could record a result
 * (record_execution_result) but never list or inspect an execution first to find its id or see its
 * current state. update_execution_result is the fuller sibling of record_execution_result: same
 * updateExecution() call, same ctx.userId attribution reasoning, but with status made optional and
 * assigneeId added, matching every field the app's own Test Run screen exposes.
 */
test.describe("MCP list_executions, get_execution, and update_execution_result", () => {
  test("lists and gets an execution created via REST, scoped to the token's project", async ({ request }) => {
    const stamp = Date.now();
    const cycle = await createCycleRest(request, { name: `E2E MCP Executions Cycle ${stamp}` });
    const testcase = await createCase(request, { title: `E2E MCP Executions Case ${stamp}` });
    let tokenId: string | undefined;
    let executionId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      await addCycleTestCaseRest(request, cycle.id, testcase.id);
      const executions = await getCycleExecutionsRest(request, cycle.id);
      executionId = executions[0]?.id;
      expect(executionId).toBeTruthy();

      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP list/get_execution token ${stamp}`, scopes: ["read"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const listed = await callMcpTool(mcpApi, token, "list_executions", { cycleId: cycle.id });
      const listedExecutions = listed.executions as Array<{ id: string; title: string; status: string; testcaseId: string }>;
      expect(listedExecutions).toHaveLength(1);
      expect(listedExecutions[0].id).toBe(executionId);
      expect(listedExecutions[0].testcaseId).toBe(testcase.id);
      expect(listedExecutions[0].title).toBe(testcase.title);
      expect(listedExecutions[0].status).toBe("Untested");

      const fetched = await callMcpTool(mcpApi, token, "get_execution", { executionId });
      expect(fetched.id).toBe(executionId);
      expect(fetched.title).toBe(testcase.title);
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      await deleteCycleRest(request, cycle.id);
      await deleteCase(request, testcase.id);
      await mcpApi.dispose();
    }
  });

  test("updates one execution's result without touching an unrelated execution in a different cycle", async ({
    request,
  }) => {
    const stamp = Date.now();
    const cycle = await createCycleRest(request, { name: `E2E MCP Update Execution Cycle ${stamp}` });
    const testcase = await createCase(request, { title: `E2E MCP Update Execution Case ${stamp}` });
    const otherCycle = await createCycleRest(request, { name: `E2E MCP Unrelated Cycle ${stamp}` });
    const otherTestcase = await createCase(request, { title: `E2E MCP Unrelated Case ${stamp}` });
    let tokenId: string | undefined;
    let executionId: string | undefined;
    let otherExecutionId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      await addCycleTestCaseRest(request, cycle.id, testcase.id);
      executionId = (await getCycleExecutionsRest(request, cycle.id))[0]?.id;
      expect(executionId).toBeTruthy();

      await addCycleTestCaseRest(request, otherCycle.id, otherTestcase.id);
      otherExecutionId = (await getCycleExecutionsRest(request, otherCycle.id))[0]?.id;
      expect(otherExecutionId).toBeTruthy();

      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP update_execution_result token ${stamp}`, scopes: ["write"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const updated = await callMcpTool(mcpApi, token, "update_execution_result", {
        executionId,
        status: "Passed",
        actualResult: "Worked as expected",
        assigneeId: null,
      });
      expect(updated.status).toBe("Passed");
      expect(updated.actualResult).toBe("Worked as expected");

      const executionsAfter = await getCycleExecutionsRest(request, cycle.id);
      expect(executionsAfter.find((e: { id: string }) => e.id === executionId)?.status).toBe("Passed");

      // The unrelated cycle's execution must be untouched — update_execution_result must not
      // reach beyond the one execution id it was given.
      const otherExecutionsAfter = await getCycleExecutionsRest(request, otherCycle.id);
      expect(otherExecutionsAfter.find((e: { id: string }) => e.id === otherExecutionId)?.status).toBe("Untested");
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      await deleteCycleRest(request, cycle.id);
      await deleteCase(request, testcase.id);
      await deleteCycleRest(request, otherCycle.id);
      await deleteCase(request, otherTestcase.id);
      await mcpApi.dispose();
    }
  });

  test("rejects get_execution and update_execution_result for an execution belonging to another project", async ({
    request,
  }) => {
    const asB = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: path.join(__dirname, "../.auth/state-b.json"),
    });
    let tokenId: string | undefined;
    let bCycleId: string | undefined;
    let bTestcaseId: string | undefined;
    let bExecutionId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const bCycleRes = await asB.post(`/api/projects/${ctxB.projectId}/cycles`, {
        data: { name: `E2E MCP Execution Cross-Project Cycle ${Date.now()}` },
      });
      expect(bCycleRes.ok()).toBeTruthy();
      bCycleId = (await bCycleRes.json()).id;
      const bCaseRes = await asB.post(`/api/projects/${ctxB.projectId}/testcases`, {
        data: { title: `E2E MCP Execution Cross-Project Case ${Date.now()}` },
      });
      expect(bCaseRes.ok()).toBeTruthy();
      bTestcaseId = (await bCaseRes.json()).id;
      await approveTestcase(asB, ctxB.projectId, bTestcaseId!);
      const attachedForeign = await asB.post(`/api/cycles/${bCycleId}/testcases`, { data: { testcaseId: bTestcaseId } });
      expect(attachedForeign.ok(), await attachedForeign.text()).toBe(true);
      const bExecutionsRes = await asB.get(`/api/cycles/${bCycleId}/executions`);
      expect(bExecutionsRes.ok()).toBeTruthy();
      bExecutionId = (await bExecutionsRes.json())[0]?.id;
      expect(bExecutionId).toBeTruthy();

      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP execution cross-project token ${Date.now()}`, scopes: ["read", "write"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const getError = await callMcpToolExpectError(mcpApi, token, "get_execution", { executionId: bExecutionId });
      expect(getError.code).toBe(-32001); // RpcCode.ProjectScopeDenied
      const updateError = await callMcpToolExpectError(mcpApi, token, "update_execution_result", {
        executionId: bExecutionId,
        status: "Passed",
      });
      expect(updateError.code).toBe(-32001);

      const stillThere = await asB.get(`/api/cycles/${bCycleId}/executions`);
      expect((await stillThere.json()).find((e: { id: string }) => e.id === bExecutionId)?.status).toBe("Untested");
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      if (bCycleId) await asB.delete(`/api/cycles/${bCycleId}`, { failOnStatusCode: false });
      if (bTestcaseId) await asB.delete(`/api/projects/${ctxB.projectId}/testcases/${bTestcaseId}`, { failOnStatusCode: false });
      await asB.dispose();
      await mcpApi.dispose();
    }
  });

  test("rejects list_executions/get_execution/update_execution_result missing required ids, on ids that do not exist, and update_execution_result for a read-scoped token", async ({
    request,
  }) => {
    const ghostId = "00000000-0000-0000-0000-000000000000";
    const cycle = await createCycleRest(request, { name: `E2E MCP Execution Scope Cycle ${Date.now()}` });
    const testcase = await createCase(request, { title: `E2E MCP Execution Scope Case ${Date.now()}` });
    let writeTokenId: string | undefined;
    let readTokenId: string | undefined;
    let executionId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      await addCycleTestCaseRest(request, cycle.id, testcase.id);
      executionId = (await getCycleExecutionsRest(request, cycle.id))[0]?.id;
      expect(executionId).toBeTruthy();

      const writeTokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP execution validation token ${Date.now()}`, scopes: ["read", "write"] },
      });
      expect(writeTokenRes.ok()).toBeTruthy();
      const writeTokenBody = await writeTokenRes.json();
      writeTokenId = writeTokenBody.id;
      const writeToken = writeTokenBody.token as string;

      expect((await callMcpToolExpectError(mcpApi, writeToken, "list_executions", {})).message).toMatch(/"cycleId"/i);
      expect((await callMcpToolExpectError(mcpApi, writeToken, "get_execution", {})).message).toMatch(
        /"executionId"/i,
      );
      expect((await callMcpToolExpectError(mcpApi, writeToken, "update_execution_result", {})).message).toMatch(
        /"executionId"/i,
      );
      expect(
        (await callMcpToolExpectError(mcpApi, writeToken, "get_execution", { executionId: ghostId })).message,
      ).toMatch(/not found/i);
      expect(
        (
          await callMcpToolExpectError(mcpApi, writeToken, "update_execution_result", {
            executionId: ghostId,
            status: "Passed",
          })
        ).message,
      ).toMatch(/not found/i);

      const readTokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP execution read-only token ${Date.now()}`, scopes: ["read"] },
      });
      expect(readTokenRes.ok()).toBeTruthy();
      const readTokenBody = await readTokenRes.json();
      readTokenId = readTokenBody.id;
      const readToken = readTokenBody.token as string;

      const scopeError = await callMcpToolExpectError(mcpApi, readToken, "update_execution_result", {
        executionId,
        status: "Passed",
      });
      expect(scopeError.code).toBe(-32002); // RpcCode.ScopeDenied
    } finally {
      if (writeTokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${writeTokenId}`, { failOnStatusCode: false });
      }
      if (readTokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${readTokenId}`, { failOnStatusCode: false });
      }
      await deleteCycleRest(request, cycle.id);
      await deleteCase(request, testcase.id);
      await mcpApi.dispose();
    }
  });
});

/*
 * MCP relationship tools: link_testcase_to_bug, unlink_testcase_from_bug, get_testcase_bugs,
 * get_testcase_executions, link_requirement_to_testcase, unlink_requirement_from_testcase.
 *
 * link/unlink_testcase_to_bug wrap addBugLink/removeBugLink (bug_links) — addBugLink already
 * dedupes by (bugId, testcaseId, cycleId) both in application logic and via a DB partial unique
 * index (V117), so linking the same pair twice cannot create two rows. removeBugLink takes the
 * link's own id, not a testcaseId, so unlink_testcase_from_bug resolves it via getBug(bugId).links
 * first and is a graceful no-op (not an error) when nothing matches.
 *
 * link/unlink_requirement_to_testcase set/clear testcases.jiraIssueKey+jiraUrl (or the linear
 * equivalent) directly — there is no separate "requirements" table in this product, confirmed by
 * requirementMatrix/requirementsSummary/linkedJiraKeys all treating that column as the link. The
 * explicit-clear support these tools need (updateTestCaseWithClient, legacy.service.ts) is new:
 * previously an explicit null on these fields was indistinguishable from omitting them.
 */
test.describe("MCP link_testcase_to_bug, unlink_testcase_from_bug, and get_testcase_bugs", () => {
  test("links, duplicate-links, lists, and unlinks a test case and a bug without deleting either", async ({
    request,
  }) => {
    const stamp = Date.now();
    const testcase = await createCase(request, { title: `E2E MCP Link Bug Case ${stamp}` });
    const bug = await createBugRest(request, { title: `E2E MCP Link Bug ${stamp}` });
    let tokenId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP link_testcase_to_bug token ${stamp}`, scopes: ["read", "write"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const linked = await callMcpTool(mcpApi, token, "link_testcase_to_bug", {
        bugId: bug.id,
        testcaseId: testcase.id,
      });
      expect(linked.links.filter((l: { testcaseId: string }) => l.testcaseId === testcase.id)).toHaveLength(1);

      // Duplicate link: must not create a second row (addBugLink's own dedup, both app-level and
      // the V117 partial unique index).
      const linkedAgain = await callMcpTool(mcpApi, token, "link_testcase_to_bug", {
        bugId: bug.id,
        testcaseId: testcase.id,
      });
      expect(linkedAgain.links.filter((l: { testcaseId: string }) => l.testcaseId === testcase.id)).toHaveLength(1);

      const fetchedBug = await (await request.get(`/api/bugs/${bug.id}`)).json();
      expect(fetchedBug.links.filter((l: { testcaseId: string }) => l.testcaseId === testcase.id)).toHaveLength(1);

      const testcaseBugs = await callMcpTool(mcpApi, token, "get_testcase_bugs", { testcaseId: testcase.id });
      expect(testcaseBugs.bugs.some((b: { id: string }) => b.id === bug.id)).toBe(true);

      const unlinked = await callMcpTool(mcpApi, token, "unlink_testcase_from_bug", {
        bugId: bug.id,
        testcaseId: testcase.id,
      });
      expect(unlinked).toEqual({ ok: true, bugId: bug.id, testcaseId: testcase.id, wasLinked: true });

      const fetchedAfterUnlink = await (await request.get(`/api/bugs/${bug.id}`)).json();
      expect(fetchedAfterUnlink.links.some((l: { testcaseId: string }) => l.testcaseId === testcase.id)).toBe(false);

      const bugsAfterUnlink = await callMcpTool(mcpApi, token, "get_testcase_bugs", { testcaseId: testcase.id });
      expect(bugsAfterUnlink.bugs.some((b: { id: string }) => b.id === bug.id)).toBe(false);

      // Unlinking again is a graceful no-op, not an error — and neither entity was ever deleted.
      const unlinkedAgain = await callMcpTool(mcpApi, token, "unlink_testcase_from_bug", {
        bugId: bug.id,
        testcaseId: testcase.id,
      });
      expect(unlinkedAgain).toEqual({ ok: true, bugId: bug.id, testcaseId: testcase.id, wasLinked: false });

      const stillTestcase = await request.get(`/api/projects/${ctx.projectId}/testcases/${testcase.id}`);
      expect(stillTestcase.ok()).toBeTruthy();
      const stillBug = await request.get(`/api/bugs/${bug.id}`);
      expect(stillBug.ok()).toBeTruthy();
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      await deleteBugRest(request, bug.id);
      await deleteCase(request, testcase.id);
      await mcpApi.dispose();
    }
  });

  test("rejects link/unlink/get_testcase_bugs for a test case or bug belonging to another project", async ({
    request,
  }) => {
    const asB = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: path.join(__dirname, "../.auth/state-b.json"),
    });
    let tokenId: string | undefined;
    let bTestcaseId: string | undefined;
    let bBugId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const bCaseRes = await asB.post(`/api/projects/${ctxB.projectId}/testcases`, {
        data: { title: `E2E MCP Link Cross-Project Case ${Date.now()}` },
      });
      expect(bCaseRes.ok()).toBeTruthy();
      bTestcaseId = (await bCaseRes.json()).id;
      const bBugRes = await asB.post(`/api/projects/${ctxB.projectId}/bugs`, {
        data: { title: `E2E MCP Link Cross-Project Bug ${Date.now()}` },
      });
      expect(bBugRes.ok()).toBeTruthy();
      bBugId = (await bBugRes.json()).id;

      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP link cross-project token ${Date.now()}`, scopes: ["read", "write"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      // A token scoped to project A must not be able to link/read using either a foreign
      // testcaseId or a foreign bugId, even if the other id is a real one in project A.
      const localCase = await createCase(request, { title: `E2E MCP Link Local Case ${Date.now()}` });
      const localBug = await createBugRest(request, { title: `E2E MCP Link Local Bug ${Date.now()}` });

      try {
        const foreignBugError = await callMcpToolExpectError(mcpApi, token, "link_testcase_to_bug", {
          bugId: bBugId,
          testcaseId: localCase.id,
        });
        expect(foreignBugError.code).toBe(-32001); // RpcCode.ProjectScopeDenied

        const foreignCaseError = await callMcpToolExpectError(mcpApi, token, "link_testcase_to_bug", {
          bugId: localBug.id,
          testcaseId: bTestcaseId,
        });
        expect(foreignCaseError.code).toBe(-32001);

        const unlinkError = await callMcpToolExpectError(mcpApi, token, "unlink_testcase_from_bug", {
          bugId: bBugId,
          testcaseId: localCase.id,
        });
        expect(unlinkError.code).toBe(-32001);

        const getBugsError = await callMcpToolExpectError(mcpApi, token, "get_testcase_bugs", { testcaseId: bTestcaseId });
        expect(getBugsError.code).toBe(-32001);
      } finally {
        await deleteCase(request, localCase.id);
        await deleteBugRest(request, localBug.id);
      }
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      if (bTestcaseId) {
        await asB.delete(`/api/projects/${ctxB.projectId}/testcases/${bTestcaseId}`, { failOnStatusCode: false });
      }
      if (bBugId) await asB.delete(`/api/bugs/${bBugId}`, { failOnStatusCode: false });
      await asB.dispose();
      await mcpApi.dispose();
    }
  });

  test("rejects link/unlink/get_testcase_bugs on ids that do not exist, missing required arguments, and for a read-scoped token", async ({
    request,
  }) => {
    const ghostId = "00000000-0000-0000-0000-000000000000";
    const testcase = await createCase(request, { title: `E2E MCP Link Scope Case ${Date.now()}` });
    const bug = await createBugRest(request, { title: `E2E MCP Link Scope Bug ${Date.now()}` });
    let writeTokenId: string | undefined;
    let readTokenId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const writeTokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP link validation token ${Date.now()}`, scopes: ["read", "write"] },
      });
      expect(writeTokenRes.ok()).toBeTruthy();
      const writeTokenBody = await writeTokenRes.json();
      writeTokenId = writeTokenBody.id;
      const writeToken = writeTokenBody.token as string;

      expect(
        (await callMcpToolExpectError(mcpApi, writeToken, "link_testcase_to_bug", { testcaseId: testcase.id })).message,
      ).toMatch(/"bugId"/i);
      expect(
        (await callMcpToolExpectError(mcpApi, writeToken, "link_testcase_to_bug", { bugId: bug.id })).message,
      ).toMatch(/"testcaseId"/i);
      expect((await callMcpToolExpectError(mcpApi, writeToken, "get_testcase_bugs", {})).message).toMatch(
        /"testcaseId"/i,
      );

      const ghostBugError = await callMcpToolExpectError(mcpApi, writeToken, "link_testcase_to_bug", {
        bugId: ghostId,
        testcaseId: testcase.id,
      });
      expect(ghostBugError.message).toMatch(/not found/i);
      const ghostCaseError = await callMcpToolExpectError(mcpApi, writeToken, "link_testcase_to_bug", {
        bugId: bug.id,
        testcaseId: ghostId,
      });
      expect(ghostCaseError.message).toMatch(/not found/i);

      const readTokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP link read-only token ${Date.now()}`, scopes: ["read"] },
      });
      expect(readTokenRes.ok()).toBeTruthy();
      const readTokenBody = await readTokenRes.json();
      readTokenId = readTokenBody.id;
      const readToken = readTokenBody.token as string;

      const scopeError = await callMcpToolExpectError(mcpApi, readToken, "link_testcase_to_bug", {
        bugId: bug.id,
        testcaseId: testcase.id,
      });
      expect(scopeError.code).toBe(-32002); // RpcCode.ScopeDenied
    } finally {
      if (writeTokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${writeTokenId}`, { failOnStatusCode: false });
      }
      if (readTokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${readTokenId}`, { failOnStatusCode: false });
      }
      await deleteBugRest(request, bug.id);
      await deleteCase(request, testcase.id);
      await mcpApi.dispose();
    }
  });
});

test.describe("MCP get_testcase_executions", () => {
  test("lists a test case's executions across every cycle it has been added to", async ({ request }) => {
    const stamp = Date.now();
    const testcase = await createCase(request, { title: `E2E MCP Testcase Executions ${stamp}` });
    const cycleA = await createCycleRest(request, { name: `E2E MCP Testcase Executions Cycle A ${stamp}` });
    const cycleB = await createCycleRest(request, { name: `E2E MCP Testcase Executions Cycle B ${stamp}` });
    let tokenId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      await addCycleTestCaseRest(request, cycleA.id, testcase.id);
      await addCycleTestCaseRest(request, cycleB.id, testcase.id);

      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP get_testcase_executions token ${stamp}`, scopes: ["read"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const result = await callMcpTool(mcpApi, token, "get_testcase_executions", { testcaseId: testcase.id });
      const executions = result.executions as Array<{ cycleId: string }>;
      expect(executions).toHaveLength(2);
      expect(executions.some((e) => e.cycleId === cycleA.id)).toBe(true);
      expect(executions.some((e) => e.cycleId === cycleB.id)).toBe(true);
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      await deleteCycleRest(request, cycleA.id);
      await deleteCycleRest(request, cycleB.id);
      await deleteCase(request, testcase.id);
      await mcpApi.dispose();
    }
  });

  test("rejects get_testcase_executions missing testcaseId, on a test case that does not exist, and across projects", async ({
    request,
  }) => {
    const ghostId = "00000000-0000-0000-0000-000000000000";
    const asB = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: path.join(__dirname, "../.auth/state-b.json"),
    });
    let tokenId: string | undefined;
    let bCaseId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const bCaseRes = await asB.post(`/api/projects/${ctxB.projectId}/testcases`, {
        data: { title: `E2E MCP Testcase Executions Cross-Project ${Date.now()}` },
      });
      expect(bCaseRes.ok()).toBeTruthy();
      bCaseId = (await bCaseRes.json()).id;

      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP get_testcase_executions validation token ${Date.now()}`, scopes: ["read"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      expect((await callMcpToolExpectError(mcpApi, token, "get_testcase_executions", {})).message).toMatch(
        /"testcaseId"/i,
      );
      expect(
        (await callMcpToolExpectError(mcpApi, token, "get_testcase_executions", { testcaseId: ghostId })).message,
      ).toMatch(/not found/i);
      const crossProjectError = await callMcpToolExpectError(mcpApi, token, "get_testcase_executions", {
        testcaseId: bCaseId,
      });
      expect(crossProjectError.code).toBe(-32001); // RpcCode.ProjectScopeDenied
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      if (bCaseId) await asB.delete(`/api/projects/${ctxB.projectId}/testcases/${bCaseId}`, { failOnStatusCode: false });
      await asB.dispose();
      await mcpApi.dispose();
    }
  });
});

test.describe("MCP link_requirement_to_testcase and unlink_requirement_from_testcase", () => {
  async function publishRequirementFields(
    human: APIRequestContext, machine: APIRequestContext, token: string,
    legacyTool: "link_requirement_to_testcase" | "unlink_requirement_from_testcase",
    legacyArgs: Record<string, unknown>, fields: Record<string, unknown>,
  ) {
    const endpoint = `/api/projects/${ctx.projectId}/testcases/${legacyArgs.testcaseId}`;
    const before = await (await human.get(endpoint)).json();
    const denied = await callMcpToolExpectError(machine, token, legacyTool, legacyArgs);
    expect(denied.data).toMatchObject({ code: "HUMAN_PUBLICATION_REQUIRED", stagingAvailable: true });
    expect((await (await human.get(endpoint)).json()).editRevision).toBe(before.editRevision);
    return publishReviewedCaseChange(human, machine, token, "update_testcase", { testcaseId: legacyArgs.testcaseId, ...fields });
  }

  test("refuses cached Jira linking, then human selection links, re-links and unlinks only the requested fields", async ({
    request,
  }) => {
    const stamp = Date.now();
    const testcase = await createCase(request, { title: `E2E MCP Link Requirement ${stamp}`, priority: "High" });
    let tokenId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP link_requirement token ${stamp}`, scopes: ["write"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const linked = await publishRequirementFields(request, mcpApi, token, "link_requirement_to_testcase", {
        testcaseId: testcase.id,
        jiraIssueKey: `E2E-${stamp}`,
        jiraUrl: `https://example.atlassian.net/browse/E2E-${stamp}`,
      }, { jiraIssueKey: `E2E-${stamp}`, jiraUrl: `https://example.atlassian.net/browse/E2E-${stamp}` });
      expect(linked.jiraIssueKey).toBe(`E2E-${stamp}`);
      expect(linked.jiraUrl).toBe(`https://example.atlassian.net/browse/E2E-${stamp}`);
      expect(linked.priority).toBe("High");

      // Linking the same requirement again just re-sets the same value — no duplication is
      // possible since this is a plain column, not a join table.
      const linkedAgain = await publishRequirementFields(request, mcpApi, token, "link_requirement_to_testcase", {
        testcaseId: testcase.id,
        jiraIssueKey: `E2E-${stamp}`,
      }, { jiraIssueKey: `E2E-${stamp}` });
      expect(linkedAgain.jiraIssueKey).toBe(`E2E-${stamp}`);
      expect(linkedAgain.jiraUrl).toBe(`https://example.atlassian.net/browse/E2E-${stamp}`);

      const fetchedLinked = await (await request.get(`/api/projects/${ctx.projectId}/testcases/${testcase.id}`)).json();
      expect(fetchedLinked.jiraIssueKey).toBe(`E2E-${stamp}`);

      const unlinked = await publishRequirementFields(request, mcpApi, token, "unlink_requirement_from_testcase", {
        testcaseId: testcase.id,
        provider: "jira",
      }, { jiraIssueKey: null, jiraUrl: null });
      expect(unlinked.jiraIssueKey ?? null).toBeNull();
      expect(unlinked.jiraUrl ?? null).toBeNull();
      expect(unlinked.priority).toBe("High");

      const fetchedUnlinked = await (await request.get(`/api/projects/${ctx.projectId}/testcases/${testcase.id}`)).json();
      expect(fetchedUnlinked.jiraIssueKey ?? null).toBeNull();

      // Unlinking again is a graceful no-op, not an error.
      const unlinkedAgain = await publishRequirementFields(request, mcpApi, token, "unlink_requirement_from_testcase", {
        testcaseId: testcase.id,
        provider: "jira",
      }, { jiraIssueKey: null, jiraUrl: null });
      expect(unlinkedAgain.jiraIssueKey ?? null).toBeNull();
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      await deleteCase(request, testcase.id);
      await mcpApi.dispose();
    }
  });

  // Notion links by PAGE ID (notionPageId/notionUrl), not by the short display key. Like the Jira and
  // Linear fields it is a plain testcases column, so no Notion connection or seeded page is needed.
  test("refuses cached Notion linking, then human selection links and unlinks the page without changing Jira", async ({ request }) => {
    const stamp = Date.now();
    const pageId = crypto.randomUUID();
    const notionUrl = `https://www.notion.so/e2e-${pageId.replace(/-/g, "")}`;
    const testcase = await createCase(request, {
      title: `E2E MCP Link Notion ${stamp}`,
      priority: "High",
      jiraIssueKey: `E2E-${stamp}`,
    });
    let tokenId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP link_requirement notion token ${stamp}`, scopes: ["write"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const linked = await publishRequirementFields(request, mcpApi, token, "link_requirement_to_testcase", {
        testcaseId: testcase.id,
        notionPageId: pageId,
        notionUrl,
      }, { notionPageId: pageId, notionUrl });
      expect(linked.notionPageId).toBe(pageId);
      expect(linked.notionUrl).toBe(notionUrl);
      expect(linked.priority).toBe("High");
      expect(linked.jiraIssueKey).toBe(`E2E-${stamp}`);

      // Linking the same page again re-sets the same value; the url is optional on the second call.
      const again = await publishRequirementFields(request, mcpApi, token, "link_requirement_to_testcase", {
        testcaseId: testcase.id,
        notionPageId: pageId,
      }, { notionPageId: pageId });
      expect(again.notionPageId).toBe(pageId);
      expect(again.notionUrl).toBe(notionUrl);

      const fetched = await (await request.get(`/api/projects/${ctx.projectId}/testcases/${testcase.id}`)).json();
      expect(fetched.notionPageId).toBe(pageId);
      // The link is visible to the Requirements view's own read of it.
      const linkedPages = await (await request.get(`/api/projects/${ctx.projectId}/testcases/linked-notion-pages`)).json();
      expect(linkedPages.counts[pageId]).toBe(1);

      const unlinked = await publishRequirementFields(request, mcpApi, token, "unlink_requirement_from_testcase", {
        testcaseId: testcase.id,
        provider: "notion",
      }, { notionPageId: null, notionUrl: null });
      expect(unlinked.notionPageId ?? null).toBeNull();
      expect(unlinked.notionUrl ?? null).toBeNull();
      // Only the Notion link went: the Jira link and the rest of the test case are untouched.
      expect(unlinked.jiraIssueKey).toBe(`E2E-${stamp}`);
      expect(unlinked.priority).toBe("High");

      const fetchedUnlinked = await (await request.get(`/api/projects/${ctx.projectId}/testcases/${testcase.id}`)).json();
      expect(fetchedUnlinked.notionPageId ?? null).toBeNull();

      // Unlinking again is a graceful no-op, not an error.
      const unlinkedAgain = await publishRequirementFields(request, mcpApi, token, "unlink_requirement_from_testcase", {
        testcaseId: testcase.id,
        provider: "notion",
      }, { notionPageId: null, notionUrl: null });
      expect(unlinkedAgain.notionPageId ?? null).toBeNull();
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      await deleteCase(request, testcase.id);
      await mcpApi.dispose();
    }
  });

  test("cached link/unlink calls refuse before obsolete provider validation and leave every link unchanged", async ({
    request,
  }) => {
    const testcase = await createCase(request, { title: `E2E MCP Link Notion Validation ${Date.now()}` });
    let tokenId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP link_requirement notion validation token ${Date.now()}`, scopes: ["write"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;
      const pageId = crypto.randomUUID();

      const neither = await callMcpToolExpectError(mcpApi, token, "link_requirement_to_testcase", { testcaseId: testcase.id });
      expect(neither.data).toMatchObject({ code: "HUMAN_PUBLICATION_REQUIRED" });
      // A malformed old call cannot bypass the publication boundary by reaching its old parser.
      const blank = await callMcpToolExpectError(mcpApi, token, "link_requirement_to_testcase", {
        testcaseId: testcase.id,
        notionPageId: "   ",
      });
      expect(blank.data).toMatchObject({ code: "HUMAN_PUBLICATION_REQUIRED" });

      for (const other of [{ jiraIssueKey: "PROJ-1" }, { linearIssueKey: "ENG-1" }]) {
        const both = await callMcpToolExpectError(mcpApi, token, "link_requirement_to_testcase", {
          testcaseId: testcase.id,
          notionPageId: pageId,
          ...other,
        });
        expect(both.data).toMatchObject({ code: "HUMAN_PUBLICATION_REQUIRED" });
      }

      // None of the refused calls linked anything.
      const fetched = await (await request.get(`/api/projects/${ctx.projectId}/testcases/${testcase.id}`)).json();
      expect(fetched.notionPageId ?? null).toBeNull();
      expect(fetched.jiraIssueKey ?? null).toBeNull();
      expect(fetched.linearIssueKey ?? null).toBeNull();

      // Cached unlink is also refused before provider inspection.
      const bad = await callMcpToolExpectError(mcpApi, token, "unlink_requirement_from_testcase", {
        testcaseId: testcase.id,
        provider: "github",
      });
      expect(bad.data).toMatchObject({ code: "HUMAN_PUBLICATION_REQUIRED" });
      expect((await (await request.get(`/api/projects/${ctx.projectId}/testcases/${testcase.id}`)).json()).editRevision).toBe(fetched.editRevision);
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      await deleteCase(request, testcase.id);
      await mcpApi.dispose();
    }
  });

  test("native requirement proposals validate fields and exact target revision, then preserve multiple provider links", async ({
    request,
  }) => {
    const testcase = await createCase(request, { title: `E2E MCP Link Requirement Validation ${Date.now()}` });
    let tokenId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP link_requirement validation token ${Date.now()}`, scopes: ["write"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      for (const [tool, args] of [
        ["link_requirement_to_testcase", {}],
        ["unlink_requirement_from_testcase", { testcaseId: testcase.id }],
      ] as const) {
        const denied = await callMcpToolExpectError(mcpApi, token, tool, args);
        expect(denied.data).toMatchObject({ code: "HUMAN_PUBLICATION_REQUIRED" });
      }
      const current = await (await request.get(`/api/projects/${ctx.projectId}/testcases/${testcase.id}`)).json();
      const invalidFields = await expectRejectedCaseProposal(request, mcpApi, token, "update_testcase", {
        testcaseId: testcase.id, provider: "github", jiraIssueKey: "PROJ-1",
      });
      expect(invalidFields.message).toMatch(/native testcase field contract/i);
      const missingId = await expectRejectedCaseProposal(request, mcpApi, token, "update_testcase", { jiraIssueKey: "PROJ-1" });
      expect(missingId.message).toMatch(/testcaseId/i);
      const missingRevision = await expectRejectedCaseProposal(request, mcpApi, token, "update_testcase", {
        testcaseId: testcase.id, expectedRevision: null, jiraIssueKey: "PROJ-1",
      });
      expect(missingRevision.message).toMatch(/expectedRevision/i);
      const stale = await expectRejectedCaseProposal(request, mcpApi, token, "update_testcase", {
        testcaseId: testcase.id, expectedRevision: "0".repeat(64), jiraIssueKey: "PROJ-1",
      });
      expect(stale.code).toBe(-32003);
      expect(stale.data).toMatchObject({ code: "PROPOSAL_TARGET_CONFLICT", httpStatus: 409 });
      expect(stale.message).toMatch(/changed before this proposal was staged/i);
      expect((await (await request.get(`/api/projects/${ctx.projectId}/testcases/${testcase.id}`)).json()).editRevision).toBe(current.editRevision);
      // Native case fields can retain more than one provider; the old helper's one-provider input
      // rule does not replace the existing native case contract during exact human review.
      const linked = await publishReviewedCaseChange(request, mcpApi, token, "update_testcase", {
        testcaseId: testcase.id, jiraIssueKey: "PROJ-1", jiraUrl: "https://example.atlassian.net/browse/PROJ-1",
        linearIssueKey: "ENG-1", linearUrl: "https://linear.app/example/issue/ENG-1",
      });
      expect(linked).toMatchObject({ jiraIssueKey: "PROJ-1", linearIssueKey: "ENG-1" });
      const unlinked = await publishRequirementFields(request, mcpApi, token, "unlink_requirement_from_testcase", {
        testcaseId: testcase.id, provider: "linear",
      }, { linearIssueKey: null, linearUrl: null });
      expect(unlinked).toMatchObject({ jiraIssueKey: "PROJ-1", jiraUrl: "https://example.atlassian.net/browse/PROJ-1", linearIssueKey: null, linearUrl: null });
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      await deleteCase(request, testcase.id);
      await mcpApi.dispose();
    }
  });

  test("cached link writers stay refused and native proposals preserve foreign-project and read-scope boundaries", async ({
    request,
  }) => {
    const asB = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: path.join(__dirname, "../.auth/state-b.json"),
    });
    const localCase = await createCase(request, { title: `E2E MCP Link Requirement Scope ${Date.now()}` });
    let writeTokenId: string | undefined;
    let readTokenId: string | undefined;
    let bCaseId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const bCaseRes = await asB.post(`/api/projects/${ctxB.projectId}/testcases`, {
        data: { title: `E2E MCP Link Requirement Cross-Project ${Date.now()}` },
      });
      expect(bCaseRes.ok()).toBeTruthy();
      bCaseId = (await bCaseRes.json()).id;
      const bBefore = await (await asB.get(`/api/projects/${ctxB.projectId}/testcases/${bCaseId}`)).json();
      const localBefore = await (await request.get(`/api/projects/${ctx.projectId}/testcases/${localCase.id}`)).json();

      const writeTokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP link_requirement cross-project token ${Date.now()}`, scopes: ["write"] },
      });
      expect(writeTokenRes.ok()).toBeTruthy();
      const writeTokenBody = await writeTokenRes.json();
      writeTokenId = writeTokenBody.id;
      const writeToken = writeTokenBody.token as string;

      const linkError = await callMcpToolExpectError(mcpApi, writeToken, "link_requirement_to_testcase", {
        testcaseId: bCaseId,
        jiraIssueKey: "PROJ-1",
      });
      expect(linkError.data).toMatchObject({ code: "HUMAN_PUBLICATION_REQUIRED" });
      const unlinkError = await callMcpToolExpectError(mcpApi, writeToken, "unlink_requirement_from_testcase", {
        testcaseId: bCaseId,
        provider: "jira",
      });
      expect(unlinkError.data).toMatchObject({ code: "HUMAN_PUBLICATION_REQUIRED" });
      for (const fields of [{ jiraIssueKey: "PROJ-1" }, { jiraIssueKey: null, jiraUrl: null }]) {
        const foreignProposal = await callMcpToolExpectError(mcpApi, writeToken, "stage_testcase_changes", {
          requestKey: crypto.randomUUID(), operations: [{ opType: "update", testcaseId: bCaseId, expectedRevision: bBefore.editRevision, fields }],
        });
        expect(foreignProposal.code).toBe(-32003);
        expect(foreignProposal.data).toMatchObject({ httpStatus: 404 });
        expect(foreignProposal.message).toMatch(/target not found in this project/i);
      }
      expect((await (await asB.get(`/api/projects/${ctxB.projectId}/testcases/${bCaseId}`)).json()).editRevision).toBe(bBefore.editRevision);

      const readTokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP link_requirement read-only token ${Date.now()}`, scopes: ["read"] },
      });
      expect(readTokenRes.ok()).toBeTruthy();
      const readTokenBody = await readTokenRes.json();
      readTokenId = readTokenBody.id;
      const readToken = readTokenBody.token as string;

      const scopeError = await callMcpToolExpectError(mcpApi, readToken, "link_requirement_to_testcase", {
        testcaseId: localCase.id,
        jiraIssueKey: "PROJ-1",
      });
      expect(scopeError.code).toBe(-32002); // RpcCode.ScopeDenied
      const proposalScopeError = await callMcpToolExpectError(mcpApi, readToken, "stage_testcase_changes", {
        requestKey: crypto.randomUUID(), operations: [{ opType: "update", testcaseId: localCase.id, expectedRevision: localBefore.editRevision,
          fields: { jiraIssueKey: "PROJ-1" } }],
      });
      expect(proposalScopeError.code).toBe(-32002);
      expect((await (await request.get(`/api/projects/${ctx.projectId}/testcases/${localCase.id}`)).json()).editRevision).toBe(localBefore.editRevision);
    } finally {
      if (writeTokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${writeTokenId}`, { failOnStatusCode: false });
      }
      if (readTokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${readTokenId}`, { failOnStatusCode: false });
      }
      if (bCaseId) await asB.delete(`/api/projects/${ctxB.projectId}/testcases/${bCaseId}`, { failOnStatusCode: false });
      await deleteCase(request, localCase.id);
      await asB.dispose();
      await mcpApi.dispose();
    }
  });
});

/*
 * MCP read access to the Knowledge Base: list_knowledge_documents, get_knowledge_document,
 * list_knowledge_folders, get_knowledge_folder. All four close a read-only gap — MCP could create/
 * update/move KB documents and folders but never list or inspect one afterwards. Unlike testcases/
 * suites/bugs/cycles, the underlying legacy methods (kbDocument/kbFolder) already filter by
 * project_id internally, so these tools need no extra ownership pre-check of their own — a
 * foreign-project id 404s from inside the call itself, exactly like the REST GET routes that
 * share it (see api/knowledge-base.spec.ts for the REST-level equivalent coverage).
 */
test.describe("MCP list_knowledge_documents and get_knowledge_document", () => {
  test("lists and gets a Knowledge Base document created via REST, scoped to the token's project", async ({
    request,
  }) => {
    const stamp = Date.now();
    const asB = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: path.join(__dirname, "../.auth/state-b.json"),
    });
    let tokenId: string | undefined;
    let documentId: string | undefined;
    let bDocumentId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const rootFolderId = await getKbRootFolderId(request);
      const doc = await createKbDocumentRest(request, rootFolderId, {
        title: `E2E MCP List KB Doc ${stamp}`,
        contentText: "Steps to reset a forgotten password",
        documentType: "general",
      });
      documentId = doc.id;

      // A document in account B's own project must never appear in account A's
      // list_knowledge_documents.
      const bRootFolderId = await getKbRootFolderId(asB, ctxB.projectId);
      const bDocRes = await asB.post(`/api/projects/${ctxB.projectId}/knowledge-base/documents`, {
        data: { title: `E2E MCP Cross-Project KB Doc ${stamp}`, folderId: bRootFolderId },
      });
      expect(bDocRes.ok()).toBeTruthy();
      bDocumentId = (await bDocRes.json()).id;

      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP list/get_knowledge_document token ${stamp}`, scopes: ["read"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const listed = await callMcpTool(mcpApi, token, "list_knowledge_documents", { documentType: "general" });
      const docs = listed.list as Array<{ id: string }>;
      expect(docs.some((d) => d.id === documentId)).toBe(true);
      expect(docs.some((d) => d.id === bDocumentId)).toBe(false);

      const fetched = await callMcpTool(mcpApi, token, "get_knowledge_document", { documentId });
      expect(fetched.id).toBe(documentId);
      expect(fetched.title).toBe(`E2E MCP List KB Doc ${stamp}`);
      expect(fetched.contentText).toBe("Steps to reset a forgotten password");
      expect(Array.isArray(fetched.breadcrumb)).toBe(true);
      expect(fetched.breadcrumb[fetched.breadcrumb.length - 1].id).toBe(rootFolderId);
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      if (documentId) await deleteKbDocumentRest(request, documentId);
      if (bDocumentId) {
        await asB.delete(`/api/projects/${ctxB.projectId}/knowledge-base/documents/${bDocumentId}`, { failOnStatusCode: false });
      }
      await asB.dispose();
      await mcpApi.dispose();
    }
  });

  test("rejects get_knowledge_document missing documentId, on a document that does not exist, and across projects", async ({
    request,
  }) => {
    const ghostId = "00000000-0000-0000-0000-000000000000";
    const asB = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: path.join(__dirname, "../.auth/state-b.json"),
    });
    let tokenId: string | undefined;
    let bDocumentId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const bRootFolderId = await getKbRootFolderId(asB, ctxB.projectId);
      const bDocRes = await asB.post(`/api/projects/${ctxB.projectId}/knowledge-base/documents`, {
        data: { title: `E2E MCP Get KB Cross-Project ${Date.now()}`, folderId: bRootFolderId },
      });
      expect(bDocRes.ok()).toBeTruthy();
      bDocumentId = (await bDocRes.json()).id;

      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP get_knowledge_document validation token ${Date.now()}`, scopes: ["read"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      expect((await callMcpToolExpectError(mcpApi, token, "get_knowledge_document", {})).message).toMatch(
        /"documentId"/i,
      );
      expect(
        (await callMcpToolExpectError(mcpApi, token, "get_knowledge_document", { documentId: ghostId })).message,
      ).toMatch(/document not found/i);
      expect(
        (await callMcpToolExpectError(mcpApi, token, "get_knowledge_document", { documentId: bDocumentId })).message,
      ).toMatch(/document not found/i);
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      if (bDocumentId) {
        await asB.delete(`/api/projects/${ctxB.projectId}/knowledge-base/documents/${bDocumentId}`, { failOnStatusCode: false });
      }
      await asB.dispose();
      await mcpApi.dispose();
    }
  });
});

test.describe("MCP list_knowledge_folders and get_knowledge_folder", () => {
  test("lists the folder tree and gets one folder created via REST, scoped to the token's project", async ({
    request,
  }) => {
    const stamp = Date.now();
    let tokenId: string | undefined;
    let folderId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const rootFolderId = await getKbRootFolderId(request);
      const folder = await createKbFolderRest(request, {
        name: `E2E MCP List KB Folder ${stamp}`,
        parentFolderId: rootFolderId,
      });
      folderId = folder.id;

      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP list/get_knowledge_folder token ${stamp}`, scopes: ["read"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const tree = await callMcpTool(mcpApi, token, "list_knowledge_folders", {});
      expect(tree.isRoot).toBe(true);
      expect(tree.id).toBe(rootFolderId);
      expect(tree.children.some((c: { id: string; name: string }) => c.id === folderId)).toBe(true);

      const fetched = await callMcpTool(mcpApi, token, "get_knowledge_folder", { folderId });
      expect(fetched.id).toBe(folderId);
      expect(fetched.name).toBe(`E2E MCP List KB Folder ${stamp}`);
      expect(fetched.parentFolderId).toBe(rootFolderId);
      expect(fetched.breadcrumb[fetched.breadcrumb.length - 1].id).toBe(folderId);
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      if (folderId) await deleteKbFolderRest(request, folderId);
      await mcpApi.dispose();
    }
  });

  test("rejects get_knowledge_folder missing folderId, on a folder that does not exist, and across projects", async ({
    request,
  }) => {
    const ghostId = "00000000-0000-0000-0000-000000000000";
    const asB = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: path.join(__dirname, "../.auth/state-b.json"),
    });
    let tokenId: string | undefined;
    let bFolderId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const bRootFolderId = await getKbRootFolderId(asB, ctxB.projectId);
      const bFolderRes = await asB.post(`/api/projects/${ctxB.projectId}/knowledge-base/folders`, {
        data: { name: `E2E MCP Get KB Folder Cross-Project ${Date.now()}`, parentFolderId: bRootFolderId },
      });
      expect(bFolderRes.ok()).toBeTruthy();
      bFolderId = (await bFolderRes.json()).id;

      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP get_knowledge_folder validation token ${Date.now()}`, scopes: ["read"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      expect((await callMcpToolExpectError(mcpApi, token, "get_knowledge_folder", {})).message).toMatch(
        /"folderId"/i,
      );
      expect(
        (await callMcpToolExpectError(mcpApi, token, "get_knowledge_folder", { folderId: ghostId })).message,
      ).toMatch(/folder not found/i);
      expect(
        (await callMcpToolExpectError(mcpApi, token, "get_knowledge_folder", { folderId: bFolderId })).message,
      ).toMatch(/folder not found/i);
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      if (bFolderId) {
        await asB.delete(`/api/projects/${ctxB.projectId}/knowledge-base/folders/${bFolderId}`, { failOnStatusCode: false });
      }
      await asB.dispose();
      await mcpApi.dispose();
    }
  });
});

/*
 * archive_knowledge_document/restore_knowledge_document: soft-delete/restore via is_deleted +
 * deleted_at — there is no status="Archived" concept for KB documents the way testcases have one.
 * Deliberately asymmetric, matching deleteKnowledgeDocument/restoreKnowledgeDocument's own real
 * behavior: archiving an already-archived document 404s (kbDocument's own lookup excludes
 * is_deleted rows), but restoring an already-active document is a genuine idempotent no-op.
 * Restoring requires the account's project role to be owner/manager — the smoke tenant's account A
 * is the workspace owner (provisioned by global-setup.ts's signup flow), so this is not specially
 * arranged here.
 */
test.describe("MCP archive_knowledge_document and restore_knowledge_document", () => {
  test("archives and restores a document without touching its content or folder location", async ({ request }) => {
    const stamp = Date.now();
    let tokenId: string | undefined;
    let documentId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const rootFolderId = await getKbRootFolderId(request);
      const doc = await createKbDocumentRest(request, rootFolderId, {
        title: `E2E MCP Archive KB Doc ${stamp}`,
        contentText: "Original content",
      });
      documentId = doc.id;

      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP archive_knowledge_document token ${stamp}`, scopes: ["read", "write"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      await callMcpTool(mcpApi, token, "archive_knowledge_document", { documentId });

      // Archived documents are excluded from lookup the same way a nonexistent one is.
      const fetchedWhileArchived = await request.get(
        `/api/projects/${ctx.projectId}/knowledge-base/documents/${documentId}`,
        { failOnStatusCode: false },
      );
      expect(fetchedWhileArchived.status()).toBe(404);

      const listedWhileArchived = await callMcpTool(mcpApi, token, "list_knowledge_documents", {});
      expect(listedWhileArchived.list.some((d: { id: string }) => d.id === documentId)).toBe(false);

      // Archiving an already-archived document 404s — not a silent no-op.
      const doubleArchiveError = await callMcpToolExpectError(mcpApi, token, "archive_knowledge_document", {
        documentId,
      });
      expect(doubleArchiveError.message).toMatch(/document not found/i);

      const restored = await callMcpTool(mcpApi, token, "restore_knowledge_document", { documentId });
      expect(restored.id).toBe(documentId);
      expect(restored.isDeleted).toBe(false);

      const fetchedAfterRestore = await (
        await request.get(`/api/projects/${ctx.projectId}/knowledge-base/documents/${documentId}`)
      ).json();
      expect(fetchedAfterRestore.title).toBe(`E2E MCP Archive KB Doc ${stamp}`);
      expect(fetchedAfterRestore.contentText).toBe("Original content");
      expect(fetchedAfterRestore.folderId).toBe(rootFolderId);

      const listedAfterRestore = await callMcpTool(mcpApi, token, "list_knowledge_documents", {});
      expect(listedAfterRestore.list.some((d: { id: string }) => d.id === documentId)).toBe(true);

      // Restoring an already-active document is a genuine idempotent no-op, not an error.
      const restoredAgain = await callMcpTool(mcpApi, token, "restore_knowledge_document", { documentId });
      expect(restoredAgain.isDeleted).toBe(false);
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      if (documentId) await deleteKbDocumentRest(request, documentId);
      await mcpApi.dispose();
    }
  });

  test("rejects archive/restore_knowledge_document for a document belonging to another project", async ({
    request,
  }) => {
    const asB = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: path.join(__dirname, "../.auth/state-b.json"),
    });
    let tokenId: string | undefined;
    let bDocumentId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const bRootFolderId = await getKbRootFolderId(asB, ctxB.projectId);
      const bDocRes = await asB.post(`/api/projects/${ctxB.projectId}/knowledge-base/documents`, {
        data: { title: `E2E MCP Archive Cross-Project ${Date.now()}`, folderId: bRootFolderId },
      });
      expect(bDocRes.ok()).toBeTruthy();
      bDocumentId = (await bDocRes.json()).id;

      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP archive cross-project token ${Date.now()}`, scopes: ["write"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const archiveError = await callMcpToolExpectError(mcpApi, token, "archive_knowledge_document", {
        documentId: bDocumentId,
      });
      expect(archiveError.message).toMatch(/document not found/i);
      const restoreError = await callMcpToolExpectError(mcpApi, token, "restore_knowledge_document", {
        documentId: bDocumentId,
      });
      expect(restoreError.message).toMatch(/document not found/i);

      const stillThere = await asB.get(`/api/projects/${ctxB.projectId}/knowledge-base/documents/${bDocumentId}`);
      expect(stillThere.ok()).toBeTruthy();
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      if (bDocumentId) {
        await asB.delete(`/api/projects/${ctxB.projectId}/knowledge-base/documents/${bDocumentId}`, { failOnStatusCode: false });
      }
      await asB.dispose();
      await mcpApi.dispose();
    }
  });

  test("rejects archive/restore_knowledge_document missing documentId, and for a read-scoped token", async ({
    request,
  }) => {
    const rootFolderId = await getKbRootFolderId(request);
    const doc = await createKbDocumentRest(request, rootFolderId, {
      title: `E2E MCP Archive Scope Doc ${Date.now()}`,
    });
    let writeTokenId: string | undefined;
    let readTokenId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const writeTokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP archive validation token ${Date.now()}`, scopes: ["write"] },
      });
      expect(writeTokenRes.ok()).toBeTruthy();
      const writeTokenBody = await writeTokenRes.json();
      writeTokenId = writeTokenBody.id;
      const writeToken = writeTokenBody.token as string;

      expect((await callMcpToolExpectError(mcpApi, writeToken, "archive_knowledge_document", {})).message).toMatch(
        /"documentId"/i,
      );
      expect((await callMcpToolExpectError(mcpApi, writeToken, "restore_knowledge_document", {})).message).toMatch(
        /"documentId"/i,
      );

      const readTokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP archive read-only token ${Date.now()}`, scopes: ["read"] },
      });
      expect(readTokenRes.ok()).toBeTruthy();
      const readTokenBody = await readTokenRes.json();
      readTokenId = readTokenBody.id;
      const readToken = readTokenBody.token as string;

      const archiveScopeError = await callMcpToolExpectError(mcpApi, readToken, "archive_knowledge_document", {
        documentId: doc.id,
      });
      expect(archiveScopeError.code).toBe(-32002); // RpcCode.ScopeDenied
      const restoreScopeError = await callMcpToolExpectError(mcpApi, readToken, "restore_knowledge_document", {
        documentId: doc.id,
      });
      expect(restoreScopeError.code).toBe(-32002);

      const fetched = await (
        await request.get(`/api/projects/${ctx.projectId}/knowledge-base/documents/${doc.id}`)
      ).json();
      expect(fetched.isDeleted).toBe(false);
    } finally {
      if (writeTokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${writeTokenId}`, { failOnStatusCode: false });
      }
      if (readTokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${readTokenId}`, { failOnStatusCode: false });
      }
      await deleteKbDocumentRest(request, doc.id);
      await mcpApi.dispose();
    }
  });
});

/*
 * MCP bulk-operation and AI-workflow tools: duplicate_testcase, bulk_create_testcases,
 * bulk_update_testcases, bulk_archive_testcases, bulk_record_execution_results,
 * clone_test_suite, create_cycle_from_testcases, get_test_execution_summary.
 *
 * Case publishers are cached-name refusals. Their replacements validate an unpublished batch
 * atomically, and a human selects exact proposals to save. Raw execution reporting retains its
 * existing per-item outcomes. These tests assert unchanged official cases on refusal and native
 * persisted rows after an explicit review; they never emulate removed writer responses.
 */
test.describe("MCP duplicate_testcase", () => {
  test("MCP-P07 cached duplicate is refused and an explicitly reviewed draft copy preserves its source", async ({ request }) => {
    const stamp = Date.now();
    const suite = await createSuiteRest(request, { name: `E2E MCP Duplicate Suite ${stamp}` });
    const original = await createCase(request, {
      title: `E2E MCP Duplicate ${stamp}`,
      suiteId: suite.id,
      priority: "High",
      description: "Original description",
    });
    let tokenId: string | undefined;
    let copyId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP duplicate_testcase token ${stamp}`, scopes: ["write"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const beforeOriginal = await (await request.get(`/api/projects/${ctx.projectId}/testcases/${original.id}`)).json();
      const saved = await publishReviewedOperations(request, mcpApi, token, "duplicate_testcase", { testcaseId: original.id }, [{
        opType: "create", draft: { title: `${original.title} (copy)`, suiteId: suite.id, priority: "High", description: "Original description" }
      }]);
      const copy = saved.testcases[0];
      copyId = copy.id;
      expect(testcaseEditState(await (await request.get(`/api/projects/${ctx.projectId}/testcases/${original.id}`)).json()))
        .toEqual(testcaseEditState(beforeOriginal));
      expect(copyId).not.toBe(original.id);
      expect(copy.title).toBe(`${original.title} (copy)`);
      expect(copy.suiteId).toBe(suite.id);
      expect(copy.priority).toBe("High");
      expect(copy.description).toBe("Original description");
      expect(copy.externalId).not.toBe(original.externalId);

      const fetchedOriginal = await (await request.get(`/api/projects/${ctx.projectId}/testcases/${original.id}`)).json();
      expect(fetchedOriginal.title).toBe(original.title);
      expect(fetchedOriginal.title.endsWith("(copy)")).toBe(false);
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      if (copyId) await deleteCase(request, copyId);
      await deleteCase(request, original.id);
      await deleteSuiteRest(request, suite.id);
      await mcpApi.dispose();
    }
  });

  test("rejects duplicate_testcase for a test case belonging to another project, and on a nonexistent id", async ({
    request,
  }) => {
    const ghostId = "00000000-0000-0000-0000-000000000000";
    const asB = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: path.join(__dirname, "../.auth/state-b.json"),
    });
    let tokenId: string | undefined;
    let bCaseId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const bCaseRes = await asB.post(`/api/projects/${ctxB.projectId}/testcases`, {
        data: { title: `E2E MCP Duplicate Cross-Project ${Date.now()}` },
      });
      expect(bCaseRes.ok()).toBeTruthy();
      bCaseId = (await bCaseRes.json()).id;

      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP duplicate validation token ${Date.now()}`, scopes: ["write"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const crossProjectError = await callMcpToolExpectError(mcpApi, token, "duplicate_testcase", { testcaseId: bCaseId });
      expect(crossProjectError.data?.code).toBe("HUMAN_PUBLICATION_REQUIRED");
      const notFoundError = await callMcpToolExpectError(mcpApi, token, "duplicate_testcase", { testcaseId: ghostId });
      expect(notFoundError.data?.code).toBe("HUMAN_PUBLICATION_REQUIRED");
      expect(crossProjectError.message).toBe(notFoundError.message);
      const stillThere = await asB.get(`/api/projects/${ctxB.projectId}/testcases/${bCaseId}`);
      expect(stillThere.ok()).toBe(true);
      expect((await stillThere.json()).title).toMatch(/^E2E MCP Duplicate Cross-Project/);
      const forbiddenTarget = await callMcpToolExpectError(mcpApi, token, "stage_testcase_changes", {
        requestKey: `foreign-copy-${Date.now()}`, operations: [{ opType: "update", testcaseId: bCaseId,
          expectedRevision: "0".repeat(64), fields: { title: "Forbidden source mutation" } }]
      });
      expect(forbiddenTarget).toMatchObject({ code: -32003, data: { httpStatus: 404 } });
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      if (bCaseId) await asB.delete(`/api/projects/${ctxB.projectId}/testcases/${bCaseId}`, { failOnStatusCode: false });
      await asB.dispose();
      await mcpApi.dispose();
    }
  });
});

test.describe("MCP bulk_create_testcases", () => {
  test("MCP-P07 invalid create batches publish nothing and valid proposals save after exact human review", async ({
    request,
  }) => {
    const stamp = Date.now();
    let tokenId: string | undefined;
    let createdIds: string[] = [];
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP bulk_create_testcases token ${stamp}`, scopes: ["write"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const drafts = [
        { title: `E2E MCP Bulk Create A ${stamp}`, priority: "High" },
        { title: "" },
        { title: `E2E MCP Bulk Create B ${stamp}`, priority: "Low" }
      ];
      const refused = await callMcpToolExpectError(mcpApi, token, "bulk_create_testcases", { testcases: drafts });
      expect(refused.data?.code).toBe("HUMAN_PUBLICATION_REQUIRED");
      const invalid = await callMcpToolExpectError(mcpApi, token, "stage_testcase_changes", {
        requestKey: `invalid-batch-${stamp}`, operations: drafts.map(draft => ({ opType: "create", draft }))
      });
      expect(invalid.message).toMatch(/title/i);
      for (const draft of [drafts[0], drafts[2]]) {
        const found = await request.get(`/api/projects/${ctx.projectId}/testcases`, { params: { search: draft.title } });
        expect((await found.json()).filter((item: { title: string }) => item.title === draft.title)).toHaveLength(0);
      }
      const result = await publishReviewedOperations(request, mcpApi, token, "bulk_create_testcases", { testcases: [drafts[0], drafts[2]] },
        [drafts[0], drafts[2]].map(draft => ({ opType: "create", draft })));
      expect(result.savedCount).toBe(2);
      createdIds = result.testcases.map((item: { id: string }) => item.id);

      const fetchedA = await (await request.get(`/api/projects/${ctx.projectId}/testcases/${createdIds[0]}`)).json();
      expect(fetchedA.title).toBe(`E2E MCP Bulk Create A ${stamp}`);
      expect(fetchedA.priority).toBe("High");
      const fetchedB = await (await request.get(`/api/projects/${ctx.projectId}/testcases/${createdIds[1]}`)).json();
      expect(fetchedB.title).toBe(`E2E MCP Bulk Create B ${stamp}`);
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      for (const id of createdIds) await deleteCase(request, id);
      await mcpApi.dispose();
    }
  });

  test("rejects an empty testcases array, and for a read-scoped token", async ({ request }) => {
    let writeTokenId: string | undefined;
    let readTokenId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      // Scope is checked before argument validation (mcp.service.ts callTool), so a read-scoped
      // token can never reach the empty-array check — it needs write scope to get there at all.
      const writeTokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP bulk_create validation token ${Date.now()}`, scopes: ["write"] },
      });
      expect(writeTokenRes.ok()).toBeTruthy();
      const writeTokenBody = await writeTokenRes.json();
      writeTokenId = writeTokenBody.id;
      const writeToken = writeTokenBody.token as string;

      const emptyError = await callMcpToolExpectError(mcpApi, writeToken, "bulk_create_testcases", { testcases: [] });
      expect(emptyError.data?.code).toBe("HUMAN_PUBLICATION_REQUIRED");
      const emptyProposal = await callMcpToolExpectError(mcpApi, writeToken, "stage_testcase_changes", {
        requestKey: `empty-batch-${Date.now()}`, operations: []
      });
      expect(emptyProposal.message).toMatch(/operations must contain/i);

      const readTokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP bulk_create read-only token ${Date.now()}`, scopes: ["read"] },
      });
      expect(readTokenRes.ok()).toBeTruthy();
      const readTokenBody = await readTokenRes.json();
      readTokenId = readTokenBody.id;
      const readToken = readTokenBody.token as string;

      const scopeError = await callMcpToolExpectError(mcpApi, readToken, "bulk_create_testcases", {
        testcases: [{ title: "Should be refused" }],
      });
      expect(scopeError.code).toBe(-32002); // RpcCode.ScopeDenied
    } finally {
      if (writeTokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${writeTokenId}`, { failOnStatusCode: false });
      }
      if (readTokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${readTokenId}`, { failOnStatusCode: false });
      }
      await mcpApi.dispose();
    }
  });
});

test.describe("MCP bulk_update_testcases and bulk_archive_testcases", () => {
  test("MCP-P07 update batch refusal preserves every case and reviewed valid targets change together", async ({
    request,
  }) => {
    const stamp = Date.now();
    const tcA = await createCase(request, { title: `E2E MCP Bulk Update A ${stamp}`, priority: "Low" });
    const tcB = await createCase(request, { title: `E2E MCP Bulk Update B ${stamp}`, priority: "Low" });
    const control = await createCase(request, { title: `E2E MCP Bulk Update Control ${stamp}`, priority: "Low" });
    const ghostId = "00000000-0000-0000-0000-000000000000";
    let tokenId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP bulk_update_testcases token ${stamp}`, scopes: ["write"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const refused = await callMcpToolExpectError(mcpApi, token, "bulk_update_testcases", {
        testcaseIds: [tcA.id, tcA.id, tcB.id, ghostId], priority: "High"
      });
      expect(refused.data?.code).toBe("HUMAN_PUBLICATION_REQUIRED");
      const operations = await Promise.all([tcA.id, tcB.id].map(id => testcaseUpdateProposal(request, ctx.projectId, id, { priority: "High" })));
      const invalid = await callMcpToolExpectError(mcpApi, token, "stage_testcase_changes", {
        requestKey: `invalid-update-${stamp}`, operations: [...operations,
          { opType: "update", testcaseId: ghostId, expectedRevision: "0".repeat(64), fields: { priority: "High" } }]
      });
      expect(invalid).toMatchObject({ code: -32003, data: { httpStatus: 404 } });
      for (const tc of [tcA, tcB, control]) {
        const unchanged = await (await request.get(`/api/projects/${ctx.projectId}/testcases/${tc.id}`)).json();
        expect(unchanged.priority).toBe("Low");
      }
      const result = await publishReviewedOperations(request, mcpApi, token, "bulk_update_testcases",
        { testcaseIds: [tcA.id, tcB.id], priority: "High" }, operations);
      expect(result.savedCount).toBe(2);

      const fetchedA = await (await request.get(`/api/projects/${ctx.projectId}/testcases/${tcA.id}`)).json();
      expect(fetchedA.priority).toBe("High");
      const fetchedB = await (await request.get(`/api/projects/${ctx.projectId}/testcases/${tcB.id}`)).json();
      expect(fetchedB.priority).toBe("High");
      // Unrelated case, not named in the batch, is untouched.
      const fetchedControl = await (await request.get(`/api/projects/${ctx.projectId}/testcases/${control.id}`)).json();
      expect(fetchedControl.priority).toBe("Low");
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      await deleteCase(request, tcA.id);
      await deleteCase(request, tcB.id);
      await deleteCase(request, control.id);
      await mcpApi.dispose();
    }
  });

  test("MCP-P07 archive batch refusal is atomic and reviewed archives preserve unrelated cases", async ({
    request,
  }) => {
    const stamp = Date.now();
    const title = `E2E MCP Bulk Archive ${stamp}`;
    const tcA = await createCase(request, { title });
    const tcB = await createCase(request, { title: `E2E MCP Bulk Archive B ${stamp}` });
    const control = await createCase(request, { title: `E2E MCP Bulk Archive Control ${stamp}` });
    const ghostId = "00000000-0000-0000-0000-000000000000";
    let tokenId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP bulk_archive_testcases token ${stamp}`, scopes: ["read", "write"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const refused = await callMcpToolExpectError(mcpApi, token, "bulk_archive_testcases", { testcaseIds: [tcA.id, tcB.id, ghostId] });
      expect(refused.data?.code).toBe("HUMAN_PUBLICATION_REQUIRED");
      const operations = await Promise.all([tcA.id, tcB.id].map(id => testcaseUpdateProposal(request, ctx.projectId, id, {}, "archive")));
      const invalid = await callMcpToolExpectError(mcpApi, token, "stage_testcase_changes", {
        requestKey: `invalid-archive-${stamp}`, operations: [...operations,
          { opType: "archive", testcaseId: ghostId, expectedRevision: "0".repeat(64), fields: {} }]
      });
      expect(invalid).toMatchObject({ code: -32003, data: { httpStatus: 404 } });
      for (const tc of [tcA, tcB, control]) {
        expect((await (await request.get(`/api/projects/${ctx.projectId}/testcases/${tc.id}`)).json()).status).not.toBe("Archived");
      }
      const result = await publishReviewedOperations(request, mcpApi, token, "bulk_archive_testcases",
        { testcaseIds: [tcA.id, tcB.id] }, operations);
      expect(result.savedCount).toBe(2);

      // Archived, not deleted: still a 200 with status Archived, not a 404.
      const fetchedA = await (await request.get(`/api/projects/${ctx.projectId}/testcases/${tcA.id}`)).json();
      expect(fetchedA.status).toBe("Archived");
      const fetchedB = await (await request.get(`/api/projects/${ctx.projectId}/testcases/${tcB.id}`)).json();
      expect(fetchedB.status).toBe("Archived");
      const fetchedControl = await (await request.get(`/api/projects/${ctx.projectId}/testcases/${control.id}`)).json();
      expect(fetchedControl.status).not.toBe("Archived");

      const withoutArchived = await callMcpTool(mcpApi, token, "list_testcases", { search: title });
      expect(withoutArchived.rows.some((r: { id: string }) => r.id === tcA.id)).toBe(false);
      const withArchived = await callMcpTool(mcpApi, token, "list_testcases", { search: title, includeArchived: true });
      expect(withArchived.rows.some((r: { id: string }) => r.id === tcA.id)).toBe(true);
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      await deleteCase(request, tcA.id);
      await deleteCase(request, tcB.id);
      await deleteCase(request, control.id);
      await mcpApi.dispose();
    }
  });

  test("rejects bulk_update_testcases and bulk_archive_testcases for a read-scoped token, and an empty testcaseIds array", async ({
    request,
  }) => {
    const tc = await createCase(request, { title: `E2E MCP Bulk Scope ${Date.now()}` });
    let tokenId: string | undefined;
    let writeTokenId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP bulk read-only token ${Date.now()}`, scopes: ["read"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const updateScopeError = await callMcpToolExpectError(mcpApi, token, "bulk_update_testcases", {
        testcaseIds: [tc.id],
        priority: "High",
      });
      expect(updateScopeError.code).toBe(-32002); // RpcCode.ScopeDenied
      const archiveScopeError = await callMcpToolExpectError(mcpApi, token, "bulk_archive_testcases", { testcaseIds: [tc.id] });
      expect(archiveScopeError.code).toBe(-32002);

      // Scope is checked before argument validation, so the empty-array message can only be
      // reached with a token that actually has write scope.
      const writeTokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP bulk empty-array token ${Date.now()}`, scopes: ["write"] },
      });
      expect(writeTokenRes.ok()).toBeTruthy();
      const writeTokenBody = await writeTokenRes.json();
      writeTokenId = writeTokenBody.id;
      const writeToken = writeTokenBody.token as string;
      const emptyLegacy = await callMcpToolExpectError(mcpApi, writeToken, "bulk_update_testcases", { testcaseIds: [] });
      expect(emptyLegacy.data?.code).toBe("HUMAN_PUBLICATION_REQUIRED");
      const emptyProposal = await callMcpToolExpectError(mcpApi, writeToken, "stage_testcase_changes", {
        requestKey: `empty-update-${Date.now()}`, operations: []
      });
      expect(emptyProposal.message).toMatch(/operations must contain/i);
      const readProposal = await callMcpToolExpectError(mcpApi, token, "stage_testcase_changes", {
        requestKey: `read-cannot-stage-${Date.now()}`, operations: []
      });
      expect(readProposal.code).toBe(-32002);

      const fetched = await (await request.get(`/api/projects/${ctx.projectId}/testcases/${tc.id}`)).json();
      expect(fetched.status).not.toBe("Archived");
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      if (writeTokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${writeTokenId}`, { failOnStatusCode: false });
      }
      await deleteCase(request, tc.id);
      await mcpApi.dispose();
    }
  });
});

test.describe("MCP bulk_record_execution_results", () => {
  test("records every valid execution and reports an invalid one, without touching an unrelated execution", async ({
    request,
  }) => {
    const stamp = Date.now();
    const cycle = await createCycleRest(request, { name: `E2E MCP Bulk Executions Cycle ${stamp}` });
    const tcA = await createCase(request, { title: `E2E MCP Bulk Exec A ${stamp}` });
    const tcB = await createCase(request, { title: `E2E MCP Bulk Exec B ${stamp}` });
    const otherCycle = await createCycleRest(request, { name: `E2E MCP Bulk Executions Unrelated Cycle ${stamp}` });
    const otherCase = await createCase(request, { title: `E2E MCP Bulk Exec Unrelated ${stamp}` });
    const ghostId = "00000000-0000-0000-0000-000000000000";
    let tokenId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      await addCycleTestCaseRest(request, cycle.id, tcA.id);
      await addCycleTestCaseRest(request, cycle.id, tcB.id);
      const executions = await getCycleExecutionsRest(request, cycle.id);
      const execA = executions.find((e: { testcaseId: string }) => e.testcaseId === tcA.id);
      const execB = executions.find((e: { testcaseId: string }) => e.testcaseId === tcB.id);
      expect(execA?.id).toBeTruthy();
      expect(execB?.id).toBeTruthy();

      await addCycleTestCaseRest(request, otherCycle.id, otherCase.id);
      const otherExecutionId = (await getCycleExecutionsRest(request, otherCycle.id))[0]?.id;
      expect(otherExecutionId).toBeTruthy();

      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP bulk_record_execution_results token ${stamp}`, scopes: ["write"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const result = await callMcpTool(mcpApi, token, "bulk_record_execution_results", {
        results: [
          { executionId: execA.id, status: "Passed", actualResult: "Worked" },
          { executionId: ghostId, status: "Failed" },
          { executionId: execB.id, status: "Blocked" },
        ],
      });
      expect(result.total).toBe(3);
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.results[1].ok).toBe(false);
      expect(result.results[1].error).toMatch(/not found/i);

      const executionsAfter = await getCycleExecutionsRest(request, cycle.id);
      expect(executionsAfter.find((e: { id: string }) => e.id === execA.id)?.status).toBe("Passed");
      expect(executionsAfter.find((e: { id: string }) => e.id === execB.id)?.status).toBe("Blocked");

      const otherExecutionsAfter = await getCycleExecutionsRest(request, otherCycle.id);
      expect(otherExecutionsAfter.find((e: { id: string }) => e.id === otherExecutionId)?.status).toBe("Untested");
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      await deleteCycleRest(request, cycle.id);
      await deleteCase(request, tcA.id);
      await deleteCase(request, tcB.id);
      await deleteCycleRest(request, otherCycle.id);
      await deleteCase(request, otherCase.id);
      await mcpApi.dispose();
    }
  });

  test("rejects an execution belonging to another project as a per-item failure, not a whole-call error", async ({
    request,
  }) => {
    const asB = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: path.join(__dirname, "../.auth/state-b.json"),
    });
    const cycle = await createCycleRest(request, { name: `E2E MCP Bulk Exec Cross-Project Cycle ${Date.now()}` });
    const tc = await createCase(request, { title: `E2E MCP Bulk Exec Cross-Project Case ${Date.now()}` });
    let tokenId: string | undefined;
    let bCycleId: string | undefined;
    let bTestcaseId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      await addCycleTestCaseRest(request, cycle.id, tc.id);
      const execution = (await getCycleExecutionsRest(request, cycle.id))[0];
      expect(execution?.id).toBeTruthy();

      const bCycleRes = await asB.post(`/api/projects/${ctxB.projectId}/cycles`, {
        data: { name: `E2E MCP Bulk Exec Foreign Cycle ${Date.now()}` },
      });
      expect(bCycleRes.ok()).toBeTruthy();
      bCycleId = (await bCycleRes.json()).id;
      const bCaseRes = await asB.post(`/api/projects/${ctxB.projectId}/testcases`, {
        data: { title: `E2E MCP Bulk Exec Foreign Case ${Date.now()}` },
      });
      expect(bCaseRes.ok()).toBeTruthy();
      bTestcaseId = (await bCaseRes.json()).id;
      await approveTestcase(asB, ctxB.projectId, bTestcaseId!);
      const attachedForeign = await asB.post(`/api/cycles/${bCycleId}/testcases`, { data: { testcaseId: bTestcaseId } });
      expect(attachedForeign.ok(), await attachedForeign.text()).toBe(true);
      const bExecution = (await (await asB.get(`/api/cycles/${bCycleId}/executions`)).json())[0];
      expect(bExecution?.id).toBeTruthy();

      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP bulk_record cross-project token ${Date.now()}`, scopes: ["write"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const result = await callMcpTool(mcpApi, token, "bulk_record_execution_results", {
        results: [
          { executionId: execution.id, status: "Passed" },
          { executionId: bExecution.id, status: "Passed" },
        ],
      });
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.results[1].ok).toBe(false);

      const stillThere = await (await asB.get(`/api/cycles/${bCycleId}/executions`)).json();
      expect(stillThere.find((e: { id: string }) => e.id === bExecution.id)?.status).toBe("Untested");
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      await deleteCycleRest(request, cycle.id);
      await deleteCase(request, tc.id);
      if (bCycleId) await asB.delete(`/api/cycles/${bCycleId}`, { failOnStatusCode: false });
      if (bTestcaseId) await asB.delete(`/api/projects/${ctxB.projectId}/testcases/${bTestcaseId}`, { failOnStatusCode: false });
      await asB.dispose();
      await mcpApi.dispose();
    }
  });
});

test.describe("MCP clone_test_suite", () => {
  test("MCP-P07 cached deep clone is refused and explicit suites plus reviewed case copies preserve their source", async ({ request }) => {
    const stamp = Date.now();
    const sourceParent = await createSuiteRest(request, { name: `E2E MCP Clone Source ${stamp}` });
    const sourceChild = await createSuiteRest(request, { name: `E2E MCP Clone Source Child ${stamp}`, parentId: sourceParent.id });
    const caseInParent = await createCase(request, { title: `E2E MCP Clone Case Parent ${stamp}`, suiteId: sourceParent.id });
    const caseInChild = await createCase(request, { title: `E2E MCP Clone Case Child ${stamp}`, suiteId: sourceChild.id });
    let tokenId: string | undefined;
    let clonedParentId: string | undefined;
    let clonedChildId: string | undefined;
    let clonedCaseIds: string[] = [];
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP clone_test_suite token ${stamp}`, scopes: ["read", "write"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const beforeSuites = await callMcpTool(mcpApi, token, "list_suites", {});
      const refused = await callMcpToolExpectError(mcpApi, token, "clone_test_suite", { suiteId: sourceParent.id });
      expect(refused.data?.code).toBe("HUMAN_PUBLICATION_REQUIRED");
      expect(await callMcpTool(mcpApi, token, "list_suites", {})).toEqual(beforeSuites);
      // The human native editor creates the copied hierarchy. Cases appear only after exact human Save.
      const parent = await publishHumanSuiteChange(request, mcpApi, token, "create_suite", { name: `${sourceParent.name} (copy)` });
      clonedParentId = parent.id;
      const child = await publishHumanSuiteChange(request, mcpApi, token, "create_suite", { name: sourceChild.name, parentId: clonedParentId });
      clonedChildId = child.id;
      const saved = await stageAndApplyMcpTestcases(request, mcpApi, token, ctx.projectId, [
        { opType: "create", draft: { title: `${caseInParent.title} (copy)`, suiteId: clonedParentId } },
        { opType: "create", draft: { title: `${caseInChild.title} (copy)`, suiteId: clonedChildId } }
      ]);
      expect(clonedParentId).not.toBe(sourceParent.id);
      expect(saved.published.savedCount).toBe(2);
      clonedCaseIds = saved.published.testcases.map((item: { id: string }) => item.id);

      const clonedTree = await callMcpTool(mcpApi, token, "list_suites", {});
      const clonedParentRow = clonedTree.suites.find((s: { id: string }) => s.id === clonedParentId);
      expect(clonedParentRow).toBeTruthy();
      expect(clonedParentRow.name).toBe(`${sourceParent.name} (copy)`);
      const clonedChildRow = clonedTree.suites.find(
        (s: { parentId: string; name: string }) => s.parentId === clonedParentId && s.name === sourceChild.name,
      );
      expect(clonedChildRow).toBeTruthy();
      clonedChildId = clonedChildRow.id;

      // Original suites and test cases are completely unchanged.
      const originalParentCases = await callMcpTool(mcpApi, token, "list_testcases", { suiteId: sourceParent.id });
      expect(originalParentCases.rows.some((r: { id: string }) => r.id === caseInParent.id)).toBe(true);
      const fetchedOriginalChildCase = await (
        await request.get(`/api/projects/${ctx.projectId}/testcases/${caseInChild.id}`)
      ).json();
      expect(fetchedOriginalChildCase.suiteId).toBe(sourceChild.id);
      expect(fetchedOriginalChildCase.title).toBe(caseInChild.title);

      // The cloned test case in the cloned child suite is a real, independent copy.
      const clonedChildCases = await callMcpTool(mcpApi, token, "list_testcases", { suiteId: clonedChildId });
      expect(clonedChildCases.rows).toHaveLength(1);
      expect(clonedChildCases.rows[0].title).toBe(`${caseInChild.title} (copy)`);
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      for (const id of clonedCaseIds) await deleteCase(request, id);
      if (clonedChildId) await deleteSuiteRest(request, clonedChildId);
      if (clonedParentId) await deleteSuiteRest(request, clonedParentId);
      await deleteCase(request, caseInParent.id);
      await deleteCase(request, caseInChild.id);
      await deleteSuiteRest(request, sourceChild.id);
      await deleteSuiteRest(request, sourceParent.id);
      await mcpApi.dispose();
    }
  });

  test("rejects clone_test_suite for a suite belonging to another project, and on a nonexistent id", async ({ request }) => {
    const ghostId = "00000000-0000-0000-0000-000000000000";
    const asB = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: path.join(__dirname, "../.auth/state-b.json"),
    });
    let tokenId: string | undefined;
    let bSuiteId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const bSuiteRes = await asB.post(`/api/projects/${ctxB.projectId}/suites`, {
        data: { name: `E2E MCP Clone Cross-Project ${Date.now()}` },
      });
      expect(bSuiteRes.ok()).toBeTruthy();
      bSuiteId = (await bSuiteRes.json()).id;

      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP clone validation token ${Date.now()}`, scopes: ["write"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const crossProjectError = await callMcpToolExpectError(mcpApi, token, "clone_test_suite", { suiteId: bSuiteId });
      expect(crossProjectError.data?.code).toBe("HUMAN_PUBLICATION_REQUIRED");
      const notFoundError = await callMcpToolExpectError(mcpApi, token, "clone_test_suite", { suiteId: ghostId });
      expect(notFoundError.data?.code).toBe("HUMAN_PUBLICATION_REQUIRED");
      expect(crossProjectError.message).toBe(notFoundError.message);
      for (const suiteId of [bSuiteId, ghostId]) {
        const forbiddenSuite = await callMcpToolExpectError(mcpApi, token, "stage_testcase_changes", {
          requestKey: `foreign-suite-${suiteId}-${Date.now()}`, operations: [{ opType: "create", draft: { title: "Forbidden suite copy", suiteId } }]
        });
        expect(forbiddenSuite).toMatchObject({ code: -32003, data: { httpStatus: 400 } });
        expect(forbiddenSuite.message).toMatch(/suiteId.*this project/);
      }
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      if (bSuiteId) await asB.delete(`/api/suites/${bSuiteId}`, { failOnStatusCode: false });
      await asB.dispose();
      await mcpApi.dispose();
    }
  });
});

test.describe("MCP create_cycle_from_testcases", () => {
  test("creates a cycle with only the valid test cases attached, reporting a foreign-project id separately", async ({
    request,
  }) => {
    const stamp = Date.now();
    const asB = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: path.join(__dirname, "../.auth/state-b.json"),
    });
    const tcA = await createApprovedTestcase(request, ctx.projectId, { title: `E2E MCP Cycle From Cases A ${stamp}` });
    const tcB = await createApprovedTestcase(request, ctx.projectId, { title: `E2E MCP Cycle From Cases B ${stamp}` });
    let tokenId: string | undefined;
    let cycleId: string | undefined;
    let bCaseId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const bCaseRes = await asB.post(`/api/projects/${ctxB.projectId}/testcases`, {
        data: { title: `E2E MCP Cycle From Cases Foreign ${stamp}` },
      });
      expect(bCaseRes.ok()).toBeTruthy();
      bCaseId = (await bCaseRes.json()).id;

      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP create_cycle_from_testcases token ${stamp}`, scopes: ["write"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const result = await callMcpTool(mcpApi, token, "create_cycle_from_testcases", {
        name: `E2E MCP Cycle From Cases ${stamp}`,
        testcaseIds: [tcA.id, tcB.id, bCaseId],
      });
      cycleId = result.cycle.id;
      expect(result.testcasesRequested).toBe(3);
      expect(result.testcasesAdded).toBe(2);
      expect(result.invalidTestcaseIds).toEqual([bCaseId]);

      const executions = await getCycleExecutionsRest(request, cycleId!);
      expect(executions).toHaveLength(2);
      expect(executions.some((e: { testcaseId: string }) => e.testcaseId === tcA.id)).toBe(true);
      expect(executions.some((e: { testcaseId: string }) => e.testcaseId === tcB.id)).toBe(true);
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      if (cycleId) await deleteCycleRest(request, cycleId);
      await deleteCase(request, tcA.id);
      await deleteCase(request, tcB.id);
      if (bCaseId) await asB.delete(`/api/projects/${ctxB.projectId}/testcases/${bCaseId}`, { failOnStatusCode: false });
      await asB.dispose();
      await mcpApi.dispose();
    }
  });

  test("rejects create_cycle_from_testcases missing name/testcaseIds, and for a read-scoped token", async ({ request }) => {
    const tc = await createCase(request, { title: `E2E MCP Cycle From Cases Scope ${Date.now()}` });
    let writeTokenId: string | undefined;
    let readTokenId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      // Scope is checked before argument validation, so the "name"/"non-empty array" messages
      // can only be reached with a token that actually has write scope.
      const writeTokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP cycle-from-cases validation token ${Date.now()}`, scopes: ["write"] },
      });
      expect(writeTokenRes.ok()).toBeTruthy();
      const writeTokenBody = await writeTokenRes.json();
      writeTokenId = writeTokenBody.id;
      const writeToken = writeTokenBody.token as string;

      expect(
        (await callMcpToolExpectError(mcpApi, writeToken, "create_cycle_from_testcases", { testcaseIds: [tc.id] }))
          .message,
      ).toMatch(/"name"/i);
      expect(
        (await callMcpToolExpectError(mcpApi, writeToken, "create_cycle_from_testcases", { name: "Run" })).message,
      ).toMatch(/non-empty array/i);

      const readTokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP cycle-from-cases read-only token ${Date.now()}`, scopes: ["read"] },
      });
      expect(readTokenRes.ok()).toBeTruthy();
      const readTokenBody = await readTokenRes.json();
      readTokenId = readTokenBody.id;
      const readToken = readTokenBody.token as string;

      const scopeError = await callMcpToolExpectError(mcpApi, readToken, "create_cycle_from_testcases", {
        name: "Run",
        testcaseIds: [tc.id],
      });
      expect(scopeError.code).toBe(-32002); // RpcCode.ScopeDenied
    } finally {
      if (writeTokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${writeTokenId}`, { failOnStatusCode: false });
      }
      if (readTokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${readTokenId}`, { failOnStatusCode: false });
      }
      await deleteCase(request, tc.id);
      await mcpApi.dispose();
    }
  });
});

test.describe("MCP get_test_execution_summary", () => {
  test("summarizes actual execution data for one cycle from real recorded results", async ({ request }) => {
    const stamp = Date.now();
    const cycle = await createCycleRest(request, { name: `E2E MCP Execution Summary Cycle ${stamp}` });
    const tcA = await createCase(request, { title: `E2E MCP Execution Summary A ${stamp}` });
    const tcB = await createCase(request, { title: `E2E MCP Execution Summary B ${stamp}` });
    let tokenId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      await addCycleTestCaseRest(request, cycle.id, tcA.id);
      await addCycleTestCaseRest(request, cycle.id, tcB.id);
      const executions = await getCycleExecutionsRest(request, cycle.id);
      const execA = executions.find((e: { testcaseId: string }) => e.testcaseId === tcA.id);
      const execB = executions.find((e: { testcaseId: string }) => e.testcaseId === tcB.id);
      await request.patch(`/api/cycles/${cycle.id}/executions/${execA.id}`, { data: { status: "Passed" } });
      await request.patch(`/api/cycles/${cycle.id}/executions/${execB.id}`, { data: { status: "Failed" } });

      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP get_test_execution_summary token ${stamp}`, scopes: ["read"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const cycleSummary = await callMcpTool(mcpApi, token, "get_test_execution_summary", { cycleId: cycle.id });
      expect(cycleSummary.scope).toBe("cycle");
      expect(cycleSummary.Passed).toBe(1);
      expect(cycleSummary.Failed).toBe(1);
      expect(cycleSummary.total).toBe(2);

      // Project-wide totals can't be asserted exactly (other tests share this project), but the
      // shape must be real and this cycle's contribution must be reflected in cycleCount.
      const projectSummary = await callMcpTool(mcpApi, token, "get_test_execution_summary", {});
      expect(projectSummary.scope).toBe("project");
      expect(typeof projectSummary.total).toBe("number");
      expect(projectSummary.total).toBeGreaterThanOrEqual(2);
      expect(projectSummary.cycleCount).toBeGreaterThanOrEqual(1);
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      await deleteCycleRest(request, cycle.id);
      await deleteCase(request, tcA.id);
      await deleteCase(request, tcB.id);
      await mcpApi.dispose();
    }
  });

  test("returns all zeros for a freshly created cycle with no executions", async ({ request }) => {
    const cycle = await createCycleRest(request, { name: `E2E MCP Execution Summary Empty ${Date.now()}` });
    let tokenId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP execution summary empty token ${Date.now()}`, scopes: ["read"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const summary = await callMcpTool(mcpApi, token, "get_test_execution_summary", { cycleId: cycle.id });
      expect(summary).toMatchObject({ Passed: 0, Failed: 0, Blocked: 0, Skipped: 0, Untested: 0, Retest: 0, total: 0 });
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      await deleteCycleRest(request, cycle.id);
      await mcpApi.dispose();
    }
  });

  test("rejects get_test_execution_summary for a cycle belonging to another project, and on a nonexistent id", async ({
    request,
  }) => {
    const ghostId = "00000000-0000-0000-0000-000000000000";
    const asB = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: path.join(__dirname, "../.auth/state-b.json"),
    });
    let tokenId: string | undefined;
    let bCycleId: string | undefined;
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const bCycleRes = await asB.post(`/api/projects/${ctxB.projectId}/cycles`, {
        data: { name: `E2E MCP Execution Summary Cross-Project ${Date.now()}` },
      });
      expect(bCycleRes.ok()).toBeTruthy();
      bCycleId = (await bCycleRes.json()).id;

      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP execution summary validation token ${Date.now()}`, scopes: ["read"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const crossProjectError = await callMcpToolExpectError(mcpApi, token, "get_test_execution_summary", { cycleId: bCycleId });
      expect(crossProjectError.code).toBe(-32001); // RpcCode.ProjectScopeDenied
      const notFoundError = await callMcpToolExpectError(mcpApi, token, "get_test_execution_summary", { cycleId: ghostId });
      expect(notFoundError.message).toMatch(/not found/i);
    } finally {
      if (tokenId) {
        await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      }
      if (bCycleId) await asB.delete(`/api/cycles/${bCycleId}`, { failOnStatusCode: false });
      await asB.dispose();
      await mcpApi.dispose();
    }
  });
});

test.describe("MCP suite description and preconditions", () => {
  test("suite text persists across native creation and edits while cached cloning is refused", async ({ request }) => {
    const stamp = Date.now();
    let tokenId: string | undefined;
    const suiteIds: string[] = [];
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });
    try {
      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP suite text token ${stamp}`, scopes: ["read", "write"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const created = await publishHumanSuiteChange(request, mcpApi, token, "create_suite", {
        name: `E2E MCP Suite Text ${stamp}`,
        description: "Created by a human",
        preconditions: "Seed data loaded",
      });
      suiteIds.push(created.id);
      expect(created.description).toBe("Created by a human");
      expect(created.preconditions).toBe("Seed data loaded");

      const got = await callMcpTool(mcpApi, token, "get_suite", { suiteId: created.id });
      expect([got.description, got.preconditions]).toEqual(["Created by a human", "Seed data loaded"]);
      const listed = (await callMcpTool(mcpApi, token, "list_suites", {})).suites.find((s: { id: string }) => s.id === created.id);
      expect(listed.description).toBe("Created by a human");

      // A rename that omits the text keeps it; an empty string clears just that field.
      const renamed = await publishHumanSuiteChange(request, mcpApi, token, "update_suite", { suiteId: created.id, name: `E2E MCP Suite Text ${stamp} renamed` });
      expect([renamed.description, renamed.preconditions]).toEqual(["Created by a human", "Seed data loaded"]);
      const cleared = await publishHumanSuiteChange(request, mcpApi, token, "update_suite", { suiteId: created.id, preconditions: "" });
      expect([cleared.description, cleared.preconditions]).toEqual(["Created by a human", ""]);
      const edited = await publishHumanSuiteChange(request, mcpApi, token, "update_suite", { suiteId: created.id, description: "Edited", preconditions: "Back again" });
      expect([edited.description, edited.preconditions]).toEqual(["Edited", "Back again"]);

      // A child suite retains its own text; cached deep cloning cannot publish cases.
      const child = await publishHumanSuiteChange(request, mcpApi, token, "create_suite", {
        name: `E2E MCP Suite Child ${stamp}`,
        parentId: created.id,
        description: "Child text",
      });
      suiteIds.push(child.id);
      const beforeClone = await callMcpTool(mcpApi, token, "list_suites", {});
      const denied = await callMcpToolExpectError(mcpApi, token, "clone_test_suite", { suiteId: created.id, name: `E2E MCP Suite Clone ${stamp}` });
      expect(denied.data?.code).toBe("HUMAN_PUBLICATION_REQUIRED");
      expect(await callMcpTool(mcpApi, token, "list_suites", {})).toEqual(beforeClone);
      const copiedParent = await publishHumanSuiteChange(request, mcpApi, token, "create_suite", {
        name: `E2E MCP Suite Clone ${stamp}`, description: edited.description, preconditions: edited.preconditions
      });
      suiteIds.push(copiedParent.id);
      const copiedChild = await publishHumanSuiteChange(request, mcpApi, token, "create_suite", {
        name: child.name, parentId: copiedParent.id, description: child.description, preconditions: child.preconditions
      });
      suiteIds.push(copiedChild.id);
      expect(copiedParent).toMatchObject({ description: "Edited", preconditions: "Back again" });
      expect(copiedChild).toMatchObject({ description: "Child text", preconditions: "", parentId: copiedParent.id });

      // Over the limit is refused as a tool error, and nothing is written.
      const deniedLong = await callMcpToolExpectError(mcpApi, token, "update_suite", { suiteId: created.id, description: "x".repeat(20001) });
      expect(deniedLong.data?.code).toBe("HUMAN_PUBLICATION_REQUIRED");
      const tooLong = await request.patch(`/api/suites/${created.id}`, { data: { description: "x".repeat(20001) } });
      expect(tooLong.status()).toBe(400);
      expect(await tooLong.text()).toMatch(/too long|limit/i);
      expect((await callMcpTool(mcpApi, token, "get_suite", { suiteId: created.id })).description).toBe("Edited");
    } finally {
      for (const id of suiteIds.reverse()) await request.delete(`/api/suites/${id}`, { failOnStatusCode: false });
      if (tokenId) await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      await mcpApi.dispose();
    }
  });
});

test.describe("MCP test case ID", () => {
  test("update_testcase changes the ID, refuses a taken or malformed one, and leaves it alone when omitted", async ({ request }) => {
    const stamp = Date.now();
    let tokenId: string | undefined;
    const caseIds: string[] = [];
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl,
      storageState: { cookies: [], origins: [] },
    });
    try {
      const tokenRes = await issueMcpTestToken(request, `/api/projects/${ctx.projectId}/apikeys`, {
        data: { name: `E2E MCP case id token ${stamp}`, scopes: ["read", "write"] },
      });
      expect(tokenRes.ok()).toBeTruthy();
      const tokenBody = await tokenRes.json();
      tokenId = tokenBody.id;
      const token = tokenBody.token as string;

      const a = await createCase(request, { title: `E2E MCP ID A ${stamp}` });
      const b = await createCase(request, { title: `E2E MCP ID B ${stamp}` });
      caseIds.push(a.id, b.id);

      const renamed = await publishReviewedCaseChange(request, mcpApi, token, "update_testcase", { testcaseId: a.id, externalId: `Z${stamp}-TC-3` });
      expect(renamed.externalId).toBe(`Z${stamp}-TC-3`);
      expect((await callMcpTool(mcpApi, token, "get_testcase", { testcaseId: a.id })).externalId).toBe(`Z${stamp}-TC-3`);

      for (const [externalId, expectedStatus, message] of [
        [`Z${stamp}-TC-3`, 409, /already used/i], ["  ", 400, /non-empty|spaces/i]
      ] as const) {
        const before = await callMcpTool(mcpApi, token, "get_testcase", { testcaseId: b.id });
        const denied = await callMcpToolExpectError(mcpApi, token, "update_testcase", { testcaseId: b.id, externalId });
        expect(denied.data?.code).toBe("HUMAN_PUBLICATION_REQUIRED");
        const staged = await callMcpTool(mcpApi, token, "stage_testcase_changes", {
          requestKey: `invalid-id-${expectedStatus}-${stamp}`, operations: [{ opType: "update", testcaseId: b.id,
            expectedRevision: before.editRevision, fields: { externalId } }]
        });
        expect(staged.publication).toBe("unpublished");
        const taskUrl = `/api/projects/${ctx.projectId}/agents/zyra/tasks/${staged.taskId}`;
        const reviewed = await request.get(taskUrl);
        expect(reviewed.ok(), await reviewed.text()).toBe(true);
        const revision = (await reviewed.json()).proposalRevision;
        const refused = await request.post(`${taskUrl}/save`, { data: { expectedProposalRevision: revision, selectedDraftIndexes: [0] } });
        expect(refused.status(), await refused.text()).toBe(expectedStatus);
        expect(JSON.stringify(await refused.json())).toMatch(message);
        expect(testcaseEditState(await callMcpTool(mcpApi, token, "get_testcase", { testcaseId: b.id })))
          .toEqual(testcaseEditState(before));
      }

      // Omitting it leaves it alone.
      const kept = await publishReviewedCaseChange(request, mcpApi, token, "update_testcase", { testcaseId: a.id, title: `E2E MCP ID A ${stamp} edited` });
      expect(kept.externalId).toBe(`Z${stamp}-TC-3`);
    } finally {
      for (const id of caseIds) await deleteCase(request, id);
      if (tokenId) await request.delete(`/api/projects/${ctx.projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
      await mcpApi.dispose();
    }
  });
});


test("MCP-P07 SEC-NATIVE-01 suite publication refuses both machine aliases and REST while native human review remains usable", async () => {
  const tenant = await provisionRbacTenant("mcp-lifecycle");
  expect(tenant, "SEC-NATIVE-01 requires the authorized disposable database fixture").not.toBeNull();
  const owner = await loginAs(tenant!.owner);
  const machine = await newRequestContext.newContext({ baseURL: env.apiBaseUrl, storageState: { cookies: [], origins: [] } });
  const suiteIds: string[] = [], caseIds: string[] = [];
  let tokenId: string | undefined, projectId = "", base = "";
  try {
    const stamp = Date.now().toString().slice(-7);
    const project = await owner.post("/api/projects", { data: { name: `E2E suite publication ${stamp}`, key: `SEC${stamp}` } });
    expect(project.ok(), await project.text()).toBeTruthy();
    projectId = String((await project.json()).id); base = `/api/projects/${projectId}`;
    const create = async (body: Record<string, unknown>) => {
      const response = await owner.post(`${base}/suites`, { data: body });
      expect(response.ok(), await response.text()).toBeTruthy();
      const suite = await response.json(); suiteIds.push(suite.id); return suite;
    };
    const parent = await create({ name: "Native human parent" });
    const child = await create({ name: "Native human child", parentId: parent.id, description: "Keep context", preconditions: "Keep prerequisites" });
    const issued = await issueMcpTestToken(owner, `${base}/apikeys`, { data: { name: "Explicit suite-boundary test client", scopes: ["read", "write"] } });
    expect(issued.ok(), await issued.text()).toBeTruthy();
    const token = await issued.json(); tokenId = token.id;
    const headers = { Authorization: `Bearer ${token.token}` };
    const state = () => scalar(`SELECT jsonb_build_object(
      'suites',(SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) FROM suites s WHERE s.project_id=${literal(projectId)}),
      'cases',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) FROM testcases t WHERE t.project_id=${literal(projectId)}),
      'audit',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM audit_logs a WHERE a.project_id=${literal(projectId)})
    )::text;`);
    const before = state();
    for (const route of ["/api/mcp", `${base}/mcp`]) {
      for (const [name, args] of [
        ["create_suite", { name: "Forbidden machine suite", parentId: parent.id }],
        ["update_suite", { suiteId: child.id, name: "Forbidden rename", parentId: null, description: "Forbidden context", preconditions: "Forbidden setup" }]
      ] as const) {
        const response = await machine.post(route, { headers, data: { jsonrpc: "2.0", id: 1, method: "tools/call", params: {
          name, arguments: { ...args, principal: { kind: "human_session" }, approved: true }
        } } });
        expect(response.ok(), await response.text()).toBeTruthy();
        const denied = await response.json();
        expect(denied.error.data.code).toBe("HUMAN_PUBLICATION_REQUIRED");
        expect(denied.result).toBeUndefined();
        expect(state()).toBe(before);
      }
    }
    const deniedRest = await machine.post(`${base}/suites`, { headers, data: { name: "Forbidden REST suite", principal: { kind: "human_session" } } });
    expect(deniedRest.status()).toBe(403);
    expect((await deniedRest.json()).code).toBe("HUMAN_PUBLICATION_REQUIRED");
    expect(state()).toBe(before);

    const changed = await owner.patch(`/api/suites/${child.id}`, { data: { name: "Reviewed human rename", preconditions: "" } });
    expect(changed.ok(), await changed.text()).toBeTruthy();
    const suites = await owner.get(`${base}/suites`);
    expect((await suites.json()).find((suite: { id: string }) => suite.id === child.id)).toMatchObject({
      name: "Reviewed human rename", parentId: parent.id, description: "Keep context", preconditions: ""
    });

    // The selected human Save may create a suite inside its native transaction, after exact
    // proposal validation. It does not impersonate a human at the machine adapter.
    const stagedResponse = await machine.post(`${base}/mcp`, { headers, data: { jsonrpc: "2.0", id: 2, method: "tools/call", params: {
      name: "stage_testcase_changes", arguments: { requestKey: `suite-review-${Date.now()}`, operations: [{ opType: "create", draft: { title: "Selected reviewed suite case" } }] }
    } } });
    expect(stagedResponse.ok(), await stagedResponse.text()).toBeTruthy();
    const stagedRpc = await stagedResponse.json(); expect(stagedRpc.error).toBeUndefined();
    const staged = JSON.parse(stagedRpc.result.content[0].text);
    const reviewResponse = await owner.get(`${base}/agents/zyra/tasks/${staged.taskId}`);
    expect(reviewResponse.ok(), await reviewResponse.text()).toBeTruthy();
    const reviewed = await reviewResponse.json(), suiteName = "Suite chosen by exact human Save";
    expect((await (await owner.get(`${base}/suites`)).json()).some((suite: { name: string }) => suite.name === suiteName)).toBe(false);
    const savedResponse = await owner.post(`${base}/agents/zyra/tasks/${staged.taskId}/save`, { data: {
      expectedProposalRevision: reviewed.proposalRevision, selectedDraftIndexes: [0], suiteName
    } });
    expect(savedResponse.ok(), await savedResponse.text()).toBeTruthy();
    const saved = await savedResponse.json();
    expect(saved.savedCount).toBe(1);
    expect(saved.saveReceipt).toMatchObject({ principalKind: "human_session", reviewerId: tenant!.owner.userId,
      applyParameters: { suiteNameProvided: true, suiteName } });
    caseIds.push(saved.testcases[0].id);
    const afterSuites = await (await owner.get(`${base}/suites`)).json();
    const selectedSuite = afterSuites.find((suite: { name: string }) => suite.name === suiteName);
    expect(selectedSuite).toBeTruthy(); suiteIds.push(selectedSuite.id);
    const native = await owner.get(`${base}/testcases/${caseIds[0]}`);
    expect(native.ok(), await native.text()).toBeTruthy();
    expect(await native.json()).toMatchObject({ title: "Selected reviewed suite case", status: "Draft", suiteId: selectedSuite.id });
  } finally {
    for (const id of caseIds) await owner.delete(`${base}/testcases/${id}`, { failOnStatusCode: false });
    for (const id of suiteIds.reverse()) await owner.delete(`/api/suites/${id}`, { failOnStatusCode: false });
    if (tokenId) await owner.delete(`${base}/apikeys/${tokenId}`, { failOnStatusCode: false });
    if (projectId) await owner.delete(base, { failOnStatusCode: false });
    await Promise.all([owner.dispose(),machine.dispose()]);
  }
});

test("MCP-P18 project consent, named credentials and revocation cover both aliases and cached sessions", async () => {
  const tenant = await provisionRbacTenant("mcp-lifecycle");
  expect(tenant, "MCP-P18 requires the authorized disposable database fixture").not.toBeNull();
  const owner = await loginAs(tenant!.owner);
  const qa = await loginAs(tenant!.qa);
  const machine = await newRequestContext.newContext({ baseURL: env.apiBaseUrl, storageState: { cookies: [], origins: [] } });
  let projectId: string | undefined;
  const credentials: Array<{ id: string; token: string }> = [];
  let foreignTokenId: string | undefined;
  try {
    const stamp = Date.now().toString().slice(-9);
    const created = await owner.post("/api/projects", { data: { name: `E2E MCP consent ${stamp}`, key: `MCP${stamp}` } });
    expect(created.ok(), await created.text()).toBeTruthy();
    projectId = (await created.json()).id;
    const endpoint = `/api/projects/${projectId}/mcp-access`;
    const read = async () => {
      const response = await owner.get(endpoint);
      expect(response.ok(), await response.text()).toBeTruthy();
      return response.json();
    };
    const initial = await read();
    expect(initial).toEqual({ enabled: false, revision: 0, clients: [] });
    const issued = await owner.post(`/api/projects/${projectId}/apikeys`, { data: { name: "Approved test executor", scopes: ["read", "write"] } });
    expect(issued.ok(), await issued.text()).toBeTruthy();
    const token = await issued.json(); credentials.push(token);
    const other = await owner.post(`/api/projects/${projectId}/apikeys`, { data: { name: "Unapproved test executor", scopes: ["read", "write"] } });
    expect(other.ok(), await other.text()).toBeTruthy();
    const unapproved = await other.json(); credentials.push(unapproved);
    const aliases = ["/api/mcp", `/api/projects/${projectId}/mcp`];
    const rpc = async (route: string, method: string, credential = token.token, session?: string, params: Record<string, unknown> = {}) => {
      const response = await machine.post(route, {
        headers: { Authorization: `Bearer ${credential}`, ...(session ? { "Mcp-Session-Id": session } : {}) },
        data: { jsonrpc: "2.0", ...(method.startsWith("notifications/") ? {} : { id: 41 }), method, params }
      });
      return { response, body: response.status() === 202 ? null : await response.json() };
    };
    for (const route of aliases) {
      for (const method of ["initialize", "tools/list", "ping", "tools/call", "notifications/initialized"]) {
        const denied = await rpc(route, method, token.token, "old.cached.session", { name: "list_projects" });
        expect(denied.body.error.code).toBe(-32001);
        expect(denied.body.result).toBeUndefined();
      }
    }
    // Ordinary native use remains possible while MCP is off.
    expect((await owner.get(`/api/projects/${projectId}`)).ok()).toBeTruthy();
    expect((await qa.get(endpoint)).status()).toBe(404); // not a member of this new project
    const machineGrant = await machine.put(endpoint, { headers: { Authorization: `Bearer ${token.token}` }, data: { ...initial, enabled: true } });
    expect(machineGrant.status()).toBe(403);
    expect(await read()).toEqual(initial);
    const grant = { tokenId: token.id, clientName: "QA executor", scopes: ["read", "write"], allowedTools: ["list_projects", "create_knowledge_folder"], expiresAt: null };
    for (const bad of [
      { ...initial, enabled: "true" },
      { ...initial, revision: -1 },
      { ...initial, clients: [{ ...grant, clientName: " " }] },
      { ...initial, clients: [{ ...grant, scopes: ["admin"] }] },
      { ...initial, clients: [{ ...grant, allowedTools: ["unknown_tool"] }] },
      { ...initial, clients: [grant, grant] }
    ]) {
      expect((await owner.put(endpoint, { data: bad })).status()).toBe(400);
      expect(await read()).toEqual(initial);
    }
    const foreign = await owner.post(`/api/projects/${tenant!.secondProjectId}/apikeys`, { data: { name: "Foreign MCP credential", scopes: ["read"] } });
    expect(foreign.ok(), await foreign.text()).toBeTruthy();
    foreignTokenId = (await foreign.json()).id;
    expect((await owner.put(endpoint, { data: { ...initial, enabled: true, clients: [{ ...grant, tokenId: foreignTokenId, scopes: ["read"] }] } })).status()).toBe(400);
    expect(await read()).toEqual(initial);
    const enabledResponse = await owner.put(endpoint, { data: { ...initial, enabled: true, clients: [grant] } });
    expect(enabledResponse.ok(), await enabledResponse.text()).toBeTruthy();
    let current = await enabledResponse.json();
    expect(current.revision).toBe(1);
    // Stale administration cannot silently overwrite a more recent human decision.
    expect((await owner.put(endpoint, { data: { ...initial, enabled: false } })).status()).toBe(409);
    expect(await read()).toEqual(current);
    // Generic whole-project settings writes cannot enable, delete or restore this reserved field.
    const generic = await owner.patch(`/api/projects/${projectId}`, { data: { settings: { testcaseIdPrefix: "MCP", externalMcpAccess: { ...initial, enabled: false } } } });
    expect(generic.ok(), await generic.text()).toBeTruthy();
    expect(await read()).toEqual(current);
    const initialized = await rpc(aliases[0], "initialize");
    expect(initialized.body.result.serverInfo.name).toBe("tesbo-mcp");
    const session = initialized.response.headers()["mcp-session-id"];
    expect(session).toBeTruthy();
    for (const route of aliases) {
      const list = await rpc(route, "tools/list", token.token, session);
      expect(list.body.result.tools.map((tool: { name: string }) => tool.name).sort()).toEqual(["create_knowledge_folder", "list_projects"]);
      const denied = await rpc(route, "tools/list", unapproved.token, undefined, { clientInfo: { name: "QA executor" } });
      expect(denied.body.error.code).toBe(-32001); // claimed app name is never authorization
      const hiddenTool = await rpc(route, "tools/call", token.token, session, { name: "list_testcases", arguments: {} });
      expect(hiddenTool.body.error.code).toBe(-32002);
    }
    const made = await rpc(aliases[0], "tools/call", token.token, session, { name: "create_knowledge_folder", arguments: { name: "MCP consent permitted folder" } });
    expect(made.body.error).toBeUndefined();
    const folder = JSON.parse(made.body.result.content[0].text);
    expect((await owner.get(`/api/projects/${projectId}/knowledge-base/folders/${folder.id}`)).ok()).toBeTruthy();
    expect((await owner.delete(`/api/projects/${projectId}/knowledge-base/folders/${folder.id}`)).ok()).toBeTruthy();
    const disabled = await owner.put(endpoint, { data: { ...current, enabled: false } });
    expect(disabled.ok(), await disabled.text()).toBeTruthy(); current = await disabled.json();
    for (const route of aliases) {
      for (const method of ["tools/list", "tools/call", "notifications/initialized"]) {
        const denied = await rpc(route, method, token.token, session, { name: "create_knowledge_folder", arguments: { name: "MCP must never write" } });
        expect(denied.body.error.code).toBe(-32001);
      }
    }
    expect(Number(scalar(`SELECT COUNT(*) FROM knowledge_folders WHERE project_id=${literal(projectId!)} AND name='MCP must never write';`))).toBe(0);
    const expired = await owner.put(endpoint, { data: { ...current, enabled: true, clients: [{ ...grant, expiresAt: "2000-01-01T00:00:00.000Z" }] } });
    expect(expired.ok(), await expired.text()).toBeTruthy(); current = await expired.json();
    expect((await rpc(aliases[0], "tools/list", token.token, session)).body.error.code).toBe(-32001);
    const revoked = await owner.put(endpoint, { data: { ...current, clients: [] } });
    expect(revoked.ok(), await revoked.text()).toBeTruthy();
    expect((await rpc(aliases[1], "tools/list", token.token, session)).body.error.code).toBe(-32001);
    expect(Number(scalar(`SELECT COUNT(*) FROM audit_logs WHERE project_id=${literal(projectId!)} AND action='project_mcp_access_updated';`))).toBe(4);
  } finally {
    if (projectId) {
      for (const token of credentials) await owner.delete(`/api/projects/${projectId}/apikeys/${token.id}`, { failOnStatusCode: false });
      await owner.delete(`/api/projects/${projectId}`, { failOnStatusCode: false });
    }
    if (foreignTokenId) await owner.delete(`/api/projects/${tenant!.secondProjectId}/apikeys/${foreignTokenId}`, { failOnStatusCode: false });
    await Promise.all([owner.dispose(), qa.dispose(), machine.dispose()]);
  }
});
