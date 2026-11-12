import { expect, request as newRequest, test, type Page, type TestInfo } from "@playwright/test";
import { Client } from "pg";

const advertisedTools = `list_projects list_testcases get_testcase create_testcase update_testcase archive_testcase restore_testcase duplicate_testcase bulk_create_testcases bulk_update_testcases bulk_archive_testcases get_testcase_bugs get_testcase_executions link_requirement_to_testcase unlink_requirement_from_testcase list_suites get_suite create_suite update_suite clone_test_suite list_test_cycles get_test_cycle create_cycle_from_plan create_cycle_from_testcases record_execution_result list_executions get_execution update_execution_result bulk_record_execution_results get_test_execution_summary list_bugs get_bug create_bug update_bug link_testcase_to_bug unlink_testcase_from_bug get_requirement_matrix search_knowledge_base list_knowledge_documents get_knowledge_document create_knowledge_document update_knowledge_document move_knowledge_document archive_knowledge_document restore_knowledge_document list_knowledge_folders get_knowledge_folder create_knowledge_folder update_knowledge_folder move_knowledge_folder`.split(" ");

/** Only called after the smoke's explicit loopback/tesbo_ci checks and genuine login. */
export async function verifyRepositoryPartialEdits(page: Page, api: string, web: string, projectId: string, ownerId: string, testInfo: TestInfo) {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  // Deliberately NOT page.request: the machine transport must never inherit the browser cookie.
  const machine = await newRequest.newContext({ storageState: { cookies: [], origins: [] } });
  const base = `${api}/api/projects/${projectId}`, repo = `${web}/projects/${projectId}/testcases`;
  const tokens: string[] = [], failures: unknown[] = [];
  const capture = async (name: string) => testInfo.attach(name, { body: await page.screenshot(), contentType: "image/png" });
  const checked = async (name: string, run: () => Promise<void>) => {
    try { await test.step(name, run); }
    catch (error) {
      failures.push(error);
      // Tokens may be visible in the reveal modal or connection snippets on a failed step.
      await testInfo.attach(`repository-failure-${failures.length}`, { body: await page.screenshot({ mask: [page.locator("input"), page.locator("pre")] }), contentType: "image/png" });
    }
  };
  async function post(path: string, data: Record<string, unknown>) {
    const response = await page.request.post(path, { data });
    expect(response.ok(), await response.text()).toBeTruthy(); return response.json();
  }
  async function patch(path: string, data: Record<string, unknown>) {
    const response = await page.request.patch(path, { data });
    expect(response.ok(), await response.text()).toBeTruthy();
  }
  const caseState = async (id: string) => ({
    row: (await db.query("SELECT * FROM testcases WHERE id = $1", [id])).rows[0],
    versions: (await db.query("SELECT * FROM testcase_versions WHERE testcase_id = $1 ORDER BY version", [id])).rows,
  });
  const projectState = async () => ({
    cases: (await db.query("SELECT * FROM testcases WHERE project_id = $1 ORDER BY id", [projectId])).rows,
    history: (await db.query("SELECT v.* FROM testcase_versions v JOIN testcases t ON t.id = v.testcase_id WHERE t.project_id = $1 ORDER BY v.testcase_id,v.version", [projectId])).rows,
    suites: (await db.query("SELECT * FROM suites WHERE project_id = $1 ORDER BY id", [projectId])).rows,
    runs: (await db.query("SELECT * FROM cycles WHERE project_id = $1 ORDER BY id", [projectId])).rows,
    items: (await db.query("SELECT ci.* FROM cycle_items ci JOIN cycles c ON c.id = ci.cycle_id WHERE c.project_id = $1 ORDER BY ci.id", [projectId])).rows,
    executions: (await db.query("SELECT e.* FROM executions e JOIN cycle_items ci ON ci.id = e.cycle_item_id JOIN cycles c ON c.id = ci.cycle_id WHERE c.project_id = $1 ORDER BY e.id", [projectId])).rows,
  });
  const panel = () => page.locator("aside").filter({ has: page.locator("#panel-form-global") });
  const suiteField = () => panel().locator("select").filter({ has: page.locator('option[value=""]', { hasText: "No suite" }) });
  async function openCase(title: string, suite: string) {
    await page.goto(repo);
    await page.getByRole("button", { name: suite, exact: true }).click();
    await page.getByRole("button", { name: title, exact: true }).click();
    await expect(panel().getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(panel().getByRole("button", { name: "Save changes", exact: true })).toBeEnabled();
  }
  await db.connect();
  try {
    const first = await post(`${base}/suites`, { name: "CI Original parent" });
    const second = await post(`${base}/suites`, { name: "CI Concurrent parent" });
    const child = await post(`${base}/suites`, { name: "CI Child suite", parentId: first.id, description: "Original description", preconditions: "Original setup" });
    const selected = await post(`${base}/testcases`, { title: "CI Archive retains relationships", suiteId: first.id, ownerId, description: "Preserve authored body", steps: [{ action: "Act", expectedResult: "Expect" }], jiraIssueKey: "CI-1", jiraUrl: "https://example.invalid/CI-1" });
    const control = await post(`${base}/testcases`, { title: "CI Unselected repository control", suiteId: first.id, ownerId });
    const run = await post(`${base}/cycles`, { name: "CI Existing manual run" });
    await post(`${api}/api/cycles/${run.id}/testcases`, { testcaseIds: [selected.id] });
    const controlBefore = await caseState(control.id);
    const associations = async () => {
      const state = await projectState(); return { runs: state.runs, items: state.items, executions: state.executions };
    };
    const associationsBefore = await associations();

    await checked("drawer Archive/Unarchive changes status only and preserves suite, owner, body, history and manual-run associations after reload", async () => {
      await openCase(selected.title, first.name);
      await expect(suiteField()).toHaveValue(first.id);
      const before = await caseState(selected.id);
      page.once("dialog", (dialog) => dialog.accept());
      const archivedResponse = page.waitForResponse((response) => response.url() === `${base}/testcases/${selected.id}` && response.request().method() === "PUT");
      await panel().getByRole("button", { name: "Archive", exact: true }).click();
      const archived = await archivedResponse;
      expect(archived.ok(), await archived.text()).toBeTruthy();
      expect(archived.request().postDataJSON()).toEqual({ status: "Archived" });
      await expect(panel().getByRole("button", { name: "Unarchive", exact: true })).toBeEnabled();
      await expect(suiteField()).toHaveValue(first.id);
      const middle = await caseState(selected.id);
      expect(middle.row).toEqual({ ...before.row, status: "Archived", updated_at: expect.any(Date) });
      expect(middle.versions).toHaveLength(before.versions.length + 1);
      expect(middle.versions.at(-1)).toMatchObject({ changed_by: ownerId, snapshot: expect.objectContaining({ suite_id: first.id, owner_id: ownerId, status: "Draft" }) });
      await capture("repository-archived-case-retains-suite");
      const restoredResponse = page.waitForResponse((response) => response.url() === `${base}/testcases/${selected.id}` && response.request().method() === "PUT");
      await panel().getByRole("button", { name: "Unarchive", exact: true }).click();
      const restored = await restoredResponse;
      expect(restored.ok(), await restored.text()).toBeTruthy();
      expect(restored.request().postDataJSON()).toEqual({ status: "Draft" });
      await expect(panel().getByRole("button", { name: "Archive", exact: true })).toBeEnabled();
      await openCase(selected.title, first.name);
      await expect(suiteField()).toHaveValue(first.id);
      const after = await caseState(selected.id);
      expect(after.row).toEqual({ ...before.row, updated_at: expect.any(Date) });
      expect(after.versions).toHaveLength(before.versions.length + 2);
      expect(after.versions.at(-1)).toMatchObject({ snapshot: expect.objectContaining({ suite_id: first.id, owner_id: ownerId, status: "Archived" }) });
      expect(await associations()).toEqual(associationsBefore); expect(await caseState(control.id)).toEqual(controlBefore);
      await capture("repository-restored-case-after-reload");
    });

    await checked("a stale suite rename dialog does not replay an old parent over a real REST move", async () => {
      await page.goto(repo);
      const expand = page.getByTestId(`suite-expand-${first.id}`);
      await expand.click();
      await page.getByRole("button", { name: child.name, exact: true }).click();
      await page.getByTitle("Rename suite", { exact: true }).click();
      const modal = page.getByRole("heading", { name: "Rename suite", exact: true }).locator("..");
      const name = modal.locator("input[type=text]");
      await expect(name).toHaveValue(child.name);
      // Another authenticated writer moves the suite AFTER this browser loaded its hierarchy.
      await patch(`${api}/api/suites/${child.id}`, { parentId: second.id });
      await name.fill("CI Renamed without moving");
      await modal.getByPlaceholder("What does this suite cover?").fill("Edited description");
      const saved = page.waitForResponse((response) => response.url() === `${api}/api/suites/${child.id}` && response.request().method() === "PATCH");
      await modal.getByRole("button", { name: "Save", exact: true }).click();
      const response = await saved;
      expect(response.ok(), await response.text()).toBeTruthy();
      expect(response.request().postDataJSON()).toEqual({ name: "CI Renamed without moving", description: "Edited description", preconditions: "Original setup" });
      await expect(page.getByRole("heading", { name: "Rename suite", exact: true })).toBeHidden();
      expect((await db.query("SELECT parent_id,name,description,preconditions FROM suites WHERE id = $1", [child.id])).rows[0]).toEqual({ parent_id: second.id, name: "CI Renamed without moving", description: "Edited description", preconditions: "Original setup" });
      await page.reload();
      await expect(page.getByRole("button", { name: second.name, exact: true })).toBeVisible();
      await page.getByTestId(`suite-expand-${second.id}`).click();
      await page.getByRole("button", { name: "CI Renamed without moving", exact: true }).click();
      await expect(page.getByTestId("suite-details")).toContainText("Edited description");
      expect(await associations()).toEqual(associationsBefore); expect(await caseState(control.id)).toEqual(controlBefore);
      await capture("repository-renamed-suite-under-concurrent-parent");
    });

    await checked("UI-created API tokens support cookie-free MCP initialize/discovery/writes, read-only refusal and UI revocation", async () => {
      const tokenPage = `${web}/projects/${projectId}/settings/api-tokens`;
      async function createToken(name: string, readOnly = false) {
        await page.goto(tokenPage);
        await page.getByRole("button", { name: "Create token", exact: true }).click();
        const modal = page.getByRole("heading", { name: "Create API token", exact: true }).locator("..");
        await modal.getByPlaceholder("e.g. Claude Code — my laptop").fill(name);
        if (readOnly) await modal.getByRole("checkbox", { name: /^Write/ }).uncheck();
        const issued = page.waitForResponse((response) => response.url() === `${base}/apikeys` && response.request().method() === "POST");
        await modal.getByRole("button", { name: "Create token", exact: true }).click();
        const response = await issued;
        expect(response.ok()).toBeTruthy();
        const data = await response.json(); tokens.push(data.id);
        const reveal = page.getByRole("heading", { name: "Copy your new token", exact: true }).locator("..");
        await expect(reveal.locator("input[readonly]")).toHaveValue(data.token);
        await reveal.getByRole("button", { name: "Done", exact: true }).click();
        await page.reload(); // Clear the just-created secret from ALL connection snippets before capture.
        await expect(page.getByRole("row").filter({ hasText: name })).toBeVisible();
        expect(await page.locator("body").innerText()).not.toContain(data.token);
        return { id: data.id as string, secret: data.token as string, name };
      }
      let rpcId = 0;
      async function rpc(secret: string, method: string, params: Record<string, unknown> = {}, session?: string, alias = false) {
        return machine.post(alias ? `${api}/api/mcp` : `${base}/mcp`, {
          headers: { Authorization: `Bearer ${secret}`, ...(session ? { "mcp-session-id": session } : {}) },
          data: { jsonrpc: "2.0", id: ++rpcId, method, params },
        });
      }
      async function call(secret: string, session: string, name: string, args: Record<string, unknown>) {
        const response = await rpc(secret, "tools/call", { name, arguments: args }, session);
        expect(response.status()).toBe(201);
        const body = await response.json(); expect(body.error).toBeUndefined(); expect(body.result.isError).toBe(false);
        return JSON.parse(body.result.content[0].text);
      }
      const write = await createToken("CI MCP read-write");
      const initialized = await rpc(write.secret, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "tesbo-ci", version: "1" } });
      expect(initialized.status()).toBe(201);
      expect((await initialized.json()).result).toMatchObject({ protocolVersion: "2025-06-18", serverInfo: { name: "tesbo-mcp" }, capabilities: { tools: { listChanged: false } } });
      const session = initialized.headers()["mcp-session-id"]; expect(session).toBeTruthy();
      const discovery = await rpc(write.secret, "tools/list", {}, session, true);
      expect(discovery.status()).toBe(201);
      const tools = (await discovery.json()).result.tools as Array<{ name: string; description: string; inputSchema: { type: string } }>;
      expect(tools.map((tool) => tool.name).sort()).toEqual([...advertisedTools].sort());
      for (const tool of tools) { expect(tool.description.length).toBeGreaterThan(0); expect(tool.inputSchema.type).toBe("object"); }
      const noBearer = await page.request.post(`${base}/mcp`, { data: { jsonrpc: "2.0", id: 1, method: "tools/list" } });
      expect(noBearer.status()).toBe(401); // A real browser session is not an MCP credential.
      expect((await machine.storageState()).cookies).toEqual([]);
      const created = await call(write.secret, session, "create_testcase", { title: "CI MCP persisted case", suiteId: first.id, ownerId, description: "MCP body" });
      const initial = await caseState(created.id);
      const mcpActor = (await db.query<{ id: string }>("SELECT id FROM agents WHERE slug = 'tesbo-mcp'")).rows[0].id;
      expect(initial.row).toMatchObject({ suite_id: first.id, owner_id: ownerId, created_by: mcpActor });
      for (const [name, args, expected] of [
        ["update_testcase", { title: "CI MCP partial title" }, { title: "CI MCP partial title" }],
        ["archive_testcase", {}, { status: "Archived" }],
        ["restore_testcase", {}, { status: "Draft" }],
        ["link_requirement_to_testcase", { jiraIssueKey: "CI-22" }, { jira_issue_key: "CI-22" }],
        ["unlink_requirement_from_testcase", { provider: "jira" }, { jira_issue_key: null }],
      ] as const) {
        const before = await caseState(created.id);
        await call(write.secret, session, name, { testcaseId: created.id, ...args });
        const after = await caseState(created.id);
        expect(after.row).toMatchObject({ suite_id: first.id, owner_id: ownerId, description: "MCP body", updated_by: mcpActor, ...expected });
        expect(after.versions).toHaveLength(before.versions.length + 1);
        expect(after.versions.at(-1)).toMatchObject({ changed_by: mcpActor, snapshot: expect.objectContaining({ suite_id: first.id, owner_id: ownerId }) });
      }
      await call(write.secret, session, "update_testcase", { testcaseId: created.id, suiteId: null });
      expect((await caseState(created.id)).row).toMatchObject({ suite_id: null, owner_id: ownerId });
      await call(write.secret, session, "update_testcase", { testcaseId: created.id, suiteId: second.id });
      expect((await caseState(created.id)).row).toMatchObject({ suite_id: second.id, owner_id: ownerId });
      const read = await createToken("CI MCP read-only", true);
      const readInit = await rpc(read.secret, "initialize", { protocolVersion: "2024-11-05" });
      expect(readInit.status()).toBe(201);
      const readSession = readInit.headers()["mcp-session-id"];
      expect(await call(read.secret, readSession, "get_testcase", { testcaseId: created.id })).toMatchObject({ id: created.id, suiteId: second.id, ownerId });
      const beforeDenied = await projectState();
      const denied = await rpc(read.secret, "tools/call", { name: "archive_testcase", arguments: { testcaseId: created.id } }, readSession);
      expect(denied.status()).toBe(201); expect((await denied.json()).error).toMatchObject({ code: -32002 });
      expect(await projectState()).toEqual(beforeDenied);
      await capture("mcp-ui-issued-tokens-with-secret-cleared");
      for (const token of [read, write]) {
        const row = page.getByRole("row").filter({ hasText: token.name });
        const revoked = page.waitForResponse((response) => response.url() === `${base}/apikeys/${token.id}` && response.request().method() === "DELETE");
        await row.getByRole("button", { name: "Revoke", exact: true }).click();
        expect((await revoked).ok()).toBeTruthy(); await expect(row).toHaveCount(0);
        const refusal = await rpc(token.secret, "tools/call", { name: "archive_testcase", arguments: { testcaseId: created.id } }, token.id === read.id ? readSession : session);
        expect(refusal.status()).toBe(401); expect(await projectState()).toEqual(beforeDenied);
        expect((await db.query("SELECT id FROM api_tokens WHERE id = $1", [token.id])).rowCount).toBe(0);
      }
      await page.reload();
      await expect(page.getByText("No API tokens yet.", { exact: false })).toBeVisible();
      expect(await associations()).toEqual(associationsBefore); expect(await caseState(control.id)).toEqual(controlBefore);
      await capture("mcp-tokens-revoked-and-domain-state-preserved");
      await openCase("CI MCP partial title", second.name);
      await expect(suiteField()).toHaveValue(second.id);
      await capture("mcp-created-and-edited-case-in-real-repository");
    });
    expect(await caseState(control.id)).toEqual(controlBefore);
    expect(await associations()).toEqual(associationsBefore);
    if (failures.length) throw new AggregateError(failures, `${failures.length} repository/MCP journey step(s) failed`);
  } finally {
    for (const id of tokens) {
      const revoked = await page.request.delete(`${base}/apikeys/${id}`);
      expect([200, 204, 404]).toContain(revoked.status());
    }
    // Keep suite/case/run/version/audit provenance until the disposable database teardown.
    await machine.dispose(); await db.end();
  }
}
