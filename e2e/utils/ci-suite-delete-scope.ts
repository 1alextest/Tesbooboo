import { expect, test, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";
import type { Client } from "pg";

/** Extends the existing two-tenant smoke fixture; no second identity or test framework. */
export async function verifySuiteDeleteScope(ctx: {
  page: Page; api: string; web: string; db: Client; other: APIRequestContext; machine: APIRequestContext;
  projectId: string; foreignProject: string; ownerId: string; outsider: string; tokens: Record<string, string>; testInfo: TestInfo;
}) {
  const { page, api, web, db, other, machine, projectId, foreignProject, ownerId, outsider, tokens, testInfo } = ctx;
  const base = `${api}/api/projects/${projectId}`;
  async function post(url: string, data: Record<string, unknown>) {
    const response = await page.request.post(url, { data }); expect(response.ok(), await response.text()).toBeTruthy(); return response.json();
  }
  for (const mode of ["moveToDefault", "deleteTestcases"] as const) {
    await test.step(`suite ${mode} keeps counts and deletion within the authorized project`, async () => {
      const root = await post(`${base}/suites`, { name: `CI Scoped ${mode} root` });
      const child = await post(`${base}/suites`, { name: `CI Scoped ${mode} child`, parentId: root.id });
      const foreignChild = (await db.query("INSERT INTO suites (project_id,parent_id,name) VALUES ($1,$2,'CI PRIVATE inconsistent child') RETURNING id", [foreignProject, root.id])).rows[0].id;
      const local: Array<{ id: string; title: string }> = [], foreign: string[] = [];
      for (const [index, suiteId] of [root.id, child.id].entries()) {
        local.push((await db.query("INSERT INTO testcases (project_id,suite_id,external_id,title,created_by,updated_by) VALUES ($1,$2,$3,$4,$5,$5) RETURNING id,title", [projectId, suiteId, `SU-${mode}-${index}`, `CI ${mode} local ${index}`, ownerId])).rows[0]);
        foreign.push((await db.query("INSERT INTO testcases (project_id,suite_id,external_id,title,created_by,updated_by) VALUES ($1,$2,$3,'CI PRIVATE inconsistent case',$4,$4) RETURNING id", [foreignProject, suiteId, `SF-${mode}-${index}`, outsider])).rows[0].id);
      }
      // Reuse the normal Suite writer's existing cache invalidation after declared SQL fixtures.
      expect((await page.request.patch(`${api}/api/suites/${root.id}`, { data: { description: "Suite scope fixture" } })).ok()).toBeTruthy();
      const ids = [...local.map((row) => row.id), ...foreign];
      const state = async () => ({
        cases: (await db.query("SELECT * FROM testcases WHERE id=ANY($1::uuid[]) ORDER BY id", [ids])).rows,
        versions: (await db.query("SELECT * FROM testcase_versions WHERE testcase_id=ANY($1::uuid[]) ORDER BY testcase_id,version", [ids])).rows,
        suites: (await db.query("SELECT * FROM suites WHERE id=ANY($1::uuid[]) ORDER BY id", [[root.id, child.id, foreignChild]])).rows,
      });
      const before = await state();
      const listed = await page.request.get(`${base}/suites`); expect(listed.ok()).toBeTruthy();
      expect((await listed.json()).find((row: { id: string }) => row.id === root.id)).toMatchObject({ testCaseCount: 1, recursiveTestCaseCount: 2 });
      const discovery = await machine.post(`${base}/mcp`, { headers: { Authorization: `Bearer ${tokens.read}` }, data: { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "get_suite", arguments: { suiteId: root.id } } } });
      expect(discovery.status()).toBe(201); const rpc = await discovery.json(); expect(rpc.error).toBeUndefined();
      expect(JSON.parse(rpc.result.content[0].text)).toMatchObject({ id: root.id, testCaseCount: 1, recursiveTestCaseCount: 2 });
      // Legacy non-project-prefixed Suite routes intentionally do not accept bearer credentials.
      for (const [client, status, headers] of [[machine, 400, {}], [other, 404, {}], [machine, 403, { Authorization: `Bearer ${tokens.write}` }]] as const) {
        const denied = await client.delete(`${api}/api/suites/${root.id}`, { params: { mode }, headers });
        expect(denied.status(), await denied.text()).toBe(status); expect(await state()).toEqual(before);
      }
      await page.goto(`${web}/projects/${projectId}/testcases`);
      const rootRow = page.getByRole("button", { name: root.name, exact: true }).locator("..");
      await expect(rootRow.getByText("2", { exact: true })).toBeVisible();
      await expect(page.locator("body")).not.toContainText("CI PRIVATE");
      await testInfo.attach(`suite-${mode}-local-only-count`, { body: await page.screenshot(), contentType: "image/png" });
      await rootRow.hover(); await rootRow.getByTitle("Delete suite", { exact: true }).click();
      const modal = page.getByRole("heading", { name: "Delete suite", exact: true }).locator("..");
      const saved = page.waitForResponse((response) => response.url().startsWith(`${api}/api/suites/${root.id}?`) && response.request().method() === "DELETE");
      await modal.getByRole("button", { name: mode === "moveToDefault" ? /^Delete suite only/ : /^Delete suite and all test cases/ }).click();
      const response = await saved; expect(response.ok(), await response.text()).toBeTruthy(); await expect(modal).toBeHidden();
      const after = await state();
      for (const row of before.cases) {
        const next = after.cases.find((item) => item.id === row.id), versions = after.versions.filter((item) => item.testcase_id === row.id);
        if (foreign.includes(row.id)) {
          expect(next).toEqual(row); expect(versions).toEqual(before.versions.filter((item) => item.testcase_id === row.id));
          const readable = await other.get(`${api}/api/projects/${foreignProject}/testcases/${row.id}`); expect(readable.ok()).toBeTruthy();
          expect(await readable.json()).toMatchObject({ suiteId: row.suite_id, title: row.title });
        } else {
          expect(next).toEqual({ ...row, ...(mode === "moveToDefault" ? { suite_id: null } : { deleted_at: expect.any(Date), deleted_by: ownerId, updated_by: ownerId }), updated_at: expect.any(Date) });
          expect(versions).toHaveLength(1); expect(versions[0].snapshot).toMatchObject({ suite_id: row.suite_id, deleted_at: null });
        }
      }
      for (const row of before.suites) expect(after.suites.find((item) => item.id === row.id)).toEqual(row.id === foreignChild ? row : { ...row, deleted_at: expect.any(Date), deleted_by: ownerId, updated_at: expect.any(Date) });
      await page.reload();
      await expect(page.getByRole("button", { name: root.name, exact: true })).toHaveCount(0);
      for (const row of local) {
        if (mode === "moveToDefault") await expect(page.getByRole("button", { name: row.title, exact: true })).toBeVisible();
        else await expect(page.getByRole("button", { name: row.title, exact: true })).toHaveCount(0);
      }
      await expect(page.locator("body")).not.toContainText("CI PRIVATE");
      await testInfo.attach(`suite-${mode}-after-reload`, { body: await page.screenshot(), contentType: "image/png" });
    });
  }
}
