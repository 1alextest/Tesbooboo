import { expect, request as newRequest, test, type APIRequestContext, type Page, type Route, type TestInfo } from "@playwright/test";
import { Client } from "pg";
import { hashPasswordForSeed } from "./utils/password";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { verifyProductionReporter } from "./utils/ci-reporter";
import { verifyContentSecurity } from "./utils/ci-content-security";
import { verifyDocumentWrites } from "./utils/ci-document-writes";
import { verifyRepositoryPartialEdits } from "./utils/ci-repository-partial-edits";
import { verifyBugMetadataWrites } from "./utils/ci-bug-metadata-writes";

async function verifyBugCreateAccess(request: APIRequestContext, api: string, projectId: string, ownerId: string, organizationId: string) {
  // Called only after the test's explicit loopback/disposable-database safety checks.
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  const anonymous = await newRequest.newContext({ storageState: { cookies: [], origins: [] } });
  const nonmember = await newRequest.newContext({ storageState: { cookies: [], origins: [] } });
  const base = `${api}/api/projects/${projectId}`;
  const bugs: string[] = [];
  const tokenIds: string[] = [];
  let cycleId = "";
  let testcaseId = "";
  let otherOrgId = "";
  await db.connect();
  try {
    const outsider = (await db.query<{ id: string }>(
      "INSERT INTO users (email, name, password_hash, active_organization_id) VALUES ($1,'CI nonmember',$2,$3) RETURNING id",
      ["ci-bug-nonmember@tesbo.invalid", hashPasswordForSeed("Ci-Bugs-2026!"), organizationId]
    )).rows[0].id;
    await db.query("INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1,$2,'qa_engineer')", [organizationId, outsider]);
    await db.query("UPDATE users SET active_organization_id = $1 WHERE id = $2", [organizationId, ownerId]);
    const login = await nonmember.post(`${api}/api/auth/password/login`, {
      data: { email: "ci-bug-nonmember@tesbo.invalid", password: "Ci-Bugs-2026!" }
    });
    expect(login.ok(), await login.text()).toBeTruthy();

    const testcaseResponse = await request.post(`${base}/testcases`, { data: { title: "CI authorization control" } });
    expect(testcaseResponse.ok(), await testcaseResponse.text()).toBeTruthy();
    testcaseId = (await testcaseResponse.json()).id;
    const cycleResponse = await request.post(`${base}/cycles`, { data: { name: "CI authorization control" } });
    expect(cycleResponse.ok(), await cycleResponse.text()).toBeTruthy();
    cycleId = (await cycleResponse.json()).id;
    const attached = await request.post(`${api}/api/cycles/${cycleId}/testcases`, { data: { testcaseIds: [testcaseId] } });
    expect(attached.ok(), await attached.text()).toBeTruthy();
    const execution = (await db.query<{ id: string }>(
      "SELECT e.id FROM executions e JOIN cycle_items ci ON ci.id = e.cycle_item_id WHERE ci.cycle_id = $1", [cycleId]
    )).rows[0];
    const passed = await request.patch(`${api}/api/cycles/${cycleId}/executions/${execution.id}`, { data: { status: "Passed" } });
    expect(passed.ok(), await passed.text()).toBeTruthy();
    const body = { title: "CI authorized bug", links: [{ testcaseId, cycleId, executionId: execution.id }] };
    const persisted = async () => ({
      bugs: (await db.query("SELECT * FROM bugs WHERE project_id = $1 ORDER BY id", [projectId])).rows,
      links: (await db.query("SELECT bl.* FROM bug_links bl JOIN bugs b ON b.id = bl.bug_id WHERE b.project_id = $1 ORDER BY bl.id", [projectId])).rows,
      execution: (await db.query("SELECT * FROM executions WHERE id = $1", [execution.id])).rows,
      run: (await db.query("SELECT * FROM cycles WHERE id = $1", [cycleId])).rows,
      snapshot: (await db.query("SELECT * FROM cycle_items WHERE cycle_id = $1 ORDER BY id", [cycleId])).rows
    });
    const denied = async (client: APIRequestContext, status: number, headers?: Record<string, string>) => {
      const before = await persisted();
      const response = await client.post(`${base}/bugs`, { data: body, headers });
      const data = await response.json();
      if (data.id) bugs.push(data.id); // Preserve cleanup if the regression accidentally accepts.
      expect(response.status(), JSON.stringify(data)).toBe(status);
      expect(await persisted()).toEqual(before);
    };
    await denied(anonymous, 400);
    await denied(anonymous, 400, { Authorization: "Bearer not-a-valid-token" });
    await denied(nonmember, 404);
    const tokens: Record<string, string> = {};
    for (const scope of ["read", "write"]) {
      const response = await request.post(`${base}/apikeys`, { data: { name: `CI bug ${scope}`, scopes: [scope] } });
      expect(response.ok(), await response.text()).toBeTruthy();
      const token = await response.json();
      tokenIds.push(token.id);
      tokens[scope] = token.token;
    }
    await denied(anonymous, 403, { Authorization: `Bearer ${tokens.read}` });

    await db.query("DELETE FROM project_members WHERE project_id = $1 AND user_id = $2", [projectId, ownerId]);
    try {
      await denied(request, 404);
      await denied(anonymous, 404, { Authorization: `Bearer ${tokens.write}` });
      const before = await persisted();
      const refusedMcp = await anonymous.post(`${base}/mcp`, {
        headers: { Authorization: `Bearer ${tokens.write}` },
        data: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "create_bug", arguments: body } }
      });
      expect(refusedMcp.ok()).toBeTruthy();
      expect((await refusedMcp.json()).error).toBeDefined();
      expect(await persisted()).toEqual(before);
    } finally {
      await db.query("INSERT INTO project_members (project_id, user_id, role) VALUES ($1,$2,'owner') ON CONFLICT DO NOTHING", [projectId, ownerId]);
    }
    otherOrgId = (await db.query<{ id: string }>(
      "INSERT INTO organizations (name, slug) VALUES ('CI other workspace','ci-bug-auth-other') RETURNING id"
    )).rows[0].id;
    await db.query("INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1,$2,'owner')", [otherOrgId, ownerId]);
    await db.query("UPDATE users SET active_organization_id = $1 WHERE id = $2", [otherOrgId, ownerId]);
    await denied(request, 404);
    await db.query("UPDATE users SET active_organization_id = $1 WHERE id = $2", [organizationId, ownerId]);
    await db.query("UPDATE projects SET archived_at = now() WHERE id = $1", [projectId]);
    await denied(request, 404);
    await db.query("UPDATE projects SET archived_at = NULL WHERE id = $1", [projectId]);

    for (const transport of ["REST", "MCP"]) {
      const response = await anonymous.post(transport === "REST" ? `${base}/bugs` : `${base}/mcp`, {
        headers: { Authorization: `Bearer ${tokens.write}` },
        data: transport === "REST" ? body : { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "create_bug", arguments: body } }
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      const result = await response.json();
      if (transport === "MCP") expect(result.error).toBeUndefined();
      const created = transport === "REST" ? result : JSON.parse(result.result.content[0].text);
      bugs.push(created.id);
      expect(created).toMatchObject({ reportedBy: ownerId });
      expect(created.links).toEqual(expect.arrayContaining([expect.objectContaining(body.links[0])]));
      expect((await persisted()).execution[0]).toMatchObject({ status: "Failed", executed_by: ownerId });
    }
    await verifyHistoryImportText(request, nonmember, anonymous, db, api, projectId);
  } finally {
    await db.query("UPDATE users SET active_organization_id = $1 WHERE id = $2", [organizationId, ownerId]);
    await db.query("UPDATE projects SET archived_at = NULL WHERE id = $1", [projectId]);
    await db.query("INSERT INTO project_members (project_id, user_id, role) VALUES ($1,$2,'owner') ON CONFLICT DO NOTHING", [projectId, ownerId]);
    for (const id of bugs) await request.delete(`${api}/api/bugs/${id}`, { failOnStatusCode: false });
    for (const id of tokenIds) await request.delete(`${base}/apikeys/${id}`, { failOnStatusCode: false });
    if (cycleId) await request.delete(`${api}/api/cycles/${cycleId}`, { failOnStatusCode: false });
    if (testcaseId) await request.delete(`${base}/testcases/${testcaseId}`, { failOnStatusCode: false });
    if (otherOrgId) {
      await db.query("DELETE FROM organization_members WHERE organization_id = $1", [otherOrgId]);
      await db.query("DELETE FROM organizations WHERE id = $1", [otherOrgId]);
    }
    // Keep authenticated synthetic identity/audit provenance until the CI service teardown.
    // Do not delete immutable audit rows merely to remove a fixture user.
    await anonymous.dispose();
    await nonmember.dispose();
    await db.end();
  }
}

