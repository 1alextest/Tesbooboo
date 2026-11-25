import path from "node:path";
import { expect, request as pwRequest, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { env } from "../utils/env";
import {
  loginAs,
  provisionRbacTenant,
  rbacSuiteSkipReason,
  setProjectRole,
  writeStorageState,
  type RbacTenant,
} from "../utils/rbac-tenant";

const STATE_PATH = path.join(__dirname, "../.auth/state.json");

function apiContext() {
  return pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
}

test.describe("project settings", () => {
  test("a user can rename a project and update its description from settings", { tag: '@tesbo.testId("TES-TC-805")' }, async ({ page }) => {
    const api = await apiContext();
    let projectId: string | undefined;

    try {
      const suffix = Date.now().toString().slice(-8);
      const name = `UI Settings Project ${suffix}`;
      // Explicit key: projectKey() truncates to 16 chars from the start, and this name is
      // long enough that an auto-derived key would drop the timestamp and collide on rerun.
      const created = await (
        await api.post("/api/projects", { data: { name, key: `E2EUISET${suffix}` } })
      ).json();
      projectId = created.id;

      // The General tab is the default — no ?tab= needed. Name/Description have no
      // id/label pairing in the markup, so scope structurally within the form.
      await page.goto(`/projects/${projectId}/settings`);
      const updatedName = `UI Renamed ${suffix}`;
      await page.locator('form input[type="text"]').first().fill(updatedName);
      await page.locator("form textarea").fill("Updated via the e2e UI suite");
      await page.getByRole("button", { name: "Save", exact: true }).click();

      await expect(page.getByText("Project settings saved.")).toBeVisible();

      const fetched = await (await api.get(`/api/projects/${projectId}`)).json();
      expect(fetched.name).toBe(updatedName);
      expect(fetched.description).toBe("Updated via the e2e UI suite");
    } finally {
      if (projectId) await api.delete(`/api/projects/${projectId}`, { failOnStatusCode: false });
      await api.dispose();
    }
  });

  test("the General tab's save result sits above the Danger zone, for success and for failure", async ({ page }) => {
    const api = await apiContext();
    let projectId: string | undefined;

    try {
      const suffix = Date.now().toString().slice(-8);
      const created = await (
        await api.post("/api/projects", { data: { name: `UI Banner Project ${suffix}`, key: `E2EUIBAN${suffix}` } })
      ).json();
      projectId = created.id;

      await page.goto(`/projects/${projectId}/settings`);
      // The Danger zone has no role; its heading is the stable anchor. The banner used to render
      // below it, off-screen on a short viewport, so a save looked like it did nothing.
      const dangerTop = async () => (await page.getByRole("heading", { name: "Danger zone" }).boundingBox())!.y;

      await page.getByRole("button", { name: "Save", exact: true }).click();
      const ok = page.getByRole("status").filter({ hasText: "Project settings saved." });
      await expect(ok).toBeVisible();
      expect((await ok.boundingBox())!.y).toBeLessThan(await dangerTop());

      // Failure path: the server rejects the save, and the error banner takes the same slot.
      await page.route(`**/api/projects/${projectId}`, (route) =>
        route.request().method() === "PATCH"
          ? route.fulfill({ status: 500, json: { error: "E2E forced save failure" } })
          : route.continue()
      );
      await page.getByRole("button", { name: "Save", exact: true }).click();
      const failed = page.getByRole("alert").filter({ hasText: "E2E forced save failure" });
      await expect(failed).toBeVisible();
      await expect(ok).toHaveCount(0);
      expect((await failed.boundingBox())!.y).toBeLessThan(await dangerTop());
    } finally {
      if (projectId) await api.delete(`/api/projects/${projectId}`, { failOnStatusCode: false });
      await api.dispose();
    }
  });

  test("after a rename the project card shows the new name and initial, while the key stays and settings says so", async ({ page }) => {
    const api = await apiContext();
    let projectId: string | undefined;

    try {
      const suffix = Date.now().toString().slice(-8);
      const key = `E2EUIKEY${suffix}`;
      const created = await (
        await api.post("/api/projects", { data: { name: `Alpha Label ${suffix}`, key } })
      ).json();
      projectId = created.id;

      await page.goto(`/projects/${projectId}/settings`);
      await expect(page.getByTestId("project-key")).toHaveText(key, { ignoreCase: true });
      await expect(page.getByTestId("project-key-note")).toContainText("stays the same when you rename it");

      const renamed = `Zulu Label ${suffix}`;
      await page.locator('form input[type="text"]').first().fill(renamed);
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByText("Project settings saved.")).toBeVisible();
      // The note reads the refetched project, so it still shows the original key after the save.
      await expect(page.getByTestId("project-key")).toHaveText(key, { ignoreCase: true });

      // Client-side nav to the list: the card must carry the new name and initial, the same key.
      await page.goto("/projects");
      await page.getByPlaceholder(/search/i).first().fill(suffix);
      const card = page.getByRole("link").filter({ hasText: renamed });
      await expect(card).toBeVisible();
      await expect(card.getByText(key, { exact: true })).toBeVisible();
      await expect(card.getByText(`Alpha Label ${suffix}`)).toHaveCount(0);
      // Automatic avatar: first letter of the NEW name (Z), not the original (A).
      await expect(card.getByText("Z", { exact: true })).toBeVisible();
    } finally {
      if (projectId) await api.delete(`/api/projects/${projectId}`, { failOnStatusCode: false });
      await api.dispose();
    }
  });

  test("a project with a custom icon letter keeps it across a rename", async ({ page }) => {
    const api = await apiContext();
    let projectId: string | undefined;

    try {
      const suffix = Date.now().toString().slice(-8);
      const created = await (
        await api.post("/api/projects", { data: { name: `Beta Icon ${suffix}`, key: `E2EUIGLY${suffix}`, icon: { color: "#4C5FD5", glyph: "Q" } } })
      ).json();
      projectId = created.id;

      const res = await api.patch(`/api/projects/${projectId}`, { data: { name: `Yankee Icon ${suffix}` } });
      expect(res.ok()).toBeTruthy();

      await page.goto("/projects");
      await page.getByPlaceholder(/search/i).first().fill(suffix);
      const card = page.getByRole("link").filter({ hasText: `Yankee Icon ${suffix}` });
      await expect(card).toBeVisible();
      // An explicit glyph is the user's choice; only the automatic one follows the name.
      await expect(card.getByText("Q", { exact: true })).toBeVisible();
    } finally {
      if (projectId) await api.delete(`/api/projects/${projectId}`, { failOnStatusCode: false });
      await api.dispose();
    }
  });

  test("a user can set a project's icon from settings, and clear it back to automatic", async ({ page }) => {
    const api = await apiContext();
    let projectId: string | undefined;

    try {
      const suffix = Date.now().toString().slice(-8);
      const name = `UI Icon Project ${suffix}`;
      const createRes = await api.post("/api/projects", { data: { name, key: `E2EUIICON${suffix}` } });
      expect(createRes.ok(), await createRes.text()).toBeTruthy();
      const created = await createRes.json();
      projectId = created.id;

      await page.goto(`/projects/${projectId}/settings`);
      await page.getByRole("button", { name: "Icon color #4C5FD5" }).click();
      await page.getByRole("textbox", { name: "Custom icon letter or emoji" }).fill("Q");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByText("Project settings saved.")).toBeVisible();

      const afterSet = await (await api.get(`/api/projects/${projectId}`)).json();
      expect(afterSet.settings.icon).toEqual({ color: "#4C5FD5", glyph: "Q" });

      // Reloading re-derives the picker's state from what was actually persisted, not from
      // whatever the form happened to hold in memory.
      await page.reload();
      await expect(page.getByRole("button", { name: "Icon color #4C5FD5" })).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByRole("textbox", { name: "Custom icon letter or emoji" })).toHaveValue("Q");

      await page.getByRole("button", { name: "Automatic color" }).click();
      await page.getByRole("textbox", { name: "Custom icon letter or emoji" }).fill("");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByText("Project settings saved.")).toBeVisible();

      const afterClear = await (await api.get(`/api/projects/${projectId}`)).json();
      expect(afterClear.settings.icon).toEqual({ color: null, glyph: null });
    } finally {
      if (projectId) await api.delete(`/api/projects/${projectId}`, { failOnStatusCode: false });
      await api.dispose();
    }
  });

  test("the delete confirmation blocks a mismatched name and only deletes on an exact match", { tag: '@tesbo.testId("TES-TC-806")' }, async ({
    page,
  }) => {
    const api = await apiContext();
    const suffix = Date.now().toString().slice(-8);
    const name = `UI Delete Project ${suffix}`;
    const created = await (
      await api.post("/api/projects", { data: { name, key: `E2EUIDEL${suffix}` } })
    ).json();
    const projectId = created.id;

    try {
      await page.goto(`/projects/${projectId}/settings`);
      await page.getByRole("button", { name: "Delete project", exact: true }).click();

      // Modal.tsx has no role="dialog" and doesn't unmount the page behind it, so scope to
      // the modal's own container (the heading's parent) to avoid colliding with the General
      // tab's own text inputs still sitting in the DOM underneath.
      const modal = page.getByRole("heading", { name: "Confirm project deletion" }).locator("..");
      await expect(modal).toBeVisible();

      const confirmationName = modal.locator('input[type="text"]');
      await confirmationName.fill("definitely not the project name");
      await modal.getByRole("button", { name: "Delete project permanently" }).click();
      const mismatchError = modal.getByRole("alert");
      await expect(mismatchError).toHaveText("Entered name does not match. Deletion cancelled.");
      await expect(mismatchError).toBeVisible();
      await expect(confirmationName).toHaveAttribute("aria-invalid", "true");
      const afterMismatch = await api.get(`/api/projects/${projectId}`);
      expect(afterMismatch.ok()).toBeTruthy();
      expect((await afterMismatch.json()).name).toBe(name);

      await confirmationName.fill(name);
      await modal.getByRole("button", { name: "Delete project permanently" }).click();
      await page.waitForURL(/\/projects$/);

      const getAfterDelete = await api.get(`/api/projects/${projectId}`, { failOnStatusCode: false });
      expect(getAfterDelete.status()).toBe(404);
    } finally {
      // Best-effort: only fires if an assertion above failed before the real delete happened.
      await api.delete(`/api/projects/${projectId}`, { failOnStatusCode: false });
      await api.dispose();
    }
  });
});

