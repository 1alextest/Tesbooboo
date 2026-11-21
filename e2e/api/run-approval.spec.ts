import { expect, test, request as newRequestContext, type APIRequestContext } from "@playwright/test";
import { env } from "../utils/env";
import { exec, execMany, literal, scalar } from "../utils/psql";
import { approveTestcase } from "../utils/testcase-approval";
import { approveMcpTestClient } from "../utils/mcp-access";
import {
  anonymousContext, loginAs, provisionRbacTenant, rbacSuiteSkipReason, type RbacTenant
} from "../utils/rbac-tenant";

/**
 * Direct HTTP + MCP + automation acceptance, all against one disposable
 * project. These tests demonstrate the shared canonical write rule rather
 * than trusting the Test Runs picker or a Zyra-only preflight.
 */
test.describe("Approved-only native run attachments", () => {
  let tenant: RbacTenant | null = null;
  let asOwner: APIRequestContext;
  let asQa: APIRequestContext;
  let anon: APIRequestContext;

  test.beforeAll(async () => {
    tenant = await provisionRbacTenant("run-approval");
    if (!tenant) return;
    asOwner = await loginAs(tenant.owner);
    asQa = await loginAs(tenant.qa);
    anon = await anonymousContext();
    purge();
  });

  test.afterAll(async () => {
    if (tenant) purge();
    await Promise.all([asOwner,asQa,anon].filter(Boolean).map((ctx)=>ctx.dispose()));
  });
  test.beforeEach(() => {
    const reason = rbacSuiteSkipReason(tenant);
    test.skip(reason !== null, reason ?? "");
  });
  test.afterEach(() => { if (tenant) purge(); });

  function purge() {
    if (!tenant) return;
    const p = literal(tenant.mainProjectId);
    execMany([
      "DELETE FROM executions WHERE cycle_item_id IN " +
        "(SELECT ci.id FROM cycle_items ci JOIN cycles c ON c.id=ci.cycle_id WHERE c.project_id=" + p + ")",
      "DELETE FROM cycle_items WHERE cycle_id IN (SELECT id FROM cycles WHERE project_id=" + p + ")",
      "DELETE FROM cycles WHERE project_id=" + p,
      "DELETE FROM testcases WHERE project_id=" + p + " AND external_id LIKE 'APR-%'"
    ]);
  }

  async function caseId(externalId: string, status: string): Promise<string> {
    const p = literal(tenant!.mainProjectId);
    const id = scalar("INSERT INTO testcases(project_id,external_id,title,status) VALUES (" +
      p + "," + literal(externalId) + "," + literal("E2E Approval " + externalId) + "," +
      literal(status === "Approved" ? "Draft" : status) + ") RETURNING id;");
    if (status === "Approved") await approveTestcase(asOwner, tenant!.mainProjectId, id);
    return id;
  }

  async function caseIdForRemoval(): Promise<string> {
    return caseId("APR-REMOVAL-" + Date.now(), "Approved");
  }

  async function cycle(name: string): Promise<string> {
    const res = await asOwner.post("/api/projects/" + tenant!.mainProjectId + "/cycles", {
      data: { name }, failOnStatusCode: false
    });
    expect(res.status(),await res.text()).toBe(201);
    return (await res.json()).id as string;
  }

  function countItems(runId: string): number {
    return Number(scalar("SELECT COUNT(*)::int FROM cycle_items WHERE cycle_id=" +
      literal(runId) + " AND deleted_at IS NULL;"));
  }

  function countExecutions(runId: string): number {
    return Number(scalar("SELECT COUNT(*)::int FROM executions e JOIN cycle_items ci " +
      "ON ci.id=e.cycle_item_id WHERE ci.cycle_id=" + literal(runId) +
      " AND e.deleted_at IS NULL;"));
  }

  test("REST refuses Draft/In Review or mixed selection atomically, keeps approved replay and old snapshots", async () => {
    const approved = await caseId("APR-OK-1","Approved");
    const draft = await caseId("APR-DRAFT-1","Draft");
    const review = await caseId("APR-REVIEW-1","In Review");
    const run = await cycle("E2E Approved-only REST run");
    const endpoint = "/api/cycles/" + run + "/testcases";

    for (const rejected of [[draft],[review],[approved,draft]]) {
      const result = await asQa.post(endpoint, {
        data: { testcaseIds: rejected }, failOnStatusCode: false
      });
      expect(result.status(),await result.text()).toBe(409);
      expect((await result.json()).error).toMatch(/Only Approved/i);
      expect(countItems(run)).toBe(0);
      expect(countExecutions(run)).toBe(0);
    }
    const good = await asQa.post(endpoint, {
      data: { testcaseIds: [approved] }, failOnStatusCode: false
    });
    expect(good.status(),await good.text()).toBe(201);
    expect(await good.json()).toMatchObject({ requested: 1,added: 1,skipped: 0 });
    expect(countItems(run)).toBe(1);
    expect(countExecutions(run)).toBe(1);

    // An already-included case is a historical snapshot. Its subsequent
    // demotion cannot add another row, nor invalidate an existing execution.
    exec("UPDATE testcases SET status='Draft' WHERE id=" + literal(approved) + ";");
    const repeated = await asQa.post(endpoint, {
      data: { testcaseIds: [approved] }, failOnStatusCode: false
    });
    expect(repeated.status(),await repeated.text()).toBe(201);
    expect(await repeated.json()).toMatchObject({ requested: 1, added: 0, skipped: 1 });
    expect(countItems(run)).toBe(1);
    expect(countExecutions(run)).toBe(1);

    const foreign = await caseId("APR-UNKNOWN-1","Approved");
    // A nonexistent/malformed ID remains a *skipped* item under the existing
    // native response contract, not a private cross-project data disclosure.
    exec("UPDATE testcases SET status='Approved' WHERE id=" + literal(foreign) + ";");
    const unknown = await asQa.post(endpoint,{ data: {
      testcaseIds: ["not-a-uuid","00000000-0000-4000-8000-000000000000"]
    }, failOnStatusCode: false });
    expect(unknown.status(),await unknown.text()).toBe(201);
    expect(await unknown.json()).toMatchObject({ requested: 2,added: 0,skipped: 2 });
  });

  test("REST re-add after soft removal rejects Draft and retains historical result rows", async () => {
    const caseId = await caseIdForRemoval();
    const run = await cycle("E2E Soft-removed Approval " + Date.now());
    const endpoint = "/api/cycles/" + run + "/testcases";
    const insert = async () => asQa.post(endpoint, {
      data: { testcaseIds: [caseId] }, failOnStatusCode: false
    });
    const first = await insert();
    expect(first.status(), await first.text()).toBe(201);
    expect(await first.json()).toMatchObject({ requested: 1, added: 1, skipped: 0 });
    const oldItem = scalar("SELECT id FROM cycle_items WHERE cycle_id=" +
      literal(run) + " AND testcase_id=" + literal(caseId) + " AND deleted_at IS NULL;");
    const oldExecution = scalar("SELECT id FROM executions WHERE cycle_item_id=" +
      literal(oldItem) + ";");
    expect(oldExecution).toBeTruthy();

    const removed = await asQa.delete(endpoint + "/" + caseId, { failOnStatusCode: false });
    expect(removed.ok(), await removed.text()).toBe(true);
    expect(countItems(run)).toBe(0);
    expect(Number(scalar("SELECT COUNT(*)::int FROM cycle_items WHERE id=" +
      literal(oldItem) + " AND deleted_at IS NOT NULL;"))).toBe(1);

    // A removed membership is a NEW association, unlike idempotent replay
    // of an active item. Demotion must reject it before creating a new result.
    exec("UPDATE testcases SET status='Draft' WHERE id=" + literal(caseId) + ";");
    const denied = await insert();
    expect(denied.status(), await denied.text()).toBe(409);
    expect((await denied.json()).error).toMatch(/Only Approved/i);
    expect(countItems(run)).toBe(0);
    expect(countExecutions(run)).toBe(0);
    expect(Number(scalar("SELECT COUNT(*)::int FROM executions WHERE cycle_item_id=" +
      literal(oldItem) + ";"))).toBe(1); // Historical execution not destroyed.

    await approveTestcase(asOwner, tenant!.mainProjectId, caseId);
    const restored = await insert();
    expect(restored.status(), await restored.text()).toBe(201);
    expect(await restored.json()).toMatchObject({ requested: 1, added: 1, skipped: 0 });
    expect(countItems(run)).toBe(1);
    expect(countExecutions(run)).toBe(1);
    expect(Number(scalar("SELECT COUNT(*)::int FROM cycle_items WHERE cycle_id=" +
      literal(run) + " AND testcase_id=" + literal(caseId) + ";"))).toBe(2);
    const replay = await insert();
    expect(replay.status(), await replay.text()).toBe(201);
    expect(await replay.json()).toMatchObject({ added: 0, skipped: 1 });
    expect(countItems(run)).toBe(1);
  });

  test("REST skips foreign-project Approved cases without importing their test or revealing status", async () => {
    const run = await cycle("E2E Cross-project Approval " + Date.now());
    const foreign = scalar("INSERT INTO testcases(project_id,external_id,title,status) VALUES (" +
      literal(tenant!.secondProjectId) + ", " + literal("APR-FOREIGN-" + Date.now()) +
      ", 'Foreign approved candidate', 'Approved') RETURNING id;");
    try {
      const response = await asQa.post("/api/cycles/" + run + "/testcases", {
        data: { testcaseIds: [foreign] }, failOnStatusCode: false
      });
      expect(response.status(), await response.text()).toBe(201);
      expect(await response.json()).toMatchObject({ requested: 1, added: 0, skipped: 1 });
      expect(countItems(run)).toBe(0);
      expect(countExecutions(run)).toBe(0);
    } finally {
      exec("DELETE FROM testcases WHERE id=" + literal(foreign) + ";");
    }
  });

  test("MCP create-from-cases is atomic and returns no run for a Draft candidate", async () => {
    const approved = await caseId("APR-MCP-OK","Approved");
    const draft = await caseId("APR-MCP-DRAFT","Draft");
    const tokenRes = await asOwner.post("/api/projects/" + tenant!.mainProjectId + "/apikeys", {
      data: { name: "CI approved-only MCP", scopes: ["read", "write"] }, failOnStatusCode: false
    });
    expect(tokenRes.status(),await tokenRes.text()).toBe(201);
    const {id:tokenId,token} = await tokenRes.json() as {id:string;token:string};
    await approveMcpTestClient(asOwner, tenant!.mainProjectId, { id: tokenId, name: "CI approved-only MCP", scopes: ["read", "write"] });
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl, storageState: { cookies: [], origins: [] }
    });
    const call = async (name:string,caseIds:string[]) => {
      const response = await mcpApi.post("/api/projects/" + tenant!.mainProjectId + "/mcp", {
        headers: { Authorization: "Bearer " + token },
        data: { jsonrpc:"2.0",id:1,method:"tools/call",
          params:{ name:"create_cycle_from_testcases",arguments:{ name, testcaseIds:caseIds } } }
      });
      // The native MCP JSON-RPC adapter returns 201 on successful transport,
      // including tool-execution errors carried in the JSON-RPC body.
      expect(response.status()).toBe(201);
      return response.json();
    };
    try {
      const blockedName = "E2E MCP Approval Blocked";
      const blocked = await call(blockedName,[approved,draft]);
      expect(blocked.error ?? blocked.result?.isError).toBeTruthy();
      expect(Number(scalar("SELECT COUNT(*)::int FROM cycles WHERE project_id=" +
        literal(tenant!.mainProjectId) + " AND name=" + literal(blockedName) + ";"))).toBe(0);
      const accepted = await call("E2E MCP Approval Passed",[approved]);
      expect(accepted.error).toBeUndefined();
      const body = JSON.parse(accepted.result.content[0].text);
      expect(body.testcasesAdded).toBe(1);
      expect(countItems(body.cycle.id)).toBe(1);
      expect(countExecutions(body.cycle.id)).toBe(1);
    } finally {
      await asOwner.delete("/api/projects/" + tenant!.mainProjectId + "/apikeys/" + tokenId,
        { failOnStatusCode: false });
      await mcpApi.dispose();
    }
  });

  test("automation ingest refuses unapproved cases and does not persist an orphan run", async () => {
    await caseId("APR-AUTO-OK","Approved");
    await caseId("APR-AUTO-DRAFT","Draft");
    const api = "/api/projects/" + tenant!.mainProjectId + "/automation/runs";
    const name = "E2E Automation Approval Rejected";
    const blocked = await asOwner.post(api, {
      data: { name, caseIds:["APR-AUTO-OK","APR-AUTO-DRAFT"] },
      failOnStatusCode: false
    });
    expect(blocked.status(),await blocked.text()).toBe(409);
    expect(Number(scalar("SELECT COUNT(*)::int FROM cycles WHERE project_id=" +
      literal(tenant!.mainProjectId) + " AND name=" + literal(name) + ";"))).toBe(0);
    const accepted = await asOwner.post(api,{
      data: { name:"E2E Automation Approved",caseIds:["APR-AUTO-OK"] },
      failOnStatusCode: false
    });
    expect(accepted.status(),await accepted.text()).toBeLessThan(300);
    const body = await accepted.json();
    expect(body.casesAttached).toBe(1);
    expect(countItems(body.runId)).toBe(1);
    expect(countExecutions(body.runId)).toBe(1);
  });

  test("anonymous cannot use native cycle-add for an otherwise Approved case",async()=>{
    const approved = await caseId("APR-ANON-OK","Approved");
    const run=await cycle("E2E Unauthorized Run");
    const result=await anon.post("/api/cycles/"+run+"/testcases",{
      data:{testcaseIds:[approved]},failOnStatusCode:false
    });
    // Legacy session authentication uses 400 Authentication required here.
    // Assert the exact public API contract rather than an invented 401.
    expect(result.status(), await result.text()).toBe(400);
    expect((await result.json()).error).toMatch(/Authentication required/i);
    expect(countItems(run)).toBe(0);
  });

  test("machine issuer identity cannot approve, and generic status writes cannot replace exact human review", async () => {
    const id=await caseId("APR-PRINCIPAL", "Draft");
    const endpoint=`/api/projects/${tenant!.mainProjectId}/testcases/${id}`;
    const reviewed=await (await asOwner.get(endpoint)).json();
    const tokenResult=await asOwner.post(`/api/projects/${tenant!.mainProjectId}/apikeys`,{
      data:{name:"E2E human-review boundary",scopes:["read","write"]}
    });
    expect(tokenResult.ok(),await tokenResult.text()).toBe(true);
    const issued=await tokenResult.json();
    const machine=await newRequestContext.newContext({baseURL:env.apiBaseUrl,storageState:{cookies:[],origins:[]},extraHTTPHeaders:{Authorization:`Bearer ${issued.token}`}});
    try {
      const forbidden=await machine.post(`${endpoint}/approve`,{data:{expectedRevision:reviewed.editRevision,expectedApprovalRevision:reviewed.approvalRevision}});
      expect(forbidden.status(),await forbidden.text()).toBe(403);
      for (const caller of [asOwner,machine]) {
        const bypass=await caller.put(endpoint,{data:{status:"Approved",expectedRevision:reviewed.editRevision}});
        expect(bypass.status(),await bypass.text()).toBe(caller === machine ? 403 : 400);
        expect((await bypass.json()).code).toBe(caller === machine ? "HUMAN_PUBLICATION_REQUIRED" : "USE_TESTCASE_APPROVAL");
      }
      expect((await (await asOwner.get(endpoint)).json()).status).toBe("Draft");
      expect(await (await asOwner.get(`${endpoint}/approvals`)).json()).toHaveLength(0);
      const legitimate=await asOwner.post(`${endpoint}/approve`,{data:{expectedRevision:reviewed.editRevision,expectedApprovalRevision:reviewed.approvalRevision}});
      expect(legitimate.status(),await legitimate.text()).toBe(200);
      const first=await legitimate.json();
      const replay=await asOwner.post(`${endpoint}/approve`,{data:{expectedRevision:reviewed.editRevision,expectedApprovalRevision:reviewed.approvalRevision}});
      expect(replay.status(),await replay.text()).toBe(200);
      expect((await replay.json()).receipt.id).toBe(first.receipt.id);
      const readback=await (await asOwner.get(endpoint)).json();
      expect(readback.approvalCurrent).toBe(true);
      expect(first.receipt.reviewedSnapshot).toEqual(reviewed.approvalSnapshot);
    } finally {
      await machine.dispose();
      await asOwner.delete(`/api/projects/${tenant!.mainProjectId}/apikeys/${issued.id}`,{failOnStatusCode:false});
    }
  });

  test("empty or malformed review context cannot publish a case", async () => {
    const id=await caseId("APR-MALFORMED", "Draft");
    const endpoint=`/api/projects/${tenant!.mainProjectId}/testcases/${id}`;
    const read=await (await asOwner.get(endpoint)).json();
    for (const payload of [{},{expectedRevision:read.editRevision},{expectedRevision:null,expectedApprovalRevision:read.approvalRevision},{expectedRevision:read.editRevision,expectedApprovalRevision:" "}]) {
      const refused=await asOwner.post(`${endpoint}/approve`,{data:payload});
      expect(refused.status(),await refused.text()).toBe(400);
    }
    expect((await (await asOwner.get(endpoint)).json()).status).toBe("Draft");
    expect(await (await asOwner.get(`${endpoint}/approvals`)).json()).toHaveLength(0);
  });

  test("approval and run admission reject a dependency changed after review and retain the old run snapshot", async () => {
    const id=await caseId("APR-DEPENDENCY", "Approved");
    const project=tenant!.mainProjectId;
    const endpoint=`/api/projects/${project}/testcases/${id}`;
    const reviewed=await (await asOwner.get(endpoint)).json();
    const oldRun=await cycle("E2E approved dependency snapshot");
    const added=await asOwner.post(`/api/cycles/${oldRun}/testcases`,{data:{testcaseIds:[id]}});
    expect(added.ok(),await added.text()).toBe(true);
    const snapshot=scalar(`SELECT snapshot_reviewed_content::text FROM cycle_items WHERE cycle_id=${literal(oldRun)} AND testcase_id=${literal(id)};`);
    expect(JSON.parse(snapshot)).toEqual(reviewed.approvalSnapshot);
    const tag=scalar(`INSERT INTO custom_tags(project_id,name) VALUES (${literal(project)},${literal(`APR dependency ${Date.now()}`)}) RETURNING id;`);
    try {
      exec(`INSERT INTO testcase_custom_tags(testcase_id,tag_id) VALUES (${literal(id)},${literal(tag)});`);
      const stale=await asOwner.post(`${endpoint}/approve`,{data:{expectedRevision:reviewed.editRevision,expectedApprovalRevision:reviewed.approvalRevision}});
      expect(stale.status(),await stale.text()).toBe(409);
      const current=await (await asOwner.get(endpoint)).json();
      expect(current.status).toBe("In Review"); expect(current.approvalCurrent).toBe(false);
      const nextRun=await cycle("E2E stale dependency refusal");
      const denied=await asOwner.post(`/api/cycles/${nextRun}/testcases`,{data:{testcaseIds:[id]}});
      expect(denied.status(),await denied.text()).toBe(409); expect(countItems(nextRun)).toBe(0);
      expect(scalar(`SELECT snapshot_reviewed_content::text FROM cycle_items WHERE cycle_id=${literal(oldRun)} AND testcase_id=${literal(id)};`)).toBe(snapshot);
      await approveTestcase(asOwner,project,id);
      const accepted=await asOwner.post(`/api/cycles/${nextRun}/testcases`,{data:{testcaseIds:[id]}});
      expect(accepted.ok(),await accepted.text()).toBe(true);
    } finally { exec(`DELETE FROM custom_tags WHERE id=${literal(tag)};`); }
  });
});