async function verifyHistoryImportText(
  request: APIRequestContext, nonmember: APIRequestContext, anonymous: APIRequestContext,
  db: Client, api: string, projectId: string
) {
  // Reuse this smoke's genuine sessions and already safety-checked disposable DB connection.
  const base = `${api}/api/projects/${projectId}`;
  const cases: Array<{ id: string; externalId: string }> = [];
  const runs: string[] = [];
  const endpoint = (runId: string) => `${api}/api/cycles/${runId}/history-import`;
  const state = async () => ({
    runs: (await db.query("SELECT * FROM cycles WHERE id = ANY($1::uuid[]) ORDER BY id", [runs])).rows,
    snapshots: (await db.query("SELECT * FROM cycle_items WHERE cycle_id = ANY($1::uuid[]) ORDER BY id", [runs])).rows,
    executions: (await db.query("SELECT e.* FROM executions e JOIN cycle_items ci ON ci.id = e.cycle_item_id WHERE ci.cycle_id = ANY($1::uuid[]) ORDER BY e.id", [runs])).rows,
    cases: (await db.query("SELECT * FROM testcases WHERE id = ANY($1::uuid[]) ORDER BY id", [cases.map((item) => item.id)])).rows,
    audit: (await db.query("SELECT * FROM audit_logs WHERE project_id = $1 AND entity_id::text = ANY($2::text[]) ORDER BY id", [projectId, runs])).rows,
    attachments: (await db.query("SELECT * FROM attachments WHERE project_id = $1 AND entity_id::text = ANY($2::text[]) ORDER BY id", [projectId, runs])).rows
  });
  try {
    for (let i = 0; i < 2; i++) {
      const created = await request.post(`${base}/testcases`, { data: { title: `CI history text ${i}` } });
      expect(created.ok(), await created.text()).toBeTruthy();
      cases.push(await created.json());
    }
    const manual = await request.post(`${base}/cycles`, { data: { name: "CI history text" } });
    expect(manual.ok(), await manual.text()).toBeTruthy();
    const runId = (await manual.json()).id as string;
    runs.push(runId);
    const attached = await request.post(`${api}/api/cycles/${runId}/testcases`, { data: { testcaseIds: cases.map((item) => item.id) } });
    expect(attached.ok(), await attached.text()).toBeTruthy();
    const before = await state();
    const nul = "before\u0000after";
    const invalid: Array<{ label: string; run?: Record<string, unknown>; result?: Record<string, unknown> }> = [
      { label: "run.tags[1]", run: { tags: ["valid", nul] } },
      { label: "results[1].actualResult", result: { actualResult: nul } },
      { label: "results[1].errorMessage", result: { errorMessage: nul } },
      { label: "results[1].errorStack", result: { errorStack: nul } },
      { label: "results[1].stepResults[0].comment", result: { stepResults: [{ position: 1, status: "Failed", comment: nul }] } },
      { label: "results[1].history[0].comment", result: { history: [{ status: "Passed", comment: nul }] } },
      { label: "results[1].history[0].errorStack", result: { history: [{ status: "Passed", errorStack: nul }] } }
    ];
    for (const item of invalid) {
      const response = await request.post(endpoint(runId), { data: {
        run: { tags: ["Must not persist"], timeSpentMs: 321, ...item.run },
        results: [{ testcaseId: cases[0].id, status: "Failed", actualResult: "Must not persist" }, { testcaseId: cases[1].id, ...item.result }],
        refreshSnapshots: true
      } });
      // Inspect independent persisted rows even on the intentionally failing baseline HTTP assertion.
      expect(await state()).toEqual(before);
      expect(response.status(), `${item.label}: ${await response.text()}`).toBe(400);
      expect(await response.json()).toMatchObject({ error: `${item.label} must not contain U+0000` });
    }
    for (const [client, expected] of [[anonymous, 400], [nonmember, 404]] as const) {
      const response = await client.post(endpoint(runId), { data: { run: { tags: ["Unauthorized"] } } });
      expect(response.status(), await response.text()).toBe(expected);
      expect(await state()).toEqual(before);
    }

    const text = "日本語 café 😀\n\t literal \\u0000";
    const payload = {
      run: { status: "Completed", closedAt: "2024-03-13T15:18:01Z", closeStatus: "completed", tags: [" Smoke 😀 ", "SMOKE 😀"] },
      results: [{ testcaseId: cases[0].id, status: "Passed", actualResult: text, errorMessage: null, errorStack: text,
        stepResults: [{ position: 1, status: "Passed", comment: text }], history: [{ status: "Passed", comment: text, errorStack: null }] }],
      refreshSnapshots: true
    };
    for (let repeat = 0; repeat < 2; repeat++) {
      const accepted = await request.post(endpoint(runId), { data: payload });
      expect(accepted.ok(), await accepted.text()).toBeTruthy();
      expect(await accepted.json()).toMatchObject({ applied: 1, unmatched: [], refreshedSnapshots: 2 });
    }
    let saved = await state();
    expect(saved.executions).toHaveLength(2);
    const original = before.executions.find((row) => row.cycle_item_id === before.snapshots.find((item) => item.testcase_id === cases[0].id)?.id)!;
    expect(saved.executions.find((row) => row.id === original.id)).toMatchObject({
      status: "Passed", actual_result: text, error_message: null, error_stack: text,
      step_results: payload.results[0].stepResults, history: payload.results[0].history,
      executed_by: original.executed_by, assignee_id: original.assignee_id
    });
    expect(saved.runs[0]).toMatchObject({ status: "Completed", source: "manual", close_status: "completed", tags: ["Smoke 😀"] });
    const clear = await request.post(endpoint(runId), { data: { results: [{ testcaseId: cases[0].id, actualResult: null, errorStack: null, history: null, stepResults: null }] } });
    expect(clear.ok(), await clear.text()).toBeTruthy();
    const empty = await request.post(endpoint(runId), { data: {} });
    expect(await empty.json()).toMatchObject({ applied: 0, unmatched: [], refreshedSnapshots: 0, runFields: [] });
    saved = await state();
    expect(saved.executions.find((row) => row.id === original.id)).toMatchObject({ status: "Passed", actual_result: null, error_stack: null, history: null, step_results: null });

    const automation = await request.post(`${base}/automation/runs`, { data: { name: "CI history automation control", caseIds: [cases[0].externalId] } });
    expect(automation.ok(), await automation.text()).toBeTruthy();
    const automationId = (await automation.json()).runId as string;
    runs.push(automationId);
    const open = await request.post(endpoint(automationId), { data: { results: [{ testcaseId: cases[0].id, actualResult: text }] } });
    expect(open.ok(), await open.text()).toBeTruthy();
    expect((await open.json()).applied).toBe(1);
    const closed = await request.patch(`${base}/automation/runs/${automationId}/close`, { data: { status: "incomplete" } });
    expect(closed.ok(), await closed.text()).toBeTruthy();
    const sealed = await state();
    const refused = await request.post(endpoint(automationId), { data: { results: [{ testcaseId: cases[0].id, actualResult: "Must not rewrite sealed result" }] } });
    expect(refused.status(), await refused.text()).toBe(409);
    expect(await state()).toEqual(sealed);
  } finally {
    for (const id of runs) await request.delete(`${api}/api/cycles/${id}`, { failOnStatusCode: false });
    for (const item of cases) await request.delete(`${base}/testcases/${item.id}`, { failOnStatusCode: false });
  }
}

