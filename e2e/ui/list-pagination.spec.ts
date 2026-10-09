import path from "node:path";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  createProject,
  deleteProjects,
  screensApi,
  screensSuiteSkipReason,
  screensTenant,
  uniqueSuffix,
} from "../utils/screens-tenant";

/*
 * Pagination on the Test Runs (/cycles) and Test plans (/plans) lists.
 *
 * Both lists load every row and filter/sort client-side, so paging is client-side too: the stat tiles
 * keep describing the whole filtered set while only one page of cards renders. Default is 25 per
 * page, selectable from 10 / 25 / 50 / 100.
 *
 * Every describe seeds its own project with 26 rows — one more than a default page, so page 2 holds
 * exactly one row. The rows are zero-padded and the lists are sorted by name so the page boundary is
 * deterministic (run 25 is the last card on page 1, run 26 the only card on page 2).
 */

const tenant = screensTenant();
const skipReason = screensSuiteSkipReason(tenant);

test.use({ storageState: path.join(__dirname, "../.auth/state-screens.json") });

const TOTAL = 26;
const pad = (n: number) => String(n).padStart(2, "0");

/** Creates `TOTAL` rows in small parallel batches — sequential POSTs are slow against the hosted DB. */
async function seedMany(make: (n: number) => Promise<unknown>): Promise<void> {
  for (let start = 1; start <= TOTAL; start += 7) {
    const batch: Promise<unknown>[] = [];
    for (let n = start; n < start + 7 && n <= TOTAL; n++) batch.push(make(n));
    await Promise.all(batch);
  }
}

function footer(page: Page, testId: string) {
  return {
    root: page.getByTestId(testId),
    range: page.getByTestId(`${testId}-range`),
    size: page.getByTestId(`${testId}-size`),
    prev: page.getByTestId(`${testId}-prev`),
    next: page.getByTestId(`${testId}-next`),
  };
}

test.describe("Test Runs list — pagination", () => {
  test.skip(!!skipReason, skipReason ?? "");

  let api: APIRequestContext;
  let projectId = "";
  const tag = `PGR${uniqueSuffix()}`;
  const runName = (n: number) => `${tag} Run ${pad(n)}`;
  const cards = (page: Page) => page.getByRole("link", { name: new RegExp(`^${tag} Run `) });

  test.beforeAll(async () => {
    api = await screensApi();
    projectId = (await createProject(api)).id;
    await seedMany((n) => api.post(`/api/projects/${projectId}/cycles`, { data: { name: runName(n) } }));
  });

  test.afterAll(async () => {
    await deleteProjects(api, [projectId]);
    await api.dispose();
  });

  async function open(page: Page) {
    await page.goto(`/projects/${projectId}/cycles`);
    await page.locator("select").filter({ hasText: "Name A–Z" }).selectOption("name");
    await expect(cards(page)).toHaveCount(25);
  }

  test("defaults to 25 per page and Next/Previous move between the two pages", async ({ page }) => {
    await open(page);
    const f = footer(page, "runs-pagination");

    await expect(f.size).toHaveValue("25");
    await expect(f.range).toContainText("Showing 1–25 of 26 runs");
    await expect(f.range).toContainText("page 1 of 2");
    await expect(f.prev).toBeDisabled();
    await expect(f.next).toBeEnabled();
    await expect(cards(page).first()).toHaveText(runName(1));
    await expect(cards(page).last()).toHaveText(runName(25));

    await f.next.click();
    await expect(f.range).toContainText("Showing 26–26 of 26 runs");
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toHaveText(runName(26));
    await expect(f.next).toBeDisabled();
    await expect(f.prev).toBeEnabled();

    await f.prev.click();
    await expect(cards(page)).toHaveCount(25);
    await expect(f.prev).toBeDisabled();
  });

  test("offers exactly 10 / 25 / 50 / 100 per page", async ({ page }) => {
    await open(page);
    const values = await footer(page, "runs-pagination").size.locator("option").evaluateAll((os) =>
      os.map((o) => (o as HTMLOptionElement).value),
    );
    expect(values).toEqual(["10", "25", "50", "100"]);
  });

  test("changing the page size re-slices the list and returns to page 1", async ({ page }) => {
    await open(page);
    const f = footer(page, "runs-pagination");

    await f.next.click();
    await expect(f.range).toContainText("page 2 of 2");

    await f.size.selectOption("10");
    await expect(f.range).toContainText("Showing 1–10 of 26 runs");
    await expect(f.range).toContainText("page 1 of 3");
    await expect(cards(page)).toHaveCount(10);
    await expect(f.prev).toBeDisabled();

    await f.next.click();
    await f.next.click();
    await expect(f.range).toContainText("Showing 21–26 of 26 runs");
    await expect(cards(page)).toHaveCount(6);
    await expect(f.next).toBeDisabled();

    // A size larger than the list collapses to one page with both buttons off.
    await f.size.selectOption("50");
    await expect(cards(page)).toHaveCount(26);
    await expect(f.range).toContainText("Showing 1–26 of 26 runs");
    await expect(f.range).not.toContainText("page 1 of");
    await expect(f.prev).toBeDisabled();
    await expect(f.next).toBeDisabled();

    await f.size.selectOption("100");
    await expect(cards(page)).toHaveCount(26);
  });

  test("changing the sort or the status filter returns to page 1 instead of stranding the user", async ({ page }) => {
    await open(page);
    const f = footer(page, "runs-pagination");

    await f.next.click();
    await expect(f.range).toContainText("page 2 of 2");
    await page.locator("select").filter({ hasText: "Name A–Z" }).selectOption("oldest");
    await expect(f.range).toContainText("page 1 of 2");
    await expect(cards(page)).toHaveCount(25);

    await f.next.click();
    await expect(f.range).toContainText("page 2 of 2");
    // Every seeded run is Planning, so filtering to Completed matches none: the page must not stay
    // on "page 2" of nothing, and the footer has nothing to offer.
    await page.getByRole("button", { name: "Completed" }).click();
    await expect(page.getByText("No test runs match this filter.")).toBeVisible();
    await expect(f.root).toHaveCount(0);

    await page.getByRole("button", { name: "All", exact: true }).click();
    await expect(f.range).toContainText("page 1 of 2");
  });

  test("the summary tiles describe every run, not just the page on screen", async ({ page }) => {
    await open(page);
    await expect(page.getByText("Total Runs", { exact: true }).locator("xpath=..")).toContainText("26");
    await footer(page, "runs-pagination").next.click();
    await expect(page.getByText("Total Runs", { exact: true }).locator("xpath=..")).toContainText("26");
  });
});

