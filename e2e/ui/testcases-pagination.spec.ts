import fs from "node:fs";
import path from "node:path";
import { expect, request as pwRequest, test, type Page } from "@playwright/test";
import { env } from "../utils/env";

const ctx = JSON.parse(fs.readFileSync(path.join(__dirname, "../.auth/context.json"), "utf-8"));
const STATE_PATH = path.join(__dirname, "../.auth/state.json");

test.describe("test case list pagination", () => {
  // Regression test for a bug where the backend sent the real total via an X-Total-Count
  // header that wasn't in the CORS exposedHeaders allowlist. Cross-origin fetch() silently
  // returned null for it, so the frontend fell back to the current page's row count as the
  // "total" — making a full page look like the last page and disabling Next forever.
  test("Next/Previous move between pages and show the correct rows for a suite with 12 test cases", { tag: '@tesbo.testId("TES-TC-835")' }, async ({
    page,
  }) => {
    const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
    const suiteName = `E2E Pagination Suite ${Date.now()}`;
    let suiteId = "";

    try {
      const suite = await (
        await api.post(`/api/projects/${ctx.projectId}/suites`, { data: { name: suiteName } })
      ).json();
      suiteId = suite.id;

      for (let i = 0; i < 12; i++) {
        const createRes = await api.post(`/api/projects/${ctx.projectId}/testcases`, {
          data: { title: `E2E Pagination Case ${Date.now()}-${i}`, suiteId },
        });
        expect(createRes.ok()).toBeTruthy();
      }

      // Ground truth for what each page should show, from the same API the UI calls — this
      // test doesn't assume a sort order, it just checks the UI matches whatever the API says.
      const page1Res = await api.get(`/api/projects/${ctx.projectId}/testcases`, {
        params: { suiteId, limit: 10, offset: 0 },
      });
      expect(page1Res.headers()["x-total-count"]).toBe("12");
      const page1Expected: string[] = (await page1Res.json()).map((tc: { title: string }) => tc.title);
      const page2Res = await api.get(`/api/projects/${ctx.projectId}/testcases`, {
        params: { suiteId, limit: 10, offset: 10 },
      });
      const page2Expected: string[] = (await page2Res.json()).map((tc: { title: string }) => tc.title);
      expect(page1Expected).toHaveLength(10);
      expect(page2Expected).toHaveLength(2);

      await page.goto(`/projects/${ctx.projectId}/testcases?suiteId=${suiteId}`);
      const pagination = page.getByTestId("testcases-pagination");
      await pagination.getByTestId("testcases-page-size").selectOption("10");

      const previousButton = pagination.getByRole("button", { name: "Previous" });
      const nextButton = pagination.getByRole("button", { name: "Next" });

      await expect(pagination).toContainText("12 results");
      await expect(pagination).toContainText("page 1 of 2");
      await expect(previousButton).toBeDisabled();
      await expect(nextButton).toBeEnabled();
      for (const title of page1Expected) {
        await expect(page.getByRole("button", { name: title })).toBeVisible();
      }

      await nextButton.click();

      await expect(pagination).toContainText("page 2 of 2");
      await expect(nextButton).toBeDisabled();
      await expect(previousButton).toBeEnabled();
      for (const title of page2Expected) {
        await expect(page.getByRole("button", { name: title })).toBeVisible();
      }
      // The actual regression: before the fix, totalPages was miscomputed as 1, so this row
      // from page 1 either stayed on screen (Next was a no-op) or Next was disabled outright.
      await expect(page.getByRole("button", { name: page1Expected[0] })).not.toBeVisible();

      await previousButton.click();

      await expect(pagination).toContainText("page 1 of 2");
      await expect(previousButton).toBeDisabled();
      await expect(page.getByRole("button", { name: page1Expected[0] })).toBeVisible();
    } finally {
      if (suiteId) {
        await api.delete(`/api/suites/${suiteId}`, {
          params: { mode: "deleteTestcases" },
          failOnStatusCode: false,
        });
      }
      await api.dispose();
    }
  });
});

/*
 * Server-side paging. The repository used to load up to 500 rows and page/sort them in the browser,
 * so a project with more than 500 matching cases could never show the rest ("showing the first
 * 500"). It now asks the server for one page at a time (limit/offset/sortBy), which is what these
 * pin: reachability past 500, what each interaction actually requests, and the edge cases that only
 * exist once a page is a network round trip (stale responses, a page that vanishes, a failed page).
 */