async function verifyExecutionRunContext(
  request: APIRequestContext, tokenClient: APIRequestContext, db: Client, api: string, projectId: string,
  ownerId: string, targets: Array<{ testcaseId: string; cycleId: string; executionId: string }>, headers: Record<string, string>
) {
  const [actual, other, foreign] = targets;
  const runs = targets.map((target) => target.cycleId);
  const state = async () => ({
    runs: (await db.query("SELECT * FROM cycles WHERE id = ANY($1::uuid[]) ORDER BY id", [runs])).rows,
    items: (await db.query("SELECT * FROM cycle_items WHERE cycle_id = ANY($1::uuid[]) ORDER BY id", [runs])).rows,
    executions: (await db.query("SELECT e.* FROM executions e JOIN cycle_items ci ON ci.id = e.cycle_item_id WHERE ci.cycle_id = ANY($1::uuid[]) ORDER BY e.id", [runs])).rows
  });
  const route = (cycleId: string) => `${api}/api/cycles/${cycleId}/executions/${actual.executionId}`;
  for (const cycleId of [other.cycleId, foreign.cycleId, "00000000-0000-4000-8000-000000000001", "not-a-run-id"]) {
    const before = await state();
    const response = await request.patch(route(cycleId), { data: {
      status: "Blocked", actualResult: "Wrong URL context must not persist", assigneeId: null, cycleId: actual.cycleId
    } });
    const after = await state();
    const saved = after.executions.find((row) => row.id === actual.executionId);
    expect(response.status(), `URL ${cycleId}; persisted status=${saved?.status}, notes=${saved?.actual_result}, performer=${saved?.executed_by}`).toBe(404);
    expect(after).toEqual(before);
  }
  for (const token of [false, true]) {
    const before = await state();
    const refused = await tokenClient.patch(route(actual.cycleId), { headers: token ? headers : undefined, data: { status: "Failed" } });
    expect(refused.status(), await refused.text()).toBe(token ? 403 : 400);
    expect(await state()).toEqual(before);
  }
  const priorExecutor = (await state()).executions.find((row) => row.id === actual.executionId)?.executed_by;
  const notes = await request.patch(route(actual.cycleId.toUpperCase()), { data: { actualResult: "Correct-run clarification" } });
  expect(notes.ok(), await notes.text()).toBeTruthy();
  expect((await state()).executions.find((row) => row.id === actual.executionId))
    .toMatchObject({ actual_result: "Correct-run clarification", executed_by: priorExecutor });
  const passed = await request.patch(route(actual.cycleId), { data: { status: "Passed" } });
  expect(passed.ok(), await passed.text()).toBeTruthy();
  expect((await state()).executions.find((row) => row.id === actual.executionId)).toMatchObject({ status: "Passed", executed_by: ownerId });
  // MCP does not use a nested run URL. Keep its existing project-owned execution writer working.
  const called = await tokenClient.post(`${api}/api/projects/${projectId}/mcp`, { headers, data: {
    jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "record_execution_result", arguments: { executionId: actual.executionId, status: "Passed" } }
  } });
  expect(called.ok(), await called.text()).toBeTruthy();
  expect((await called.json()).error).toBeUndefined();
  expect((await state()).executions.find((row) => row.id === actual.executionId)).toMatchObject({ status: "Passed", executed_by: ownerId });
}