test.describe("Test Runs list — pagination after a delete", () => {
  test.skip(!!skipReason, skipReason ?? "");

  let api: APIRequestContext;
  let projectId = "";
  const tag = `PGD${uniqueSuffix()}`;
  const runName = (n: number) => `${tag} Run ${pad(n)}`;

  test.beforeAll(async () => {
    api = await screensApi();
    projectId = (await createProject(api)).id;
    await seedMany((n) => api.post(`/api/projects/${projectId}/cycles`, { data: { name: runName(n) } }));
  });

  test.afterAll(async () => {
    await deleteProjects(api, [projectId]);
    await api.dispose();
  });

  test("deleting the only run on the last page lands on the new last page, not an empty one", async ({ page }) => {
    await page.goto(`/projects/${projectId}/cycles`);
    await page.locator("select").filter({ hasText: "Name A–Z" }).selectOption("name");
    const f = footer(page, "runs-pagination");
    await f.next.click();
    await expect(f.range).toContainText("Showing 26–26 of 26 runs");

    await page.getByTitle("Delete run").click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();

    // 25 rows left = one full page; the user must be looking at it.
    await expect(f.range).toContainText("Showing 1–25 of 25 runs");
    await expect(f.range).not.toContainText("page 2");
    await expect(page.getByRole("link", { name: new RegExp(`^${tag} Run `) })).toHaveCount(25);
    await expect(f.next).toBeDisabled();

    // Persisted, not just hidden.
    const left = await (await api.get(`/api/projects/${projectId}/cycles`)).json();
    expect(left.some((r: { name: string }) => r.name === runName(26))).toBe(false);
  });
});

