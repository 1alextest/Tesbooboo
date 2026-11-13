import { expect, test, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";
import type { Client } from "pg";

/** Extends the existing two-tenant smoke fixture; no second identity or test framework. */
export async function verifySuiteDeleteScope(ctx: {
  page: Page; api: string; web: string; db: Client; other: APIRequestContext; machine: APIRequestContext;
  projectId: string; foreignProject: string; ownerId: string; outsider: string; tokens: Record<string, string>; testInfo: TestInfo;
}) {
  const { page, api, web, db, other, machine, projectId, foreignProject, ownerId, outsider, tokens, testInfo } = ctx;
  const base = `${api}/api/projects/${projectId}`;
  const projectResponse = await page.request.get(base); expect(projectResponse.ok()).toBeTruthy();
  const project = await projectResponse.json(); expect(project).toMatchObject({ id: projectId, key: expect.any(String) });
  const repositoryUrl = `${web}/projects/${encodeURIComponent(project.key)}/testcases`;
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
      await page.goto(`${repositoryUrl}?suiteId=${child.id}`);
      const rootRow = page.getByRole("button", { name: root.name, exact: true }).locator("..");
      await expect(rootRow.getByText("2", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: local[1].title, exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: local[0].title, exact: true })).toHaveCount(0);
      await expect(page.locator("body")).not.toContainText("CI PRIVATE");
      await testInfo.attach(`suite-${mode}-local-only-count`, { body: await page.screenshot(), contentType: "image/png" });
      await rootRow.hover(); await rootRow.getByTitle("Delete suite", { exact: true }).click();
      const modal = page.getByRole("heading", { name: "Delete suite", exact: true }).locator("..");
      if (mode === "moveToDefault") {
        const pageErrors: string[] = [], recordError = (error: Error) => pageErrors.push(error.message);
        page.on("pageerror", recordError);
        let release!: () => void;
        const gate = new Promise<void>((resolve) => { release = resolve; });
        let reached!: () => void;
        const intercepted = new Promise<void>((resolve) => { reached = resolve; });
        try {
          // Controlled pre-delivery refusal, not a real entitlement change or outage. The
          // anonymous/nonmember/bearer controls above still exercise genuine server refusals.
          await page.route((url) => url.href.startsWith(`${api}/api/suites/${root.id}?`), async (route) => {
            reached(); await gate;
            await route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: "CI controlled Suite deletion refusal" }) });
          }, { times: 1 });
          await modal.getByRole("button", { name: /^Delete suite only/ }).click();
          await intercepted;
          for (const name of [/^Delete suite only/, /^Delete suite and all test cases/, /^Cancel$/]) await expect(modal.getByRole("button", { name })).toBeDisabled();
          await page.keyboard.press("Escape"); await expect(modal).toBeVisible(); release();
          await expect(modal.getByRole("alert")).toContainText("CI controlled Suite deletion refusal");
          expect(await state()).toEqual(before); await expect(modal.getByRole("button", { name: /^Delete suite only/ })).toBeEnabled();
        } finally {
          release();
          await testInfo.attach("suite-delete-refusal-visible-recovery", { body: await page.screenshot(), contentType: "image/png" });
          await testInfo.attach("suite-delete-refusal-page-errors", { body: JSON.stringify(pageErrors), contentType: "application/json" });
          page.off("pageerror", recordError);
        }
        await modal.getByRole("button", { name: "Cancel", exact: true }).click(); await expect(modal).toBeHidden();
        await rootRow.hover(); await rootRow.getByTitle("Delete suite", { exact: true }).click();
        await expect(modal.getByRole("alert")).toHaveCount(0);
      } else {
        // Abort before delivery: the transport must not replay DELETE, and UI must retain
        // its existing honest "outcome unconfirmed" guidance, not promise a rollback.
        await page.route((url) => url.href.startsWith(`${api}/api/suites/${root.id}?`), (route) => route.abort("failed"), { times: 1 });
        await modal.getByRole("button", { name: /^Delete suite and all test cases/ }).click();
        await expect(modal.getByRole("alert")).toContainText("Request outcome unconfirmed. This action may already have been applied.");
        expect(await state()).toEqual(before);
        await testInfo.attach("suite-delete-network-outcome-unconfirmed", { body: await page.screenshot(), contentType: "image/png" });
        await modal.getByRole("button", { name: "Reload repository", exact: true }).click();
        await expect(modal).toBeHidden();
        await expect(page.getByRole("button", { name: local[1].title, exact: true })).toBeVisible();
        await rootRow.hover(); await rootRow.getByTitle("Delete suite", { exact: true }).click();
        await expect(modal.getByRole("alert")).toHaveCount(0);
      }
      await expect(modal).toContainText("2 test cases are currently assigned to this suite and its sub-suites.");
      await expect(modal).toContainText("Both options delete this suite and its 1 sub-suite, including any nested suites.");
      await expect(modal).toContainText("No suites");
      await expect(modal).toContainText("Existing run results and test case version history are retained.");
      await expect(modal).not.toContainText("Default Suite"); await expect(modal).not.toContainText(/permanently|may affect/i);
      await testInfo.attach(`suite-${mode}-truthful-subtree-guidance`, { body: await page.screenshot(), contentType: "image/png" });
      const saved = page.waitForResponse((response) => response.url().startsWith(`${api}/api/suites/${root.id}?`) && response.request().method() === "DELETE");
      await modal.getByRole("button", { name: mode === "moveToDefault" ? /^Delete suite only/ : /^Delete suite and all test cases/ }).click();
      const response = await saved; expect(response.ok(), await response.text()).toBeTruthy(); await expect(modal).toBeHidden();
      await expect(page).toHaveURL(repositoryUrl);
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
  await test.step("empty Suite deletion preserves the No suites view and clears any prior dialog error", async () => {
    const empty = await post(`${base}/suites`, { name: "CI Empty Suite removal" });
    await page.goto(`${repositoryUrl}?suiteId=none`);
    const row = page.getByRole("button", { name: empty.name, exact: true }).locator("..");
    await row.hover(); await row.getByTitle("Delete suite", { exact: true }).click();
    const modal = page.getByRole("heading", { name: "Delete suite", exact: true }).locator("..");
    await expect(modal).toContainText("No test cases are currently assigned to this suite.");
    await expect(modal.getByRole("alert")).toHaveCount(0);
    await testInfo.attach("empty-suite-delete-truthful-guidance", { body: await page.screenshot(), contentType: "image/png" });
    let deleteRequests = 0;
    page.on("request", (request) => { if (request.method() === "DELETE" && new URL(request.url()).pathname === `/api/suites/${empty.id}`) deleteRequests += 1; });
    // DELETE will really commit; only its follow-up Suite-list read is refused.
    await page.route((url) => url.href === `${base}/suites`, (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "CI controlled repository refresh failure" }) }), { times: 1 });
    await modal.getByRole("button", { name: /^Delete suite only/ }).click(); await expect(modal).toBeHidden();
    await expect(page).toHaveURL(`${repositoryUrl}?suiteId=none`);
    await expect(page.getByRole("alert")).toContainText("Suite deleted, but the repository could not be refreshed.");
    expect((await db.query("SELECT deleted_at FROM suites WHERE id=$1", [empty.id])).rows[0].deleted_at).toBeInstanceOf(Date);
    await testInfo.attach("confirmed-suite-delete-refresh-failure-not-a-retry", { body: await page.screenshot(), contentType: "image/png" });
    await page.getByRole("button", { name: "Reload repository", exact: true }).click();
    await expect(page.getByRole("button", { name: empty.name, exact: true })).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0); expect(deleteRequests).toBe(1);
  });
  await test.step("deeply nested Suite guidance counts the whole subtree and leaves no removed grandchild filter", async () => {
    const root = await post(`${base}/suites`, { name: "CI Deep empty root" });
    const child = await post(`${base}/suites`, { name: "CI Deep empty child", parentId: root.id });
    const leaf = await post(`${base}/suites`, { name: "CI Deep empty grandchild", parentId: child.id });
    const ids = [root.id, child.id, leaf.id];
    const otherSuites = async () => (await db.query("SELECT * FROM suites WHERE project_id=ANY($1::uuid[]) AND NOT id=ANY($2::uuid[]) ORDER BY id", [[projectId, foreignProject], ids])).rows;
    const before = await otherSuites();
    await page.goto(`${repositoryUrl}?suiteId=${leaf.id}`);
    const row = page.getByRole("button", { name: root.name, exact: true }).locator("..");
    await row.hover(); await row.getByTitle("Delete suite", { exact: true }).click();
    const modal = page.getByRole("heading", { name: "Delete suite", exact: true }).locator("..");
    await expect(modal).toContainText("No test cases are currently assigned to this suite or its sub-suites.");
    await expect(modal).toContainText("Both options delete this suite and its 2 sub-suites, including any nested suites.");
    await testInfo.attach("deep-suite-delete-whole-subtree-guidance", { body: await page.screenshot(), contentType: "image/png" });
    const saved = page.waitForResponse((response) => response.url().startsWith(`${api}/api/suites/${root.id}?`) && response.request().method() === "DELETE");
    await modal.getByRole("button", { name: /^Delete suite and all test cases/ }).click(); expect((await saved).ok()).toBeTruthy();
    await expect(modal).toBeHidden(); await expect(page).toHaveURL(repositoryUrl);
    const removed = (await db.query("SELECT id,deleted_at,deleted_by FROM suites WHERE id=ANY($1::uuid[])", [ids])).rows;
    expect(removed).toHaveLength(3); for (const suite of removed) expect(suite).toMatchObject({ deleted_at: expect.any(Date), deleted_by: ownerId });
    expect(await otherSuites()).toEqual(before);
  });
}
