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
      const updatedName = `${name} (renamed via UI)`;
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

  test("a user can set a project's icon from settings, and clear it back to automatic", async ({ page }) => {
    const api = await apiContext();
    let projectId: string | undefined;

    try {
      const suffix = Date.now().toString().slice(-8);
      const name = `UI Icon Settings Project ${suffix}`;
      const created = await (
        await api.post("/api/projects", { data: { name, key: `E2EUIICON${suffix}` } })
      ).json();
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

      await modal.locator('input[type="text"]').fill("definitely not the project name");
      await modal.getByRole("button", { name: "Delete project permanently" }).click();
      await expect(
        page.getByText("Project deletion cancelled. Entered name does not match."),
      ).toBeVisible();
      expect((await api.get(`/api/projects/${projectId}`)).ok()).toBeTruthy();

      await modal.locator('input[type="text"]').fill(name);
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
    await expect(form).toBeDisabled();
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
      await expect(form).toBeEnabled();
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
    await expect(settingsForm(qaPage)).toBeDisabled();

    setProjectRole(tenant!.mainProjectId, tenant!.qa.userId, "manager");
    try {
      await qaPage.reload();
      await expect(qaPage.getByRole("heading", { name: "General", level: 2 })).toBeVisible();
      await expect(settingsForm(qaPage)).toBeEnabled();
      await expect(qaPage.getByText(NOTICE)).toHaveCount(0);
      await expect(qaPage.getByRole("button", { name: "Delete project", exact: true })).toBeEnabled();
    } finally {
      setProjectRole(tenant!.mainProjectId, tenant!.qa.userId, "qa_engineer");
    }
  });
});