/*
 * "[Project Settings] Edit Project Settings and Delete Project Buttons Should Be Disabled for QA
 * Engineer Role". The API already refuses a QA engineer's PATCH/DELETE /api/projects/:id (see
 * api/rbac.spec.ts, TES-TC-453/454); the settings page still offered every control and only failed
 * after the click. These pin what the page *offers* per project role — the role comes from
 * project_members, so promoting the same user must re-enable everything with no other change.
 */
test.describe("project settings controls by role (UI)", () => {
  const NOTICE = "Only project managers and owners can change project settings or delete the project.";
  let tenant: RbacTenant | null = null;
  let ownerApi: APIRequestContext;
  const states = new Map<string, string>();
  const contexts: BrowserContext[] = [];

  test.beforeAll(async () => {
    tenant = await provisionRbacTenant("project-settings-ui");
    if (!tenant) return;
    ownerApi = await loginAs(tenant.owner);
    states.set("owner", await writeStorageState(tenant.owner, "project-settings-ui-owner"));
    states.set("manager", await writeStorageState(tenant.manager, "project-settings-ui-manager"));
    states.set("qa", await writeStorageState(tenant.qa, "project-settings-ui-qa"));
  });

  test.afterAll(async () => {
    if (tenant) setProjectRole(tenant.mainProjectId, tenant.qa.userId, "qa_engineer");
    if (ownerApi) await ownerApi.dispose();
    await Promise.all(contexts.map((ctx) => ctx.close()));
  });

  test.beforeEach(() => {
    const reason = rbacSuiteSkipReason(tenant);
    test.skip(reason !== null, reason ?? "");
    // A test that promotes the QA user restores it in its own finally; this guards a crashed one.
    setProjectRole(tenant!.mainProjectId, tenant!.qa.userId, "qa_engineer");
  });

  async function settingsAs(browser: Browser, label: "owner" | "manager" | "qa"): Promise<Page> {
    const context = await browser.newContext({ baseURL: env.webBaseUrl, storageState: states.get(label)! });
    contexts.push(context);
    const page = await context.newPage();
    await page.goto(`/projects/${tenant!.mainProjectId}/settings`);
    await expect(page.getByRole("heading", { name: "General", level: 2 })).toBeVisible();
    return page;
  }

  /** The General / Test Environments form; every control the role gate covers lives inside it. */
  function settingsForm(page: Page) {
    return page.locator("form fieldset");
  }

  async function projectSnapshot(): Promise<{ name: string; description: string; settings: Record<string, unknown> }> {
    const project = await (await ownerApi.get(`/api/projects/${tenant!.mainProjectId}`)).json();
    const settings = typeof project.settings === "string" ? JSON.parse(project.settings || "{}") : (project.settings ?? {});
    return { name: project.name, description: project.description ?? "", settings };
  }

  test("PSU-01 a QA engineer sees General read-only: inputs, Save and Delete project disabled, with a notice", async ({ browser }) => {
    const before = await projectSnapshot();
    const page = await settingsAs(browser, "qa");
    const form = settingsForm(page);

    await expect(page.getByText(NOTICE)).toBeVisible();
    // Playwright's disabled matcher targets form controls, not the fieldset container itself.
    // Check the native fieldset property and then the actual controls it disables.
    await expect(form).toHaveJSProperty("disabled", true);
    // The values are still readable — read-only, not hidden.
    await expect(form.getByRole("textbox").first()).toHaveValue(before.name);
    for (const box of await form.getByRole("textbox").all()) await expect(box).toBeDisabled();
    await expect(form.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
    const deleteButton = page.getByRole("button", { name: "Delete project", exact: true });
    await expect(deleteButton).toBeVisible();
    await expect(deleteButton).toBeDisabled();

    // A forced click on a disabled button dispatches nothing: the confirmation must not open.
    await deleteButton.click({ force: true });
    await expect(page.getByRole("heading", { name: "Confirm project deletion" })).toHaveCount(0);

    const after = await projectSnapshot();
    expect(after.name).toBe(before.name);
    expect(after.description).toBe(before.description);
  });

  test("PSU-02 a QA engineer sees Test Environments read-only: Add, Remove and Save disabled", async ({ browser }) => {
    const original = await projectSnapshot();
    const envName = `E2E Env ${Date.now()}`;
    const seeded = { ...original.settings, testRunEnvironments: [{ name: envName, url: "https://e2e.example.com" }] };
    await ownerApi.patch(`/api/projects/${tenant!.mainProjectId}`, { data: { settings: JSON.stringify(seeded) } });
    try {
      const page = await settingsAs(browser, "qa");
      await page.getByRole("button", { name: "Test Environments" }).click();
      const form = settingsForm(page);
      await expect(form.getByText(envName)).toBeVisible();

      await expect(page.getByText(NOTICE)).toBeVisible();
      await expect(form.getByPlaceholder("Environment name")).toBeDisabled();
      await expect(form.getByPlaceholder("https://staging.example.com")).toBeDisabled();
      await expect(form.getByRole("button", { name: "Add", exact: true })).toBeDisabled();
      await expect(form.getByRole("button", { name: "Remove", exact: true })).toBeDisabled();
      await expect(form.getByRole("button", { name: "Save", exact: true })).toBeDisabled();

      const after = await projectSnapshot();
      expect(after.settings.testRunEnvironments).toEqual(seeded.testRunEnvironments);
    } finally {
      await ownerApi.patch(`/api/projects/${tenant!.mainProjectId}`, {
        data: { settings: JSON.stringify(original.settings) },
        failOnStatusCode: false,
      });
    }
  });

  for (const role of ["owner", "manager"] as const) {
    test(`PSU-03 ${role === "owner" ? "an owner" : "a manager"} keeps every General and Test Environments control enabled`, async ({ browser }) => {
      const page = await settingsAs(browser, role);
      const form = settingsForm(page);

      await expect(page.getByText(NOTICE)).toHaveCount(0);
      await expect(form).toHaveJSProperty("disabled", false);
      for (const box of await form.getByRole("textbox").all()) await expect(box).toBeEnabled();
      await expect(form.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
      await expect(page.getByRole("button", { name: "Delete project", exact: true })).toBeEnabled();

      await page.getByRole("button", { name: "Test Environments" }).click();
      await expect(form.getByPlaceholder("Environment name")).toBeEnabled();
      await expect(form.getByRole("button", { name: "Add", exact: true })).toBeEnabled();
      await expect(form.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
    });
  }

  test("PSU-04 a manager can still save General settings, and the change persists", async ({ browser }) => {
    const original = await projectSnapshot();
    const description = `E2E manager description ${Date.now()}`;
    try {
      const page = await settingsAs(browser, "manager");
      const form = settingsForm(page);
      await form.locator("textarea").fill(description);
      await form.getByRole("button", { name: "Save", exact: true }).click();
      await expect.poll(async () => (await projectSnapshot()).description).toBe(description);
    } finally {
      await ownerApi.patch(`/api/projects/${tenant!.mainProjectId}`, {
        data: { description: original.description },
        failOnStatusCode: false,
      });
    }
  });

  test("PSU-05 an owner's Delete project still opens the confirmation", async ({ browser }) => {
    const page = await settingsAs(browser, "owner");
    await page.getByRole("button", { name: "Delete project", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Confirm project deletion" })).toBeVisible();
    // Not confirmed: the tenant's main project is shared by the rest of this describe.
  });

  test("PSU-06 the gate follows the stored project role: promoting the same QA user re-enables the controls", async ({ browser }) => {
    const qaPage = await settingsAs(browser, "qa");
    const form = settingsForm(qaPage);
    await expect(form).toHaveJSProperty("disabled", true);
    for (const box of await form.getByRole("textbox").all()) await expect(box).toBeDisabled();
    await expect(form.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
    await expect(qaPage.getByRole("button", { name: "Delete project", exact: true })).toBeDisabled();

    setProjectRole(tenant!.mainProjectId, tenant!.qa.userId, "manager");
    try {
      await qaPage.reload();
      await expect(qaPage.getByRole("heading", { name: "General", level: 2 })).toBeVisible();
      await expect(form).toHaveJSProperty("disabled", false);
      for (const box of await form.getByRole("textbox").all()) await expect(box).toBeEnabled();
      await expect(form.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
      await expect(qaPage.getByText(NOTICE)).toHaveCount(0);
      await expect(qaPage.getByRole("button", { name: "Delete project", exact: true })).toBeEnabled();
    } finally {
      setProjectRole(tenant!.mainProjectId, tenant!.qa.userId, "qa_engineer");
    }
  });
});

test("MCP-P18 UI approves a named credential, shows stale conflicts, and revokes access", async ({ page }) => {
  const api = await apiContext();
  const machine = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: { cookies: [], origins: [] } });
  let projectId: string | undefined, tokenId: string | undefined;
  try {
    const stamp = Date.now().toString().slice(-8);
    const created = await api.post("/api/projects", { data: { name: `MCP consent UI ${stamp}`, key: `MCUI${stamp}` } });
    expect(created.ok(), await created.text()).toBeTruthy();
    projectId = (await created.json()).id;
    const issued = await api.post(`/api/projects/${projectId}/apikeys`, { data: { name: `UI executor ${stamp}`, scopes: ["read", "write"] } });
    expect(issued.ok(), await issued.text()).toBeTruthy();
    const credential = await issued.json(); tokenId = credential.id;
    const settingsUrl = `/api/projects/${projectId}/mcp-access`;
    const read = async () => {
      const response = await api.get(settingsUrl);
      expect(response.ok(), await response.text()).toBeTruthy();
      return response.json();
    };
    const discover = async () => {
      const response = await machine.post("/api/mcp", {
        headers: { Authorization: `Bearer ${credential.token}` },
        data: { jsonrpc: "2.0", id: 1, method: "tools/list" }
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      return response.json();
    };
    await page.goto(`/projects/${projectId}/settings?tab=apiTokens`);
    const panel = page.getByRole("heading", { name: "External AI & MCP Access" }).locator("..").locator("..");
    await expect(panel.getByText("External MCP: Off", { exact: true })).toBeVisible();
    expect((await discover()).error.code).toBe(-32001);
    await panel.getByLabel("API credential", { exact: true }).selectOption(tokenId!);
    await panel.getByLabel("Client name", { exact: true }).fill("UI QA executor");
    await panel.getByLabel("Limit to specific tool names", { exact: false }).fill("list_projects");
    await panel.getByRole("button", { name: "Approve client", exact: true }).click();
    await expect(panel.getByText("UI QA executor", { exact: true })).toBeVisible();
    let saved = await read();
    expect(saved.enabled).toBe(false);
    expect(saved.clients).toEqual([{ tokenId, clientName: "UI QA executor", scopes: ["read"], allowedTools: ["list_projects"], expiresAt: null }]);
    await panel.getByRole("button", { name: "Enable external MCP", exact: true }).click();
    await expect(panel.getByText("External MCP: On", { exact: true })).toBeVisible();
    expect((await discover()).result.tools.map((tool: { name: string }) => tool.name)).toEqual(["list_projects"]);
    saved = await read();
    // A real concurrent settings write, not a mocked error: a stale browser must preserve the
    // newer human decision and explain how to recover before it can revoke another grant.
    const concurrent = await api.put(settingsUrl, { data: { ...saved, enabled: false } });
    expect(concurrent.ok(), await concurrent.text()).toBeTruthy();
    await panel.getByRole("button", { name: "Revoke UI QA executor", exact: true }).click();
    await expect(panel.getByRole("alert")).toContainText("changed");
    expect((await read()).clients).toHaveLength(1);
    await panel.getByRole("button", { name: "Reload access settings", exact: true }).click();
    await expect(panel.getByText("External MCP: Off", { exact: true })).toBeVisible();
    await panel.getByRole("button", { name: "Revoke UI QA executor", exact: true }).click();
    await expect(panel.getByText("No client credentials are approved.")).toBeVisible();
    expect((await read()).clients).toEqual([]);
    expect((await discover()).error.code).toBe(-32001);
    const keys = await api.get(`/api/projects/${projectId}/apikeys`);
    expect((await keys.json()).some((token: { id: string }) => token.id === tokenId)).toBe(true);
    await page.reload();
    await expect(page.getByText("No client credentials are approved.")).toBeVisible();
  } finally {
    if (projectId && tokenId) await api.delete(`/api/projects/${projectId}/apikeys/${tokenId}`, { failOnStatusCode: false });
    if (projectId) await api.delete(`/api/projects/${projectId}`, { failOnStatusCode: false });
    await Promise.all([api.dispose(), machine.dispose()]);
  }
});

test("MCP-P18 human consent history does not claim live connection and revokes only selected record", async ({ page }) => {
  const api = await apiContext();
  let projectId: string | undefined;
  const consentId = "a".repeat(64);
  const otherId = "b".repeat(64);
  const clientId = "https://chatgpt.com/oauth/client.json";
  const records = [
    { id: consentId, clientId, clientName: "Existing QA reader",
      resource: "https://tesbo.example/api/projects/test/mcp",
      status: "consent_current", currentAllowedTools: ["list_testcases"], createdAt: "2026-11-20T10:00:00.000Z", revokedAt: null },
    { id: otherId, clientId: "https://example.test/old-client.json",
      clientName: "Older revoked connection", resource: "https://tesbo.example/api/projects/test/mcp",
      status: "revoked", currentAllowedTools: null, createdAt: "2026-11-19T10:00:00.000Z",
      revokedAt: "2026-11-21T10:00:00.000Z" }
  ];
  const deletes: string[] = [];
  try {
    const suffix = Date.now().toString().slice(-8);
    const result = await api.post("/api/projects", {
      data: { name: "Consent UI " + suffix, key: "CONUI" + suffix }
    });
    expect(result.ok(), await result.text()).toBe(true);
    projectId = (await result.json()).id;
    await page.route("**/api/projects/" + projectId + "/mcp-oauth-consents**", async route => {
      if (route.request().method() === "DELETE") {
        deletes.push(route.request().url());
        records[0].status = "revoked";
        await route.fulfill({ status: 200, json: {
          id: consentId, status: "revoked", replayed: false
        } });
      } else {
        await route.fulfill({ status: 200, json: { consents: records, truncated: false } });
      }
    });
    await page.goto("/projects/" + projectId + "/settings?tab=apiTokens");
    const history = page.locator('[aria-labelledby="my-oauth-consents-title"]');
    await expect(history.getByText("Existing QA reader", { exact: true })).toBeVisible();
    await expect(history.getByText("Consent recorded (not live status)")).toBeVisible();
    await expect(history.getByText("Read-only tools: list_testcases")).toBeVisible();
    await expect(history.getByText("Older revoked connection", { exact: true })).toBeVisible();
    await expect(history.getByText("State: Revoked", { exact: true })).toBeVisible();
    await expect(history.getByRole("button", { name: "Revoke my consent" })).toHaveCount(1);
    await history.getByRole("button", { name: "Revoke my consent" }).click();
    await expect(history.getByText("This consent has been revoked.")).toBeVisible();
    await expect(history.getByRole("button", { name: "Revoke my consent" })).toHaveCount(0);
    expect(deletes).toHaveLength(1);
    expect(deletes[0]).toContain("/mcp-oauth-consents/" + consentId);
    expect(deletes[0]).not.toContain(otherId);
  } finally {
    if (projectId) await api.delete("/api/projects/" + projectId, { failOnStatusCode: false });
    await api.dispose();
  }
});

test("MCP-P18 delayed save and failed project reload never expose another project's editable grants", async ({ page }) => {
  test.slow();
  const api = await apiContext();
  const projects: Array<{ id: string; name: string; tokenId: string; clientName: string }> = [];
  let releaseSave: () => void = () => {};
  let saveObserved: () => void = () => {};
  let saveReleased: () => void = () => {};
  const delayedSave = new Promise<void>(resolve => { releaseSave = resolve; });
  const observedSave = new Promise<void>(resolve => { saveObserved = resolve; });
  const releasedSave = new Promise<void>(resolve => { saveReleased = resolve; });
  let holdSave = false;
  let failSecondLoad = true;
  const secondProjectWrites: string[] = [];
  try {
    const stamp = Date.now().toString().slice(-8);
    for (const label of ["A", "B"]) {
      const name = `MCP scoped UI ${label} ${stamp}`;
      const created = await api.post("/api/projects", { data: { name, key: `MCS${label}${stamp}` } });
      expect(created.ok(), await created.text()).toBe(true);
      const id = (await created.json()).id as string;
      const row = { id, name, tokenId: "", clientName: `Only project ${label} client ${stamp}` };
      projects.push(row);
      const issued = await api.post(`/api/projects/${id}/apikeys`, { data: { name: row.clientName, scopes: ["read"] } });
      expect(issued.ok(), await issued.text()).toBe(true);
      row.tokenId = (await issued.json()).id;
      const access = await api.get(`/api/projects/${id}/mcp-access`);
      expect(access.ok(), await access.text()).toBe(true);
      const approved = await api.put(`/api/projects/${id}/mcp-access`, { data: {
        ...(await access.json()), enabled: false, clients: [{ tokenId: row.tokenId, clientName: row.clientName,
          scopes: ["read"], allowedTools: ["list_projects"], expiresAt: null }]
      } });
      expect(approved.ok(), await approved.text()).toBe(true);
    }
    const [first, second] = projects;
    await page.route(`**/api/projects/${first.id}/mcp-access`, async route => {
      if (route.request().method() !== "PUT" || !holdSave) return route.continue();
      const response = await route.fetch(); // The actual first-project save commits; only delivery is delayed.
      saveObserved();
      await delayedSave;
      try { await route.fulfill({ response }); } finally { saveReleased(); }
    });
    await page.route(`**/api/projects/${second.id}/mcp-access`, async route => {
      if (route.request().method() !== "GET") {
        secondProjectWrites.push(route.request().method());
        return route.continue();
      }
      if (failSecondLoad) return route.fulfill({ status: 503, contentType: "application/json",
        body: JSON.stringify({ error: "Controlled project B access load failure" }) });
      return route.continue();
    });
    const panel = () => page.getByRole("heading", { name: "External AI & MCP Access" }).locator("..").locator("..");
    await page.goto(`/projects/${first.id}/settings?tab=apiTokens`);
    await expect(panel().getByText(first.clientName, { exact: true })).toBeVisible();
    holdSave = true;
    await panel().getByRole("button", { name: "Enable external MCP", exact: true }).click();
    await observedSave;
    // Navigate through real client-side links while the first project's response is outstanding.
    await page.getByRole("link", { name: "All Projects", exact: true }).click();
    await page.locator(`a[href="/projects/${second.id}/dashboard"]`).click();
    await page.getByRole("link", { name: "Project settings", exact: true }).click();
    await page.getByRole("button", { name: "API & MCP", exact: true }).click();
    await expect(panel().getByRole("alert")).toContainText("Controlled project B access load failure");
    await expect(panel().getByRole("button", { name: /^(Enable|Disable) external MCP$/ })).toHaveCount(0);
    await expect(panel().getByText(first.clientName, { exact: true })).toHaveCount(0);
    releaseSave();
    await releasedSave;
    await expect(panel().getByRole("alert")).toContainText("Controlled project B access load failure");
    await expect(panel().getByRole("button", { name: "Approve client", exact: true })).toHaveCount(0);
    expect(secondProjectWrites).toEqual([]);

    failSecondLoad = false;
    await panel().getByRole("button", { name: "Reload access settings", exact: true }).click();
    await expect(panel().getByText(second.clientName, { exact: true })).toBeVisible();
    await expect(panel().getByText("External MCP: Off", { exact: true })).toBeVisible();
    await expect(panel().getByText(first.clientName, { exact: true })).toHaveCount(0);
    // A failed reload of an already populated panel must remove its previously actionable snapshot.
    failSecondLoad = true;
    await panel().getByRole("button", { name: "Reload credentials", exact: true }).click();
    await expect(panel().getByRole("alert")).toContainText("Controlled project B access load failure");
    await expect(panel().getByRole("button", { name: /^(Enable|Disable) external MCP$/ })).toHaveCount(0);
    await expect(panel().getByRole("button", { name: `Revoke ${second.clientName}`, exact: true })).toHaveCount(0);
    await expect(panel().getByLabel("API credential", { exact: true })).toHaveCount(0);
    expect(secondProjectWrites).toEqual([]);
    const firstCurrent = await api.get(`/api/projects/${first.id}/mcp-access`);
    const secondCurrent = await api.get(`/api/projects/${second.id}/mcp-access`);
    expect((await firstCurrent.json()).enabled).toBe(true);
    expect(await secondCurrent.json()).toMatchObject({ enabled: false, clients: [{ tokenId: second.tokenId, clientName: second.clientName }] });
  } finally {
    releaseSave();
    await page.unrouteAll({ behavior: "wait" });
    for (const project of projects) {
      if (project.tokenId) await api.delete(`/api/projects/${project.id}/apikeys/${project.tokenId}`, { failOnStatusCode: false });
      await api.delete(`/api/projects/${project.id}`, { failOnStatusCode: false });
    }
    await api.dispose();
  }
});
