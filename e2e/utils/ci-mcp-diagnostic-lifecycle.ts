import { expect, test, type Page, type Request, type Route, type TestInfo } from "@playwright/test";

/** Reuse an issued synthetic token and real app/session; only response delivery and the clock are controlled. */
export async function verifyMcpDiagnosticLifecycle(source: Page, api: string, web: string, projectId: string, otherProjectId: string, secret: string, testInfo: TestInfo) {
  const browser = source.context().browser();
  expect(browser, "isolated smoke must own its browser").not.toBeNull();
  // Clock interception stays in its own context, not in the other repository/history regressions.
  const context = await browser!.newContext({ storageState: await source.context().storageState(), viewport: source.viewportSize() ?? undefined });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const endpoint = `${api}/api/projects/${projectId}/mcp`;
  const card = () => page.getByRole("heading", { name: "Check MCP connection", exact: true }).locator("../..");
  const input = () => card().getByLabel("API token", { exact: true });
  const capture = async (name: string) => testInfo.attach(name, { body: await card().screenshot(), contentType: "image/png" });
  async function start() {
    await input().fill(secret);
    await card().getByRole("button", { name: "Check connection", exact: true }).click();
  }
  async function holdProjectRead() {
    let release!: () => void, observed!: (request: Request) => void, delivered!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const request = new Promise<Request>((resolve) => { observed = resolve; });
    const finished = new Promise<void>((resolve) => { delivered = resolve; });
    const handler = async (route: Route) => {
      if (route.request().method() !== "POST") return route.continue();
      const rpc = route.request().postDataJSON();
      if (rpc.method !== "tools/call" || rpc.params?.name !== "list_projects") return route.continue();
      try {
        // Fetch the genuine read result first; only delivery to the browser is held.
        const response = await route.fetch();
        expect(response.status()).toBe(201);
        expect((await response.json()).result.isError).toBe(false);
        observed(route.request());
        await held;
        await route.fulfill({ response });
      } finally { delivered(); }
    };
    await page.route(endpoint, handler);
    return { request, release, finished, handler };
  }
  try {
    await page.clock.install();
    await page.goto(`${web}/projects/${projectId}/settings/api-tokens`);
    await expect(card()).toContainText(endpoint);
    await test.step("a pending real project read times out, clears its credential and permits an explicit fresh check", async () => {
      const held = await holdProjectRead();
      try {
        await start();
        const request = await held.request;
        await expect(input()).toHaveValue("");
        await expect(input()).toBeDisabled();
        await expect(card().getByRole("button", { name: "Checking…", exact: true })).toBeDisabled();
        await page.clock.fastForward(10_001);
        await expect(card().getByRole("status")).toContainText("Connection check timed out after 10 seconds");
        held.release(); await held.finished;
        await expect.poll(() => request.failure()?.errorText).toContain("ERR_ABORTED");
        await expect(input()).toBeEnabled();
        await expect(card().getByRole("button", { name: "Check connection", exact: true })).toBeDisabled();
        expect(await card().innerText()).not.toContain(secret);
        await capture("mcp-browser-project-read-timeout-with-cleared-input");
      } finally { held.release(); await page.unroute(endpoint, held.handler); }
      await start();
      await expect(card().getByRole("status")).toContainText("Read permission and project identity verified; 50 MCP tools advertised");
      await expect(input()).toHaveValue("");
      await expect(card()).toContainText("Write permissions and reporting were not tested");
      // Capture the whole actual success card, not an unrelated viewport above its status.
      await capture("mcp-browser-verified-read-status-after-timeout-recovery");
    });
    await test.step("client-side navigation aborts a pending check and does not carry credentials/results into another project", async () => {
      const held = await holdProjectRead();
      try {
        await page.evaluate(() => { Object.assign(window, { __tesboCiMcpDocument: true }); });
        await start();
        const request = await held.request;
        await expect(input()).toHaveValue("");
        await page.getByRole("navigation", { name: "Breadcrumb", exact: true }).getByRole("link", { name: "Projects", exact: true }).click();
        await expect(page).toHaveURL(`${web}/projects`);
        held.release(); await held.finished;
        await expect.poll(() => request.failure()?.errorText).toContain("ERR_ABORTED");
        await page.locator(`a[href="/projects/${otherProjectId}/dashboard"]`).click();
        await page.getByRole("link", { name: "Project settings", exact: true }).click();
        await page.getByRole("button", { name: "API & MCP", exact: true }).click();
        await page.getByRole("link", { name: "Manage API tokens", exact: true }).click();
        await expect(card()).toContainText(`${api}/api/projects/${otherProjectId}/mcp`);
        await expect(input()).toHaveValue("");
        await expect(card().getByRole("status")).toHaveCount(0);
        await expect(card().getByRole("button", { name: "Check connection", exact: true })).toBeDisabled();
        expect(await page.evaluate(() => "__tesboCiMcpDocument" in window), "real Next links, not a reload that would automatically abort all networking").toBe(true);
        expect(await page.locator("body").innerText()).not.toContain(secret);
        await capture("mcp-browser-other-project-after-client-navigation-cancellation");
      } finally { held.release(); await page.unroute(endpoint, held.handler); }
    });
    expect(errors).toEqual([]);
  } catch (error) {
    await testInfo.attach("mcp-lifecycle-failure", { body: await page.screenshot({ mask: [page.locator("input"), page.locator("pre")] }), contentType: "image/png" });
    throw error;
  } finally { await context.close(); }
}
