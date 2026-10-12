import { expect, test, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";
import { env } from "../utils/env";
import { exec, literal } from "../utils/psql";
import {
  loginAs,
  provisionRbacTenant,
  rbacSuiteSkipReason,
  writeStorageState,
  type RbacTenant,
} from "../utils/rbac-tenant";

/*
 * The custom tags screens: the per-project settings editor (its own Project Settings sidebar tab,
 * positioned right after Integrations — see settings/page.tsx's visibleTabs), the test case panel's
 * multi-select, and the Execution Report's Group by Tags filter.
 *
 * What makes these worth a browser rather than more API tests: api/custom-tags.spec.ts proves the
 * backend enforces Owner/Manager, but only the screen proves the "Custom Tags" sidebar entry is
 * absent for a QA Engineer rather than present-but-403ing, and that the Execution Report's tag
 * filter actually empties out when the project's catalog is empty instead of falling back to a
 * free-text box.
 *
 * Runs against its own disposable workspace ("custom-tags-ui"), same reasoning as custom-fields-ui.
 */

test.describe("custom tags (UI)", () => {
  let tenant: RbacTenant | null = null;
  let api: APIRequestContext;
  const states = new Map<string, string>();
  const contexts: BrowserContext[] = [];

  test.beforeAll(async () => {
    tenant = await provisionRbacTenant("custom-tags-ui");
    if (!tenant) return;
    api = await loginAs(tenant.owner);
    states.set("owner", await writeStorageState(tenant.owner, "custom-tags-ui-owner"));
    states.set("qa", await writeStorageState(tenant.qa, "custom-tags-ui-qa"));
    purgeFixtures(tenant);
  });

  test.afterAll(async () => {
    if (tenant) purgeFixtures(tenant);
    if (api) await api.dispose();
    await Promise.all(contexts.map((ctx) => ctx.close()));
  });

  test.beforeEach(() => {
    const reason = rbacSuiteSkipReason(tenant);
    test.skip(reason !== null, reason ?? "");
  });

  test.afterEach(() => {
    if (tenant) purgeFixtures(tenant);
  });

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function purgeFixtures(t: RbacTenant): void {
    const projects = `${literal(t.mainProjectId)}, ${literal(t.secondProjectId)}`;
    exec(`DELETE FROM testcases WHERE project_id IN (${projects});`);
    exec(`DELETE FROM custom_tags WHERE project_id IN (${projects});`);
  }

  async function pageAs(browser: import("@playwright/test").Browser, label: string): Promise<Page> {
    const context = await browser.newContext({ baseURL: env.webBaseUrl, storageState: states.get(label)! });
    contexts.push(context);
    return context.newPage();
  }

  function settingsUrl(): string {
    return `/projects/${tenant!.mainProjectId}/settings`;
  }

  function customTagsTabUrl(): string {
    return `/projects/${tenant!.mainProjectId}/settings?tab=customTags`;
  }

  function customTagsUrl(): string {
    return `/projects/${tenant!.mainProjectId}/settings/custom-tags`;
  }

  function testcasesUrl(): string {
    return `/projects/${tenant!.mainProjectId}/testcases`;
  }

  function reportsUrl(): string {
    return `/projects/${tenant!.mainProjectId}/reports`;
  }

  function tagsApiUrl(): string {
    return `/api/projects/${tenant!.mainProjectId}/custom-tags`;
  }

  function tagName(label: string): string {
    return `E2E ${label} ${Date.now()}${Math.floor(Math.random() * 1000)}`;
  }

  async function defineTag(name: string): Promise<any> {
    const res = await api.post(tagsApiUrl(), { data: { name }, failOnStatusCode: false });
    expect(res.status(), await res.text()).toBe(201);
    return res.json();
  }

  function tagCheckbox(scope: import("@playwright/test").Locator, label: string) {
    return scope.locator("label").filter({ hasText: label }).locator("input[type='checkbox']");
  }

  // ─── The Project Settings sidebar ───────────────────────────────────────────

  test("the Custom Tags settings tab sits under Integrations in the sidebar and is hidden entirely from a QA Engineer", async ({ browser }) => {
    const ownerPage = await pageAs(browser, "owner");
    await ownerPage.goto(settingsUrl());
    const sidebar = ownerPage.locator("nav").filter({ has: ownerPage.getByRole("button", { name: "Integrations" }) });
    await expect(sidebar.getByRole("button", { name: "Custom Tags" })).toBeVisible();
    // Sits directly after Integrations, not nested inside its tab content.
    const labels = await sidebar.getByRole("button").allTextContents();
    const integrationsIndex = labels.indexOf("Integrations");
    expect(labels[integrationsIndex + 1]).toBe("Custom Tags");

    await sidebar.getByRole("button", { name: "Custom Tags" }).click();
    await expect(ownerPage.getByRole("heading", { name: "Custom Tags", exact: true })).toBeVisible();
    await expect(ownerPage.getByRole("link", { name: "Manage custom tags" })).toBeVisible();

    const qaPage = await pageAs(browser, "qa");
    await qaPage.goto(settingsUrl());
    await expect(qaPage.getByRole("button", { name: "Custom Tags" })).toHaveCount(0);
    // Navigating straight to the tab query param doesn't work around the hidden tab either.
    await qaPage.goto(customTagsTabUrl());
    await expect(qaPage.getByRole("heading", { name: "Custom Tags", exact: true })).toHaveCount(0);
  });

  test("a QA Engineer who navigates to the page directly is told it isn't theirs to use", async ({ browser }) => {
    const page = await pageAs(browser, "qa");
    await page.goto(customTagsUrl());
    await expect(page.getByText("Only project owners and managers can manage custom tags.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add tag" })).toHaveCount(0);
  });

  // ─── The settings screen ───────────────────────────────────────────────────

  test("an owner can add a tag and see it listed, then delete it", async ({ browser }) => {
    const page = await pageAs(browser, "owner");
    await page.goto(customTagsUrl());

    const name = tagName("Regression");
    await page.getByPlaceholder("e.g. Regression, Smoke, Flaky").fill(name);
    await page.getByRole("button", { name: "Add tag" }).click();
    await expect(page.getByText(name, { exact: true })).toBeVisible();

    const listed = await api.get(tagsApiUrl()).then((r) => r.json());
    expect(listed.map((t: any) => t.name)).toContain(name);

    await page.getByRole("button", { name: `Delete tag ${name}` }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText(name, { exact: true })).toHaveCount(0);
    expect((await api.get(tagsApiUrl()).then((r) => r.json())).map((t: any) => t.name)).not.toContain(name);
  });

  test("an owner renames a tag inline, and the new name is saved", async ({ browser }) => {
    const tag = await defineTag(tagName("Rename me"));
    const page = await pageAs(browser, "owner");
    await page.goto(customTagsUrl());

    await page.getByRole("button", { name: `Edit tag ${tag.name}` }).click();
    const next = tagName("Renamed");
    const input = page.getByLabel(`New name for tag ${tag.name}`);
    await expect(input).toHaveValue(tag.name);
    await input.fill(next);
    await page.getByRole("button", { name: "Save", exact: true }).click();

    await expect(page.getByText(next, { exact: true })).toBeVisible();
    await expect(page.getByText(tag.name, { exact: true })).toHaveCount(0);
    const listed = await api.get(tagsApiUrl()).then((r) => r.json());
    expect(listed.find((t: any) => t.id === tag.id)?.name).toBe(next);
  });

  test("Cancel and Escape leave a tag's name unchanged", async ({ browser }) => {
    const tag = await defineTag(tagName("Keep"));
    const page = await pageAs(browser, "owner");
    await page.goto(customTagsUrl());

    await page.getByRole("button", { name: `Edit tag ${tag.name}` }).click();
    await page.getByLabel(`New name for tag ${tag.name}`).fill(tagName("Discarded"));
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByText(tag.name, { exact: true })).toBeVisible();

    await page.getByRole("button", { name: `Edit tag ${tag.name}` }).click();
    const input = page.getByLabel(`New name for tag ${tag.name}`);
    await input.fill(tagName("Discarded too"));
    await input.press("Escape");
    await expect(page.getByText(tag.name, { exact: true })).toBeVisible();
    expect((await api.get(tagsApiUrl()).then((r) => r.json())).find((t: any) => t.id === tag.id)?.name).toBe(tag.name);
  });

  test("renaming onto an existing tag's name shows the error inline and keeps the row in edit mode", async ({ browser }) => {
    const [first, second] = await Promise.all([defineTag(tagName("First")), defineTag(tagName("Second"))]);
    const page = await pageAs(browser, "owner");
    await page.goto(customTagsUrl());

    await page.getByRole("button", { name: `Edit tag ${first.name}` }).click();
    const input = page.getByLabel(`New name for tag ${first.name}`);
    await input.fill(second.name.toLowerCase());
    await input.press("Enter");
    await expect(page.getByText("A tag with this name already exists")).toBeVisible();
    await expect(input).toBeVisible();
    // An empty name is caught before any request.
    await input.fill("   ");
    await input.press("Enter");
    await expect(page.getByText("Tag name is required.")).toBeVisible();
    expect((await api.get(tagsApiUrl()).then((r) => r.json())).find((t: any) => t.id === first.id)?.name).toBe(first.name);
  });

  test("a QA Engineer is never offered the edit action", async ({ browser }) => {
    const tag = await defineTag(tagName("QA no edit"));
    const page = await pageAs(browser, "qa");
    await page.goto(customTagsUrl());
    await expect(page.getByText("Only project owners and managers can manage custom tags.")).toBeVisible();
    await expect(page.getByRole("button", { name: `Edit tag ${tag.name}` })).toHaveCount(0);
  });

  test("with a few tags the list is compact: several to a row, no empty band below, actions beside each name", async ({ browser }) => {
    const names = [tagName("Compact A"), tagName("Compact B"), tagName("Compact C")];
    for (const n of names) await defineTag(n);
    const page = await pageAs(browser, "owner");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(customTagsUrl());
    await expect(page.getByText(names[2], { exact: true })).toBeVisible();

    const list = page.locator("ul").filter({ hasText: names[0] });
    const layout = await list.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const cells = Array.from(el.children).map((li) => li.getBoundingClientRect());
      return {
        emptyBelow: box.bottom - Math.max(...cells.map((c) => c.bottom)),
        rowTops: new Set(cells.map((c) => Math.round(c.top))).size,
        widestCell: Math.max(...cells.map((c) => c.width)),
        listWidth: box.width,
      };
    });
    // It used to stretch to fill the viewport (~500px of empty box under three tags).
    expect(layout.emptyBelow).toBeLessThanOrEqual(4);
    // Three tags share one row on a desktop width, rather than one full-width row each.
    expect(layout.rowTops).toBe(1);
    expect(layout.widestCell).toBeLessThan(layout.listWidth / 2);
    // Each tag's actions sit inside its own cell, next to its name.
    const cell = list.locator("li").filter({ hasText: names[0] });
    await expect(cell.getByRole("button", { name: `Edit tag ${names[0]}` })).toBeVisible();
    await expect(cell.getByRole("button", { name: `Delete tag ${names[0]}` })).toBeVisible();
  });

  test("with a long catalog the page itself never scrolls — only the tag list does", async ({ browser }) => {
    // Enough tags to overflow any sane viewport height; created in one go so the page loads them all.
    // 60, not 30: the list lays tags out three to a row on a desktop width, so 30 is only ten rows.
    const names = Array.from({ length: 60 }, (_, i) => tagName(`Scroll ${String(i).padStart(2, "0")}`));
    await Promise.all(names.map((n) => defineTag(n)));

    const page = await pageAs(browser, "owner");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(customTagsUrl());
    await expect(page.getByText(names[0], { exact: true })).toBeVisible();

    // <main> in app/(app)/layout.tsx is the shell's scroll container — the rightmost scrollbar.
    const main = page.locator("main").first();
    const list = page.locator("ul").filter({ hasText: names[0] });
    const overflow = (loc: typeof main) =>
      loc.evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight, top: el.scrollTop }));

    const mainBefore = await overflow(main);
    expect(mainBefore.scroll, "the page shell must not overflow").toBeLessThanOrEqual(mainBefore.client + 1);
    const listBefore = await overflow(list);
    expect(listBefore.scroll, "the tag list should be the thing that scrolls").toBeGreaterThan(listBefore.client);

    // Wheel-scrolling over the list reaches the last tag while the shell stays at the top.
    await list.hover();
    await page.mouse.wheel(0, 5000);
    await expect(page.getByRole("button", { name: `Delete tag ${names[names.length - 1]}` })).toBeInViewport();
    expect((await overflow(list)).top).toBeGreaterThan(0);
    expect((await overflow(main)).top).toBe(0);

    // Adding one more tag to an already-long list still doesn't grow the page.
    const extra = tagName("Scroll extra");
    await page.getByPlaceholder("e.g. Regression, Smoke, Flaky").fill(extra);
    await page.getByRole("button", { name: "Add tag" }).click();
    await expect(page.getByText(extra, { exact: true })).toBeAttached();
    const mainAfter = await overflow(main);
    expect(mainAfter.scroll).toBeLessThanOrEqual(mainAfter.client + 1);
  });

  test("with only a couple of tags the page doesn't scroll either", async ({ browser }) => {
    const name = tagName("Short");
    await defineTag(name);
    const page = await pageAs(browser, "owner");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(customTagsUrl());
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    const m = await page.locator("main").first().evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight }));
    expect(m.scroll).toBeLessThanOrEqual(m.client + 1);
  });

  // ─── On the test case panel ─────────────────────────────────────────────────

  test("tags selected on create are saved and remain selected when reopened for edit", async ({ browser }) => {
    const [alpha, beta] = await Promise.all([defineTag(tagName("Alpha")), defineTag(tagName("Beta"))]);

    const page = await pageAs(browser, "owner");
    await page.goto(testcasesUrl());
    await page.getByRole("button", { name: "Add test case" }).first().click();

    const panel = page.locator("aside");
    const title = `E2E Custom Tags UI Case ${Date.now()}`;
    await panel.getByPlaceholder("Describe what this test case validates").fill(title);
    await expect(panel.getByText("Custom Tags", { exact: true })).toBeVisible();

    const trigger = panel.getByRole("button", { name: "Custom tags" });
    await trigger.click();
    await tagCheckbox(panel, alpha.name).check();
    await page.keyboard.press("Escape");
    // The dropdown closes and the trigger itself now shows the selection as a chip.
    await expect(trigger.getByText(alpha.name, { exact: true })).toBeVisible();

    await panel.getByRole("button", { name: "Create", exact: true }).click();
    await expect(panel.getByText("Test case created successfully.")).toBeVisible();

    const [created] = await api
      .get(`/api/projects/${tenant!.mainProjectId}/testcases`, { params: { search: title } })
      .then((r) => r.json());
    const assignedAfterCreate = await api.get(`/api/projects/${tenant!.mainProjectId}/testcases/${created.id}/tags`).then((r) => r.json());
    expect(assignedAfterCreate.map((t: any) => t.id)).toEqual([alpha.id]);

    // Reopen for edit: the chip reflects what was actually persisted, not just local state.
    await page.goto(testcasesUrl());
    await page.getByRole("button", { name: title }).click();
    await expect(trigger.getByText(alpha.name, { exact: true })).toBeVisible();
    await expect(trigger.getByText(beta.name, { exact: true })).toHaveCount(0);

    // Changing the selection and saving replaces the assignment.
    await trigger.click();
    await tagCheckbox(panel, beta.name).check();
    await tagCheckbox(panel, alpha.name).uncheck();
    await page.keyboard.press("Escape");
    await panel.getByRole("button", { name: "Save changes" }).click();
    await expect(panel.getByText("Test case updated successfully.")).toBeVisible();

    await expect
      .poll(() => api.get(`/api/projects/${tenant!.mainProjectId}/testcases/${created.id}/tags`).then((r) => r.json()).then((t: any[]) => t.map((x) => x.id)))
      .toEqual([beta.id]);
  });

  test("with no tags in the catalog, the Custom Tags field does not appear on the panel", async ({ browser }) => {
    const page = await pageAs(browser, "owner");
    await page.goto(testcasesUrl());
    await page.getByRole("button", { name: "Add test case" }).first().click();
    const panel = page.locator("aside");
    await expect(panel.getByPlaceholder("Describe what this test case validates")).toBeVisible();
    await expect(panel.getByText("Custom Tags", { exact: true })).toHaveCount(0);
  });

  // ─── Repository toolbar — Tags filter ───────────────────────────────────────

  // The trigger's accessible name gains the selection-count badge ("Tags 2"), so match both forms.
  const TAGS_FILTER = /^Tags(\s*\d+)?$/;

  async function defineCase(title: string, customTagIds: string[] = []): Promise<any> {
    const res = await api.post(`/api/projects/${tenant!.mainProjectId}/testcases`, { data: { title, customTagIds }, failOnStatusCode: false });
    expect(res.status(), await res.text()).toBe(201);
    return res.json();
  }

  test("the Tags filter narrows the repository to cases carrying any selected tag, and chips undo it", async ({ browser }) => {
    const [smoke, flaky, other] = await Promise.all([
      defineTag(tagName("Smoke")),
      defineTag(tagName("Flaky")),
      defineTag(tagName("Other")),
    ]);
    const stamp = `Filter ${Date.now()}`;
    const smokeCase = await defineCase(`E2E ${stamp} smoke`, [smoke.id]);
    const flakyCase = await defineCase(`E2E ${stamp} flaky`, [flaky.id]);
    const otherCase = await defineCase(`E2E ${stamp} other`, [other.id]);
    const plainCase = await defineCase(`E2E ${stamp} plain`);

    const page = await pageAs(browser, "owner");
    await page.goto(testcasesUrl());
    const titles = page.locator("table.tc-repo-table tbody tr td button", { hasText: stamp });
    await expect(titles).toHaveCount(4);

    // Each row shows its custom tag as a chip under the title.
    const smokeRow = page.locator("table.tc-repo-table tbody tr", { hasText: smokeCase.title });
    await expect(smokeRow.getByTitle("Custom tag")).toHaveText(smoke.name);

    // The filter lists the whole catalog.
    await page.getByRole("button", { name: TAGS_FILTER }).click();
    const listbox = page.getByRole("listbox", { name: "Filter by tags" });
    for (const t of [smoke, flaky, other]) await expect(listbox.getByText(t.name, { exact: true })).toBeVisible();

    // One tag, then a second: the list is the union, and the request actually carries both ids.
    await tagCheckbox(listbox, smoke.name).check();
    await expect(titles).toHaveCount(1);
    await expect(titles.first()).toHaveText(smokeCase.title);
    const twoTagRequest = page.waitForRequest((r) => r.url().includes("/testcases?") && r.url().includes(flaky.id));
    await tagCheckbox(listbox, flaky.name).check();
    const req = await twoTagRequest;
    expect(new URL(req.url()).searchParams.get("customTagIds")?.split(",").sort()).toEqual([smoke.id, flaky.id].sort());
    await expect(titles).toHaveCount(2);
    await expect(page.getByText(otherCase.title)).toHaveCount(0);
    await expect(page.getByText(plainCase.title)).toHaveCount(0);
    await expect(page.getByRole("button", { name: TAGS_FILTER })).toContainText("2");
    await page.keyboard.press("Escape");
    // Selections live only in the dropdown (checked boxes + the count badge) — no "Tag: …" chips
    // are rendered in the toolbar's active-filter row.
    await expect(page.getByText(/^Tag:/)).toHaveCount(0);

    // Reopening shows both still ticked; unticking one drops just that tag.
    await page.getByRole("button", { name: TAGS_FILTER }).click();
    await expect(tagCheckbox(listbox, smoke.name)).toBeChecked();
    await expect(tagCheckbox(listbox, flaky.name)).toBeChecked();
    await tagCheckbox(listbox, smoke.name).uncheck();
    await expect(titles).toHaveCount(1);
    await expect(titles.first()).toHaveText(flakyCase.title);
    await page.keyboard.press("Escape");

    // "Clear all" drops the rest and restores the whole list.
    await page.getByRole("button", { name: "Clear all" }).click();
    await expect(titles).toHaveCount(4);
    await page.getByRole("button", { name: TAGS_FILTER }).click();
    await expect(tagCheckbox(listbox, flaky.name)).not.toBeChecked();
    await page.keyboard.press("Escape");

    // The dropdown's own Clear resets a multi-tag selection in one go.
    await page.getByRole("button", { name: TAGS_FILTER }).click();
    await tagCheckbox(listbox, other.name).check();
    await tagCheckbox(listbox, smoke.name).check();
    await expect(titles).toHaveCount(2);
    await listbox.getByRole("button", { name: "Clear" }).click();
    await expect(titles).toHaveCount(4);
  });

  test("a tag nobody carries empties the list instead of showing everything", async ({ browser }) => {
    const unused = await defineTag(tagName("Unused"));
    const stamp = `Empty ${Date.now()}`;
    await defineCase(`E2E ${stamp} plain`);
    const page = await pageAs(browser, "owner");
    await page.goto(testcasesUrl());
    await expect(page.getByText(`E2E ${stamp} plain`)).toBeVisible();
    await page.getByRole("button", { name: TAGS_FILTER }).click();
    await tagCheckbox(page.getByRole("listbox", { name: "Filter by tags" }), unused.name).check();
    await expect(page.locator("table.tc-repo-table tbody tr td button", { hasText: stamp })).toHaveCount(0);
    await expect(page.getByText("No test cases found")).toBeVisible();
  });

  test("with an empty catalog the Tags filter says so and points at settings", async ({ browser }) => {
    const page = await pageAs(browser, "owner");
    await page.goto(testcasesUrl());
    await page.getByRole("button", { name: TAGS_FILTER }).click();
    const listbox = page.getByRole("listbox", { name: "Filter by tags" });
    await expect(listbox.getByText(/No custom tags in this project yet/)).toBeVisible();
    await expect(listbox.locator("input[type='checkbox']")).toHaveCount(0);
  });

  test("when the filtered list request fails, the screen reports the error", async ({ browser }) => {
    const tag = await defineTag(tagName("Broken"));
    const page = await pageAs(browser, "owner");
    await page.goto(testcasesUrl());
    // Only the tag-filtered request fails, so everything else on the page still loads normally.
    await page.route(/\/testcases\?.*customTagIds=/, (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "E2E forced failure" }) }),
    );
    await page.getByRole("button", { name: TAGS_FILTER }).click();
    await tagCheckbox(page.getByRole("listbox", { name: "Filter by tags" }), tag.name).check();
    await expect(page.getByText("E2E forced failure")).toBeVisible();
  });

  // ─── Insights -> Execution Report ───────────────────────────────────────────

  test("Group by Tags offers no values for an empty catalog, and the real catalog once tags exist", async ({ browser }) => {
    const page = await pageAs(browser, "owner");
    await page.goto(reportsUrl());
    await expect(page.getByRole("heading", { name: "Reports & Insights" })).toBeVisible();
    await page.getByRole("button", { name: /Execution Report/i }).first().click();

    const groupBy = page.locator("select").first();
    await groupBy.selectOption("tags");
    const tagSelect = page.locator("select").nth(1);
    await expect(tagSelect).toBeVisible();
    await expect(tagSelect).toBeDisabled();
    await expect(tagSelect.locator("option")).toHaveCount(1);
    await expect(tagSelect.locator("option").first()).toHaveText("No tags available");

    const tag = await defineTag(tagName("Smoke"));
    await page.reload();
    await page.getByRole("button", { name: /Execution Report/i }).first().click();
    await groupBy.selectOption("tags");
    await expect(tagSelect).toBeEnabled();
    await expect(tagSelect.locator(`option[value="${tag.id}"]`)).toHaveText(tag.name);
  });
});