async function verifyBugLinkReadIsolation(
  request: APIRequestContext, tokenClient: APIRequestContext, db: Client, api: string, projectId: string,
  ownerId: string, foreignProject: string, bugId: string,
  local: { testcaseId: string; cycleId: string; executionId: string },
  foreign: { testcaseId: string; cycleId: string; executionId: string }
) {
  const base = `${api}/api/projects/${projectId}`;
  const response = await request.post(`${base}/apikeys`, { data: { name: "CI bug-link read isolation", scopes: ["read"] } });
  expect(response.ok(), await response.text()).toBeTruthy();
  const token = await response.json();
  const headers = { Authorization: `Bearer ${token.token}` };
  try {
    // Scoped SQL represents a preexisting invalid association. It is not an exploit of #29's writer.
    await db.query("INSERT INTO bug_links (bug_id, testcase_id, cycle_id, execution_id) VALUES ($1,$2,$3,$4)",
      [bugId, foreign.testcaseId, foreign.cycleId, foreign.executionId]);
    await db.query("DELETE FROM project_members WHERE project_id = $1 AND user_id = $2", [foreignProject, ownerId]);
    const inaccessible = await request.get(`${api}/api/projects/${foreignProject}/testcases`);
    expect(inaccessible.status(), await inaccessible.text()).toBe(404);
    const tokenDenied = await tokenClient.get(`${api}/api/projects/${foreignProject}/testcases`, { headers });
    expect(tokenDenied.status(), await tokenDenied.text()).toBe(403);
    const state = async () => ({
      bugs: (await db.query("SELECT * FROM bugs WHERE project_id = ANY($1::uuid[]) ORDER BY id", [[projectId, foreignProject]])).rows,
      links: (await db.query("SELECT bl.* FROM bug_links bl JOIN bugs b ON b.id = bl.bug_id WHERE b.project_id = ANY($1::uuid[]) ORDER BY bl.id", [[projectId, foreignProject]])).rows,
      cases: (await db.query("SELECT * FROM testcases WHERE id = ANY($1::uuid[]) ORDER BY id", [[local.testcaseId, foreign.testcaseId]])).rows,
      runs: (await db.query("SELECT * FROM cycles WHERE id = ANY($1::uuid[]) ORDER BY id", [[local.cycleId, foreign.cycleId]])).rows,
      items: (await db.query("SELECT * FROM cycle_items WHERE cycle_id = ANY($1::uuid[]) ORDER BY id", [[local.cycleId, foreign.cycleId]])).rows,
      executions: (await db.query("SELECT * FROM executions WHERE id = ANY($1::uuid[]) ORDER BY id", [[local.executionId, foreign.executionId]])).rows
    });
    for (const status of ["active", "deleted"]) {
      if (status === "deleted") {
        await db.query("UPDATE testcases SET deleted_at = now() WHERE id = $1", [foreign.testcaseId]);
        await db.query("UPDATE cycles SET deleted_at = now() WHERE id = $1", [foreign.cycleId]);
      }
      const before = await state();
      const results: Array<{ links: Array<Record<string, unknown>> }> = [];
      const detail = await request.get(`${api}/api/bugs/${bugId}`);
      expect(detail.ok(), await detail.text()).toBeTruthy();
      results.push(await detail.json());
      const filters: Array<Record<string, string>> = [{}, { testcaseId: local.testcaseId, cycleId: local.cycleId }];
      for (const client of [request, tokenClient]) {
        for (const params of filters) {
          const listed = await client.get(`${base}/bugs`, { headers: client === tokenClient ? headers : undefined, params });
          expect(listed.ok(), await listed.text()).toBeTruthy();
          const bug = (await listed.json()).find((item: { id: string }) => item.id === bugId);
          expect(bug).toBeDefined(); results.push(bug);
        }
      }
      for (const [name, args] of [
        ["get_bug", { bugId }], ["list_bugs", {}], ["get_testcase_bugs", { testcaseId: local.testcaseId }]
      ] as const) {
        const called = await tokenClient.post(`${base}/mcp`, { headers, data: { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name, arguments: args } } });
        expect(called.ok(), await called.text()).toBeTruthy();
        const result = await called.json(); expect(result.error).toBeUndefined();
        const data = JSON.parse(result.result.content[0].text);
        const bug = name === "get_bug" ? data : data.bugs.find((item: { id: string }) => item.id === bugId);
        expect(bug).toBeDefined(); results.push(bug);
      }
      for (const bug of results) {
        const invalid = bug.links.find((item) => item.testcaseId === foreign.testcaseId);
        expect(invalid, `${status} historical reference must not disappear`).toMatchObject({
          ...foreign, testcaseTitle: null, testcaseExternalId: null, cycleName: null
        });
        expect(bug.links).toEqual(expect.arrayContaining([expect.objectContaining({
          ...local, testcaseTitle: expect.any(String), testcaseExternalId: expect.any(String), cycleName: expect.any(String)
        })]));
      }
      expect(await state()).toEqual(before);
    }
  } finally {
    await db.query("INSERT INTO project_members (project_id, user_id, role) VALUES ($1,$2,'owner') ON CONFLICT DO NOTHING", [foreignProject, ownerId]);
    await request.delete(`${base}/apikeys/${token.id}`, { failOnStatusCode: false });
  }
}