test.describe("Test plans list — pagination", () => {
  test.skip(!!skipReason, skipReason ?? "");

  let api: APIRequestContext;
  let projectId = "";
  const tag = `PGP${uniqueSuffix()}`;
  const planName = (n: number) => `${tag} Plan ${pad(n)}`;
  const cards = (page: Page) => page.getByRole("link", { name: new RegExp(`^${tag} Plan `) });

  test.beforeAll(async () => {
    api = await screensApi();
    projectId = (await createProject(api)).id;
    await seedMany((n) => api.post(`/api/projects/${projectId}/plans`, { data: { name: planName(n) } }));
  });

  test.afterAll(async () => {
    await deleteProjects(api, [projectId]);
    await api.dispose();
  });

  async function open(page: Page) {
    await page.goto(`/projects/${projectId}/plans`);
    await page.getByRole("button", { name: /^Sort:/ }).click();
    await page.getByRole("button", { name: "Name (A–Z)" }).click();
    await expect(cards(page)).toHaveCount(25);
  }

  test("defaults to 25 per page and Next/Previous move between the two pages", async ({ page }) => {
    await open(page);
    const f = footer(page, "plans-pagination");

    await expect(f.size).toHaveValue("25");
    await expect(f.range).toContainText("Showing 1–25 of 26 plans");
    await expect(f.range).toContainText("page 1 of 2");
    await expect(f.prev).toBeDisabled();
    await expect(cards(page).first()).toHaveText(planName(1));
    await expect(cards(page).last()).toHaveText(planName(25));

    await f.next.click();
    await expect(f.range).toContainText("Showing 26–26 of 26 plans");
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toHaveText(planName(26));
    await expect(f.next).toBeDisabled();

    await f.prev.click();
    await expect(cards(page)).toHaveCount(25);
  });

  test("offers exactly 10 / 25 / 50 / 100 per page and each choice re-slices from page 1", async ({ page }) => {
    await open(page);
    const f = footer(page, "plans-pagination");
    const values = await f.size.locator("option").evaluateAll((os) =>
      os.map((o) => (o as HTMLOptionElement).value),
    );
    expect(values).toEqual(["10", "25", "50", "100"]);

    await f.next.click();
    await f.size.selectOption("10");
    await expect(f.range).toContainText("Showing 1–10 of 26 plans");
    await expect(f.range).toContainText("page 1 of 3");
    await expect(cards(page)).toHaveCount(10);

    await f.size.selectOption("100");
    await expect(cards(page)).toHaveCount(26);
    await expect(f.next).toBeDisabled();
    await expect(f.prev).toBeDisabled();
  });

  test("searching returns to page 1 and pages over the matches only", async ({ page }) => {
    await open(page);
    const f = footer(page, "plans-pagination");

    await f.next.click();
    await expect(f.range).toContainText("page 2 of 2");

    // "Plan 2" matches the zero-padded numbers 20..26: seven plans, one page.
    await page.getByPlaceholder("Search plans...").fill(`${tag} Plan 2`);
    await expect(cards(page)).toHaveCount(7);
    await expect(f.range).toContainText("Showing 1–7 of 7 plans");
    await expect(f.range).not.toContainText("page 1 of");
    await expect(f.next).toBeDisabled();

    // No match: empty state, no pagination footer.
    await page.getByPlaceholder("Search plans...").fill(`${tag} nothing-matches-this`);
    await expect(page.getByText("No test plans found")).toBeVisible();
    await expect(f.root).toHaveCount(0);

    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(f.range).toContainText("Showing 1–25 of 26 plans");
  });
});

test.describe("Test plans list — pagination after a delete", () => {
  test.skip(!!skipReason, skipReason ?? "");

  let api: APIRequestContext;
  let projectId = "";
  const tag = `PGX${uniqueSuffix()}`;
  const planName = (n: number) => `${tag} Plan ${pad(n)}`;

  test.beforeAll(async () => {
    api = await screensApi();
    projectId = (await createProject(api)).id;
    await seedMany((n) => api.post(`/api/projects/${projectId}/plans`, { data: { name: planName(n) } }));
  });

  test.afterAll(async () => {
    await deleteProjects(api, [projectId]);
    await api.dispose();
  });

  test("deleting the only plan on the last page lands on the new last page, not an empty one", async ({ page }) => {
    await page.goto(`/projects/${projectId}/plans`);
    await page.getByRole("button", { name: /^Sort:/ }).click();
    await page.getByRole("button", { name: "Name (A–Z)" }).click();
    const f = footer(page, "plans-pagination");
    await f.next.click();
    await expect(f.range).toContainText("Showing 26–26 of 26 plans");

    page.once("dialog", (d) => d.accept()); // the plan delete is a native confirm()
    await page.getByTitle("Delete plan").click();

    await expect(f.range).toContainText("Showing 1–25 of 25 plans");
    await expect(f.range).not.toContainText("page 2");
    await expect(page.getByRole("link", { name: new RegExp(`^${tag} Plan `) })).toHaveCount(25);

    const left = await (await api.get(`/api/projects/${projectId}/plans`)).json();
    expect(left.some((p: { name: string }) => p.name === planName(26))).toBe(false);
  });
});
