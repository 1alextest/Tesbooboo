import { expect, test, request as newRequestContext, type APIRequestContext } from "@playwright/test";
import { env } from "../utils/env";
import { exec, execMany, literal, scalar } from "../utils/psql";
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

  function caseId(externalId: string, status: string): string {
    const p = literal(tenant!.mainProjectId);
    return scalar("INSERT INTO testcases(project_id,external_id,title,status) VALUES (" +
      p + "," + literal(externalId) + "," + literal("E2E Approval " + externalId) + "," +
      literal(status) + ") RETURNING id;");
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
    const approved = caseId("APR-OK-1","Approved");
    const draft = caseId("APR-DRAFT-1","Draft");
    const review = caseId("APR-REVIEW-1","In Review");
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

    const foreign = caseId("APR-UNKNOWN-1","Approved");
    // A nonexistent/malformed ID remains a *skipped* item under the existing
    // native response contract, not a private cross-project data disclosure.
    exec("UPDATE testcases SET status='Approved' WHERE id=" + literal(foreign) + ";");
    const unknown = await asQa.post(endpoint,{ data: {
      testcaseIds: ["not-a-uuid","00000000-0000-4000-8000-000000000000"]
    }, failOnStatusCode: false });
    expect(unknown.status(),await unknown.text()).toBe(201);
    expect(await unknown.json()).toMatchObject({ requested: 2,added: 0,skipped: 2 });
  });

  test("MCP create-from-cases is atomic and returns no run for a Draft candidate", async () => {
    const approved = caseId("APR-MCP-OK","Approved");
    const draft = caseId("APR-MCP-DRAFT","Draft");
    const tokenRes = await asOwner.post("/api/projects/" + tenant!.mainProjectId + "/apikeys", {
      data: { name: "CI approved-only MCP", scopes: ["write"] }, failOnStatusCode: false
    });
    expect(tokenRes.status(),await tokenRes.text()).toBe(201);
    const {id:tokenId,token} = await tokenRes.json() as {id:string;token:string};
    const mcpApi = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl, storageState: { cookies: [], origins: [] }
    });
    const call = async (name:string,caseIds:string[]) => {
      const response = await mcpApi.post("/api/projects/" + tenant!.mainProjectId + "/mcp", {
        headers: { Authorization: "Bearer " + token },
        data: { jsonrpc:"2.0",id:1,method:"tools/call",
          params:{ name:"create_cycle_from_testcases",arguments:{ name, testcaseIds:caseIds } } }
      });
      expect(response.status()).toBe(200);
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
    caseId("APR-AUTO-OK","Approved");
    caseId("APR-AUTO-DRAFT","Draft");
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
    expect(countItems(body.id)).toBe(1);
    expect(countExecutions(body.id)).toBe(1);
  });

  test("anonymous cannot use native cycle-add for an otherwise Approved case",async()=>{
    const approved = caseId("APR-ANON-OK","Approved");
    const run=await cycle("E2E Unauthorized Run");
    const result=await anon.post("/api/cycles/"+run+"/testcases",{
      data:{testcaseIds:[approved]},failOnStatusCode:false
    });
    expect([401,403,404]).toContain(result.status());
    expect(countItems(run)).toBe(0);
  });
});
