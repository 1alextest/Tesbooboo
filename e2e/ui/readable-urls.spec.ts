import fs from "node:fs";
import path from "node:path";
import { expect, test, type APIRequestContext, type Page, type Request } from "@playwright/test";
import { env } from "../utils/env";

/*
 * Readable page URLs: /projects/LOH/bugs/LOH-BUG-1 instead of /projects/<uuid>/bugs/<uuid>.
 *
 * Runs in account A's shared smoke project (default storageState). Nothing here mutates the
 * workspace beyond a bug and a run created with unique names and deleted in `finally`.
 *
 * Every in-app link is still built from uuids, so the interesting behaviour is the canonicalisation:
 * a uuid URL must land on its readable form without a reload, and a readable URL typed or pasted
 * must load the same page.
 */

const ctx = JSON.parse(fs.readFileSync(path.join(__dirname, "../.auth/context.json"), "utf-8"));
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

let projectKey = "";

test.beforeAll(async ({ request }) => {
  projectKey = (await (await request.get(`${apiBase()}/api/projects/${ctx.projectId}`)).json()).key;
});

function apiBase(): string {
  return env.apiBaseUrl;
}

async function createBug(request: APIRequestContext, title: string) {
  const res = await request.post(`${apiBase()}/api/projects/${ctx.projectId}/bugs`, { data: { title, severity: "Low" } });
  expect(res.ok(), await res.text()).toBeTruthy();
  return res.json();
}