async function verifyBugLinkRelationships(request: APIRequestContext, api: string, projectId: string, ownerId: string) {
  // Uses only this smoke journey's guarded, disposable installation and genuine session/token auth.
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  const tokenClient = await newRequest.newContext({ storageState: { cookies: [], origins: [] } });
  const bugs: string[] = []; const runs: string[] = []; const cases: Array<{ id: string; project: string }> = [];
  const base = `${api}/api/projects/${projectId}`;
  let tokenId = "";
  await db.connect();
  try {
    const foreignResponse = await request.post(`${api}/api/projects`, { data: { name: "CI foreign link targets", key: "CFL" } });
    expect(foreignResponse.ok(), await foreignResponse.text()).toBeTruthy();
    const foreignProject = (await foreignResponse.json()).id;
    const targets: Array<{ testcaseId: string; cycleId: string; executionId: string }> = [];
    for (const [index, project] of [projectId, projectId, foreignProject].entries()) {
      const caseResponse = await request.post(`${api}/api/projects/${project}/testcases`, { data: { title: `CI relationship case ${index}` } });
      expect(caseResponse.ok(), await caseResponse.text()).toBeTruthy();
      const testcaseId = (await caseResponse.json()).id;
      cases.push({ id: testcaseId, project });
      const runResponse = await request.post(`${api}/api/projects/${project}/cycles`, { data: { name: `CI relationship run ${index}` } });
      expect(runResponse.ok(), await runResponse.text()).toBeTruthy();
      const cycleId = (await runResponse.json()).id; runs.push(cycleId);
      const attached = await request.post(`${api}/api/cycles/${cycleId}/testcases`, { data: { testcaseIds: [testcaseId] } });
      expect(attached.ok(), await attached.text()).toBeTruthy();
      const executionId = (await db.query<{ id: string }>(
        "SELECT e.id FROM executions e JOIN cycle_items ci ON ci.id = e.cycle_item_id WHERE ci.cycle_id = $1", [cycleId]
      )).rows[0].id;
      targets.push({ testcaseId, cycleId, executionId });
    }
    const [first, second, foreign] = targets;
    const tokenResponse = await request.post(`${base}/apikeys`, { data: { name: "CI relationship writer", scopes: ["write"] } });
    expect(tokenResponse.ok(), await tokenResponse.text()).toBeTruthy();
    const token = await tokenResponse.json(); tokenId = token.id;
    const headers = { Authorization: `Bearer ${token.token}` };
    await verifyExecutionRunContext(request, tokenClient, db, api, projectId, ownerId, targets, headers);
    const initial = await request.post(`${base}/bugs`, { data: { title: "CI atomic relationship edit", links: [{ testcaseId: first.testcaseId }] } });
    expect(initial.ok(), await initial.text()).toBeTruthy();
    const bug = await initial.json(); bugs.push(bug.id);
    const persisted = async () => ({
      bugs: (await db.query("SELECT * FROM bugs WHERE project_id = ANY($1::uuid[]) ORDER BY id", [[projectId, foreignProject]])).rows,
      links: (await db.query("SELECT bl.* FROM bug_links bl JOIN bugs b ON b.id = bl.bug_id WHERE b.project_id = ANY($1::uuid[]) ORDER BY bl.id", [[projectId, foreignProject]])).rows,
      runs: (await db.query("SELECT * FROM cycles WHERE id = ANY($1::uuid[]) ORDER BY id", [runs])).rows,
      items: (await db.query("SELECT * FROM cycle_items WHERE cycle_id = ANY($1::uuid[]) ORDER BY id", [runs])).rows,
      executions: (await db.query("SELECT e.* FROM executions e JOIN cycle_items ci ON ci.id = e.cycle_item_id WHERE ci.cycle_id = ANY($1::uuid[]) ORDER BY e.id", [runs])).rows
    });
    for (const [invalid, status] of [
      [{ ...first, testcaseId: foreign.testcaseId }, 404],
      [{ ...first, executionId: foreign.executionId }, 404],
      [{ testcaseId: first.testcaseId, cycleId: second.cycleId }, 400],
      [{ ...first, executionId: second.executionId }, 400],
      [{ ...first, executionId: "00000000-0000-4000-8000-000000000001" }, 404],
      [{ ...first, executionId: "malformed" }, 400]
    ] as const) {
      for (const transport of ["session", "token", "MCP"]) {
        for (const operation of ["create", "add", "edit"]) {
          const before = await persisted();
          const body = { title: "CI rejected relationship metadata", links: [{ testcaseId: second.testcaseId }, invalid] };
          const client = transport === "session" ? request : tokenClient;
          const response = transport === "MCP"
            ? await client.post(`${base}/mcp`, { headers, data: {
              jsonrpc: "2.0", id: 3, method: "tools/call", params: {
                name: operation === "create" ? "create_bug" : operation === "add" ? "link_testcase_to_bug" : "update_bug",
                arguments: operation === "create" ? body : operation === "add" ? { bugId: bug.id, ...invalid } : { bugId: bug.id, ...body }
              }
            } })
            : await client[operation === "edit" ? "patch" : "post"](
              operation === "create" ? `${base}/bugs` : `${api}/api/bugs/${bug.id}${operation === "add" ? "/links" : ""}`,
              { headers: transport === "token" ? headers : undefined, data: operation === "add" ? invalid : body }
            );
          const result = await response.json();
          if (result.id && transport !== "MCP") bugs.push(result.id);
          if (transport === "MCP") {
            expect(response.ok()).toBeTruthy();
            expect(result.error, JSON.stringify(result)).toBeDefined();
          } else if (transport === "token" && operation !== "create") {
            // Tokens deliberately cannot use flat /api/bugs routes. Prove this earlier guard
            // remains intact; session REST and MCP cover the shared edit/add validator below it.
            expect(response.status(), JSON.stringify(result)).toBe(403);
            expect(result.error).toBe("API token is not authorized for this REST project route");
          } else expect(response.status(), `${transport} ${operation}: ${JSON.stringify(result)}`).toBe(status);
          expect(await persisted(), `${transport} ${operation}`).toEqual(before);
        }
      }
    }

    // Positive controls: real MCP create/add/edit, normal manual auto-failure, no link-row churn,
    // then metadata edits preserving deleted history and strict refusal after explicit removal.
    const passed = await request.patch(`${api}/api/cycles/${first.cycleId}/executions/${first.executionId}`, { data: { status: "Passed" } });
    expect(passed.ok(), await passed.text()).toBeTruthy();
    const mcp = async (name: string, args: Record<string, unknown>) => {
      const response = await tokenClient.post(`${base}/mcp`, { headers, data: { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name, arguments: args } } });
      expect(response.ok(), await response.text()).toBeTruthy();
      const result = await response.json();
      expect(result.error, JSON.stringify(result)).toBeUndefined();
      return JSON.parse(result.result.content[0].text);
    };
    const reported = await mcp("create_bug", { title: "CI valid relationship report", links: [first] });
    bugs.push(reported.id);
    expect(reported.links).toEqual([expect.objectContaining(first)]);
    expect((await db.query("SELECT status FROM executions WHERE id = $1", [first.executionId])).rows[0].status).toBe("Failed");
    const linked = await mcp("link_testcase_to_bug", { bugId: bug.id, ...first });
    const original = (await db.query("SELECT * FROM bug_links WHERE bug_id = $1 ORDER BY id", [bug.id])).rows;
    const edited = await mcp("update_bug", { bugId: bug.id, title: "CI valid metadata edit", links: linked.links });
    expect(edited.links).toEqual(linked.links);
    expect((await db.query("SELECT * FROM bug_links WHERE bug_id = $1 ORDER BY id", [bug.id])).rows).toEqual(original);
    expect((await request.delete(`${api}/api/cycles/${first.cycleId}`)).ok()).toBeTruthy();
    const historical = await mcp("update_bug", { bugId: bug.id, title: "CI historical metadata edit", links: edited.links });
    expect(historical.links).toEqual(expect.arrayContaining([expect.objectContaining({ ...first, cycleName: expect.stringContaining("(deleted)") })]));
    expect((await db.query("SELECT * FROM bug_links WHERE bug_id = $1 ORDER BY id", [bug.id])).rows).toEqual(original);
    const before = await persisted();
    const refused = await request.post(`${base}/bugs`, { data: { title: "CI deleted target refused", links: [{ testcaseId: second.testcaseId }, first] } });
    expect(refused.status(), await refused.text()).toBe(404);
    expect(await persisted()).toEqual(before);
    await mcp("update_bug", { bugId: bug.id, links: [] });
    const afterRemoval = await persisted();
    const readd = await request.post(`${api}/api/bugs/${bug.id}/links`, { data: { ...first, id: reported.links[0].id } });
    expect(readd.status(), await readd.text()).toBe(404);
    expect(await persisted()).toEqual(afterRemoval);
    const readControl = await mcp("create_bug", { title: "CI legacy bug-link read control", links: [second] });
    bugs.push(readControl.id);
    await verifyBugLinkReadIsolation(request, tokenClient, db, api, projectId, ownerId, foreignProject, readControl.id, second, foreign);
  } finally {
    for (const id of bugs) await request.delete(`${api}/api/bugs/${id}`, { failOnStatusCode: false });
    if (tokenId) await request.delete(`${base}/apikeys/${tokenId}`, { failOnStatusCode: false });
    for (const id of runs) await request.delete(`${api}/api/cycles/${id}`, { failOnStatusCode: false });
    for (const { id, project } of cases) await request.delete(`${api}/api/projects/${project}/testcases/${id}`, { failOnStatusCode: false });
    // The dedicated project and immutable audit provenance remain until disposable CI teardown.
    await tokenClient.dispose();
    await db.end();
  }
}

