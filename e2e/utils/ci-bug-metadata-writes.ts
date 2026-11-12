import { expect, request as newRequest, test, type Page, type TestInfo } from "@playwright/test";
import { Client } from "pg";

/** Real app/HTTP/DB verification, only after the smoke's loopback + disposable tesbo_ci checks. */
export async function verifyBugMetadataWrites(page: Page, api: string, web: string, projectId: string, ownerId: string, testInfo: TestInfo) {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  const machine = await newRequest.newContext({ storageState: { cookies: [], origins: [] } });
  const base = `${api}/api/projects/${projectId}`, failures: unknown[] = [], tokenIds: string[] = [];
  let connectionId = "";
  const form = () => page.getByRole("region", { name: "Edit bug", exact: true });
  const title = () => form().locator('input[type="text"]').first();
  const description = () => form().locator("textarea").first();
  const betterbugs = () => form().getByPlaceholder("https://app.betterbugs.io/session/…");
  const capture = async (name: string) => testInfo.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  const checked = async (name: string, work: () => Promise<void>) => {
    try { await test.step(name, work); }
    catch (error) { failures.push(error); await capture(`bug-edit-failure-${failures.length}`); }
  };
  async function post(path: string, data: Record<string, unknown>) {
    const response = await page.request.post(path, { data }); expect(response.ok(), await response.text()).toBeTruthy(); return response.json();
  }
  async function patch(id: string, data: Record<string, unknown>) {
    const response = await page.request.patch(`${api}/api/bugs/${id}`, { data }); expect(response.ok(), await response.text()).toBeTruthy(); return response.json();
  }
  const state = async (id: string) => ({
    bug: (await db.query("SELECT * FROM bugs WHERE id=$1", [id])).rows[0],
    links: (await db.query("SELECT * FROM bug_links WHERE bug_id=$1 ORDER BY id", [id])).rows,
    comments: (await db.query("SELECT * FROM bug_comments WHERE bug_id=$1 ORDER BY id", [id])).rows,
    attachments: (await db.query("SELECT * FROM attachments WHERE entity_id=$1 ORDER BY id", [id])).rows,
    audit: (await db.query("SELECT * FROM audit_logs WHERE entity_id=$1 ORDER BY created_at,id", [id])).rows,
  });
  const associations = async () => ({
    runs: (await db.query("SELECT * FROM cycles WHERE project_id=$1 ORDER BY id", [projectId])).rows,
    items: (await db.query("SELECT ci.* FROM cycle_items ci JOIN cycles c ON c.id=ci.cycle_id WHERE c.project_id=$1 ORDER BY ci.id", [projectId])).rows,
    executions: (await db.query("SELECT e.* FROM executions e JOIN cycle_items ci ON ci.id=e.cycle_item_id JOIN cycles c ON c.id=ci.cycle_id WHERE c.project_id=$1 ORDER BY e.id", [projectId])).rows,
  });
  function preserved(before: Awaited<ReturnType<typeof state>>, after: Awaited<ReturnType<typeof state>>) {
    for (const key of ["links", "comments", "attachments"] as const) expect(after[key]).toEqual(before[key]);
    expect(after.audit.slice(0, before.audit.length)).toEqual(before.audit);
  }
  async function open(id: string) {
    await page.goto(`${web}/projects/${projectId}/bugs/${id}?edit=1`);
    await expect(form()).toBeVisible(); await expect(page.getByRole("button", { name: "Save Changes", exact: true })).toBeEnabled();
  }
  async function save(id: string) {
    const pending = page.waitForResponse((response) => response.url() === `${api}/api/bugs/${id}` && response.request().method() === "PATCH");
    await page.getByRole("button", { name: "Save Changes", exact: true }).click();
    const response = await pending; expect(response.ok(), await response.text()).toBeTruthy();
    await expect(form()).toHaveCount(0); return response.request().postDataJSON() as Record<string, unknown>;
  }
  await db.connect();
  try {
    const testcase = await post(`${base}/testcases`, { title: "CI bug-edit linked case" });
    const run = await post(`${base}/cycles`, { name: "CI bug-edit manual control" });
    await post(`${api}/api/cycles/${run.id}/testcases`, { testcaseIds: [testcase.id] });
    const linked = [{ testcaseId: testcase.id, cycleId: run.id }];
    async function fixture(label: string) {
      const bug = await post(`${base}/bugs`, {
        title: `CI bug edit ${label}`, description: "Original authored description", externalUrl: "https://example.invalid/BUG-1",
        integrationProvider: "JIRA", integrationIssueKey: "BUG-1", betterbugsUrl: "https://example.invalid/session-1", priority: "P2", severity: "Medium", assigneeId: ownerId, links: linked,
      });
      await post(`${base}/bugs/${bug.id}/comments`, { body: "Preserved discussion" });
      const uploaded = await page.request.post(`${base}/bugs/${bug.id}/attachments`, { multipart: { files: { name: "keep.txt", mimeType: "text/plain", buffer: Buffer.from("Preserved evidence") } } });
      expect(uploaded.ok(), await uploaded.text()).toBeTruthy();
      return bug;
    }
    const control = await fixture("unselected control"), controlBefore = await state(control.id);
    const manualBefore = await associations();

    await checked("disconnected/untouched tracking and evidence controls do not replay older metadata over a real concurrent REST edit", async () => {
      const bug = await fixture("omission"); await open(bug.id);
      await expect(form().getByRole("button", { name: "Log into Tesbo", exact: true })).toHaveCount(0);
      await expect(betterbugs()).toHaveValue("https://example.invalid/session-1");
      await patch(bug.id, { externalUrl: "https://example.invalid/NEW-2", integrationProvider: "LINEAR", integrationIssueKey: "NEW-2", betterbugsUrl: "https://example.invalid/new-session" });
      const before = await state(bug.id); await title().fill("CI bug title only");
      const payload = await save(bug.id);
      for (const field of ["externalUrl", "integrationProvider", "integrationIssueKey", "betterbugsUrl"]) expect(payload).not.toHaveProperty(field);
      const after = await state(bug.id); preserved(before, after);
      expect(after.bug).toEqual({ ...before.bug, title: "CI bug title only", updated_at: expect.any(Date) });
      expect(after.audit.slice(before.audit.length)).toEqual([expect.objectContaining({ action: "bug_updated", diff: { fields: ["title"] } })]);
      await page.reload(); await expect(page.getByRole("heading", { name: "CI bug title only", exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "NEW-2", exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "https://example.invalid/new-session", exact: true })).toBeVisible();
      await capture("bug-edit-untouched-disconnected-metadata-preserved");
    });

    // A synthetic, non-expiring status-only connection in the disposable DB. No provider request,
    // OAuth, sync, search or genuine Jira/Linear connectivity is claimed by these UI controls.
    const orgId = (await db.query<{ organization_id: string }>("SELECT organization_id FROM projects WHERE id=$1", [projectId])).rows[0].organization_id;
    connectionId = (await db.query<{ id: string }>("INSERT INTO integration_connections (organization_id,provider,external_id,site_url,access_token,refresh_token,token_expires_at) VALUES ($1,'jira','ci-bug-edit','https://example.invalid','ci-synthetic-not-a-provider-token','',now()+interval '1 day') RETURNING id", [orgId])).rows[0].id;

    await checked("explicit UI clearing and tracking/evidence mode changes persist after reload without removing file evidence or links", async () => {
      const bug = await fixture("explicit clear"); await open(bug.id);
      await expect(form().getByRole("button", { name: "Log into Tesbo", exact: true })).toBeVisible();
      // Connected controls are visible but still must not replay the values loaded on open.
      await patch(bug.id, { externalUrl: "https://example.invalid/CONNECTED-2", integrationIssueKey: "CONNECTED-2", betterbugsUrl: "https://example.invalid/connected-session" });
      const concurrent = await state(bug.id); await title().fill("CI connected untouched controls");
      const untouched = await save(bug.id);
      for (const field of ["externalUrl", "integrationProvider", "integrationIssueKey", "betterbugsUrl"]) expect(untouched).not.toHaveProperty(field);
      const saved = await state(bug.id); preserved(concurrent, saved);
      expect(saved.bug).toEqual({ ...concurrent.bug, title: "CI connected untouched controls", updated_at: expect.any(Date) });
      await page.reload(); await expect(page.getByRole("link", { name: "CONNECTED-2", exact: true })).toBeVisible();
      await capture("bug-edit-untouched-connected-metadata-preserved");
      await open(bug.id);
      await expect(form().getByRole("button", { name: "Log into Tesbo", exact: true })).toBeVisible();
      const before = await state(bug.id);
      await description().fill("");
      await form().getByRole("button", { name: "Log into Tesbo", exact: true }).click();
      await form().getByRole("button", { name: "Attach Files", exact: true }).click();
      const payload = await save(bug.id);
      expect(payload).toMatchObject({ description: "", externalUrl: null, integrationProvider: null, integrationIssueKey: null, betterbugsUrl: null });
      const after = await state(bug.id); preserved(before, after);
      expect(after.bug).toEqual({ ...before.bug, description: "", external_url: null, integration_provider: null, integration_issue_key: null, betterbugs_url: null, updated_at: expect.any(Date) });
      expect(after.audit.slice(before.audit.length)).toEqual([expect.objectContaining({ action: "bug_updated", diff: { fields: ["description", "externalUrl", "integrationProvider", "integrationIssueKey", "betterbugsUrl"] } })]);
      await page.reload();
      await expect(page.getByRole("link", { name: "keep.txt", exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "CONNECTED-2", exact: true })).toHaveCount(0);
      await open(bug.id); await expect(description()).toHaveValue("");
      await form().getByRole("button", { name: "BetterBugs Link", exact: true }).click();
      await expect(betterbugs()).toHaveValue("");
      await betterbugs().fill("https://example.invalid/replacement-session"); await save(bug.id);
      await page.reload(); await expect(page.getByRole("link", { name: "https://example.invalid/replacement-session", exact: true })).toBeVisible();
      expect((await state(bug.id)).attachments).toEqual(before.attachments);
      await capture("bug-edit-cleared-tracker-and-replaced-session");
    });

    await checked("a lost committed clear acknowledgement stays unconfirmed and is never automatically resent", async () => {
      const bug = await fixture("uncertain clear"); await open(bug.id); await betterbugs().fill("");
      const before = await state(bug.id); let attempts = 0;
      const endpoint = `${api}/api/bugs/${bug.id}`;
      await page.route(endpoint, async (route) => {
        if (route.request().method() !== "PATCH") { await route.continue(); return; }
        attempts++;
        const response = await route.fetch({ maxRetries: 0 }); expect(response.ok(), await response.text()).toBeTruthy();
        await route.abort("failed");
      });
      try {
        await page.getByRole("button", { name: "Save Changes", exact: true }).click();
        await expect(page.getByTestId("edit-bug-error")).toContainText(/outcome unconfirmed/i);
        await expect(page.getByRole("button", { name: "Save Changes", exact: true })).toBeEnabled();
        expect(attempts).toBe(1); const after = await state(bug.id); preserved(before, after);
        expect(after.bug).toEqual({ ...before.bug, betterbugs_url: null, updated_at: expect.any(Date) });
        expect(after.audit.slice(before.audit.length)).toEqual([expect.objectContaining({ action: "bug_updated", diff: { fields: ["betterbugsUrl"] } })]);
        await capture("bug-edit-committed-clear-unconfirmed");
        await page.reload(); await expect(form()).toBeVisible();
        await expect(form().getByRole("link", { name: "keep.txt", exact: true })).toBeVisible();
        await expect(betterbugs()).toHaveCount(0); // Saved mode is Files now.
        expect(attempts).toBe(1);
      } finally { await page.unroute(endpoint); }
    });

    await checked("cookie-free REST/MCP clear/set/omission contracts persist and read-only/anonymous attempts change nothing", async () => {
      const bug = await fixture("REST MCP");
      const read = await post(`${base}/apikeys`, { name: "CI bug metadata read", scopes: ["read"] }); tokenIds.push(read.id);
      const write = await post(`${base}/apikeys`, { name: "CI bug metadata write", scopes: ["read", "write"] }); tokenIds.push(write.id);
      let id = 0;
      const rpc = async (token: string, name: string, args: Record<string, unknown>) => machine.post(`${base}/mcp`, { headers: { Authorization: `Bearer ${token}` }, data: { jsonrpc: "2.0", id: ++id, method: "tools/call", params: { name, arguments: args } } });
      const before = await state(bug.id);
      for (const [token, status] of [[undefined, 400], [read.token, 403]] as const) {
        const denied = await machine.patch(`${api}/api/bugs/${bug.id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, data: { description: null, externalUrl: null, links: [] } });
        expect(denied.status(), await denied.text()).toBe(status); expect(await state(bug.id)).toEqual(before);
      }
      const denied = await rpc(read.token, "update_bug", { bugId: bug.id, betterbugsUrl: null });
      expect((await denied.json()).error).toMatchObject({ code: -32002 }); expect(await state(bug.id)).toEqual(before);
      const cleared = await rpc(write.token, "update_bug", { bugId: bug.id, description: null, externalUrl: null, integrationProvider: null, integrationIssueKey: null, betterbugsUrl: null });
      expect(cleared.ok(), await cleared.text()).toBeTruthy(); const body = await cleared.json(); expect(body.error).toBeUndefined(); expect(body.result.isError).toBe(false);
      const after = await state(bug.id); preserved(before, after);
      expect(after.bug).toEqual({ ...before.bug, description: null, external_url: null, integration_provider: null, integration_issue_key: null, betterbugs_url: null, updated_at: expect.any(Date) });
      expect(after.audit.slice(before.audit.length)).toEqual([expect.objectContaining({ actor_id: ownerId, action: "bug_updated", diff: { fields: ["description", "externalUrl", "integrationProvider", "integrationIssueKey", "betterbugsUrl"] } })]);
      const replacedResponse = await machine.patch(`${api}/api/bugs/${bug.id}`, {
        headers: { Authorization: `Bearer ${write.token}` },
        data: { externalUrl: "https://example.invalid/REST-3", integrationProvider: "JIRA", integrationIssueKey: "REST-3", description: "New body" },
      });
      expect(replacedResponse.ok(), await replacedResponse.text()).toBeTruthy(); const replaced = await replacedResponse.json();
      expect(replaced).toMatchObject({ externalUrl: "https://example.invalid/REST-3", integrationIssueKey: "REST-3", description: "New body", betterbugsUrl: null });
      const renamed = await rpc(write.token, "update_bug", { bugId: bug.id, title: "CI MCP bug title" }); expect((await renamed.json()).error).toBeUndefined();
      expect((await state(bug.id)).bug).toMatchObject({ external_url: "https://example.invalid/REST-3", integration_issue_key: "REST-3", title: "CI MCP bug title" });
      await page.goto(`${web}/projects/${projectId}/bugs/${bug.id}`);
      await expect(page.getByRole("heading", { name: "CI MCP bug title", exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "REST-3", exact: true })).toBeVisible();
      expect((await machine.storageState()).cookies).toEqual([]);
      await capture("bug-edit-rest-mcp-persisted-browser-readback");
    });
    expect(await state(control.id)).toEqual(controlBefore); expect(await associations()).toEqual(manualBefore);
    if (failures.length) throw new AggregateError(failures, `${failures.length} bug metadata journey step(s) failed`);
  } finally {
    for (const id of tokenIds) expect((await page.request.delete(`${base}/apikeys/${id}`)).ok()).toBeTruthy();
    if (connectionId) await db.query("UPDATE integration_connections SET disconnected_at=now(),access_token='',refresh_token='' WHERE id=$1", [connectionId]);
    await machine.dispose(); await db.end(); // Keep record/audit provenance until disposable DB teardown.
  }
}
