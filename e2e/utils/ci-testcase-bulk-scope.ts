import { randomUUID } from "node:crypto";
import { expect, request as newRequest, test, type Page, type TestInfo } from "@playwright/test";
import { Client } from "pg";
import { hashPasswordForSeed } from "./password";

/** Existing bulk API/UI contract on the disposable smoke stack, with a truly separate tenant. */
export async function verifyTestcaseBulkScope(page: Page, api: string, web: string, projectId: string, ownerId: string, testInfo: TestInfo) {
  const db = new Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
  const machine = await newRequest.newContext({ storageState: { cookies: [], origins: [] } });
  const other = await newRequest.newContext({ storageState: { cookies: [], origins: [] } });
  const base = `${api}/api/projects/${projectId}`, stamp = randomUUID();
  const tokens: string[] = [];
  let sequence = 0;
  async function post(url: string, data: Record<string, unknown>) {
    const response = await page.request.post(url, { data }); expect(response.ok(), await response.text()).toBeTruthy(); return response.json();
  }
  try {
    const org = (await db.query("INSERT INTO organizations (name,slug) VALUES ('CI Bulk Other Tenant',$1) RETURNING id", [`bulk-${stamp}`])).rows[0].id;
    const email = `ci-bulk-${stamp}@tesbo.invalid`, password = "Ci-Bulk-2026!";
    const outsider = (await db.query("INSERT INTO users (email,name,password_hash,active_organization_id) VALUES ($1,'CI Other Bulk Owner',$2,$3) RETURNING id", [email, hashPasswordForSeed(password), org])).rows[0].id;
    await db.query("INSERT INTO organization_members (organization_id,user_id,role) VALUES ($1,$2,'owner')", [org, outsider]);
    const foreignProject = (await db.query("INSERT INTO projects (organization_id,key,name) VALUES ($1,'BFOREIGN','CI Private Bulk Project') RETURNING id", [org])).rows[0].id;
    await db.query("INSERT INTO project_members (project_id,user_id,role) VALUES ($1,$2,'owner')", [foreignProject, outsider]);
    const login = await other.post(`${api}/api/auth/password/login`, { data: { email, password } }); expect(login.ok(), await login.text()).toBeTruthy();
    const suite = await post(`${base}/suites`, { name: "CI Bulk Local Suite" });
    async function seed(title: string, foreign = false, deleted = false) {
      // Declared native fixtures avoid embedding-worker bookkeeping between exact no-write checks.
      return (await db.query("INSERT INTO testcases (project_id,suite_id,external_id,title,description,priority,owner_id,created_by,updated_by,deleted_at) VALUES ($1,$2,$3,$4,'Preserve bulk body','P2',$5,$5,$5,CASE WHEN $6::boolean THEN now() ELSE NULL END) RETURNING *", [foreign ? foreignProject : projectId, foreign ? null : suite.id, `BULK-TC-${++sequence}`, title, foreign ? outsider : ownerId, deleted])).rows[0];
    }
    const first = await seed("CI Bulk Selected One"), second = await seed("CI Bulk Selected Two"), control = await seed("CI Bulk Unselected Control");
    const deleted = await seed("CI Bulk Already Deleted", false, true), foreign = await seed("CI PRIVATE Bulk Case", true);
    const ids = [first.id, second.id, control.id, deleted.id, foreign.id];
    const state = async () => ({
      cases: (await db.query("SELECT * FROM testcases WHERE id=ANY($1::uuid[]) ORDER BY id", [ids])).rows,
      history: (await db.query("SELECT * FROM testcase_versions WHERE testcase_id=ANY($1::uuid[]) ORDER BY testcase_id,version", [ids])).rows,
    });
    const activity = async () => (await db.query("SELECT * FROM audit_logs WHERE project_id=$1 AND action=ANY($2::text[]) ORDER BY created_at,id", [projectId, ["testcase_bulk_updated", "testcase_bulk_deleted"]])).rows;
    const expectPreserved = (before: Awaited<ReturnType<typeof state>>, after: Awaited<ReturnType<typeof state>>, selected: string[]) => {
      for (const row of before.cases.filter((item) => !selected.includes(item.id))) {
        expect(after.cases.find((item) => item.id === row.id)).toEqual(row);
        expect(after.history.filter((item) => item.testcase_id === row.id)).toEqual(before.history.filter((item) => item.testcase_id === row.id));
      }
      for (const id of selected) {
        const previous = before.history.filter((item) => item.testcase_id === id), next = after.history.filter((item) => item.testcase_id === id);
        expect(next.slice(0, previous.length)).toEqual(previous); expect(next).toHaveLength(previous.length + 1);
        expect(next.at(-1)).toMatchObject({ changed_by: ownerId });
      }
    };
    const tokenByScope: Record<string, string> = {};
    for (const scope of ["read", "write"]) {
      const issued = await post(`${base}/apikeys`, { name: `CI Bulk ${scope}`, scopes: [scope] }); tokens.push(issued.id); tokenByScope[scope] = issued.token;
    }
    const endpoint = (kind: string) => `${base}/testcases/bulk-${kind}`;

    await test.step("genuine anonymous, nonmember and read-only bearer requests are refused before any row/history/activity write", async () => {
      expect((await page.request.get(`${api}/api/projects/${foreignProject}/testcases/${foreign.id}`)).status()).toBe(404);
      expect((await other.get(`${api}/api/projects/${foreignProject}/testcases/${foreign.id}`)).ok()).toBeTruthy();
      const before = await state(), events = await activity();
      for (const kind of ["update", "delete"]) {
        const data = { testcaseIds: [first.id, foreign.id], priority: "P0" };
        for (const [client, status, headers] of [
          [machine, 400, {}], [other, 404, {}], [machine, 403, { Authorization: `Bearer ${tokenByScope.read}` }],
        ] as const) {
          const response = await client.post(endpoint(kind), { data, headers });
          expect(response.status(), await response.text()).toBe(status); expect(await state()).toEqual(before); expect(await activity()).toEqual(events);
        }
      }
    });

    await test.step("session REST mixed update only affects the local selection once and logs the actual count", async () => {
      const before = await state();
      const response = await page.request.post(endpoint("update"), { data: { testcaseIds: [first.id, foreign.id, deleted.id, randomUUID(), first.id], priority: "P0" } });
      expect(response.ok(), await response.text()).toBeTruthy();
      const after = await state(); expectPreserved(before, after, [first.id]);
      expect(after.cases.find((item) => item.id === first.id)).toEqual({ ...before.cases.find((item) => item.id === first.id), priority: "P0", updated_by: ownerId, updated_at: expect.any(Date) });
      const events = await activity(); expect(events).toHaveLength(1); expect(events[0].diff).toMatchObject({ testcaseIds: [first.id], requestedCount: 5 });
    });

    await test.step("foreign/unknown/deleted and empty REST selections remain no-ops, including a cookie-free Write token", async () => {
      const before = await state();
      for (const kind of ["update", "delete"]) {
        for (const testcaseIds of [[foreign.id, deleted.id, randomUUID()], []]) {
          const response = await machine.post(endpoint(kind), { headers: { Authorization: `Bearer ${tokenByScope.write}` }, data: { testcaseIds, priority: "P0" } });
          expect(response.ok(), await response.text()).toBeTruthy(); expect(await state()).toEqual(before);
          const events = await activity(); expect(events.at(-1).diff.testcaseIds).toEqual([]);
        }
      }
    });

    await test.step("MCP preserves indexed per-item outcomes through the same bulk writer", async () => {
      const before = await state();
      const response = await machine.post(`${base}/mcp`, {
        headers: { Authorization: `Bearer ${tokenByScope.write}` },
        data: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "bulk_update_testcases", arguments: { testcaseIds: [first.id, foreign.id], priority: "P1" } } },
      });
      expect(response.status()).toBe(201); const rpc = await response.json(); expect(rpc.error).toBeUndefined();
      expect(JSON.parse(rpc.result.content[0].text)).toMatchObject({ total: 2, succeeded: 1, failed: 1, results: expect.arrayContaining([{ id: first.id, ok: true }, { id: foreign.id, ok: false, error: "Test case not found in this project" }]) });
      expectPreserved(before, await state(), [first.id]);
    });

    await test.step("the existing bulk modal updates local cases, survives a controlled refusal and reloads authoritative state", async () => {
      await page.goto(`${web}/projects/${projectId}/testcases`);
      await page.getByRole("checkbox", { name: `Select ${first.title}`, exact: true }).check();
      await page.getByRole("checkbox", { name: `Select ${second.title}`, exact: true }).check();
      await page.getByRole("button", { name: "Bulk actions", exact: true }).click();
      const modal = page.getByRole("heading", { name: "Bulk actions", exact: true }).locator("..");
      await modal.locator("select").filter({ has: page.locator('option[value="update"]') }).selectOption("update");
      await modal.locator("select").filter({ has: page.locator('option[value="P0"]') }).selectOption("P0");
      const before = await state();
      // One controlled pre-delivery 403, not a real entitlement transition or backend outage.
      await page.route(endpoint("update"), async (route) => route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: "CI controlled bulk refusal" }) }), { times: 1 });
      await modal.getByRole("button", { name: "Confirm", exact: true }).click();
      await expect(modal.getByText("CI controlled bulk refusal", { exact: true })).toBeVisible(); expect(await state()).toEqual(before);
      const saved = page.waitForResponse((response) => response.url() === endpoint("update") && response.request().method() === "POST");
      await modal.getByRole("button", { name: "Confirm", exact: true }).click(); expect((await saved).ok()).toBeTruthy();
      await expect(modal).toBeHidden();
      const after = await state(); expectPreserved(before, after, [first.id, second.id]);
      for (const id of [first.id, second.id]) expect(after.cases.find((row) => row.id === id)).toMatchObject({ priority: "P0", suite_id: suite.id, description: "Preserve bulk body", owner_id: ownerId });
      await page.reload();
      for (const title of [first.title, second.title]) await expect(page.getByRole("row").filter({ has: page.getByRole("button", { name: title, exact: true }) })).toContainText("P0");
      await expect(page.locator("body")).not.toContainText(foreign.title);
      await testInfo.attach("bulk-local-update-after-reload", { body: await page.screenshot(), contentType: "image/png" });
    });

    await test.step("a cookie-free bearer mixed delete preserves the foreign case and the same UI can delete the remaining local selection", async () => {
      const before = await state();
      const response = await machine.post(endpoint("delete"), { headers: { Authorization: `Bearer ${tokenByScope.write}` }, data: { testcaseIds: [first.id, foreign.id, deleted.id, randomUUID(), first.id] } });
      expect(response.ok(), await response.text()).toBeTruthy(); const after = await state(); expectPreserved(before, after, [first.id]);
      expect(after.cases.find((row) => row.id === first.id)).toMatchObject({ deleted_at: expect.any(Date), deleted_by: ownerId });
      const events = await activity(); expect(events.at(-1).diff).toMatchObject({ testcaseIds: [first.id], requestedCount: 5 });
      await page.reload(); await expect(page.getByRole("button", { name: first.title, exact: true })).toHaveCount(0);
      await page.getByRole("checkbox", { name: `Select ${second.title}`, exact: true }).check();
      await page.getByRole("button", { name: "Bulk actions", exact: true }).click();
      const modal = page.getByRole("heading", { name: "Bulk actions", exact: true }).locator("..");
      await modal.locator("select").selectOption("delete");
      const saved = page.waitForResponse((item) => item.url() === endpoint("delete") && item.request().method() === "POST");
      await modal.getByRole("button", { name: "Confirm", exact: true }).click(); expect((await saved).ok()).toBeTruthy();
      await expect(modal).toBeHidden(); await page.reload();
      await expect(page.getByRole("button", { name: second.title, exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: control.title, exact: true })).toBeVisible();
      expectPreserved(after, await state(), [second.id]);
      expect((await other.get(`${api}/api/projects/${foreignProject}/testcases/${foreign.id}`)).ok()).toBeTruthy();
      await testInfo.attach("bulk-delete-keeps-unselected-local-and-foreign-records", { body: await page.screenshot(), contentType: "image/png" });
    });

    await test.step("the existing Activity UI counts changed rows, not foreign, missing or duplicate IDs", async () => {
      await page.goto(`${web}/projects/${projectId}/activity`);
      await expect(page.getByText("Bulk-updated 1 test case(s).", { exact: true }).first()).toBeVisible();
      await expect(page.getByText("Bulk-updated 2 test case(s).", { exact: true })).toBeVisible();
      await expect(page.getByText("Deleted 1 test case(s).", { exact: true }).first()).toBeVisible();
      await expect(page.getByText("Bulk-updated 5 test case(s).", { exact: true })).toHaveCount(0);
      await expect(page.getByText("Deleted 5 test case(s).", { exact: true })).toHaveCount(0);
      await expect(page.locator("body")).not.toContainText(foreign.title);
      await testInfo.attach("bulk-activity-counts-actual-project-rows", { body: await page.screenshot(), contentType: "image/png" });
    });
  } finally {
    for (const id of tokens) expect((await page.request.delete(`${base}/apikeys/${id}`)).ok()).toBeTruthy();
    await machine.dispose(); await other.dispose(); await db.end(); // Preserve synthetic history/audit until disposable DB teardown.
  }
}