async function verifyBrowserMutationResponseLoss(page: Page, api: string, web: string, projectId: string, testInfo: TestInfo) {
  // The caller already enforced loopback URLs and the disposable tesbo_ci database.
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  const request = page.request;
  const base = `${api}/api/projects/${projectId}`;
  const bugs: string[] = [];
  let caseId = "";
  let runId = "";
  let attempts = 0;
  let committed!: () => void;
  let rejectCommit!: (error: unknown) => void;
  const didCommit = new Promise<void>((resolve, reject) => { committed = resolve; rejectCommit = reject; });
  let release!: () => void;
  const mayDrop = new Promise<void>((resolve) => { release = resolve; });
  let dropped!: () => void;
  const didDrop = new Promise<void>((resolve) => { dropped = resolve; });
  const handler = async (route: Route) => {
    if (route.request().method() !== "POST") { await route.continue(); return; }
    attempts += 1;
    try {
      // Actually dispatch to Nest and await its committed response. Only then lose the browser's
      // acknowledgement. This is not route.abort() before delivery or mocked successful creation.
      const response = await route.fetch({ maxRetries: 0 });
      expect(response.ok(), await response.text()).toBeTruthy();
      bugs.push((await response.json()).id);
      if (attempts === 1) {
        committed();
        await mayDrop;
        await route.abort("failed");
        dropped();
      } else await route.fulfill({ response });
    } catch (error) {
      rejectCommit(error);
      throw error;
    }
  };
  await db.connect();
  try {
    const title = "CI lost browser create acknowledgement";
    const testcaseResponse = await request.post(`${base}/testcases`, { data: { title } });
    expect(testcaseResponse.ok(), await testcaseResponse.text()).toBeTruthy();
    const testcase = await testcaseResponse.json();
    caseId = testcase.id;
    const runResponse = await request.post(`${base}/automation/runs`, { data: { name: title, caseIds: [testcase.externalId] } });
    expect(runResponse.ok(), await runResponse.text()).toBeTruthy();
    runId = (await runResponse.json()).runId;
    const resultResponse = await request.post(`${base}/automation/runs/${runId}/results`, { data: { caseId: testcase.externalId, status: "pass", retryCount: 0 } });
    expect(resultResponse.ok(), await resultResponse.text()).toBeTruthy();
    const executionId = (await resultResponse.json()).executionId as string;
    const close = await request.patch(`${base}/automation/runs/${runId}/close`, { data: { status: "completed" } });
    expect(close.ok(), await close.text()).toBeTruthy();
    const sealedState = async () => ({
      run: (await db.query("SELECT * FROM cycles WHERE id = $1", [runId])).rows,
      items: (await db.query("SELECT * FROM cycle_items WHERE cycle_id = $1 ORDER BY id", [runId])).rows,
      execution: (await db.query("SELECT * FROM executions WHERE id = $1", [executionId])).rows
    });
    const storedBugs = async () => (await db.query("SELECT * FROM bugs WHERE project_id = $1 AND title = $2 AND deleted_at IS NULL ORDER BY id", [projectId, title])).rows;
    const before = await sealedState();
    await page.goto(`${web}/projects/${projectId}/cycles/${runId}/execute/${executionId}`);
    await page.getByRole("button", { name: "Log bug", exact: true }).filter({ hasText: /^Log bug$/ }).click();
    await page.getByPlaceholder("Brief summary of the bug…").fill(title);
    await page.route(`${base}/bugs`, handler);
    await page.getByRole("button", { name: "Report Bug", exact: true }).click();
    await didCommit;
    expect(await storedBugs(), "a real bug is already committed before the acknowledgement is dropped").toHaveLength(1);
    await expect(page.getByRole("button", { name: "Creating…", exact: true })).toBeVisible();
    release();
    await didDrop;
    await expect(page.getByRole("button", { name: "Creating…", exact: true })).toHaveCount(0);
    const persisted = await storedBugs();
    expect(persisted, `one user save dispatched ${attempts} POST requests and persisted ${persisted.length} bugs`).toHaveLength(1);
    expect(attempts).toBe(1);
    expect(await sealedState()).toEqual(before);
    await expect(page.getByTestId("log-bug-error")).toContainText(/outcome unconfirmed/i);
    await expect(page.getByTestId("log-bug-error")).toContainText(/check|refresh/i);
    await expect(page.getByPlaceholder("Brief summary of the bug…")).toHaveValue(title);
    await expect(page.getByRole("button", { name: "Report Bug", exact: true })).toBeEnabled();
    await testInfo.attach("lost-create-acknowledgement", { body: await page.screenshot(), contentType: "image/png" });
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.reload();
    await expect(page.getByLabel("Bug Title", { exact: true })).toHaveValue(title);
    await expect(page.getByRole("button", { name: "Passed", exact: true })).toHaveClass(/bg-\[var\(--success\)\]/);
    expect(await storedBugs()).toHaveLength(1);
    expect(await sealedState()).toEqual(before);
  } finally {
    release();
    await page.unroute(`${base}/bugs`, handler);
    for (const id of bugs) await request.delete(`${api}/api/bugs/${id}`, { failOnStatusCode: false });
    if (runId) await request.delete(`${api}/api/cycles/${runId}`, { failOnStatusCode: false });
    if (caseId) await request.delete(`${base}/testcases/${caseId}`, { failOnStatusCode: false });
    await db.end();
  }
}

// CI-only smoke suite: separate from e2e/playwright.config.ts and its
// tenant-provisioning global setup. Never connects to a shared demo project.
test("backend health endpoint responds with the expected contract", async ({ request }) => {
  const response = await request.get(`${process.env.CI_API_BASE_URL}/health`);
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ status: "ok" });
});

test("fresh installation sends unauthenticated users to setup", async ({ page }) => {
  await page.goto(`${process.env.CI_WEB_BASE_URL}/login`);
  await expect(page.locator("body")).toBeVisible();
  await expect(page).toHaveURL(/\/setup/);
});

