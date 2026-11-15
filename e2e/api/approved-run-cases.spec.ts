import { expect, test, request as newRequestContext, type APIRequestContext } from "@playwright/test";
import { env } from "../utils/env";
import { exec, literal, scalar } from "../utils/psql";
import {
  anonymousContext, loginAs, provisionRbacTenant,
  rbacSuiteSkipReason, type RbacTenant
} from "../utils/rbac-tenant";

/**
 * Canonical Approved-only case selection:
 *   native REST /api/cycles/:id/testcases,
 *   MCP create_cycle_from_testcases,
 *   automation SDK createRun.
 * Disposable, project-isolated tenant; no production customers or AI provider.
 */
test.describe("Approved-only cases at native run write boundary", () => {
  let tenant: RbacTenant | null = null;
  let owner: APIRequestContext;
  let guest: APIRequestContext;
  let sequence = 0;

  test.beforeAll(async () => {
    tenant = await provisionRbacTenant("approved-run-cases");
    if (!tenant) return;
    owner = await loginAs(tenant.owner);
    guest = await loginAs(tenant.guest);
    purge(tenant);
  });

  test.afterAll(async () => {
    if (tenant) purge(tenant);
    await Promise.all([owner, guest].filter(Boolean).map((context) => context.dispose()));
  });

  test.beforeEach(() => {
    const reason = rbacSuiteSkipReason(tenant);
    test.skip(reason !== null, reason ?? "");
  });

  test.afterEach(() => { if (tenant) purge(tenant); });

  function purge(t: RbacTenant) {
    const p = [t.mainProjectId, t.secondProjectId].map(literal).join(",");
    const runs = `SELECT id FROM cycles WHERE project_id IN (${p}) AND name LIKE 'E2E Approved Boundary%'`;
    exec(`DELETE FROM executions WHERE cycle_item_id IN (SELECT ci.id FROM cycle_items ci WHERE ci.cycle_id IN (${runs}));`);
    exec(`DELETE FROM cycle_items WHERE cycle_id IN (${runs});`);
    exec(`DELETE FROM cycles WHERE id IN (${runs});`);
    exec(`DELETE FROM testcases WHERE project_id IN (${p}) AND external_id LIKE 'APR-%';`);
  }

  function createCase(status: "Approved" | "Draft" | "In Review" | "Deprecated",
    projectId = tenant!.mainProjectId): { id: string; externalId: string } {
    const externalId = "APR-" + (++sequence) + "-" + Date.now().toString(36).slice(-7);
    const id = scalar(
      `INSERT INTO testcases(project_id, external_id, title, status)
       VALUES (${literal(projectId)}, ${literal(externalId)},
         ${literal("E2E Approved Boundary " + status)}, ${literal(status)}) RETURNING id;`
    );
    return { id, externalId };
  }

  async function createRun() {
    const name = "E2E Approved Boundary Run " + Date.now();
    const res = await owner.post(`/api/projects/${tenant!.mainProjectId}/cycles`, {
      data: { name, environment: "Disposable QA" }, failOnStatusCode: false
    });
    expect(res.status(), await res.text()).toBe(201);
    return (await res.json()).id as string;
  }

  const items = (id: string) => Number(scalar(
    "SELECT COUNT(*)::int FROM cycle_items WHERE cycle_id=" + literal(id) +
    " AND deleted_at IS NULL;"
  ));
  const executed = (id: string) => Number(scalar(
    "SELECT COUNT(*)::int FROM executions e JOIN cycle_items ci ON ci.id=e.cycle_item_id" +
    " WHERE ci.cycle_id=" + literal(id) + " AND e.deleted_at IS NULL;"
  ));

  test("REST: mixed Approved and Draft is rejected atomically, then Approved retry is idempotent", async () => {
    const runId = await createRun();
    const approved = createCase("Approved");
    const draft = createCase("Draft");
    const endpoint = `/api/cycles/${runId}/testcases`;

    const refused = await owner.post(endpoint, {
      data: { testcaseIds: [approved.id, draft.id] }, failOnStatusCode: false
    });
    expect(refused.status(), await refused.text()).toBe(409);
    expect(await refused.text()).toContain("Only Approved test cases");
    expect(items(runId)).toBe(0);
    expect(executed(runId)).toBe(0);

    const allowed = await owner.post(endpoint, {
      data: { testcaseIds: [approved.id] }, failOnStatusCode: false
    });
    expect(allowed.status(), await allowed.text()).toBe(201);
    expect(await allowed.json()).toMatchObject({ requested: 1, added: 1, skipped: 0 });
    const replay = await owner.post(endpoint, {
      data: { testcaseIds: [approved.id] }, failOnStatusCode: false
    });
    expect(replay.ok()).toBeTruthy();
    expect(await replay.json()).toMatchObject({ requested: 1, added: 0, skipped: 1 });
    expect(items(runId)).toBe(1);
    expect(executed(runId)).toBe(1);

    // A case already in the run can be demoted, but a fresh add request must
    // reject its now-stale approval instead of accepting it based on the past.
    exec("UPDATE testcases SET status='Draft' WHERE id=" + literal(approved.id) + ";");
    const stale = await owner.post(endpoint, {
      data: { testcaseIds: [approved.id] }, failOnStatusCode: false
    });
    expect(stale.status()).toBe(409);
    expect(items(runId)).toBe(1);
  });

  test("REST: In Review/Deprecated refused; foreign, deleted and malformed ids retain skipped counts", async () => {
    const runId = await createRun();
    const approved = createCase("Approved");
    const review = createCase("In Review");
    const deprecated = createCase("Deprecated");
    const foreign = createCase("Approved", tenant!.secondProjectId);
    const deleted = createCase("Approved");
    exec("UPDATE testcases SET deleted_at=now() WHERE id=" + literal(deleted.id) + ";");
    const endpoint = `/api/cycles/${runId}/testcases`;

    for (const id of [review.id, deprecated.id]) {
      const refused = await owner.post(endpoint, {
        data: { testcaseIds: [approved.id, id] }, failOnStatusCode: false
      });
      expect(refused.status()).toBe(409);
      expect(items(runId)).toBe(0);
    }
    const selection = await owner.post(endpoint, {
      data: { testcaseIds: [approved.id, approved.id, foreign.id, deleted.id, "not-a-uuid"] },
      failOnStatusCode: false
    });
    expect(selection.ok(), await selection.text()).toBeTruthy();
    expect(await selection.json()).toMatchObject({ requested: 5, added: 1, skipped: 4 });
    expect(items(runId)).toBe(1);

    const unauthorized = await guest.post(endpoint, {
      data: { testcaseIds: [approved.id] }, failOnStatusCode: false
    });
    expect([401, 403, 404]).toContain(unauthorized.status());
    expect(items(runId)).toBe(1);
  });

  test("MCP: known Draft is refused before creating an empty cycle; Approved run succeeds", async () => {
    const draft = createCase("Draft");
    const name = "E2E Approved Boundary MCP " + Date.now();
    const issued = await owner.post(`/api/projects/${tenant!.mainProjectId}/apikeys`, {
      data: { name: "E2E Approved Boundary Token", scopes: ["read", "write"] },
      failOnStatusCode: false
    });
    expect(issued.ok(), await issued.text()).toBeTruthy();
    const credentials = await issued.json();
    const mcp = await newRequestContext.newContext({
      baseURL: env.apiBaseUrl, storageState: { cookies: [], origins: [] }
    });
    try {
      const rpc = (ids: string[]) => mcp.post(`/api/projects/${tenant!.mainProjectId}/mcp`, {
        headers: { Authorization: "Bearer " + credentials.token },
        data: { jsonrpc: "2.0", id: 1, method: "tools/call", params: {
          name: "create_cycle_from_testcases", arguments: { name, testcaseIds: ids }
        } }, failOnStatusCode: false
      });
      const denied = await rpc([draft.id]);
      expect(denied.ok(), await denied.text()).toBeTruthy();
      const error = await denied.json();
      expect(JSON.stringify(error)).toContain("Only Approved test cases");
      expect(Number(scalar("SELECT COUNT(*)::int FROM cycles WHERE project_id=" +
        literal(tenant!.mainProjectId) + " AND name=" + literal(name) + ";"))).toBe(0);

      exec("UPDATE testcases SET status='Approved' WHERE id=" + literal(draft.id) + ";");
      const allowed = await rpc([draft.id]);
      expect(allowed.ok(), await allowed.text()).toBeTruthy();
      const response = await allowed.json();
      expect(response.error).toBeUndefined();
      expect(JSON.stringify(response)).toContain("testcasesAdded");
      expect(Number(scalar("SELECT COUNT(*)::int FROM cycle_items WHERE cycle_id IN" +
        " (SELECT id FROM cycles WHERE project_id=" + literal(tenant!.mainProjectId) +
        " AND name=" + literal(name) + ");"))).toBe(1);
    } finally {
      await mcp.dispose();
      await owner.delete(`/api/projects/${tenant!.mainProjectId}/apikeys/${credentials.id}`, {
        failOnStatusCode: false
      });
    }
  });

  test("Automation SDK: known Draft refuses run creation, Approved case can be attached", async () => {
    const draft = createCase("Draft");
    const name = "E2E Approved Boundary Automation " + Date.now();
    const endpoint = `/api/projects/${tenant!.mainProjectId}/automation/runs`;
    const data = { name, environment: "Disposable CI", caseIds: [draft.externalId] };
    const denied = await owner.post(endpoint, { data, failOnStatusCode: false });
    expect(denied.status(), await denied.text()).toBe(409);
    expect(Number(scalar("SELECT COUNT(*)::int FROM cycles WHERE project_id=" +
      literal(tenant!.mainProjectId) + " AND name=" + literal(name) + ";"))).toBe(0);

    exec("UPDATE testcases SET status='Approved' WHERE id=" + literal(draft.id) + ";");
    const allowed = await owner.post(endpoint, { data, failOnStatusCode: false });
    expect(allowed.ok(), await allowed.text()).toBeTruthy();
    const body = await allowed.json();
    expect(body.casesAttached).toBe(1);
    expect(items(body.runId || body.id)).toBe(1);
  });
});