test.describe("repository paging past 500 rows", () => {
  test.describe.configure({ mode: "serial" });

  const stamp = Date.now();
  const BIG = 520; // two bulk-create batches (the endpoint caps a batch at 500)
  const SMALL = 26; // one more than the default page size of 25
  const bigPrefix = `E2E Big ${stamp}`;
  const smallPrefix = `E2E Small ${stamp}`;
  let api: Awaited<ReturnType<typeof pwRequest.newContext>>;
  let bigSuiteId = "";
  let smallSuiteId = "";

  const pad = (n: number) => String(n).padStart(4, "0");

  async function seed(suiteId: string, prefix: string, count: number) {
    for (let from = 0; from < count; from += 500) {
      const batch = Array.from({ length: Math.min(500, count - from) }, (_, i) => ({ title: `${prefix} ${pad(from + i)}`, suiteId }));
      const res = await api.post(`/api/projects/${ctx.projectId}/testcases/bulk-create`, { data: { testcases: batch } });
      expect(res.ok(), await res.text()).toBeTruthy();
    }
  }

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
    bigSuiteId = (await (await api.post(`/api/projects/${ctx.projectId}/suites`, { data: { name: `${bigPrefix} suite` } })).json()).id;
    smallSuiteId = (await (await api.post(`/api/projects/${ctx.projectId}/suites`, { data: { name: `${smallPrefix} suite` } })).json()).id;
    await seed(bigSuiteId, bigPrefix, BIG);
    await seed(smallSuiteId, smallPrefix, SMALL);
  });

  test.afterAll(async () => {
    for (const id of [bigSuiteId, smallSuiteId]) {
      if (id) await api.delete(`/api/suites/${id}`, { params: { mode: "deleteTestcases" }, failOnStatusCode: false });
    }
    await api.dispose();
  });

  const open = async (page: Page, suiteId: string) => {
    await page.goto(`/projects/${ctx.projectId}/testcases?suiteId=${suiteId}`);
    await expect(page.getByTestId("testcases-pagination")).toBeVisible();
  };
  const footer = (page: Page) => page.getByTestId("testcases-pagination");
  const rowsOf = (page: Page, prefix: string) => page.getByRole("row").filter({ hasText: prefix });
  const next = (page: Page) => footer(page).getByRole("button", { name: "Next" });

  /** Every list request the page sends for the repository, as a URL (not other /testcases/... calls). */
  function listRequests(page: Page): URL[] {
    const seen: URL[] = [];
    page.on("request", (req) => {
      const url = new URL(req.url());
      if (req.method() === "GET" && url.pathname === `/api/projects/${ctx.projectId}/testcases` && url.searchParams.has("limit")) seen.push(url);
    });
    return seen;
  }

  test("every case past the old 500-row cap is reachable, with no truncation note", async ({ page }) => {
    await open(page, bigSuiteId);
    await footer(page).getByTestId("testcases-page-size").selectOption("250");

    await expect(footer(page)).toContainText(`${BIG} results`);
    await expect(footer(page)).toContainText("page 1 of 3");
    await expect(footer(page)).not.toContainText("showing the first");

    await next(page).click();
    await expect(footer(page)).toContainText("page 2 of 3");
    await next(page).click();
    await expect(footer(page)).toContainText("page 3 of 3");
    await expect(rowsOf(page, bigPrefix)).toHaveCount(BIG - 500); // 20 rows on the last, partial page
    await expect(next(page)).toBeDisabled();
    await expect(page.getByRole("button", { name: `${bigPrefix} ${pad(BIG - 1)}` })).toBeVisible();
  });

  test("the first load asks for one page, and Next asks for exactly the next slice", async ({ page }) => {
    const requests = listRequests(page);
    await open(page, bigSuiteId);
    await expect(footer(page)).toContainText("page 1 of 21");

    const first = requests.find((u) => u.searchParams.get("suiteId") === bigSuiteId);
    expect(first?.searchParams.get("limit"), "a page, not the old 500-row batch").toBe("25");
    expect(first?.searchParams.get("offset")).toBe("0");
    expect(requests.some((u) => u.searchParams.get("limit") === "500")).toBe(false);

    await next(page).click();
    await expect(footer(page)).toContainText("page 2 of 21");
    await expect.poll(() => requests.some((u) => u.searchParams.get("offset") === "25" && u.searchParams.get("limit") === "25")).toBe(true);
    await expect(rowsOf(page, bigPrefix)).toHaveCount(25);
    await expect(page.getByRole("button", { name: `${bigPrefix} ${pad(0)}` })).toHaveCount(0);
  });

  test("sort is applied by the server across the whole set and sends the user back to page 1", async ({ page }) => {
    const requests = listRequests(page);
    await open(page, bigSuiteId);
    const sortByTitle = page.getByRole("button", { name: "Sort by Test case title" });

    await sortByTitle.click(); // asc
    await sortByTitle.click(); // desc
    await expect(rowsOf(page, bigPrefix).first()).toContainText(`${bigPrefix} ${pad(BIG - 1)}`);
    expect(requests.some((u) => u.searchParams.get("sortBy") === "title" && u.searchParams.get("sortDir") === "desc")).toBe(true);

    await next(page).click();
    await expect(footer(page)).toContainText("page 2 of 21");
    await expect(rowsOf(page, bigPrefix).first()).toContainText(`${bigPrefix} ${pad(BIG - 1 - 25)}`);

    await sortByTitle.click(); // flips to asc while on page 2
    await expect(footer(page)).toContainText("page 1 of 21");
    await expect(rowsOf(page, bigPrefix).first()).toContainText(`${bigPrefix} ${pad(0)}`);
  });

  test("a filter change from a later page fetches once, from offset 0", async ({ page }) => {
    const requests = listRequests(page);
    await open(page, bigSuiteId);
    await footer(page).getByTestId("testcases-page-size").selectOption("250");
    await next(page).click();
    await expect(footer(page)).toContainText("page 2 of 3");

    const before = requests.length;
    await page.getByPlaceholder("Search by ID, title, or type").fill(`${bigPrefix} ${pad(7)}`);
    await expect(footer(page)).toContainText("1 result");

    const searched = requests.slice(before).filter((u) => u.searchParams.has("search"));
    expect(searched, "one request for the new filter, not a stale-page request followed by a reset").toHaveLength(1);
    expect(searched[0].searchParams.get("offset")).toBe("0");
  });

  test("a slow page that is no longer wanted cannot overwrite the newer one", async ({ page }) => {
    await open(page, bigSuiteId);
    await expect(footer(page)).toContainText("page 1 of 21");

    // Hold only the page-2 response; the sort below supersedes it long before it lands.
    await page.route("**/api/projects/*/testcases?*", async (route) => {
      if (new URL(route.request().url()).searchParams.get("offset") === "25") await new Promise((r) => setTimeout(r, 2500));
      await route.continue();
    });
    await next(page).click();
    await page.getByRole("button", { name: "Sort by Test case title" }).click();

    await expect(footer(page)).toContainText("page 1 of 21");
    await expect(rowsOf(page, bigPrefix).first()).toContainText(`${bigPrefix} ${pad(0)}`);
    await page.waitForTimeout(3500); // past the held response
    await expect(footer(page)).toContainText("page 1 of 21");
    await expect(rowsOf(page, bigPrefix).first()).toContainText(`${bigPrefix} ${pad(0)}`);
    await expect(page.getByRole("button", { name: `${bigPrefix} ${pad(25)}` })).toHaveCount(0);
  });

  test("a failed page says so, and Retry reloads that same page", async ({ page }) => {
    await open(page, bigSuiteId);
    await expect(footer(page)).toContainText("page 1 of 21");

    await page.route("**/api/projects/*/testcases?*", async (route) => {
      if (new URL(route.request().url()).searchParams.get("offset") === "25") {
        await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "page exploded" }) });
      } else await route.continue();
    });
    await next(page).click();
    await expect(page.getByText("page exploded")).toBeVisible();

    await page.unroute("**/api/projects/*/testcases?*");
    await page.getByTestId("testcases-retry").click();
    await expect(footer(page)).toContainText("page 2 of 21");
    await expect(page.getByRole("button", { name: `${bigPrefix} ${pad(25)}` })).toBeVisible();
  });

  test("'Select all N matching' still reaches the cases on every page", async ({ page }) => {
    await open(page, bigSuiteId);
    await expect(footer(page)).toContainText("page 1 of 21");
    await page.getByRole("row").first().getByRole("checkbox").first().check();

    const selectAll = page.getByTestId("select-all-matching");
    await expect(selectAll).toContainText(String(BIG));
    await selectAll.click();
    await expect(page.getByText(`${BIG} selected`)).toBeVisible();
  });

  test("deleting the only case on the last page steps back to the page that still exists", async ({ page }) => {
    await open(page, smallSuiteId);
    await expect(footer(page)).toContainText(`${SMALL} results`);
    await expect(footer(page)).toContainText("page 1 of 2");

    await next(page).click();
    await expect(footer(page)).toContainText("page 2 of 2");
    await expect(rowsOf(page, smallPrefix)).toHaveCount(1);

    await rowsOf(page, smallPrefix).first().getByRole("button").first().click();
    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: "Delete", exact: true }).click();

    // Page 2 no longer exists: the screen must land on the full first page, not on "No test cases".
    await expect(footer(page)).toContainText(`${SMALL - 1} results`);
    await expect(page.getByText("No test cases found")).toHaveCount(0);
    await expect(rowsOf(page, smallPrefix)).toHaveCount(SMALL - 1);
    const stored = await api.get(`/api/projects/${ctx.projectId}/testcases`, { params: { suiteId: smallSuiteId, limit: 1 } });
    expect(stored.headers()["x-total-count"]).toBe(String(SMALL - 1));
  });
});