test("history import, bug authorization and finalized automation preserve persisted results and truthful UI", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const api = process.env.CI_API_BASE_URL!;
  const web = process.env.CI_WEB_BASE_URL!;
  // This test bootstraps a fresh installation. Explicit loopback URLs AND the existing
  // disposable CI database are required; never run it against a shared deployment.
  for (const target of [api, web]) {
    expect(["127.0.0.1", "localhost"]).toContain(new URL(target).hostname);
  }
  const database = new URL(process.env.DATABASE_URL!);
  expect(["127.0.0.1", "localhost"]).toContain(database.hostname);
  expect(database.pathname).toBe("/tesbo_ci");
  const request = page.request; // Share the genuine session cookie with the browser.
  const setup = await request.post(`${api}/api/setup/first-admin`, {
    data: { email: "ci-bug-links@tesbo.invalid", password: "Ci-Bugs-2026!", orgName: "CI Bug Links", demoData: false }
  });
  expect(setup.ok(), await setup.text()).toBeTruthy();
  const bootstrap = await setup.json();
  const projectResponse = await request.post(`${api}/api/projects`, { data: { name: "CI Bug Links", key: "CBL" } });
  expect(projectResponse.ok(), await projectResponse.text()).toBeTruthy();
  const projectId = (await projectResponse.json()).id;
  const base = `${api}/api/projects/${projectId}`;
  const bugs: string[] = [];
  const runs: string[] = [];
  const cases: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  try {
    await verifyBugCreateAccess(request, api, projectId, bootstrap.userId, bootstrap.organizationId);
    await verifyBugLinkRelationships(request, api, projectId, bootstrap.userId);
    await verifyBrowserMutationResponseLoss(page, api, web, projectId, testInfo);
    await verifyProductionReporter(page, api, web, projectId, bootstrap.userId, testInfo);
    await verifyContentSecurity(page, api, web, projectId, testInfo);
    for (const surface of ["drawer", "full-page"]) {
      for (const status of ["pass", "fail"]) {
        const title = `CI sealed ${surface} ${status}`;
        const testcaseResponse = await request.post(`${base}/testcases`, { data: { title } });
        expect(testcaseResponse.ok(), await testcaseResponse.text()).toBeTruthy();
        const testcase = await testcaseResponse.json();
        cases.push(testcase.id);
        const runResponse = await request.post(`${base}/automation/runs`, {
          data: { name: title, caseIds: [testcase.externalId] }
        });
        expect(runResponse.ok(), await runResponse.text()).toBeTruthy();
        const runId = (await runResponse.json()).runId;
        runs.push(runId);
        const result = await request.post(`${base}/automation/runs/${runId}/results`, {
          data: { caseId: testcase.externalId, status, retryCount: 1, durationMs: 42 }
        });
        expect(result.ok(), await result.text()).toBeTruthy();
        const close = await request.patch(`${base}/automation/runs/${runId}/close`, { data: { status: "completed" } });
        expect(close.ok(), await close.text()).toBeTruthy();
        const beforeSummary = await close.json();
        const before = await (await request.get(`${api}/api/cycles/${runId}/executions`)).json();
        const execution = (before.list ?? before)[0];
        expect(execution.status).toBe(status === "pass" ? "Passed" : "Failed");
        const bugTitle = `${title} finding`;
        let existingId = "";
        if (surface === "full-page") {
          const unlinked = await request.post(`${base}/bugs`, { data: { title: bugTitle } });
          expect(unlinked.ok(), await unlinked.text()).toBeTruthy();
          existingId = (await unlinked.json()).id;
          bugs.push(existingId);
        }

        const runUrl = `${web}/projects/${projectId}/cycles/${runId}`;
        await page.goto(surface === "drawer" ? runUrl : `${runUrl}/execute/${execution.id}`);
        // Run and testcase deliberately share a title. Only the testcase button opens the drawer;
        // a first text match may instead click the breadcrumb/run heading after a reload.
        if (surface === "drawer") await page.getByRole("button", { name: title, exact: true }).click();
        // The background row has an icon-only action with the same accessible name.
        // Exercise the drawer/full-page footer's visible-text action, not an arbitrary match.
        await page.getByRole("button", { name: "Log bug", exact: true }).filter({ hasText: /^Log bug$/ }).click();
        await expect(page.getByText("Test case marked as Failed", { exact: true })).toHaveCount(0);
        if (surface === "drawer") {
          await page.getByPlaceholder("Brief summary of the bug…").fill(bugTitle);
          const saved = page.waitForResponse((response) => response.url() === `${base}/bugs` && response.request().method() === "POST");
          await page.getByRole("button", { name: "Report Bug", exact: true }).click();
          const response = await saved;
          expect(response.ok(), await response.text()).toBeTruthy();
          bugs.push((await response.json()).id);
        } else {
          await page.getByRole("button", { name: "Yes, link existing" }).click();
          await page.getByRole("button", { name: "Existing Tesbo bug", exact: true }).click();
          await page.getByRole("button", { name: "Choose an existing bug…" }).click();
          const picker = page.getByTestId("existing-bug-picker");
          await picker.getByPlaceholder("Search bugs by title…").fill(bugTitle);
          await picker.getByText(bugTitle, { exact: true }).click();
          await picker.getByRole("button", { name: "Add Selected (1)", exact: true }).click();
          await page.getByRole("button", { name: "Link Bug", exact: true }).click();
        }
        await expect(page.getByRole("heading", { name: "Report a Bug" })).toBeHidden();
        await expect(page.getByLabel("Bug Title", { exact: true })).toBeVisible();
        await expect(page.getByLabel("Bug Key", { exact: true })).toBeVisible();
        await expect(page.getByLabel("Bug Title", { exact: true })).toHaveValue(bugTitle);
        const activeColor = status === "pass" ? /bg-\[var\(--success\)\]/ : /bg-\[var\(--error\)\]/;
        await expect(page.getByRole("button", { name: execution.status, exact: true })).toHaveClass(activeColor);
        expect(await (await request.get(`${api}/api/cycles/${runId}/executions`)).json()).toEqual(before);
        const persistedBug = await (await request.get(`${api}/api/bugs/${existingId || bugs[bugs.length - 1]}`)).json();
        expect(persistedBug.links).toEqual(expect.arrayContaining([
          expect.objectContaining({ testcaseId: testcase.id, cycleId: runId, executionId: execution.id })
        ]));
        const repeated = await request.patch(`${base}/automation/runs/${runId}/close`, { data: { status: "completed" } });
        expect(await repeated.json()).toEqual({ ...beforeSummary, alreadyClosed: true });
        await page.reload();
        if (surface === "drawer") await page.getByRole("button", { name: title, exact: true }).click();
        await expect(page.getByLabel("Bug Title", { exact: true })).toBeVisible();
        await expect(page.getByLabel("Bug Key", { exact: true })).toBeVisible();
        await expect(page.getByLabel("Bug Title", { exact: true })).toHaveValue(bugTitle);
        await expect(page.getByRole("button", { name: execution.status, exact: true })).toHaveClass(activeColor);
        await testInfo.attach(`${surface}-${status}`, { body: await page.screenshot(), contentType: "image/png" });
      }
    }
    expect(consoleErrors).toEqual([]);
  } finally {
    for (const id of bugs) await request.delete(`${api}/api/bugs/${id}`, { failOnStatusCode: false });
    for (const id of runs) await request.delete(`${api}/api/cycles/${id}`, { failOnStatusCode: false });
    for (const id of cases) await request.delete(`${base}/testcases/${id}`, { failOnStatusCode: false });
  }
});

test("knowledge document saves and restores preserve ordering, drafts and persisted history", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const api = process.env.CI_API_BASE_URL!, web = process.env.CI_WEB_BASE_URL!;
  for (const target of [api, web, process.env.DATABASE_URL!]) expect(["127.0.0.1", "localhost"]).toContain(new URL(target).hostname);
  expect(new URL(process.env.DATABASE_URL!).pathname).toBe("/tesbo_ci");
  // Reuse the installation/bootstrap above, but give this batch its own project and real session.
  const login = await page.request.post(`${api}/api/auth/password/login`, { data: { email: "ci-bug-links@tesbo.invalid", password: "Ci-Bugs-2026!" } });
  expect(login.ok(), await login.text()).toBeTruthy();
  const created = await page.request.post(`${api}/api/projects`, { data: { name: "CI Document Integrity", key: "CDI" } });
  expect(created.ok(), await created.text()).toBeTruthy();
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await verifyDocumentWrites(page, api, web, (await created.json()).id, testInfo);
  expect(consoleErrors).toEqual([]);
});

test("repository partial edits and UI-created MCP tokens preserve persisted relationships and scope", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const api = process.env.CI_API_BASE_URL!, web = process.env.CI_WEB_BASE_URL!;
  for (const target of [api, web, process.env.DATABASE_URL!]) expect(["127.0.0.1", "localhost"]).toContain(new URL(target).hostname);
  expect(new URL(process.env.DATABASE_URL!).pathname).toBe("/tesbo_ci");
  const login = await page.request.post(`${api}/api/auth/password/login`, { data: { email: "ci-bug-links@tesbo.invalid", password: "Ci-Bugs-2026!" } });
  expect(login.ok(), await login.text()).toBeTruthy();
  const ownerId = (await login.json()).userId as string;
  const created = await page.request.post(`${api}/api/projects`, { data: { name: "CI Repository Integrity", key: "CRI" } });
  expect(created.ok(), await created.text()).toBeTruthy();
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await verifyRepositoryPartialEdits(page, api, web, (await created.json()).id, ownerId, testInfo);
  expect(consoleErrors).toEqual([]);
});