/** The path the address bar shows now (the rewrite happens after load, so poll rather than read once). */
async function expectPath(page: Page, expected: string | RegExp) {
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toMatch(
    typeof expected === "string" ? new RegExp(`^${expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) : expected
  );
}

test.describe("readable URLs", () => {
  test("a uuid project URL is rewritten to the project key and the page still works", async ({ page }) => {
    await page.goto(`/projects/${ctx.projectId}/bugs`);
    await expectPath(page, `/projects/${projectKey}/bugs`);
    await expect(page.getByRole("button", { name: "Report Bug" }).first()).toBeVisible();
    expect(page.url()).not.toMatch(new RegExp(UUID));
  });

  test("a project key URL loads the project (no uuid anywhere)", async ({ page }) => {
    await page.goto(`/projects/${projectKey}/bugs`);
    await expect(page.getByRole("button", { name: "Report Bug" }).first()).toBeVisible();
    await expectPath(page, `/projects/${projectKey}/bugs`);
  });

  test("a bug page opens by its <KEY>-BUG-<n> id, and its uuid URL is rewritten to it", async ({ page, request }) => {
    const title = `E2E readable url bug ${Date.now()}`;
    const bug = await createBug(request, title);
    try {
      await page.goto(`/projects/${projectKey}/bugs/${bug.externalId}`);
      await expect(page.getByText(title).first()).toBeVisible();
      await expectPath(page, `/projects/${projectKey}/bugs/${bug.externalId}`);

      // Old link: both segments are uuids.
      await page.goto(`/projects/${ctx.projectId}/bugs/${bug.id}`);
      await expect(page.getByText(title).first()).toBeVisible();
      await expectPath(page, `/projects/${projectKey}/bugs/${bug.externalId}`);

      // A reload on the readable URL (hard load, nothing cached) still resolves.
      await page.reload();
      await expect(page.getByText(title).first()).toBeVisible();
    } finally {
      await request.delete(`${apiBase()}/api/bugs/${bug.id}`, { failOnStatusCode: false });
    }
  });

  test("the sidebar keeps the readable project key when moving between sections", async ({ page }) => {
    await page.goto(`/projects/${projectKey}/bugs`);
    await page.locator("aside").first().getByRole("link", { name: "Test Cases", exact: true }).click();
    await expectPath(page, new RegExp(`^/projects/${projectKey}/testcases$`));
    await expect(page.locator("aside a[href*='/projects/']").first()).toHaveAttribute("href", new RegExp(`^/projects/${projectKey}`));
  });

  test("a run opens by its <KEY>-RUN-<n> id", async ({ page, request }) => {
    const created = await request.post(`${apiBase()}/api/projects/${ctx.projectId}/cycles`, {
      data: { name: `E2E readable url run ${Date.now()}` },
    });
    const cycle = await created.json();
    try {
      const resolved = await (
        await request.get(`${apiBase()}/api/route-resolve`, { params: { project: projectKey, cycle: cycle.id } })
      ).json();
      await page.goto(`/projects/${projectKey}/cycles/${resolved.cycleRef}`);
      await expect(page.getByText(cycle.name).first()).toBeVisible();
      await expectPath(page, `/projects/${projectKey}/cycles/${resolved.cycleRef}`);

      await page.goto(`/projects/${ctx.projectId}/cycles/${cycle.id}`);
      await expect(page.getByText(cycle.name).first()).toBeVisible();
      await expectPath(page, `/projects/${projectKey}/cycles/${resolved.cycleRef}`);
    } finally {
      await request.delete(`${apiBase()}/api/cycles/${cycle.id}`, { failOnStatusCode: false });
    }
  });

  test("an unknown project key or bug ref shows a not-found message, not a blank page or a crash", async ({ page }) => {
    await page.goto(`/projects/NO-SUCH-PROJECT-KEY/bugs`);
    await expect(page.getByRole("alert")).toContainText("Page not found");

    await page.goto(`/projects/${projectKey}/bugs/ZZZ-BUG-99999999`);
    await expect(page.getByRole("alert")).toContainText("Page not found");
  });
});

/*
 * Hard-load prefetch (Tesbo-Frontend/lib/projectPrefetch.ts).
 *
 * AppDataProvider starts the project requests while the session check is still in flight, and the
 * project providers consume them. What has to hold: the project is still fetched exactly once (the
 * prefetch is consumed, not duplicated), the requests really do overlap the session check, and the
 * speculative calls never get anyone into a project they cannot open.
 */
test.describe("project prefetch on a hard load", () => {
  const ctxB = () => path.join(__dirname, "../.auth/state-b.json");

  /** Counts GETs to the project endpoints for the smoke project, ignoring nested paths like /bugs. */
  function trackProjectRequests(page: Page) {
    const seen: { project: Request[]; members: Request[]; resolve: Request[] } = { project: [], members: [], resolve: [] };
    page.on("request", (req) => {
      if (req.method() !== "GET") return;
      const { pathname, search } = new URL(req.url());
      if (pathname === `/api/projects/${ctx.projectId}`) seen.project.push(req);
      else if (pathname === `/api/projects/${ctx.projectId}/members`) seen.members.push(req);
      else if (pathname === "/api/route-resolve" && search === `?project=${projectKey}`) seen.resolve.push(req);
    });
    return seen;
  }

  test("a project-key URL fetches the project, its members and the key lookup once each", async ({ page }) => {
    const seen = trackProjectRequests(page);
    await page.goto(`/projects/${projectKey}/bugs`);
    await expect(page.getByRole("button", { name: "Report Bug" }).first()).toBeVisible();
    // Let any late duplicate land before counting.
    await page.waitForLoadState("networkidle");
    expect(seen.project).toHaveLength(1);
    expect(seen.members).toHaveLength(1);
    expect(seen.resolve).toHaveLength(1);
  });

  test("a uuid URL fetches the project and its members once each", async ({ page }) => {
    const seen = trackProjectRequests(page);
    await page.goto(`/projects/${ctx.projectId}/bugs`);
    await expect(page.getByRole("button", { name: "Report Bug" }).first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(seen.project).toHaveLength(1);
    expect(seen.members).toHaveLength(1);
  });

  for (const [label, ref] of [
    ["project-key", () => projectKey],
    ["uuid", () => ctx.projectId],
  ] as const) {
    test(`the ${label} URL's project requests start before a slow session check answers`, async ({ page }) => {
      // Hold the first /api/auth/me for 2s. Without the prefetch the project requests are only
      // issued after that answer, so they could not possibly have started inside the window.
      let meReleasedAt = 0;
      await page.route("**/api/auth/me", async (route) => {
        await new Promise((r) => setTimeout(r, 2000));
        if (!meReleasedAt) meReleasedAt = Date.now();
        await route.continue();
      });
      const startedAt: number[] = [];
      page.on("request", (req) => {
        if (req.method() === "GET" && new URL(req.url()).pathname === `/api/projects/${ctx.projectId}`) startedAt.push(Date.now());
      });

      await page.goto(`/projects/${ref()}/bugs`);
      await expect(page.getByRole("button", { name: "Report Bug" }).first()).toBeVisible();
      expect(meReleasedAt).toBeGreaterThan(0);
      expect(startedAt.length).toBeGreaterThan(0);
      expect(startedAt[0]).toBeLessThan(meReleasedAt);
    });
  }

  test("signed out: the project URL still ends at /login and the speculative calls are refused", async ({ browser }) => {
    const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      const page = await anon.newPage();
      const statuses: number[] = [];
      page.on("response", (res) => {
        if (new URL(res.url()).pathname === `/api/projects/${ctx.projectId}`) statuses.push(res.status());
      });
      await page.goto(`/projects/${ctx.projectId}/bugs`);
      await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toBe("/login");
      expect(statuses.every((s) => s >= 400)).toBe(true);
      await expect(page.getByRole("button", { name: "Report Bug" })).toHaveCount(0);
    } finally {
      await anon.close();
    }
  });

  test("another tenant's session cannot open this project by uuid or by key", async ({ browser }) => {
    const b = await browser.newContext({ storageState: ctxB() });
    try {
      const page = await b.newPage();
      const statuses: number[] = [];
      page.on("response", (res) => {
        const { pathname } = new URL(res.url());
        if (pathname === `/api/projects/${ctx.projectId}` || pathname === `/api/projects/${ctx.projectId}/members`) statuses.push(res.status());
      });

      // uuid: the project fetch is refused, and the provider sends the user back to the list.
      await page.goto(`/projects/${ctx.projectId}/bugs`);
      await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toBe("/projects");
      await expect(page.getByRole("button", { name: "Report Bug" })).toHaveCount(0);

      // key: the lookup is refused, so the user sees not-found rather than anyone's project.
      await page.goto(`/projects/${projectKey}/bugs`);
      await expect(page.getByRole("alert")).toContainText("Page not found");

      // Nothing the speculative requests asked for ever came back as data.
      expect(statuses.every((s) => s >= 400)).toBe(true);
    } finally {
      await b.close();
    }
  });
});
