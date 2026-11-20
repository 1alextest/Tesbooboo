import { createTestcaseFixtureResponse } from "./testcase-approval";
import { approveMcpTestClient, issueMcpTestToken } from "./mcp-access";
import { randomUUID } from "node:crypto";
import { expect, request as newRequest, test, type Page, type TestInfo } from "@playwright/test";
import { Client } from "pg";
import { isDeepStrictEqual } from "node:util";
import { verifyMcpDiagnosticLifecycle } from "./ci-mcp-diagnostic-lifecycle";

const advertisedTools = `list_projects list_testcases get_testcase get_testcase_bugs get_testcase_executions list_suites get_suite create_suite update_suite list_test_cycles get_test_cycle create_cycle_from_plan create_cycle_from_testcases record_execution_result list_executions get_execution update_execution_result bulk_record_execution_results get_test_execution_summary list_bugs get_bug create_bug update_bug link_testcase_to_bug unlink_testcase_from_bug get_requirement_matrix search_knowledge_base list_knowledge_documents get_knowledge_document create_knowledge_document update_knowledge_document move_knowledge_document archive_knowledge_document restore_knowledge_document list_knowledge_folders get_knowledge_folder create_knowledge_folder update_knowledge_folder move_knowledge_folder list_qa_graph_changes capture_qa_graph_change preview_behavior_model_draft create_behavior_model save_behavior_model_revision link_behavior_model_case get_behavior_model_coverage archive_behavior_model run_behavior_model stage_testcase_changes list_testcase_proposals get_testcase_proposal_task`.split(" ");

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
    const response = /\/api\/projects\/[^/]+\/testcases$/.test(path)
      ? await createTestcaseFixtureResponse(page.request, path, { data })
      : /\/apikeys$/.test(path)
        ? await issueMcpTestToken(page.request, path, { data })
        : await page.request.post(path, { data });
    expect(response.ok(), await response.text()).toBeTruthy(); return response.json();
  }
  async function patch(path: string, data: Record<string, unknown>) {
    const response = await page.request.patch(path, { data });
    expect(response.ok(), await response.text()).toBeTruthy();
  }
  const caseState = async (id: string) => ({
    // Match the trigger's JSON timestamp representation, including native microseconds.
    row: (await db.query("SELECT to_jsonb(t) AS row FROM testcases t WHERE id = $1", [id])).rows[0].row as Record<string, unknown>,
    versions: (await db.query("SELECT * FROM testcase_versions WHERE testcase_id = $1 ORDER BY version", [id])).rows,
  });
  const projectState = async () => ({
    cases: (await db.query("SELECT to_jsonb(t) AS row FROM testcases t WHERE project_id = $1 ORDER BY id", [projectId])).rows.map((item) => item.row as Record<string, unknown>),
    history: (await db.query("SELECT v.* FROM testcase_versions v JOIN testcases t ON t.id = v.testcase_id WHERE t.project_id = $1 ORDER BY v.testcase_id,v.version", [projectId])).rows,
    suites: (await db.query("SELECT * FROM suites WHERE project_id = $1 ORDER BY id", [projectId])).rows,
    runs: (await db.query("SELECT * FROM cycles WHERE project_id = $1 ORDER BY id", [projectId])).rows,
    items: (await db.query("SELECT ci.* FROM cycle_items ci JOIN cycles c ON c.id = ci.cycle_id WHERE c.project_id = $1 ORDER BY ci.id", [projectId])).rows,
    executions: (await db.query("SELECT e.* FROM executions e JOIN cycle_items ci ON ci.id = e.cycle_item_id JOIN cycles c ON c.id = ci.cycle_id WHERE c.project_id = $1 ORDER BY e.id", [projectId])).rows,
  });
  // Existing live ingestion/worker updates also fire the immutable testcase snapshot trigger.
  // Keep EVERY raw history row and require its prefix to survive. Count an additional row as
  // bookkeeping only when adjacent snapshots/live content agree on ALL non-bookkeeping fields.
  // In particular, suite/owner/status/body/attribution/search-vector are never excluded.
  const domain = (row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).filter(([key]) => !["embedding_status", "embedding_content_hash", "embedding_queued_at", "updated_at"].includes(key)));
  function expectHistory(before: Awaited<ReturnType<typeof caseState>>, after: Awaited<ReturnType<typeof caseState>>, changes: number, actor?: string) {
    expect(after.versions.slice(0, before.versions.length)).toEqual(before.versions);
    expect(after.versions.map((version) => version.version)).toEqual(after.versions.map((_, index) => index + 1));
    const authored = after.versions.slice(before.versions.length).filter((version, offset) => {
      const next = after.versions[before.versions.length + offset + 1]?.snapshot ?? after.row;
      return !isDeepStrictEqual(domain(version.snapshot), domain(next));
    });
    expect(authored, "exact authored changes; any extra snapshots must differ ONLY in embedding bookkeeping/time").toHaveLength(changes);
    if (changes === 1) {
      expect(domain(authored[0].snapshot)).toEqual(domain(before.row));
      expect(authored[0].changed_by).toBe(actor);
    }
  }
  function expectCaseUnchanged(before: Awaited<ReturnType<typeof caseState>>, after: Awaited<ReturnType<typeof caseState>>) {
    expect(domain(after.row)).toEqual(domain(before.row)); expectHistory(before, after, 0);
  }
  function expectProjectUnchanged(before: Awaited<ReturnType<typeof projectState>>, after: Awaited<ReturnType<typeof projectState>>) {
    expect(after.cases.map((row) => row.id)).toEqual(before.cases.map((row) => row.id));
    for (const row of before.cases) {
      expectCaseUnchanged({ row, versions: before.history.filter((version) => version.testcase_id === row.id) }, {
        row: after.cases.find((item) => item.id === row.id)!, versions: after.history.filter((version) => version.testcase_id === row.id),
      });
    }
    for (const key of ["suites", "runs", "items", "executions"] as const) expect(after[key]).toEqual(before[key]);
  }
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
    const selected = await post(`${base}/testcases`, { title: "CI Archive retains relationships", status: "Approved", suiteId: first.id, ownerId, description: "Preserve authored body", steps: [{ action: "Act", expectedResult: "Expect" }], jiraIssueKey: "CI-1", jiraUrl: "https://example.invalid/CI-1" });
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
      expect(archived.request().postDataJSON()).toEqual({ status: "Archived", expectedRevision: expect.stringMatching(/^[a-f0-9]{64}$/) });
      await expect(panel().getByRole("button", { name: "Unarchive", exact: true })).toBeEnabled();
      await expect(suiteField()).toHaveValue(first.id);
      const middle = await caseState(selected.id);
      expect(domain(middle.row)).toEqual({ ...domain(before.row), status: "Archived" });
      expectHistory(before, middle, 1, ownerId);
      await capture("repository-archived-case-retains-suite");
      const restoredResponse = page.waitForResponse((response) => response.url() === `${base}/testcases/${selected.id}` && response.request().method() === "PUT");
      await panel().getByRole("button", { name: "Unarchive", exact: true }).click();
      const restored = await restoredResponse;
      expect(restored.ok(), await restored.text()).toBeTruthy();
      expect(restored.request().postDataJSON()).toEqual({ status: "Draft", expectedRevision: expect.stringMatching(/^[a-f0-9]{64}$/) });
      await expect(panel().getByRole("button", { name: "Archive", exact: true })).toBeEnabled();
      await openCase(selected.title, first.name);
      await expect(suiteField()).toHaveValue(first.id);
      const after = await caseState(selected.id);
      // Unarchive always restores Draft. Historical run membership persists
      // even though the case was Approved when first added.
      expect(domain(after.row)).toEqual({ ...domain(before.row), status: "Draft" });
      expectHistory(middle, after, 1, ownerId);
      expectHistory(before, after, 2);
      expect(await associations()).toEqual(associationsBefore); expectCaseUnchanged(controlBefore, await caseState(control.id));
      await capture("repository-restored-case-after-reload");
    });

    await checked("a stale suite rename dialog does not replay an old parent over a real REST move", async () => {
      await page.goto(repo);
      const expand = page.getByTestId(`suite-expand-${first.id}`);
      await expand.click();
      await page.getByRole("button", { name: child.name, exact: true }).click();
      // The sidebar has hidden per-row Rename icons too; target the visible content action.
      await page.getByRole("button", { name: "Rename suite", exact: true }).click();
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
      expect(await associations()).toEqual(associationsBefore); expectCaseUnchanged(controlBefore, await caseState(control.id));
      await capture("repository-renamed-suite-under-concurrent-parent");
    });

    await checked("stale case edits refuse overwrite, retain local Notes, and require explicit reload/review", async () => {
      await openCase(selected.title, first.name);
      const notes = panel().getByPlaceholder("Add notes, links to screenshots, logs, or reference docs");
      await notes.fill("Unsaved browser Notes");
      const external = await page.request.put(`${base}/testcases/${selected.id}`, { data: { attachments: "Newer reviewer Notes" } });
      expect(external.ok(), await external.text()).toBeTruthy();
      const committed = await caseState(selected.id);
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = page.waitForResponse((response) => response.url() === `${base}/testcases/${selected.id}` && response.request().method() === "PUT");
        await panel().getByRole("button", { name: "Save changes", exact: true }).click();
        const refused = await response;
        expect(refused.status(), await refused.text()).toBe(409);
        expect(refused.request().postDataJSON().expectedRevision).toMatch(/^[a-f0-9]{64}$/);
        await expect(panel().getByRole("alert")).toContainText("Your changes were not saved");
        await expect(notes).toHaveValue("Unsaved browser Notes");
        expectCaseUnchanged(committed, await caseState(selected.id));
      }
      await capture("repository-stale-edit-retains-unsaved-notes");
      page.once("dialog", (dialog) => dialog.dismiss());
      await panel().getByRole("button", { name: "Reload latest case" }).click();
      await expect(notes).toHaveValue("Unsaved browser Notes");
      page.once("dialog", (dialog) => dialog.accept());
      await panel().getByRole("button", { name: "Reload latest case" }).click();
      await expect(notes).toHaveValue("Newer reviewer Notes");
      await notes.fill("Newer reviewer Notes; reviewed browser addition");
      await panel().getByRole("button", { name: "Save changes", exact: true }).click();
      await expect(panel().getByText("Test case updated successfully.")).toBeVisible();
      const saved = await caseState(selected.id);
      expect(saved.row).toMatchObject({ attachments: "Newer reviewer Notes; reviewed browser addition", suite_id: first.id, owner_id: ownerId });
      expectHistory(committed, saved, 1, ownerId);
      expect(await associations()).toEqual(associationsBefore);
      expectCaseUnchanged(controlBefore, await caseState(control.id));
      // A stale backend/cache response must never silently turn the editor into
      // an unconditional writer when its revision metadata is missing.
      await expect(panel().getByRole("button", { name: "Save changes", exact: true })).toBeEnabled();
      const caseUrl = `${base}/testcases/${selected.id}`;
      // Fulfil every detail read during this step, including the transport's safe-read retry, with
      // a body that omits the revision. Reusing the fetched response while overriding its JSON
      // left the panel waiting for a read that never settled; an explicit body is unambiguous.
      await page.route(caseUrl, async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        delete body.editRevision;
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      });
      try {
        await page.goto(repo);
        await page.getByRole("button", { name: first.name, exact: true }).click();
        await page.getByRole("button", { name: selected.title, exact: true }).click();
        await expect(panel().getByRole("alert")).toContainText("Case edit revision is unavailable");
        await expect(panel().getByRole("button", { name: "Save changes", exact: true })).toBeDisabled();
      } finally { await page.unroute(caseUrl); }
      page.once("dialog", (dialog) => dialog.accept());
      await panel().getByRole("button", { name: "Reload latest case" }).click();
      await expect(panel().getByRole("button", { name: "Save changes", exact: true })).toBeEnabled();
    });

    await checked("UI-created API tokens support consent, unpublished MCP proposals, human publication and revocation", async () => {
      const tokenPage = `${web}/projects/${projectId}/settings/api-tokens`;
      async function createToken(name: string, scopes: "read" | "read-write") {
        await page.goto(tokenPage);
        await page.getByRole("button", { name: "Create token", exact: true }).click();
        const modal = page.getByRole("heading", { name: "Create API token", exact: true }).locator("..");
        await modal.getByPlaceholder("e.g. Claude Code — my laptop").fill(name);
        await expect(modal).toContainText("Read is selected by default");
        await expect(modal).toContainText("Automated Playwright reporting needs Read and Write");
        await expect(modal.getByRole("checkbox", { name: /^Read/ })).toBeChecked();
        await expect(modal.getByRole("checkbox", { name: /^Write/ })).not.toBeChecked();
        if (scopes === "read-write") await modal.getByRole("checkbox", { name: /^Write/ }).check();
        let release!: () => void;
        const held = new Promise<void>((resolve) => { release = resolve; });
        // Hold the actual issuance response, not a synthetic token: Escape/backdrop must not
        // strand a successful creation before its one-time reveal can be copied.
        await page.route(`${base}/apikeys`, async (route) => {
          if (route.request().method() !== "POST") return route.continue();
          const response = await route.fetch();
          await held; await route.fulfill({ response });
        });
        const issued = page.waitForResponse((response) => response.url() === `${base}/apikeys` && response.request().method() === "POST");
        try {
          await modal.getByRole("button", { name: "Create token", exact: true }).click();
          await expect(modal.getByRole("button", { name: "Creating…", exact: true })).toBeDisabled();
          await page.keyboard.press("Escape");
          await expect(modal).toBeVisible();
          await modal.locator("..").click({ position: { x: 2, y: 2 } });
          await expect(modal).toBeVisible();
        } finally { release(); }
        const response = await issued;
        await page.unroute(`${base}/apikeys`);
        expect(response.ok()).toBeTruthy();
        expect(response.request().postDataJSON()).toEqual({ name, scopes: scopes === "read" ? ["read"] : ["read", "write"] });
        const data = await response.json(); tokens.push(data.id);
        expect(data.scopes).toEqual(scopes === "read" ? ["read"] : ["read", "write"]);
        const reveal = page.getByRole("heading", { name: "Copy your new token", exact: true }).locator("..");
        await expect(reveal.locator("input[readonly]")).toHaveValue(data.token);
        for (const snippet of await page.locator("pre").allTextContents()) expect(snippet).not.toContain(data.token);
        await page.keyboard.press("Escape"); await expect(reveal).toBeVisible();
        await reveal.getByRole("button", { name: "Done", exact: true }).click();
        await expect(page.getByRole("row").filter({ hasText: name })).toBeVisible();
        expect(await page.locator("body").innerText()).not.toContain(data.token);
        await expect(page.locator("input[readonly]")).toHaveCount(0);
        await page.reload();
        await expect(page.getByRole("row").filter({ hasText: name })).toBeVisible();
        expect(await page.locator("body").innerText()).not.toContain(data.token);
        // Token issuance alone grants no MCP consent. This fixture's human explicitly approves
        // the particular credential before the independent cookie-free client uses it.
        await approveMcpTestClient(page.request, projectId, data, api);
        return { id: data.id as string, secret: data.token as string, name };
      }
      const diagnostic = () => page.getByRole("heading", { name: "Check MCP connection", exact: true }).locator("../..");
      async function checkConnection(secret: string, expected: RegExp) {
        await diagnostic().getByLabel("API token", { exact: true }).fill(secret);
        await diagnostic().getByRole("button", { name: "Check connection", exact: true }).click();
        await expect(diagnostic().getByRole("status")).toContainText(expected);
        await expect(diagnostic().getByLabel("API token", { exact: true })).toHaveValue("");
        expect(await diagnostic().innerText()).not.toContain(secret);
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
      async function stageAndApply(secret: string, session: string, operation: Record<string, unknown>) {
        const before = await projectState();
        const staged = await call(secret, session, "stage_testcase_changes", { requestKey: randomUUID(), operations: [operation] });
        expect(staged.publication).toBe("unpublished");
        expect(staged.taskId).toBe(staged.task.id);
        expectProjectUnchanged(before, await projectState());
        const reviewed = await call(secret, session, "get_testcase_proposal_task", { taskId: staged.taskId });
        expect(reviewed.proposalRevision).toBe(staged.task.proposalRevision);
        const applied = await page.request.post(`${base}/agents/zyra/tasks/${staged.taskId}/save`, {
          data: { expectedProposalRevision: reviewed.proposalRevision, selectedDraftIndexes: [0] },
        });
        expect(applied.ok(), await applied.text()).toBeTruthy();
        const result = await applied.json();
        expect(result.saveReceipt).toMatchObject({ reviewerId: ownerId, principalKind: "human_session" });
        return result;
      }
      const write = await createToken("CI MCP read-write", "read-write");
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
      const beforeCachedWrites = await projectState();
      for (const name of ["create_testcase", "update_testcase", "archive_testcase", "restore_testcase", "duplicate_testcase", "bulk_create_testcases", "bulk_update_testcases", "bulk_archive_testcases", "link_requirement_to_testcase", "unlink_requirement_from_testcase", "clone_test_suite"]) {
        const refused = await rpc(write.secret, "tools/call", { name, arguments: { title: "Must remain unpublished" } }, session);
        expect((await refused.json()).error.data).toMatchObject({ code: "HUMAN_PUBLICATION_REQUIRED", stagingAvailable: true });
        expectProjectUnchanged(beforeCachedWrites, await projectState());
      }
      const created = (await stageAndApply(write.secret, session, { opType: "create", draft: { title: "CI MCP persisted case", suiteId: first.id, ownerId, description: "MCP body" } })).testcases[0];
      const initial = await caseState(created.id);
      expect(initial.row).toMatchObject({ suite_id: first.id, owner_id: ownerId, created_by: ownerId });
      for (const [opType, fields, expected] of [
        ["update", { title: "CI MCP partial title" }, { title: "CI MCP partial title" }],
        ["archive", {}, { status: "Archived" }],
        ["update", { status: "Draft" }, { status: "Draft" }],
        ["update", { jiraIssueKey: "CI-22" }, { jira_issue_key: "CI-22" }],
        ["update", { jiraIssueKey: null }, { jira_issue_key: null }],
      ] as const) {
        const before = await caseState(created.id);
        const current = await call(write.secret, session, "get_testcase", { testcaseId: created.id });
        await stageAndApply(write.secret, session, { opType, testcaseId: created.id, expectedRevision: current.editRevision, fields });
        const after = await caseState(created.id);
        expect(after.row).toMatchObject({ suite_id: first.id, owner_id: ownerId, description: "MCP body", updated_by: ownerId, ...expected });
        expectHistory(before, after, 1, ownerId);
      }
      const readCase = await call(write.secret, session, "get_testcase", { testcaseId: created.id });
      expect(readCase.editRevision).toMatch(/^[a-f0-9]{64}$/);
      const humanEdit = await page.request.put(`${base}/testcases/${created.id}`, { data: { attachments: "Human Notes before MCP" } });
      expect(humanEdit.ok(), await humanEdit.text()).toBeTruthy();
      const committed = await caseState(created.id);
      for (const expectedRevision of [readCase.editRevision, null, "", 3, true, [], {}]) {
        const response = await rpc(write.secret, "tools/call", { name: "stage_testcase_changes", arguments: {
          requestKey: randomUUID(), operations: [{ opType: "update", testcaseId: created.id, expectedRevision, fields: { attachments: "Must not replace human Notes" } }]
        } }, session);
        expect(response.ok()).toBeTruthy();
        const body = await response.json();
        if (expectedRevision === readCase.editRevision) {
          expect(body.error.data).toMatchObject({ code: "PROPOSAL_TARGET_CONFLICT" });
          expect(body.error.message).toMatch(/changed before this proposal was staged/);
        } else {
          expect(body.error.message).toMatch(/expectedRevision/);
        }
        expectCaseUnchanged(committed, await caseState(created.id));
      }
      const current = await call(write.secret, session, "get_testcase", { testcaseId: created.id });
      await stageAndApply(write.secret, session, {
        opType: "update", testcaseId: created.id, expectedRevision: current.editRevision, fields: { attachments: "Human Notes; reviewed MCP addition" }
      });
      const guarded = await caseState(created.id);
      expect(guarded.row.attachments).toBe("Human Notes; reviewed MCP addition");
      expectHistory(committed, guarded, 1, ownerId);
      const beforeUnassign = await call(write.secret, session, "get_testcase", { testcaseId: created.id });
      await stageAndApply(write.secret, session, { opType: "update", testcaseId: created.id, expectedRevision: beforeUnassign.editRevision, fields: { suiteId: null } });
      expect((await caseState(created.id)).row).toMatchObject({ suite_id: null, owner_id: ownerId });
      const beforeMove = await call(write.secret, session, "get_testcase", { testcaseId: created.id });
      await stageAndApply(write.secret, session, { opType: "update", testcaseId: created.id, expectedRevision: beforeMove.editRevision, fields: { suiteId: second.id } });
      expect((await caseState(created.id)).row).toMatchObject({ suite_id: second.id, owner_id: ownerId });
      const read = await createToken("CI MCP read-only", "read");
      const readInit = await rpc(read.secret, "initialize", { protocolVersion: "2024-11-05" });
      expect(readInit.status()).toBe(201);
      const readSession = readInit.headers()["mcp-session-id"];
      expect(await call(read.secret, readSession, "get_testcase", { testcaseId: created.id })).toMatchObject({ id: created.id, suiteId: second.id, ownerId });
      const beforeDenied = await projectState();
      const denied = await rpc(read.secret, "tools/call", { name: "archive_testcase", arguments: { testcaseId: created.id } }, readSession);
      expect(denied.status()).toBe(201); expect((await denied.json()).error).toMatchObject({ code: -32002 });
      expectProjectUnchanged(beforeDenied, await projectState());
      await test.step("configured endpoint/OpenCode guidance and read-only browser diagnostics are honest and secret-free", async () => {
        await page.getByRole("button", { name: "OpenCode", exact: true }).click();
        const config = page.locator("pre").filter({ hasText: '"$schema": "https://opencode.ai/config.json"' });
        expect(JSON.parse((await config.textContent())!)).toEqual({
          $schema: "https://opencode.ai/config.json", mcp: { servers: { tesbo: {
            type: "remote", url: `${base}/mcp`, oauth: false, headers: { Authorization: "Bearer {env:TESBO_API_TOKEN}" },
          } } },
        });
        await expect(page.getByText(api, { exact: true })).toBeVisible();
        await expect(diagnostic()).toContainText(`${base}/mcp`);
        const requests: Array<Promise<{ method: string; params?: unknown; cookie?: string }>> = [];
        const collect = (request: import("@playwright/test").Request) => {
          if (request.url() !== `${base}/mcp` || request.method() !== "POST") return;
          const body = request.postDataJSON();
          requests.push(request.allHeaders().then((headers) => ({ method: body.method, params: body.params, cookie: headers.cookie })));
        };
        page.on("request", collect);
        try {
          const before = await projectState();
          for (const token of [read, write]) {
            requests.length = 0;
            const advertisedCount = token.id === read.id ? 24 : 51;
            await checkConnection(token.secret, new RegExp(`Read permission and project identity verified; ${advertisedCount} MCP tools advertised`));
            expect(await Promise.all(requests)).toEqual([
              { method: "tools/list", params: undefined, cookie: undefined },
              { method: "tools/call", params: { name: "list_projects", arguments: {} }, cookie: undefined },
            ]);
            await expect(diagnostic()).toContainText("Write permissions and reporting were not tested");
          }
          expectProjectUnchanged(before, await projectState());
          await capture("mcp-browser-read-check-and-opencode-config");
          await checkConnection("tsbo_invalid_ci_credential", /Token was rejected/);
          expectProjectUnchanged(before, await projectState());
          const writeOnly = await post(`${base}/apikeys`, { name: "CI diagnostic write-only control", scopes: ["write"] });
          try {
            await checkConnection(writeOnly.token, /Read permission was not verified/);
            expectProjectUnchanged(before, await projectState());
          } finally {
            const revoked = await page.request.delete(`${base}/apikeys/${writeOnly.id}`);
            expect(revoked.ok()).toBeTruthy();
          }
          const other = await post(`${api}/api/projects`, { name: "CI MCP other project", key: "MCO" });
          await page.goto(`${web}/projects/${other.id}/settings/api-tokens`);
          await expect(diagnostic()).toContainText(`${api}/api/projects/${other.id}/mcp`);
          await checkConnection(read.secret, /Token does not have access to this project/);
          await page.goto(tokenPage);
          await expect(diagnostic()).toContainText(`${base}/mcp`);
          for (const kind of ["malformed", "rpc-error", "network"] as const) {
            await page.route(`${base}/mcp`, (route) => kind === "network" ? route.abort("failed") : route.fulfill({
              status: 201, contentType: "application/json", body: JSON.stringify(kind === "malformed" ? { result: { tools: [] } } : {
                jsonrpc: "2.0", id: 1, error: { code: -32603, message: read.secret },
              }),
            }));
            try { await checkConnection(read.secret, kind === "malformed" ? /unexpected MCP response/ : kind === "rpc-error" ? /MCP returned an error/ : /could not be verified from this browser/); }
            finally { await page.unroute(`${base}/mcp`); }
            expectProjectUnchanged(before, await projectState());
          }
          await diagnostic().scrollIntoViewIfNeeded();
          await capture("mcp-browser-diagnostic-failure-with-token-cleared");
          await verifyMcpDiagnosticLifecycle(page, api, web, projectId, other.id, read.secret, testInfo);
          expectProjectUnchanged(before, await projectState());
        } finally { page.off("request", collect); }
      });
      await capture("mcp-ui-issued-tokens-with-secret-cleared");
      for (const token of [read, write]) {
        const row = page.getByRole("row").filter({ hasText: token.name });
        const revoked = page.waitForResponse((response) => response.url() === `${base}/apikeys/${token.id}` && response.request().method() === "DELETE");
        await row.getByRole("button", { name: "Revoke", exact: true }).click();
        expect((await revoked).ok()).toBeTruthy(); await expect(row).toHaveCount(0);
        const refusal = await rpc(token.secret, "tools/call", { name: "archive_testcase", arguments: { testcaseId: created.id } }, token.id === read.id ? readSession : session);
        expect(refusal.status()).toBe(401); expectProjectUnchanged(beforeDenied, await projectState());
        expect((await db.query("SELECT id FROM api_tokens WHERE id = $1", [token.id])).rowCount).toBe(0);
        await checkConnection(token.secret, /Token was rejected/);
      }
      await page.reload();
      await expect(page.getByText("No API tokens yet.", { exact: false })).toBeVisible();
      expect(await associations()).toEqual(associationsBefore); expectCaseUnchanged(controlBefore, await caseState(control.id));
      await capture("mcp-tokens-revoked-and-domain-state-preserved");
      await openCase("CI MCP partial title", second.name);
      await expect(suiteField()).toHaveValue(second.id);
      await capture("mcp-created-and-edited-case-in-real-repository");
    });
    expectCaseUnchanged(controlBefore, await caseState(control.id));
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