test("bug metadata edits preserve explicit clears, live omissions, evidence and accurate attribution", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const api = process.env.CI_API_BASE_URL!, web = process.env.CI_WEB_BASE_URL!;
  for (const target of [api, web, process.env.DATABASE_URL!]) expect(["127.0.0.1", "localhost"]).toContain(new URL(target).hostname);
  expect(new URL(process.env.DATABASE_URL!).pathname).toBe("/tesbo_ci");
  const login = await page.request.post(`${api}/api/auth/password/login`, { data: { email: "ci-bug-links@tesbo.invalid", password: "Ci-Bugs-2026!" } });
  expect(login.ok(), await login.text()).toBeTruthy();
  const ownerId = (await login.json()).userId as string;
  const created = await page.request.post(`${api}/api/projects`, { data: { name: "CI Bug Metadata Integrity", key: "BMI" } });
  expect(created.ok(), await created.text()).toBeTruthy();
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await verifyBugMetadataWrites(page, api, web, (await created.json()).id, ownerId, testInfo);
  expect(consoleErrors).toEqual([]);
});

test("browser API transport never replays ambiguous mutations and retains bounded read retries", async () => {
  // Actual loopback HTTP and the production helper source, not a database or a browser bundle.
  // Node reports socket loss as "fetch failed"; the small adapter below presents the equivalent
  // browser "Failed to fetch" error without fabricating an HTTP response or skipping the request.
  const calls = new Map<string, number>();
  const applied = new Map<string, number>();
  const bodies = new Map<string, { body: string; contentType: string }>();
  let abortApplied!: () => void;
  const didApplyBeforeAbort = new Promise<void>((resolve) => { abortApplied = resolve; });
  const server = createServer(async (req, res) => {
    const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const count = (calls.get(pathname) ?? 0) + 1;
    calls.set(pathname, count);
    bodies.set(pathname, { body: Buffer.concat(chunks).toString(), contentType: req.headers["content-type"] ?? "" });
    if (pathname.startsWith("/lost-") || pathname.includes("/comments") || pathname.endsWith("/files/upload") || pathname === "/abort-write") {
      applied.set(pathname, (applied.get(pathname) ?? 0) + 1);
      if (pathname === "/abort-write") { abortApplied(); return; }
      if (count === 1) { req.socket.destroy(); return; } // Applied, but no acknowledgement.
    }
    if (pathname.startsWith("/read-") && (count === 1 || pathname === "/read-never")) { req.socket.destroy(); return; }
    if (pathname === "/status-403" || pathname === "/status-503") {
      res.writeHead(pathname === "/status-403" ? 403 : 503, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Fixture HTTP refusal" })); return;
    }
    if (req.method === "HEAD" || pathname === "/empty") { res.writeHead(204); res.end(); return; }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ id: "fixture", ok: true, list: [], total: 0 }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const previousBase = process.env.NEXT_PUBLIC_API_URL;
  const realFetch = globalThis.fetch;
  try {
    process.env.NEXT_PUBLIC_API_URL = base;
    globalThis.fetch = async (input, init) => {
      try { return await realFetch(input, init); }
      catch (error) {
        if (error instanceof TypeError && error.message === "fetch failed") throw new TypeError("Failed to fetch");
        throw error;
      }
    };
    const browserApi = await import("../Tesbo-Frontend/lib/api");
    expect(browserApi.API_BASE).toBe(base);
    const errorFrom = async (promise: Promise<unknown>) => promise.then(() => "", (error: unknown) => error instanceof Error ? error.message : String(error));
    for (const method of ["POST", "PUT", "PATCH", "DELETE", "post"]) {
      const pathname = `/lost-${method}`;
      const error = await errorFrom(browserApi.api(pathname, { method, body: { title: "Fixture mutation" } }));
      expect.soft(calls.get(pathname), `${method}: wire requests`).toBe(1);
      expect.soft(applied.get(pathname), `${method}: controlled fixture applications, not PostgreSQL`).toBe(1);
      expect.soft(error, `${method}: must not report success or assume the server stayed unchanged`).toMatch(/outcome unconfirmed/i);
      expect.soft(error).toMatch(/check|refresh/i);
      expect(bodies.get(pathname)).toEqual({ body: JSON.stringify({ title: "Fixture mutation" }), contentType: "application/json" });
    }
    const file = new File(["Fixture multipart bytes"], "fixture.txt", { type: "text/plain" });
    const commentPath = "/api/projects/fixture/bugs/fixture/comments";
    const commentError = await errorFrom(browserApi.createBugComment("fixture", "fixture", "Fixture comment", [file]));
    expect.soft(calls.get(commentPath), "multipart comment must not be resent").toBe(1);
    expect.soft(applied.get(commentPath)).toBe(1);
    expect.soft(commentError).toMatch(/outcome unconfirmed/i);
    expect(bodies.get(commentPath)?.contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(bodies.get(commentPath)?.body).toContain("Fixture multipart bytes");
    const uploadPath = "/api/projects/fixture/knowledge-base/files/upload";
    const uploadError = await errorFrom(browserApi.uploadKnowledgeFiles("fixture", "folder", [file]));
    expect.soft(calls.get(uploadPath), "multipart KB upload must not be resent").toBe(1);
    expect.soft(applied.get(uploadPath)).toBe(1);
    expect.soft(uploadError).toMatch(/outcome unconfirmed/i);
    expect(bodies.get(uploadPath)?.contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(bodies.get(uploadPath)?.body).toContain("Fixture multipart bytes");

    const controller = new AbortController();
    const pending = errorFrom(browserApi.api("/abort-write", { method: "POST", body: { title: "Applied before abort" }, signal: controller.signal }));
    await didApplyBeforeAbort;
    controller.abort();
    expect.soft(await pending).toMatch(/outcome unconfirmed/i);
    expect(calls.get("/abort-write")).toBe(1);
    expect(applied.get("/abort-write")).toBe(1);

    expect(await browserApi.api("/read-default")).toMatchObject({ ok: true });
    expect(await browserApi.api("/read-head", { method: "HEAD" })).toBeUndefined();
    expect(calls.get("/read-default")).toBe(2);
    expect(calls.get("/read-head")).toBe(2);
    expect(await errorFrom(browserApi.api("/read-never"))).toMatch(/blocked or could not reach the API/);
    expect(calls.get("/read-never")).toBe(2); // A failed retry must not recurse indefinitely.
    const readAbort = new AbortController();
    readAbort.abort();
    expect(await errorFrom(browserApi.api("/aborted-read", { signal: readAbort.signal }))).toMatch(/request took too long/);
    expect(calls.get("/aborted-read") ?? 0).toBe(0);
    await Promise.all([browserApi.api("/dedupe"), browserApi.api("/dedupe")]);
    expect(calls.get("/dedupe")).toBe(1);
    await browserApi.api("/dedupe");
    expect(calls.get("/dedupe")).toBe(2); // In-flight collapse, not a stale-value cache.
    for (const pathname of ["/status-403", "/status-503"]) {
      expect(await errorFrom(browserApi.api(pathname, { method: "POST", body: {} }))).toBe("Fixture HTTP refusal");
      expect(calls.get(pathname)).toBe(1); // Neither HTTP errors nor mutation statuses are retried.
    }
    expect(await browserApi.api("/empty", { method: "POST", body: {} })).toBeUndefined();
    expect(calls.get("/empty")).toBe(1);
  } finally {
    globalThis.fetch = realFetch;
    if (previousBase === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = previousBase;
    const stopped = new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    server.closeAllConnections();
    await stopped;
  }
});
