import fs from "node:fs";
import path from "node:path";
import { expect, request as pwRequest, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { env } from "../utils/env";
import { literal, scalar } from "../utils/psql";
import { approveTestcase, bulkCreateApprovedTestcases } from "../utils/testcase-approval";

const ctx = JSON.parse(fs.readFileSync(path.join(__dirname, "../.auth/context.json"), "utf-8"));
const STATE_PATH = path.join(__dirname, "../.auth/state.json");

/**
 * Creates a run, adds one Approved test case per entry in `statuses`, and sets each execution to
 * the requested status (an "Untested" entry is left alone since that is already the default on
 * creation). Cycles are created in "Planning" by default (migrations/V9_cycle_status.sql).
 */
async function seedRunWithStatuses(api: APIRequestContext, namePrefix: string, statuses: string[], projectId = ctx.projectId) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const cycleResponse = await api.post(`/api/projects/${projectId}/cycles`, { data: { name: `${namePrefix} ${stamp}` } });
  expect(cycleResponse.ok(), await cycleResponse.text()).toBeTruthy();
  const cycle = await cycleResponse.json();

  let testcaseIds: string[] = [];
  if (statuses.length > 0) {
    const created = await bulkCreateApprovedTestcases(
      api, projectId,
      statuses.map((_, i) => ({ title: `${namePrefix} Case ${stamp}-${i}` })),
    );
    testcaseIds = created.created.map((c: { id: string }) => c.id);
    const attached = await api.post(`/api/cycles/${cycle.id}/testcases`, { data: { testcaseIds } });
    expect(attached.ok(), await attached.text()).toBeTruthy();

    const executionResponse = await api.get(`/api/cycles/${cycle.id}/executions`);
    expect(executionResponse.ok(), await executionResponse.text()).toBeTruthy();
    const executions = await executionResponse.json();
    expect(executions).toHaveLength(statuses.length);
    for (let i = 0; i < statuses.length; i++) {
      if (statuses[i] === "Untested") continue;
      const updated = await api.patch(`/api/cycles/${cycle.id}/executions/${executions[i].id}`, { data: { status: statuses[i] } });
      expect(updated.ok(), await updated.text()).toBeTruthy();
    }
  }

  return { cycleId: cycle.id as string, testcaseIds };
}

async function cleanUpRun(api: APIRequestContext, cycleId: string, testcaseIds: string[], projectId = ctx.projectId) {
  await api.delete(`/api/cycles/${cycleId}`, { failOnStatusCode: false });
  if (testcaseIds.length > 0) {
    await api.post(`/api/projects/${projectId}/testcases/bulk-delete`, {
      data: { testcaseIds },
      failOnStatusCode: false,
    });
  }
}

/** The Test Runs list card for one run, found by the link to its details page. */
function runCard(page: Page, cycleId: string): Locator {
  return page.locator(`a[href$="/cycles/${cycleId}"]`).locator("xpath=ancestor::div[contains(@class,'p-0')]").first();
}

/** The value of a summary StatTile ("Total Runs", "Pass Rate", "Open Failures", ...) by its label. */
function statTileValue(page: Page, label: string): Locator {
  return page.getByText(label, { exact: true }).locator("xpath=following-sibling::div[1]");
}

/** The value span of a StatPill on the Test Run Details page, by its label. */
function statPillValue(page: Page, label: string): Locator {
  return page
    .locator("section", { hasText: "Skipped" })
    .first()
    .getByText(label, { exact: true })
    .locator("xpath=following-sibling::span[1]");
}

/**
 * The Execution Progress / Pass Rate value on the Test Run Details page, by its label. The two are
 * rendered as separate rows (label span, value span as its sibling) since the fix for "[Test Runs]
 * Pass Rate is Inconsistent Between Test Run Summary and Details" split what used to be one
 * conflated "X% pass rate" line into these two distinct metrics.
 */
function runMetricValue(page: Page, label: "Execution Progress" | "Pass Rate"): Locator {
  return page.getByText(label, { exact: true }).locator("xpath=following-sibling::span[1]");
}

test.describe("Test Runs — Pass Rate and Skipped consistency", () => {
  test("the Run Details page reports Pass Rate and Execution Progress as two distinct numbers", { tag: '@tesbo.testId("TES-TC-1329")' }, async ({
    page,
  }) => {
    const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
    /*
     * Reproduces "[Test Runs] Pass Rate is Inconsistent Between Test Run Summary and Details":
     * this run's Test Run Details page used to read Passed/Total = 5/25 = 20%, while a Test Plan
     * built on the same run read Passed/(Passed+Failed+Blocked) = 5/15 = 33%. Pass Rate is now
     * always the second formula everywhere, and Execution Progress — (Passed+Failed+Blocked+
     * Skipped)/Total = 20/25 = 80% — is its own, separately labelled number rather than being
     * folded into "pass rate".
     */
    const statuses = [
      ...Array(5).fill("Passed"),
      ...Array(5).fill("Failed"),
      ...Array(5).fill("Blocked"),
      ...Array(5).fill("Skipped"),
      ...Array(5).fill("Untested"),
    ];
    const { cycleId, testcaseIds } = await seedRunWithStatuses(api, "E2E PassRate Mixed", statuses);

    try {
      await page.goto(`/projects/${ctx.projectId}/cycles`);
      const card = runCard(page, cycleId);
      await expect(card).toBeVisible();
      await expect(card).toContainText("5 passed");
      await expect(card).toContainText("5 failed");
      await expect(card).toContainText("5 blocked");
      await expect(card).toContainText("5 skipped");
      await expect(card).toContainText("5 untested");
      await expect(card).toContainText("20 / 25 cases");

      await page.goto(`/projects/${ctx.projectId}/cycles/${cycleId}`);
      await expect(statPillValue(page, "Total")).toHaveText("25");
      await expect(statPillValue(page, "Passed")).toHaveText("5");
      await expect(statPillValue(page, "Failed")).toHaveText("5");
      await expect(statPillValue(page, "Blocked")).toHaveText("5");
      await expect(statPillValue(page, "Skipped")).toHaveText("5");
      await expect(statPillValue(page, "Pending")).toHaveText("5");
      await expect(runMetricValue(page, "Execution Progress")).toHaveText("80% executed");
      await expect(runMetricValue(page, "Pass Rate")).toHaveText("33%");
    } finally {
      await cleanUpRun(api, cycleId, testcaseIds);
      await api.dispose();
    }
  });

  test("a run where every case is Skipped shows no pass rate but full execution progress, never NaN", { tag: '@tesbo.testId("TES-TC-1330")' }, async ({
    page,
  }) => {
    const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
    const statuses = Array(5).fill("Skipped");
    const { cycleId, testcaseIds } = await seedRunWithStatuses(api, "E2E PassRate AllSkipped", statuses);

    try {
      await page.goto(`/projects/${ctx.projectId}/cycles`);
      const card = runCard(page, cycleId);
      await expect(card).toContainText("0 passed");
      await expect(card).toContainText("5 skipped");
      await expect(card).toContainText("5 / 5 cases");

      await page.goto(`/projects/${ctx.projectId}/cycles/${cycleId}`);
      // Skipped is neither a pass nor a fail — nothing has settled, so Pass Rate reads "no cases
      // executed" (not 0%, which would claim every case was run and failed). Execution Progress is
      // a real 100%: every case in the run has an outcome, even though none of them settled.
      await expect(runMetricValue(page, "Execution Progress")).toHaveText("100% executed");
      await expect(page.getByText("No cases executed yet")).toBeVisible();
      await expect(statPillValue(page, "Skipped")).toHaveText("5");
    } finally {
      await cleanUpRun(api, cycleId, testcaseIds);
      await api.dispose();
    }
  });

  test("a run with zero assigned cases renders with no breakdown row and does not break the list", { tag: '@tesbo.testId("TES-TC-1331")' }, async ({
    page,
  }) => {
    const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
    const { cycleId, testcaseIds } = await seedRunWithStatuses(api, "E2E PassRate ZeroCases", []);

    try {
      await page.goto(`/projects/${ctx.projectId}/cycles`);
      const card = runCard(page, cycleId);
      await expect(card).toBeVisible();
      await expect(card).not.toContainText("cases");

      await page.goto(`/projects/${ctx.projectId}/cycles/${cycleId}`);
      await expect(statPillValue(page, "Total")).toHaveText("0");
      await expect(page.getByText("No cases executed yet")).toBeVisible();
    } finally {
      await cleanUpRun(api, cycleId, testcaseIds);
      await api.dispose();
    }
  });

  test("the summary Pass Rate tile is Passed over settled cases for the currently filtered runs, matching the Test Plan formula", { tag: '@tesbo.testId("TES-TC-1332")' }, async ({
    page,
  }) => {
    const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
    // The page and comparison request must observe the same owned set. Other specs create and
    // delete Planning runs concurrently in the shared project, so a status filter cannot isolate it.
    const projectResponse = await api.post("/api/projects", { data: { name: `E2E Rate ${Date.now().toString(36)}` } });
    expect(projectResponse.ok(), await projectResponse.text()).toBeTruthy();
    const project = await projectResponse.json();
    const fixtures: Array<{ cycleId: string; testcaseIds: string[] }> = [];

    try {
      const first = await seedRunWithStatuses(api, "E2E Rate Passed", ["Passed", "Untested", "Untested", "Untested"], project.id);
      fixtures.push(first);
      const second = await seedRunWithStatuses(api, "E2E Rate Settled", ["Failed", "Blocked", "Skipped"], project.id);
      fixtures.push(second);
      const excluded = await seedRunWithStatuses(api, "E2E Rate Excluded", ["Passed", "Passed"], project.id);
      fixtures.push(excluded);
      const started = await api.patch(`/api/cycles/${excluded.cycleId}`, { data: { status: "In Progress" } });
      expect(started.ok(), await started.text()).toBeTruthy();

      await page.goto(`/projects/${project.id}/cycles`);
      await page.getByRole("button", { name: "Planning" }).click();
      await expect(runCard(page, first.cycleId)).toBeVisible();
      await expect(runCard(page, second.cycleId)).toBeVisible();
      await expect(runCard(page, excluded.cycleId)).toHaveCount(0);

      // Keep the API-backed formula comparison, with pending/skipped cases excluded from its
      // denominator and an In Progress run excluded by the active filter.
      const runsResponse = await api.get(`/api/projects/${project.id}/cycles`);
      expect(runsResponse.ok(), await runsResponse.text()).toBeTruthy();
      const runs: Array<{ status: string; passed: number; failed: number; blocked: number }> = await runsResponse.json();
      const planningRuns = runs.filter((r) => r.status === "Planning");
      expect(planningRuns).toHaveLength(2);
      const totalPassed = planningRuns.reduce((sum, r) => sum + r.passed, 0);
      const totalFailed = planningRuns.reduce((sum, r) => sum + r.failed, 0);
      const totalBlocked = planningRuns.reduce((sum, r) => sum + r.blocked, 0);
      const settled = totalPassed + totalFailed + totalBlocked;
      const expectedPassRate = settled > 0 ? Math.round((totalPassed / settled) * 100) : null;

      await expect(statTileValue(page, "Total Runs")).toHaveText(String(planningRuns.length));
      await expect(statTileValue(page, "Pass Rate")).toHaveText(
        expectedPassRate !== null ? `${expectedPassRate}%` : "—",
      );
    } finally {
      for (const fixture of fixtures) await cleanUpRun(api, fixture.cycleId, fixture.testcaseIds, project.id);
      await api.delete(`/api/projects/${project.id}`, { failOnStatusCode: false });
      await api.dispose();
    }
  });
});

/*
 * "[Test Run] Priority, Type, and Assignee filters are not available": the run's own test-case
 * table previously exposed only a Status filter. The new filters are applied entirely client-side
 * (app/(app)/projects/[id]/cycles/[cycleId]/page.tsx) against the executions this page already
 * holds in memory — the same mechanism the existing Status tabs and search box already use — so
 * there is no new API surface to cover in e2e/api/; GET /api/cycles/:cycleId/executions is
 * unchanged and its cross-tenant authorization is already covered by api/authorization.spec.ts.
 *
 * Type has no DB-level enum (VARCHAR, free text) and the "Add Test Cases" picker's own canonical
 * Type list doesn't even match the Test Cases page's list, so the run's Type filter options are
 * derived from the data actually on the run rather than a hardcoded list — TC-07/08 below pin that
 * a value outside any "canonical" list is still filterable rather than silently dropped.
 */
test.describe("Test Run — Priority/Type/Assignee filters", () => {
  let api: APIRequestContext;
  let cycleId: string;
  let testcaseIds: string[] = [];
  let executionIds: string[] = [];
  let memberId: string;
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const LEGACY_TYPE = `LegacyImportedType${stamp}`;
  const LEGACY_PRIORITY = "P9Legacy";
  const titles = Array.from({ length: 6 }, (_, i) => `E2E RunFilters ${stamp}-${i}`);

  test.beforeAll(async () => {
    api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
    const cycle = await (
      await api.post(`/api/projects/${ctx.projectId}/cycles`, { data: { name: `E2E RunFilters ${stamp}` } })
    ).json();
    cycleId = cycle.id;

    const members: { userId: string; name: string; email: string }[] = await (
      await api.get(`/api/projects/${ctx.projectId}/members`)
    ).json();
    memberId = members[0].userId;

    // [0] P0/Security, assigned      [1] P1/Functional, assigned    [2] P1/Functional, unassigned
    // [3] P2/Regression, unassigned  [4] legacy priority string     [5] legacy type string
    const created = await bulkCreateApprovedTestcases(api, ctx.projectId, [
      { title: titles[0], priority: "P0", type: "Security" },
      { title: titles[1], priority: "P1", type: "Functional" },
      { title: titles[2], priority: "P1", type: "Functional" },
      { title: titles[3], priority: "P2", type: "Regression" },
      { title: titles[4], priority: LEGACY_PRIORITY, type: "Functional" },
      { title: titles[5], priority: "P2", type: LEGACY_TYPE },
    ]);
    testcaseIds = created.created.map((c: { id: string }) => c.id);
    await api.post(`/api/cycles/${cycleId}/testcases`, { data: { testcaseIds } });

    const executions: { id: string }[] = await (await api.get(`/api/cycles/${cycleId}/executions`)).json();
    executionIds = executions.map((e) => e.id);
    await api.patch(`/api/cycles/${cycleId}/executions/${executionIds[0]}`, { data: { assigneeId: memberId } });
    await api.patch(`/api/cycles/${cycleId}/executions/${executionIds[1]}`, { data: { assigneeId: memberId } });
  });

  test.afterAll(async () => {
    if (api) {
      await cleanUpRun(api, cycleId, testcaseIds);
      await api.dispose();
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(`/projects/${ctx.projectId}/cycles/${cycleId}`);
    await expect(page.getByTestId("run-filter-priority")).toBeVisible();
  });

  test("filtering by Priority alone narrows the table to matching rows", { tag: '@tesbo.testId("TES-TC-2001")' }, async ({ page }) => {
    await page.getByTestId("run-filter-priority").selectOption("P1");
    await expect(page.getByText(titles[1], { exact: true })).toBeVisible();
    await expect(page.getByText(titles[2], { exact: true })).toBeVisible();
    await expect(page.getByText(titles[0], { exact: true })).toHaveCount(0);
    await expect(page.getByText(titles[3], { exact: true })).toHaveCount(0);
  });

  test("filtering by Type alone narrows the table to matching rows", { tag: '@tesbo.testId("TES-TC-2002")' }, async ({ page }) => {
    await page.getByTestId("run-filter-type").selectOption("Security");
    await expect(page.getByText(titles[0], { exact: true })).toBeVisible();
    for (const i of [1, 2, 3, 4, 5]) {
      await expect(page.getByText(titles[i], { exact: true })).toHaveCount(0);
    }
  });

  test("filtering by Assignee narrows the table, including the Unassigned bucket", { tag: '@tesbo.testId("TES-TC-2003")' }, async ({ page }) => {
    await page.getByTestId("run-filter-assignee").selectOption(memberId);
    await expect(page.getByText(titles[0], { exact: true })).toBeVisible();
    await expect(page.getByText(titles[1], { exact: true })).toBeVisible();
    await expect(page.getByText(titles[2], { exact: true })).toHaveCount(0);

    await page.getByTestId("run-filter-assignee").selectOption("__unassigned__");
    await expect(page.getByText(titles[2], { exact: true })).toBeVisible();
    await expect(page.getByText(titles[3], { exact: true })).toBeVisible();
    await expect(page.getByText(titles[0], { exact: true })).toHaveCount(0);
    await expect(page.getByText(titles[1], { exact: true })).toHaveCount(0);
  });

  test("Priority, Type and Assignee combine with AND logic, and with the Status tab and search box", { tag: '@tesbo.testId("TES-TC-2004")' }, async ({ page }) => {
    // Only [1] is P1 + Functional + assigned to the member — [2] is P1/Functional but unassigned,
    // so this pins that the three filters intersect rather than union.
    await page.getByTestId("run-filter-priority").selectOption("P1");
    await page.getByTestId("run-filter-type").selectOption("Functional");
    await page.getByTestId("run-filter-assignee").selectOption(memberId);
    await expect(page.getByText(titles[1], { exact: true })).toBeVisible();
    await expect(page.getByText(titles[2], { exact: true })).toHaveCount(0);

    // Layer the pre-existing Status tab on top: [1]'s execution is still Untested, so the
    // "Failed" tab must hide it even though the three new filters still match it.
    await page.getByRole("button", { name: "Failed", exact: false }).click();
    await expect(page.getByText(titles[1], { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "All", exact: true }).click();

    // And the pre-existing search box on top of that.
    await page.getByPlaceholder("Search test cases…").fill("no-such-case-title");
    await expect(page.getByText(titles[1], { exact: true })).toHaveCount(0);
    await expect(page.getByText("No test cases match")).toBeVisible();
  });

  test("a filter combination with zero matches shows the empty state, not a broken table", { tag: '@tesbo.testId("TES-TC-2005")' }, async ({ page }) => {
    // No seeded case is both P0 and Regression.
    await page.getByTestId("run-filter-priority").selectOption("P0");
    await page.getByTestId("run-filter-type").selectOption("Regression");
    await expect(page.getByText("No test cases match")).toBeVisible();
    await expect(page.getByText("Try adjusting the filter or search query.")).toBeVisible();
    for (const title of titles) {
      await expect(page.getByText(title, { exact: true })).toHaveCount(0);
    }
  });

  test("Clear filters resets all three selects and the affordance disappears", { tag: '@tesbo.testId("TES-TC-2006")' }, async ({ page }) => {
    await page.getByTestId("run-filter-priority").selectOption("P0");
    await page.getByTestId("run-filter-type").selectOption("Security");
    await page.getByTestId("run-filter-assignee").selectOption(memberId);
    const clearButton = page.getByTestId("run-filter-clear");
    await expect(clearButton).toContainText("3");

    await clearButton.click();
    await expect(clearButton).toHaveCount(0);
    await expect(page.getByTestId("run-filter-priority")).toHaveValue("");
    await expect(page.getByTestId("run-filter-type")).toHaveValue("");
    await expect(page.getByTestId("run-filter-assignee")).toHaveValue("");
    for (const title of titles) {
      await expect(page.getByText(title, { exact: true })).toBeVisible();
    }
  });

  test("a Type value outside any canonical list is offered and filterable, not hidden", { tag: '@tesbo.testId("TES-TC-2007")' }, async ({ page }) => {
    const typeSelect = page.getByTestId("run-filter-type");
    await expect(typeSelect.locator("option", { hasText: LEGACY_TYPE })).toHaveCount(1);
    await typeSelect.selectOption(LEGACY_TYPE);
    await expect(page.getByText(titles[5], { exact: true })).toBeVisible();
    for (const i of [0, 1, 2, 3, 4]) {
      await expect(page.getByText(titles[i], { exact: true })).toHaveCount(0);
    }
  });

  test("a Priority value outside P0-P3 is offered and filterable, not hidden", { tag: '@tesbo.testId("TES-TC-2008")' }, async ({ page }) => {
    const prioritySelect = page.getByTestId("run-filter-priority");
    await expect(prioritySelect.locator("option", { hasText: LEGACY_PRIORITY })).toHaveCount(1);
    await prioritySelect.selectOption(LEGACY_PRIORITY);
    await expect(page.getByText(titles[4], { exact: true })).toBeVisible();
    for (const i of [0, 1, 2, 3, 5]) {
      await expect(page.getByText(titles[i], { exact: true })).toHaveCount(0);
    }
  });

  test("filters set on the run table do not leak into the Add Test Cases picker's own filters", { tag: '@tesbo.testId("TES-TC-2009")' }, async ({ page }) => {
    await page.getByTestId("run-filter-priority").selectOption("P0");
    await page.getByRole("button", { name: "Add Test Cases" }).click();
    await expect(page.getByText("Add Test Cases to Run")).toBeVisible();
    // The picker's own Priority select is a separate, un-testid'd <select> distinguished by its
    // own option copy ("P0 - Critical" vs. the run filter's bare "P0") — see filterPriority/
    // runFilterPriority in the page component. It must still read its own default, unaffected by
    // the run-table filter set moments earlier.
    const pickerPrioritySelect = page.locator("select:has(option:text-is('P0 - Critical'))");
    await expect(pickerPrioritySelect).toHaveValue("");
  });

  /*
   * Rapid, effectively-simultaneous filter changes: fired together via Promise.all rather than
   * awaited one at a time, so their change events can interleave at the React-state level. The
   * product code has no debounce/lock around these selects, so the only guarantee worth pinning is
   * that the UI settles on a state consistent with the LAST value of each control — never a stuck
   * or half-applied combination — and stays responsive to further input afterward.
   */
  test("rapid, interleaved filter changes settle to the final selection with no stale intermediate state", { tag: '@tesbo.testId("TES-TC-2010")' }, async ({ page }) => {
    await Promise.all([
      page.getByTestId("run-filter-priority").selectOption("P1"),
      page.getByTestId("run-filter-type").selectOption("Functional"),
      page.getByTestId("run-filter-assignee").selectOption(memberId),
    ]);

    await expect(page.getByTestId("run-filter-priority")).toHaveValue("P1");
    await expect(page.getByTestId("run-filter-type")).toHaveValue("Functional");
    await expect(page.getByTestId("run-filter-assignee")).toHaveValue(memberId);
    // Only [1] satisfies all three at once.
    await expect(page.getByText(titles[1], { exact: true })).toBeVisible();
    await expect(page.getByText(titles[2], { exact: true })).toHaveCount(0);

    // The UI is still responsive — not deadlocked — after the burst: one more change is picked up.
    await page.getByTestId("run-filter-priority").selectOption("");
    await expect(page.getByTestId("run-filter-priority")).toHaveValue("");
    // Type still matches [2] (Functional) but Assignee is still set to the member, and [2] is
    // unassigned — so it stays excluded until Assignee is cleared too, below.
    await expect(page.getByText(titles[2], { exact: true })).toHaveCount(0);

    await page.getByTestId("run-filter-assignee").selectOption("");
    await expect(page.getByText(titles[2], { exact: true })).toBeVisible();
  });
});

/*
 * Feature: setting one status across a multi-selection of the run table.
 *
 * The bulk-status route has accepted a selection since the "bulkStatus() {}" stub was replaced, and
 * `api/execution-ops.spec.ts` covers it at the boundary. What was missing was the frontend half:
 * the multi-select bar offered Remove and Assign only, so the run detail screen could not perform
 * the batch its selection UI implied. These tests drive the control a user actually sees.
 */
test.describe("Test Run — bulk status on a multi-selection", () => {
  let api: APIRequestContext;
  let cycleId: string;
  let testcaseIds: string[] = [];
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  // Titles are asserted as row text; the -0/-1/-2 suffix also gives the SQL aggregate a stable order.
  const titles = Array.from({ length: 3 }, (_, i) => `E2E BulkStatus ${stamp}-${i}`);

  test.beforeAll(async () => {
    api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
    const cycle = await (
      await api.post(`/api/projects/${ctx.projectId}/cycles`, { data: { name: `E2E BulkStatus ${stamp}` } })
    ).json();
    cycleId = cycle.id;

    const created = await bulkCreateApprovedTestcases(api, ctx.projectId, titles.map((title) => ({ title })));
    testcaseIds = created.created.map((c: { id: string }) => c.id);
    await api.post(`/api/cycles/${cycleId}/testcases`, { data: { testcaseIds } });
  });

  test.afterAll(async () => {
    if (api) {
      await cleanUpRun(api, cycleId, testcaseIds);
      await api.dispose();
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(`/projects/${ctx.projectId}/cycles/${cycleId}`);
    await expect(page.getByText(titles[0], { exact: true })).toBeVisible();
  });

  test("setting a status on a multi-selection applies it to exactly those rows and clears the selection", async ({ page }) => {
    await page.getByRole("checkbox", { name: `Select ${titles[0]}` }).check();
    await page.getByRole("checkbox", { name: `Select ${titles[1]}` }).check();
    await expect(page.getByText("2 selected")).toBeVisible();

    await page.getByTestId("run-bulk-status").click();
    // Nothing is applied until a status is chosen; the placeholder must stop an accidental submit.
    const submit = page.getByRole("button", { name: "Set status for 2" });
    await expect(submit).toBeDisabled();
    await page.getByLabel("Status for selected test cases").selectOption("Passed");
    await submit.click();

    // The bar (and the selection it acted on) is gone once the batch lands.
    await expect(page.getByTestId("run-bulk-status")).toHaveCount(0);
    await expect(page.getByLabel("Status for selected test cases")).toHaveCount(0);

    const row = (title: string) => page.locator("tr", { hasText: title });
    await expect(row(titles[0]).getByText("Passed", { exact: true })).toBeVisible();
    await expect(row(titles[1]).getByText("Passed", { exact: true })).toBeVisible();
    await expect(row(titles[2]).getByText("Untested", { exact: true })).toBeVisible();

    // Assert the persisted state, not only the optimistic row update: the whole point of the fix
    // is that the server (not just the screen) received the batch.
    expect(
      scalar(
        "SELECT COALESCE(string_agg(e.status, ',' ORDER BY t.title), '') FROM executions e " +
          "JOIN cycle_items ci ON ci.id = e.cycle_item_id JOIN testcases t ON t.id = ci.testcase_id " +
          `WHERE ci.cycle_id = ${literal(cycleId)};`,
      ),
    ).toBe("Passed,Passed,Untested");
  });

  test("a refused bulk status shows the server message and keeps the selection", async ({ page }) => {
    // Force the failure path the backend owns (an unknown status is a 400) instead of hoping the
    // UI can produce one; the assertion is that the message is surfaced verbatim and the selection
    // survives, so the user can correct it without re-selecting every row.
    await page.route("**/api/cycles/*/executions/bulk-status", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "status must be one of: Untested, Passed, Failed, Blocked, Skipped, Retest" }),
      }),
    );

    await page.getByRole("checkbox", { name: `Select ${titles[2]}` }).check();
    await page.getByTestId("run-bulk-status").click();
    await page.getByLabel("Status for selected test cases").selectOption("Failed");
    await page.getByRole("button", { name: "Set status for 1" }).click();

    await expect(page.getByText(/status must be one of: Untested, Passed, Failed, Blocked/)).toBeVisible();
    await expect(page.getByLabel("Status for selected test cases")).toBeVisible();
    // The refused batch changed nothing: no execution in this run is Failed (the row the earlier
    // test set to Passed legitimately still is, which is why the assertion is not "all Untested").
    expect(
      scalar(
        `SELECT COUNT(*) FROM executions e JOIN cycle_items ci ON ci.id = e.cycle_item_id
         WHERE ci.cycle_id = ${literal(cycleId)} AND e.status = 'Failed';`,
      ),
    ).toBe("0");
  });

  test("a completed run offers no bulk status action", async ({ page }) => {
    // Completed Runs retain result mutation restrictions. Selection now also supports a distinct
    // new retest, so selecting here must expose only that action, never the old mutation controls.
    const completed = await api.patch(`/api/cycles/${cycleId}`, { data: { status: "Completed" } });
    expect(completed.ok(), await completed.text()).toBeTruthy();
    try {
      await page.goto(`/projects/${ctx.projectId}/cycles/${cycleId}`);
      await expect(page.getByText(titles[0], { exact: true })).toBeVisible();
      await page.getByRole("checkbox", { name: `Select ${titles[0]}` }).check();
      await expect(page.getByTestId("run-retest-selected")).toBeVisible();
      await expect(page.getByTestId("run-bulk-status")).toHaveCount(0);
      await expect(page.getByTestId("run-bulk-remove")).toHaveCount(0);
      await expect(page.getByTestId("run-bulk-assign")).toHaveCount(0);
    } finally {
      // Reopen so the next test in the file (and cleanup) sees an editable run.
      await api.patch(`/api/cycles/${cycleId}`, { data: { status: "Planning" } });
    }
  });
});

/*
 * Feature: sorting controls on the run table's ID, Priority and Test Case columns
 * (app/(app)/projects/[id]/cycles/[cycleId]/page.tsx's SortableColumnHeader / runSort /
 * compareExternalId / comparePriority / compareTestCaseTitle). Sorting is entirely client-side
 * over the run's full, already-loaded execution list — applied in the same `filteredExecutions`
 * memo that also drives pagination, so it covers the whole dataset and composes with the existing
 * tab/filter/search, not just the current page.
 */
test.describe("Test Run table — ID/Priority/Test Case column sort", () => {
  let api: APIRequestContext;
  let cycleId: string;
  let testcaseIds: string[] = [];
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  // The trailing digits are the numeric sort key — mirrors the ticket's own "PRO-TC-9 before
  // PRO-TC-10" example. Embedding the stamp before "-TC-<n>" keeps those trailing digits as the
  // LAST run of digits in the string, which is what compareExternalId keys off.
  const idNine = `E2E${stamp}-TC-9`;
  const idTen = `E2E${stamp}-TC-10`;
  const titleNine = `E2E Sort ID Nine ${stamp}`;
  const titleTen = `E2E Sort ID Ten ${stamp}`;
  const prioTitle = {
    P0: `E2E Sort Prio P0 ${stamp}`,
    P1: `E2E Sort Prio P1 ${stamp}`,
    P2: `E2E Sort Prio P2 ${stamp}`,
    P3: `E2E Sort Prio P3 ${stamp}`,
  };
  // Mixed case, chosen so a raw (case-sensitive, ASCII) sort gives a DIFFERENT order than the
  // required case-insensitive one: every uppercase letter sorts below every lowercase letter in
  // plain string comparison, so a naive sort would read "Mango, Zebra, apple" — only a genuinely
  // case-insensitive comparator produces the correct alphabetical "apple, Mango, Zebra".
  const tcTitle = {
    a: `apple Sort TC ${stamp}`,
    m: `Mango Sort TC ${stamp}`,
    z: `Zebra Sort TC ${stamp}`,
  };

  /** Titles from `candidates` that appear in the run table, in the DOM (i.e. on-screen row) order. */
  async function orderedTitles(page: Page, candidates: string[]): Promise<string[]> {
    const rows = await page.locator("tbody tr").all();
    const order: string[] = [];
    for (const row of rows) {
      const text = await row.innerText();
      const match = candidates.find((c) => text.includes(c));
      if (match) order.push(match);
    }
    return order;
  }

  test.beforeAll(async () => {
    api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
    const cycle = await (
      await api.post(`/api/projects/${ctx.projectId}/cycles`, { data: { name: `E2E Sort ${stamp}` } })
    ).json();
    cycleId = cycle.id;

    // Bulk-create's RETURNING order is not guaranteed to match the request payload's order (see the
    // comment on bulkCreateTestCases in legacy.service.ts), so the cycle's own item order below is
    // built by looking each id up by its (unique) title rather than assuming array index alignment.
    const rows = [
      { title: titleTen, status: "Approved", externalId: idTen },
      { title: titleNine, status: "Approved", externalId: idNine },
      // Deliberately scrambled — not already in P0..P3 order — so a passing test can't be
      // accidentally explained by "existing order happens to match".
      { title: prioTitle.P2, status: "Approved", priority: "P2" },
      { title: prioTitle.P0, status: "Approved", priority: "P0" },
      { title: prioTitle.P3, status: "Approved", priority: "P3" },
      { title: prioTitle.P1, status: "Approved", priority: "P1" },
      // Deliberately not in alphabetical (or ASCII) order either, for the same reason as above.
      { title: tcTitle.z, status: "Approved" },
      { title: tcTitle.a, status: "Approved" },
      { title: tcTitle.m, status: "Approved" },
    ];
    const created = await bulkCreateApprovedTestcases(api, ctx.projectId, rows);
    testcaseIds = created.created.map((c) => c.id);
    const idByTitle = new Map(created.created.map((c) => [c.title, c.id]));
    // Added in this exact order, which is what "the existing order" (no sort selected) means below.
    const orderedIds = rows.map((r) => idByTitle.get(r.title)!);
    await api.post(`/api/cycles/${cycleId}/testcases`, { data: { testcaseIds: orderedIds } });
  });

  test.afterAll(async () => {
    if (api) {
      await cleanUpRun(api, cycleId, testcaseIds);
      await api.dispose();
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(`/projects/${ctx.projectId}/cycles/${cycleId}`);
    await expect(page.getByRole("button", { name: "Sort by ID" })).toBeVisible();
  });

  test("no sort selected keeps the existing (item) order", async ({ page }) => {
    // Added as TC-10 then TC-9 (see beforeAll) — a numeric ID sort would show them the other way
    // around, so this pins that neither column is sorted by default.
    await expect.poll(() => orderedTitles(page, [titleTen, titleNine])).toEqual([titleTen, titleNine]);
  });

  test("ID sorts by the numeric portion of the external id, not string order, and toggles direction", { tag: '@tesbo.testId("TES-TC-3010")' }, async ({ page }) => {
    await page.getByRole("button", { name: "Sort by ID" }).click();
    // Ascending, numeric: TC-9 before TC-10 — a plain string sort would put "TC-10" first.
    await expect.poll(() => orderedTitles(page, [titleNine, titleTen])).toEqual([titleNine, titleTen]);
    await expect(page.getByRole("button", { name: "Sort by ID, currently ascending" })).toBeVisible();

    await page.getByRole("button", { name: "Sort by ID, currently ascending" }).click();
    await expect.poll(() => orderedTitles(page, [titleNine, titleTen])).toEqual([titleTen, titleNine]);
    await expect(page.getByRole("button", { name: "Sort by ID, currently descending" })).toBeVisible();
  });

  test("Priority sorts P0 -> P3 (the app's existing convention), and toggles direction", { tag: '@tesbo.testId("TES-TC-3011")' }, async ({ page }) => {
    const ascending = [prioTitle.P0, prioTitle.P1, prioTitle.P2, prioTitle.P3];
    await page.getByRole("button", { name: "Sort by Priority" }).click();
    await expect.poll(() => orderedTitles(page, ascending)).toEqual(ascending);

    await page.getByRole("button", { name: "Sort by Priority, currently ascending" }).click();
    await expect.poll(() => orderedTitles(page, ascending)).toEqual([...ascending].reverse());
  });

  test("Test Case sorts alphabetically by title, case-insensitively, and toggles direction", { tag: '@tesbo.testId("TES-TC-3014")' }, async ({ page }) => {
    const ascending = [tcTitle.a, tcTitle.m, tcTitle.z];
    await page.getByRole("button", { name: "Sort by Test Case" }).click();
    // "apple, Mango, Zebra" — not "Mango, Zebra, apple", which is what a case-sensitive/raw
    // comparison would produce (every uppercase letter sorts below every lowercase one otherwise).
    await expect.poll(() => orderedTitles(page, ascending)).toEqual(ascending);
    await expect(page.getByRole("button", { name: "Sort by Test Case, currently ascending" })).toBeVisible();

    await page.getByRole("button", { name: "Sort by Test Case, currently ascending" }).click();
    await expect.poll(() => orderedTitles(page, ascending)).toEqual([...ascending].reverse());
    await expect(page.getByRole("button", { name: "Sort by Test Case, currently descending" })).toBeVisible();
  });

  test("only one column sorts at a time — selecting another column replaces it", { tag: '@tesbo.testId("TES-TC-3012")' }, async ({ page }) => {
    const idSort = page.getByRole("button", { name: "Sort by ID" });
    await idSort.click();
    await expect(page.getByRole("button", { name: "Sort by ID, currently ascending" })).toBeVisible();

    // Switching to Priority drops the ID sort rather than combining with it — ID's control reads
    // as un-sorted again, and the row order now reflects Priority alone.
    await page.getByRole("button", { name: "Sort by Priority" }).click();
    await expect(page.getByRole("button", { name: "Sort by ID" })).toBeVisible();
    const prioAscending = [prioTitle.P0, prioTitle.P1, prioTitle.P2, prioTitle.P3];
    await expect.poll(() => orderedTitles(page, prioAscending)).toEqual(prioAscending);

    // And switching from Priority to Test Case behaves the same way: Priority's control reads as
    // un-sorted again, and the row order now reflects Test Case alone.
    await page.getByRole("button", { name: "Sort by Test Case" }).click();
    await expect(page.getByRole("button", { name: "Sort by Priority" })).toBeVisible();
    const tcAscending = [tcTitle.a, tcTitle.m, tcTitle.z];
    await expect.poll(() => orderedTitles(page, tcAscending)).toEqual(tcAscending);
  });

  test("the sort order is preserved after the table is narrowed by a search term", { tag: '@tesbo.testId("TES-TC-3013")' }, async ({ page }) => {
    await page.getByRole("button", { name: "Sort by Priority" }).click();
    await page.getByPlaceholder("Search test cases…").fill("E2E Sort Prio");

    const ascending = [prioTitle.P0, prioTitle.P1, prioTitle.P2, prioTitle.P3];
    await expect.poll(() => orderedTitles(page, ascending)).toEqual(ascending);
    // And the ID-only cases are correctly filtered out, not merely re-ordered to the bottom.
    await expect(page.getByText(titleNine, { exact: true })).toHaveCount(0);
    await expect(page.getByText(titleTen, { exact: true })).toHaveCount(0);
  });

  test("Test Case sort composes with a search term the same way Priority's does", { tag: '@tesbo.testId("TES-TC-3015")' }, async ({ page }) => {
    await page.getByRole("button", { name: "Sort by Test Case" }).click();
    await page.getByPlaceholder("Search test cases…").fill("Sort TC");

    const ascending = [tcTitle.a, tcTitle.m, tcTitle.z];
    await expect.poll(() => orderedTitles(page, ascending)).toEqual(ascending);
    // The ID/Priority-only cases are filtered out, not merely re-ordered to the bottom.
    await expect(page.getByText(titleNine, { exact: true })).toHaveCount(0);
    await expect(page.getByText(prioTitle.P0, { exact: true })).toHaveCount(0);
  });
});

/*
 * "Test Run shows fewer test cases than Test Case Repository": the repository screen treats a
 * selected suite as itself plus every suite nested under it (includeDescendants, see
 * loadSelectedSuiteCases in app/(app)/projects/[id]/testcases/page.tsx), but the Add Test Cases
 * picker's own suite filter matched only `tc.suiteId === filterSuiteId` — an approved case filed
 * under a CHILD suite of the one selected was silently excluded, so a suite the repository reported
 * as (for example) 170 approved cases offered only 165 in the picker. Fixed by having the picker
 * walk the already-loaded flat suite list to build the same subtree the repository's
 * includeDescendants produces server-side.
 */
test.describe("Add Test Cases picker — suite filter", () => {
  test("selecting a parent suite also offers Approved cases filed under its child suite", { tag: '@tesbo.testId("TES-TC-2013")' }, async ({ page }) => {
    const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
    const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    let cycleId = "";
    let parentSuiteId = "";
    let childSuiteId = "";
    let testcaseIds: string[] = [];
    try {
      const parentSuiteName = `E2E Picker Parent ${stamp}`;
      const parentSuite = await (
        await api.post(`/api/projects/${ctx.projectId}/suites`, { data: { name: parentSuiteName } })
      ).json();
      parentSuiteId = parentSuite.id;
      const childSuite = await (
        await api.post(`/api/projects/${ctx.projectId}/suites`, {
          data: { name: `E2E Picker Child ${stamp}`, parentId: parentSuiteId },
        })
      ).json();
      childSuiteId = childSuite.id;

      const parentCaseTitle = `E2E Picker Parent Case ${stamp}`;
      const childCaseTitle = `E2E Picker Child Case ${stamp}`;
      const created = await bulkCreateApprovedTestcases(api, ctx.projectId, [
        { title: parentCaseTitle, suiteId: parentSuiteId },
        { title: childCaseTitle, suiteId: childSuiteId },
      ]);
      testcaseIds = created.created.map((c: { id: string }) => c.id);

      const cycle = await (
        await api.post(`/api/projects/${ctx.projectId}/cycles`, { data: { name: `E2E Picker Suite Filter ${stamp}` } })
      ).json();
      cycleId = cycle.id;

      await page.goto(`/projects/${ctx.projectId}/cycles/${cycleId}`);
      await page.getByRole("button", { name: "Add Test Cases" }).click();
      await expect(page.getByText("Add Test Cases to Run")).toBeVisible();

      const suiteSelect = page.locator("select:has(option:text-is('All Suites'))");
      await suiteSelect.selectOption({ label: parentSuiteName });

      // The regression: filtering to the PARENT suite must also surface the approved case filed
      // directly under its CHILD suite, not just the parent's own case.
      await expect(page.getByText(parentCaseTitle, { exact: true })).toBeVisible();
      await expect(page.getByText(childCaseTitle, { exact: true })).toBeVisible();
      await expect(page.getByText("0 of 2 selectable selected", { exact: true })).toBeVisible();
    } finally {
      if (cycleId) await api.delete(`/api/cycles/${cycleId}`, { failOnStatusCode: false });
      if (testcaseIds.length > 0) {
        await api.post(`/api/projects/${ctx.projectId}/testcases/bulk-delete`, {
          data: { testcaseIds },
          failOnStatusCode: false,
        });
      }
      if (childSuiteId) await api.delete(`/api/suites/${childSuiteId}`, { failOnStatusCode: false });
      if (parentSuiteId) await api.delete(`/api/suites/${parentSuiteId}`, { failOnStatusCode: false });
      await api.dispose();
    }
  });
});

test.describe("Test Run filters — concurrent updates, pagination boundary, and zero-case runs", () => {
  test("an execution reassigned by a concurrent caller is reflected correctly under the Assignee filter after reload", { tag: '@tesbo.testId("TES-TC-2011")' }, async ({ page }) => {
    const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
    const { cycleId, testcaseIds } = await seedRunWithStatuses(api, "E2E RunFiltersRace", ["Untested"]);
    try {
      const members: { userId: string }[] = await (
        await api.get(`/api/projects/${ctx.projectId}/members`)
      ).json();
      const memberId = members[0].userId;
      const executionsBefore: { id: string; title: string }[] = await (
        await api.get(`/api/cycles/${cycleId}/executions`)
      ).json();
      const title = executionsBefore[0].title;

      await page.goto(`/projects/${ctx.projectId}/cycles/${cycleId}`);
      await page.getByTestId("run-filter-assignee").selectOption("__unassigned__");
      await expect(page.getByText(title, { exact: true })).toBeVisible();

      // Simulated second tab / concurrent caller reassigning the same execution while this one
      // is filtered to "Unassigned" — the page took a single snapshot on load and does not poll.
      const executions: { id: string }[] = await (await api.get(`/api/cycles/${cycleId}/executions`)).json();
      await api.patch(`/api/cycles/${cycleId}/executions/${executions[0].id}`, { data: { assigneeId: memberId } });

      await page.reload();
      await page.getByTestId("run-filter-assignee").selectOption("__unassigned__");
      await expect(page.getByText("No test cases match")).toBeVisible();

      await page.getByTestId("run-filter-assignee").selectOption(memberId);
      await expect(page.getByText("No test cases match")).toHaveCount(0);
    } finally {
      await cleanUpRun(api, cycleId, testcaseIds);
      await api.dispose();
    }
  });

  test("applying a filter that leaves fewer results than the current page resets to page 1", { tag: '@tesbo.testId("TES-TC-2012")' }, async ({ page }) => {
    const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
    const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const cycle = await (
      await api.post(`/api/projects/${ctx.projectId}/cycles`, { data: { name: `E2E RunFiltersPage ${stamp}` } })
    ).json();
    const cycleId = cycle.id as string;
    // 11 cases at P2 (page size is 10, so this run spans two pages) plus one P1 case that lands
    // last, i.e. alone on page 2 in the default unfiltered order.
    const rows = [
      ...Array.from({ length: 11 }, (_, i) => ({ title: `E2E RunFiltersPage ${stamp}-${i}`, priority: "P2", status: "Approved" })),
      { title: `E2E RunFiltersPage ${stamp}-lone-p1`, priority: "P1", status: "Approved" },
    ];
    const created = await bulkCreateApprovedTestcases(api, ctx.projectId, rows);
    const testcaseIds: string[] = created.created.map((c: { id: string }) => c.id);
    try {
      await api.post(`/api/cycles/${cycleId}/testcases`, { data: { testcaseIds } });

      await page.goto(`/projects/${ctx.projectId}/cycles/${cycleId}`);
      await expect(page.getByText("Page 1 of 2")).toBeVisible();
      await page.getByRole("button", { name: "Next page" }).click();
      await expect(page.getByText("Page 2 of 2")).toBeVisible();
      await expect(page.getByText(`${stamp}-lone-p1`)).toBeVisible();

      // Filtering to P1 leaves exactly one match — the page must not stay stuck on the now
      // out-of-range page 2, which would render nothing despite a real match existing.
      await page.getByTestId("run-filter-priority").selectOption("P1");
      await expect(page.getByText(`${stamp}-lone-p1`)).toBeVisible();
      await expect(page.getByText(/Page \d+ of \d+/)).toHaveCount(0); // pageCount is 1: pager hides
      await expect(page.getByText(/Showing 1.1 of 1 cases/)).toBeVisible();
    } finally {
      await cleanUpRun(api, cycleId, testcaseIds);
      await api.dispose();
    }
  });

  test("the filter controls render without error on a run with zero test cases", { tag: '@tesbo.testId("TES-TC-2013")' }, async ({ page }) => {
    const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
    const { cycleId, testcaseIds } = await seedRunWithStatuses(api, "E2E RunFiltersEmpty", []);
    try {
      await page.goto(`/projects/${ctx.projectId}/cycles/${cycleId}`);
      await expect(page.getByText(/No test cases added yet/)).toBeVisible();
      // The Type option list is derived from the (empty) executions array — this run has no test
      // cases, so it must render as just its "All types" default with no crash. Assignee's list is
      // the project's member roster (loaded independently of the run), so only its two fixed
      // entries are pinned, not an exact total.
      await expect(page.getByTestId("run-filter-type").locator("option")).toHaveCount(1);
      await expect(page.getByTestId("run-filter-assignee").locator("option", { hasText: "All assignees" })).toHaveCount(1);
      await expect(page.getByTestId("run-filter-assignee").locator("option", { hasText: "Unassigned" })).toHaveCount(1);
      await page.getByTestId("run-filter-priority").selectOption("P0");
      await expect(page.getByText(/No test cases added yet/)).toBeVisible();
    } finally {
      await cleanUpRun(api, cycleId, testcaseIds);
      await api.dispose();
    }
  });
});

/*
 * Schedule Run — the form and its "Run At" validation.
 *
 * Schedules are persisted in cycle_run_schedules; the worker creates a new Test Run for each
 * occurrence (api/execution-ops.spec.ts EXO-A-08b covers that side). What only the browser can show
 * is here: the field must never send a past instant, and a valid submit must produce a row that is
 * still there after the list reloads.
 */
test.describe("Schedule Run — the form and Run At validation", () => {
  let cycleId: string;
  let cycleName: string;

  test.beforeAll(async () => {
    const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
    try {
      cycleName = `E2E ScheduleRunAt ${Date.now()}`;
      const cycle = await (
        await api.post(`/api/projects/${ctx.projectId}/cycles`, { data: { name: cycleName } })
      ).json();
      cycleId = cycle.id;
    } finally {
      await api.dispose();
    }
  });

  test.afterAll(async () => {
    const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
    try {
      await api.delete(`/api/cycles/${cycleId}`, { failOnStatusCode: false });
    } finally {
      await api.dispose();
    }
  });

  /** The "Test Run" select isn't tied to its label via for/id, so this walks the DOM structure. */
  const testRunSelect = (page: Page) =>
    page.locator('xpath=//label[normalize-space(text())="Test Run"]/following-sibling::select');

  async function openSchedule(browserPage: Page) {
    await browserPage.goto(`/projects/${ctx.projectId}/cycles`);
    await browserPage.getByRole("link", { name: "Schedule", exact: true }).click();
    await expect(browserPage).toHaveURL(/\/cycles\/schedule$/);
  }

  test("a past Run At is blocked client-side with an inline error, before any request is sent", { tag: '@tesbo.testId("TES-TC-2203")' }, async ({ page }) => {
    let scheduleRequestSent = false;
    await page.route("**/api/projects/*/cycles/schedules", async (route) => {
      if (route.request().method() === "POST") scheduleRequestSent = true;
      await route.continue();
    });

    await openSchedule(page);
    await page.getByPlaceholder("Nightly Smoke").fill(`E2E Past Run At ${Date.now()}`);
    await testRunSelect(page).selectOption({ label: cycleName });
    // A clearly past datetime-local value — not merely a different day, to also cover "today with
    // an earlier time" would need the current clock; a full year in the past is unambiguous either way.
    await page.locator('input[type="datetime-local"]').fill("2020-01-01T00:00");
    await page.getByRole("button", { name: "Create Schedule" }).click();

    await expect(page.getByText("Date and time must be in future")).toBeVisible();
    expect(scheduleRequestSent, "a past Run At must never reach the server").toBe(false);
  });

  test("a future Run At creates a schedule that survives the list reload", { tag: '@tesbo.testId("TES-TC-2204")' }, async ({ page }) => {
    const scheduleName = `E2E Future Run At ${Date.now()}`;
    await openSchedule(page);
    await page.getByPlaceholder("Nightly Smoke").fill(scheduleName);
    await testRunSelect(page).selectOption({ label: cycleName });
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const futureValue = `${future.getFullYear()}-${pad(future.getMonth() + 1)}-${pad(future.getDate())}T${pad(future.getHours())}:${pad(future.getMinutes())}`;
    await page.locator('input[type="datetime-local"]').fill(futureValue);
    await page.getByRole("button", { name: "Create Schedule" }).click();

    // The reloaded list must contain it. A create that only clears the form and then vanishes is the
    // precise failure the old stub produced.
    await expect(page.getByRole("cell", { name: scheduleName })).toBeVisible();

    const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
    try {
      const rows = await (await api.get(`/api/projects/${ctx.projectId}/cycles/schedules`)).json();
      expect(rows.map((row: { name: string }) => row.name)).toContain(scheduleName);
    } finally {
      await api.dispose();
    }
  });

  test("a daily schedule is stored as a local rule and shows it in the list", { tag: '@tesbo.testId("TES-TC-2206")' }, async ({ page }) => {
    const scheduleName = `E2E Daily ${Date.now()}`;
    await openSchedule(page);
    await page.getByPlaceholder("Nightly Smoke").fill(scheduleName);
    await page.getByRole("combobox", { name: "Test Run" }).selectOption({ label: cycleName });
    await page.getByRole("combobox", { name: "Schedule Type" }).selectOption("daily");
    await page.getByLabel("Local time").fill("09:00");
    await page.getByRole("button", { name: "Create Schedule" }).click();

    // The list names the local rule, including the zone it is local to.
    await expect(page.getByRole("row", { name: new RegExp(scheduleName) })).toContainText("Daily at 09:00");

    const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
    try {
      const rows = await (await api.get(`/api/projects/${ctx.projectId}/cycles/schedules`)).json();
      expect(rows.find((row: { name: string }) => row.name === scheduleName)).toMatchObject({
        scheduleType: "daily",
        localTime: "09:00"
      });
    } finally {
      await api.dispose();
    }
  });

  test("a schedule is edited and run on demand from the list", { tag: '@tesbo.testId("TES-TC-2207")' }, async ({ page }) => {
    const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
    const originalName = `E2E EditRun ${Date.now()}`;
    const editedName = `${originalName} edited`;
    let scheduleId = "";
    let createdCycleId = "";
    try {
      const created = await api.post(`/api/projects/${ctx.projectId}/cycles/schedules`, {
        data: { name: originalName, cycleId, scheduleType: "daily", localTime: "09:00", timezone: "America/New_York" }
      });
      expect(created.status(), await created.text()).toBe(201);
      scheduleId = (await created.json()).id;

      await page.goto(`/projects/${ctx.projectId}/cycles/schedule`);
      const row = page.getByRole("row", { name: new RegExp(originalName) });
      await expect(row).toContainText("Daily at 09:00");
      await row.getByRole("button", { name: "Edit" }).click();
      await page.getByLabel("Edit schedule name").fill(editedName);
      await page.getByLabel("Edit local time").fill("10:30");
      await page.getByRole("button", { name: "Save schedule" }).click();
      await expect(page.getByRole("status")).toContainText("Schedule updated.");

      const editedRow = page.getByRole("row", { name: new RegExp(editedName) });
      await expect(editedRow).toContainText("Daily at 10:30");
      await editedRow.getByRole("button", { name: "Run now" }).click();
      await expect(page.getByRole("status")).toContainText("Created run");
      // The notice links to the run it created instead of only naming it.
      await expect(
        page.getByRole("status").getByRole("link", { name: new RegExp(`${cycleName} — scheduled`) })
      ).toBeVisible();

      const cycles = await (await api.get(`/api/projects/${ctx.projectId}/cycles`)).json();
      const spawned = (Array.isArray(cycles) ? cycles : cycles.rows ?? []).find((item: { name: string }) =>
        item.name.startsWith(`${cycleName} — scheduled`)
      );
      expect(spawned, "Run now must create a new Test Run").toBeTruthy();
      createdCycleId = spawned.id;
    } finally {
      if (createdCycleId) await api.delete(`/api/cycles/${createdCycleId}`, { failOnStatusCode: false });
      if (scheduleId) await api.delete(`/api/cycles/schedules/${scheduleId}`, { failOnStatusCode: false });
      await api.dispose();
    }
  });

  test("a past Run At shows the inline error as soon as it's picked, before Create Schedule is clicked", { tag: '@tesbo.testId("TES-TC-2205")' }, async ({ page }) => {
    let scheduleRequestSent = false;
    await page.route("**/api/projects/*/cycles/schedules", async (route) => {
      if (route.request().method() === "POST") scheduleRequestSent = true;
      await route.continue();
    });

    await openSchedule(page);
    await page.getByPlaceholder("Nightly Smoke").fill(`E2E Inline Past Run At ${Date.now()}`);
    await testRunSelect(page).selectOption({ label: cycleName });
    await page.locator('input[type="datetime-local"]').fill("2020-01-01T00:00");

    // No submit click here — the error must appear from the field's own onChange.
    await expect(page.getByText("Date and time must be in future")).toBeVisible();
    expect(scheduleRequestSent, "a past Run At must never reach the server").toBe(false);

    // Correcting to a future value clears the inline error immediately too, still without submitting.
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const futureValue = `${future.getFullYear()}-${pad(future.getMonth() + 1)}-${pad(future.getDate())}T${pad(future.getHours())}:${pad(future.getMinutes())}`;
    await page.locator('input[type="datetime-local"]').fill(futureValue);
    await expect(page.getByText("Date and time must be in future")).toBeHidden();
    expect(scheduleRequestSent, "still no request from correcting the field alone").toBe(false);
  });
});

/*
 * Hard-delete remediation, Phase 1 ("Zyra Workflow Agents/hard-delete-remediation-progress-log.md")
 * — deleting a run through the UI drives the exact same DELETE /api/cycles/:id the API-level test
 * in api/cycles.spec.ts exercises directly, and that behavior is unchanged by this phase (design
 * point 7 of the phase-gate inspection: deleting a run must keep looking instant and identical to
 * today from the UI's point of view). This is the product-surface half of that same fix: a person
 * clicking Delete still sees the run vanish from the list, while the row underneath now survives,
 * soft-deleted, instead of being destroyed outright.
 */
test.describe("deleting a run from the UI (hard-delete remediation Phase 1)", () => {
  test("deleting a run through the runs list removes its card, and the row survives soft-deleted underneath", async ({ page }) => {
    const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
    const name = `E2E UI Delete Run ${Date.now()}`;
    let cycleId = "";
    try {
      const cycle = await (await api.post(`/api/projects/${ctx.projectId}/cycles`, { data: { name } })).json();
      cycleId = cycle.id;

      await page.goto(`/projects/${ctx.projectId}/cycles`);
      await expect(page.getByText(name, { exact: true })).toBeVisible();

      await runCard(page, cycleId).getByTitle("Delete run").click();
      await expect(page.getByText("Delete Test Run")).toBeVisible();
      await page.getByRole("button", { name: "Delete", exact: true }).click();

      // Gone from the list — the same observable behavior as before this fix.
      await expect(page.getByRole("heading", { name: "Delete Test Run", exact: true })).toBeHidden();
      await expect(runCard(page, cycleId)).toHaveCount(0);

      // Database-visible: the row survived, soft-deleted, rather than vanishing outright.
      expect(
        scalar(`SELECT deleted_at IS NOT NULL FROM cycles WHERE id = ${literal(cycleId)};`),
        "the run must survive soft-deleted, not be hard-deleted",
      ).toBe("t");
    } finally {
      if (cycleId) await api.delete(`/api/cycles/${cycleId}`, { failOnStatusCode: false });
      await api.dispose();
    }
  });
});

/*
 * "Test Environment dropdown shows no options": project settings -> Test Environments saves into
 * projects.settings.testRunEnvironments, and GET /api/projects/:id hands `settings` back in whichever
 * jsonb shape it was stored in: a parsed OBJECT (written by a PATCH with an object, or by any jsonb_set
 * such as the Zyra agent config) or a JSON STRING (what the settings screen itself PATCHes). The Test
 * Runs and Test Plan create-run dropdowns only understood the string form, so every project whose
 * settings were stored as an object showed a dropdown with just "Select environment" and could never
 * create a run. Both shapes are seeded here, each in its own disposable project so the shared project's
 * settings (read by other specs) are never touched.
 */
test.describe("Test Environment dropdown: runs list and test plan", () => {
  const ENVS = [
    { name: "Staging", url: "https://staging.example.com" },
    { name: "Production", url: "https://prod.example.com" },
  ];
  let api: APIRequestContext;
  const projectIds: string[] = [];

  test.beforeAll(async () => {
    api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
  });
  test.afterAll(async () => {
    for (const id of projectIds) await api.delete(`/api/projects/${id}`, { failOnStatusCode: false });
    await api.dispose();
  });

  /** A fresh project whose settings are PATCHed as `settings` (object => stored as a jsonb object, string => jsonb string). */
  async function seedProject(settings: unknown): Promise<string> {
    const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const response = await api.post("/api/projects", { data: { name: `E2E Env ${stamp}` } });
    expect(response.ok(), await response.text()).toBeTruthy();
    const created = await response.json();
    projectIds.push(created.id);
    if (settings !== undefined) {
      const res = await api.patch(`/api/projects/${created.id}`, { data: { settings } });
      expect(res.ok(), await res.text()).toBeTruthy();
    }
    return created.id;
  }

  /** The create/edit run modals render without role="dialog", so find the select by its placeholder option. */
  const envSelect = (page: Page) =>
    page.locator("select").filter({ has: page.locator("option", { hasText: "Select environment" }) });
  const optionNames = async (page: Page) => (await envSelect(page).locator("option").allTextContents()).map((t) => t.trim());

  const SHAPES: Array<[string, () => unknown]> = [
    ["an object", () => ({ testRunEnvironments: ENVS })],
    ["a JSON string (as the settings screen saves it)", () => JSON.stringify({ testRunEnvironments: ENVS })],
  ];
  for (const [shape, settings] of SHAPES) {
    test(`Create Test Run lists the configured environments and persists the choice (settings stored as ${shape})`, async ({ page }) => {
      const projectId = await seedProject(settings());
      await page.goto(`/projects/${projectId}/cycles?create=1`);
      await expect(envSelect(page)).toBeVisible();
      await expect.poll(() => optionNames(page)).toEqual(["Select environment", "Staging", "Production"]);

      const runName = `E2E EnvRun ${Date.now()}`;
      await page.locator('form input[type="text"]').first().fill(runName);
      // Nothing chosen yet: the form must not be submittable.
      await expect(page.getByRole("button", { name: "Create Test Run", exact: true })).toBeDisabled();
      await envSelect(page).selectOption("Production");
      await expect(page.getByText("URL: https://prod.example.com")).toBeVisible();
      await page.getByRole("button", { name: "Create Test Run", exact: true }).click();
      await expect(page.getByText(runName, { exact: true })).toBeVisible();

      const runs: { name: string; environment: string }[] = await (await api.get(`/api/projects/${projectId}/cycles`)).json();
      expect(runs.find((r) => r.name === runName)?.environment).toBe("Production");
    });
  }

  test("with no environments configured the dropdown is empty, Create is disabled, and the hint links to the Test Environments tab", async ({ page }) => {
    const projectId = await seedProject(undefined);
    await page.goto(`/projects/${projectId}/cycles?create=1`);
    await expect.poll(() => optionNames(page)).toEqual(["Select environment"]);
    await page.locator('form input[type="text"]').first().fill("E2E EnvRun none");
    await expect(page.getByRole("button", { name: "Create Test Run", exact: true })).toBeDisabled();
    await expect(page.locator("form").getByRole("link", { name: "Project settings", exact: true })).toHaveAttribute("href", /settings\?tab=testRuns/);
  });

  test("entries without a name or URL, and repeated names, are not offered", async ({ page }) => {
    const projectId = await seedProject({
      testRunEnvironments: [
        { name: "Good", url: "https://good.example.com" },
        { name: "NoUrl", url: "   " },
        { name: "  ", url: "https://blank-name.example.com" },
        { name: "Good", url: "https://dup.example.com" },
        null,
      ],
    });
    await page.goto(`/projects/${projectId}/cycles?create=1`);
    await expect.poll(() => optionNames(page)).toEqual(["Select environment", "Good"]);
  });

  test("a project whose settings carry unrelated keys (icon, zyraAgent) still lists its environments", async ({ page }) => {
    const projectId = await seedProject({ testRunEnvironments: ENVS, zyraAgent: { testcaseCount: 3 }, testcaseIdPrefix: "ENV" });
    await api.patch(`/api/projects/${projectId}`, { data: { icon: { color: "#7C5FCC", glyph: "E" } } });
    await page.goto(`/projects/${projectId}/cycles?create=1`);
    await expect.poll(() => optionNames(page)).toEqual(["Select environment", "Staging", "Production"]);
  });

  test("Edit Test Run keeps a since-removed environment selectable as (legacy) next to the current ones", async ({ page }) => {
    const projectId = await seedProject({ testRunEnvironments: ENVS });
    const name = `E2E EnvLegacy ${Date.now()}`;
    const run = await (
      await api.post(`/api/projects/${projectId}/cycles`, { data: { name, environment: "Retired" } })
    ).json();
    await page.goto(`/projects/${projectId}/cycles`);
    await runCard(page, run.id).getByTitle("Edit run").click();
    await expect.poll(() => optionNames(page)).toEqual(["Select environment", "Retired (legacy)", "Staging", "Production"]);
    await expect(envSelect(page)).toHaveValue("Retired");
    await envSelect(page).selectOption("Staging");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(runCard(page, run.id)).toContainText("Staging");
    const runs: { id: string; environment: string }[] = await (await api.get(`/api/projects/${projectId}/cycles`)).json();
    expect(runs.find((r) => r.id === run.id)?.environment).toBe("Staging");
  });

  test("an environment added in project settings appears in the dropdown on the next visit", async ({ page }) => {
    const projectId = await seedProject({ testRunEnvironments: [ENVS[0]] });
    await page.goto(`/projects/${projectId}/cycles?create=1`);
    await expect.poll(() => optionNames(page)).toEqual(["Select environment", "Staging"]);
    await api.patch(`/api/projects/${projectId}`, { data: { settings: { testRunEnvironments: ENVS } } });
    await page.reload();
    await expect.poll(() => optionNames(page)).toEqual(["Select environment", "Staging", "Production"]);
  });

  test("Test Plan -> Create test run offers the same environments and persists the choice", async ({ page }) => {
    const projectId = await seedProject({ testRunEnvironments: ENVS });
    const plan = await (await api.post(`/api/projects/${projectId}/plans`, { data: { name: `E2E EnvPlan ${Date.now()}` } })).json();
    await page.goto(`/projects/${projectId}/plans/${plan.id}`);
    await page.getByRole("button", { name: "Create test run" }).click();
    await expect.poll(() => optionNames(page)).toEqual(["Select environment", "Staging", "Production"]);
    // The plan form pre-selects the first environment; the user can still switch.
    await envSelect(page).selectOption("Production");
    const runName = `E2E EnvPlanRun ${Date.now()}`;
    await page.locator('form input[type="text"]').first().fill(runName);
    await page.getByRole("button", { name: "Create Test Run", exact: true }).click();
    await expect(page.getByText(runName, { exact: true })).toBeVisible();
    const runs: { name: string; environment: string }[] = await (await api.get(`/api/projects/${projectId}/cycles`)).json();
    expect(runs.find((r) => r.name === runName)?.environment).toBe("Production");
  });

  test("Test Plan -> Create test run with no environments configured shows the hint and cannot submit", async ({ page }) => {
    const projectId = await seedProject(undefined);
    const plan = await (await api.post(`/api/projects/${projectId}/plans`, { data: { name: `E2E EnvPlanNone ${Date.now()}` } })).json();
    await page.goto(`/projects/${projectId}/plans/${plan.id}`);
    await page.getByRole("button", { name: "Create test run" }).click();
    await expect(page.getByText("No environments configured in project settings.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create Test Run", exact: true })).toBeDisabled();
  });
});

/*
 * Test Runs list: the whole run card opens the run, not just the name and the arrow icon. The name
 * link is stretched over the card (::after), with the edit/delete controls lifted above it.
 */
test.describe("run card is one click target", () => {
  test("clicking blank space or the results row opens the run, while Edit still opens its own dialog", async ({ page }) => {
    const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
    const { cycleId, testcaseIds } = await seedRunWithStatuses(api, "E2E Card Click", ["Passed", "Failed", "Untested"]);
    try {
      const resolvedResponse = await api.get("/api/route-resolve", { params: { project: ctx.projectId, cycle: cycleId } });
      expect(resolvedResponse.ok(), await resolvedResponse.text()).toBeTruthy();
      const resolved = await resolvedResponse.json();
      expect(resolved.projectId).toBe(ctx.projectId);
      expect(resolved.cycleId).toBe(cycleId);
      expect(resolved.projectKey).toBeTruthy();
      expect(resolved.cycleRef).toBeTruthy();
      const listUrl = `/projects/${resolved.projectKey}/cycles`;
      const runPath = `${listUrl}/${resolved.cycleRef}`;
      await page.goto(listUrl);
      const card = runCard(page, cycleId);
      await expect(card).toContainText("1 passed");
      const box = (await card.boundingBox())!;

      // Bottom-left of the card is the progress / counts strip: nothing there was a link before.
      await card.click({ position: { x: 40, y: box.height - 12 } });
      await expect.poll(() => new URL(page.url()).pathname).toBe(runPath);

      // Right of the header row, clear of the action icons and the name.
      await page.goto(listUrl);
      await runCard(page, cycleId).click({ position: { x: (box.width * 2) / 3, y: 20 } });
      await expect.poll(() => new URL(page.url()).pathname).toBe(runPath);

      // The pencil is above the stretched link: it opens the edit form and does not navigate.
      await page.goto(listUrl);
      await runCard(page, cycleId).getByTitle("Edit run").click();
      await expect.poll(() => new URL(page.url()).pathname).toBe(listUrl);
      await expect(page.getByRole("button", { name: /Save/i }).first()).toBeVisible();
    } finally {
      await cleanUpRun(api, cycleId, testcaseIds);
      await api.dispose();
    }
  });
});

// A run carried over from another tool keeps its time spent and tags, and each result keeps its step
// outcomes, earlier results and stack trace. A plain manual result must look exactly as it did.
test.describe("imported run history in the UI", () => {
  test("the runs list and the run header show time spent and tags", async ({ page }) => {
    const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
    const { cycleId, testcaseIds } = await seedRunWithStatuses(api, "E2E UI History", ["Passed"]);
    try {
      const tag = `ui-tag-${Date.now()}`;
      const res = await api.post(`/api/cycles/${cycleId}/history-import`, {
        data: { run: { timeSpentMs: 2 * 86_400_000 + 3 * 3_600_000, tags: [tag, "second tag"] } },
      });
      expect(res.ok(), await res.text()).toBeTruthy();

      await page.goto(`/projects/${ctx.projectId}/cycles`);
      const card = runCard(page, cycleId);
      await expect(card.getByTestId("run-time-spent")).toContainText("2d 3h");
      await expect(card.getByTestId("run-tags")).toContainText(tag);
      await expect(card.getByTestId("run-tags")).toContainText("second tag");

      await page.goto(`/projects/${ctx.projectId}/cycles/${cycleId}`);
      await expect(page.getByTestId("run-time-spent")).toContainText("2d 3h");
      await expect(page.getByTestId("run-tags")).toContainText(tag);
    } finally {
      await cleanUpRun(api, cycleId, testcaseIds);
      await api.dispose();
    }
  });

  test("a result's drawer shows step results, earlier results and the stack trace; a plain result shows none of it", async ({ page }) => {
    const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
    const { cycleId, testcaseIds } = await seedRunWithStatuses(api, "E2E UI History Drawer", ["Passed", "Passed"]);
    try {
      const rows = await (await api.get(`/api/cycles/${cycleId}/executions`)).json();
      const imported = rows.find((r: { testcaseId: string }) => r.testcaseId === testcaseIds[0]);
      const plain = rows.find((r: { testcaseId: string }) => r.testcaseId === testcaseIds[1]);
      const res = await api.post(`/api/cycles/${cycleId}/history-import`, {
        data: {
          results: [
            {
              testcaseId: testcaseIds[0],
              status: "Failed",
              executedAt: "2024-03-08T09:30:00Z",
              durationMs: 2100,
              errorStack: "TypeError: x is undefined\n    at checkout (cart.js:42:7)",
              stepResults: [
                { position: 1, status: "Passed" },
                { position: 2, status: "Failed", comment: "button missing from the page" },
              ],
              history: [{ status: "Retest", executedAt: "2024-03-08T09:00:00Z", comment: "first attempt note" }],
            },
          ],
        },
      });
      expect(res.ok(), await res.text()).toBeTruthy();

      await page.goto(`/projects/${ctx.projectId}/cycles/${cycleId}`);
      await page.getByText(imported.title).first().click();
      const meta = page.getByTestId("result-meta");
      await expect(meta).toBeVisible();
      await expect(meta.getByText("2.1s")).toBeVisible();
      await expect(meta.getByText(/Executed 08 Mar 2024/)).toBeVisible();

      const steps = meta.getByTestId("result-step-results");
      await expect(steps).toContainText("Step 1");
      await expect(steps).toContainText("Step 2");
      await expect(steps).toContainText("button missing from the page");

      // Collapsed until asked for.
      await expect(meta.getByTestId("result-stack")).toBeHidden();
      await meta.getByText("Stack trace").click();
      await expect(meta.getByTestId("result-stack")).toContainText("at checkout (cart.js:42:7)");

      await meta.getByText(/Earlier results \(1\)/).click();
      await expect(meta.getByTestId("result-history")).toContainText("first attempt note");

      // Close the drawer, open the plain result: nothing extra.
      await page.keyboard.press("Escape");
      await page.getByText(plain.title).first().click();
      await expect(page.getByText(plain.title).first()).toBeVisible();
      await expect(page.getByTestId("result-meta")).toHaveCount(0);
    } finally {
      await cleanUpRun(api, cycleId, testcaseIds);
      await api.dispose();
    }
  });
});

test.describe("native manual retest — reviewed selection and recovery", () => {
  async function fixture(api: APIRequestContext, withEvidence = false, projectId = ctx.projectId, caseFields: Record<string, unknown> = {}) {
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const name = `E2E Original manual observation ${stamp}`;
    const created = await bulkCreateApprovedTestcases(api, projectId, [0, 1].map(index => ({
      title: `E2E Retest checkout ${stamp}-${index}`,
      preconditions: "A test customer has one item in the cart.",
      testData: "One synthetic item, quantity 1",
      steps: JSON.stringify([{ action: "Confirm the order", expectedResult: "The receipt shows the saved order number." }]),
      ...caseFields,
    })));
    const testcaseIds = created.created.map(item => item.id);
    const response = await api.post(`/api/projects/${projectId}/cycles`, {
      data: { name, environment: "Manual QA", buildVersion: "before-fix" },
    });
    expect(response.status(), await response.text()).toBe(201);
    const cycleId = (await response.json()).id as string;
    const added = await api.post(`/api/cycles/${cycleId}/testcases`, { data: { testcaseIds } });
    expect(added.ok(), await added.text()).toBeTruthy();
    const rows = await (await api.get(`/api/cycles/${cycleId}/executions`)).json();
    const execution = rows.find((row: { testcaseId: string }) => row.testcaseId === testcaseIds[0]);
    const actualResult = `Original observation ${stamp}: the order number is missing.`;
    const result = await api.patch(`/api/cycles/${cycleId}/executions/${execution.id}`, { data: { status: "Failed", actualResult } });
    expect(result.ok(), await result.text()).toBeTruthy();
    let bugId: string | undefined;
    if (withEvidence) {
      const upload = await api.post(`/api/cycles/${cycleId}/executions/${execution.id}/attachments`, {
        multipart: { files: { name: "original-order.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==", "base64") } },
      });
      expect(upload.ok(), await upload.text()).toBeTruthy();
      const bug = await api.post(`/api/projects/${projectId}/bugs`, {
        data: { title: `E2E Original order defect ${stamp}`, links: [{ testcaseId: testcaseIds[0], cycleId, executionId: execution.id }] },
      });
      expect(bug.ok(), await bug.text()).toBeTruthy();
      bugId = (await bug.json()).id;
    }
    return { projectId, cycleId, testcaseIds, executionId: execution.id as string, title: execution.title as string, name, actualResult, bugId };
  }

  async function children(api: APIRequestContext, cycleId: string): Promise<Array<{ id: string; name: string }>> {
    const response = await api.get(`/api/cycles/${cycleId}/retests`);
    expect(response.status(), await response.text()).toBe(200);
    return response.json();
  }

  async function cleanup(api: APIRequestContext, source: Awaited<ReturnType<typeof fixture>>) {
    for (const child of await children(api, source.cycleId)) await api.delete(`/api/cycles/${child.id}`, { failOnStatusCode: false });
    if (source.bugId) await api.delete(`/api/bugs/${source.bugId}`, { failOnStatusCode: false });
    await cleanUpRun(api, source.cycleId, source.testcaseIds, source.projectId);
    await api.dispose();
  }

  async function openPreview(page: Page, source: Awaited<ReturnType<typeof fixture>>) {
    await page.goto(`/projects/${source.projectId}/cycles/${source.cycleId}`);
    await expect(page.getByRole("heading", { name: source.name, exact: true })).toBeVisible();
    await page.getByRole("checkbox", { name: `Select ${source.title}`, exact: true }).check();
    await page.getByTestId("run-retest-selected").click();
    return page.getByRole("dialog", { name: "Create retest", exact: true });
  }

  async function tabTo(page: Page, control: Locator, options: { backwards?: boolean; within?: Locator } = {}) {
    for (let count = 0; count < 80; count += 1) {
      if (await control.evaluate(element => document.activeElement === element)) return;
      await page.keyboard.press(options.backwards ? "Shift+Tab" : "Tab");
      if (options.within) expect(await options.within.evaluate(element => element.contains(document.activeElement))).toBe(true);
    }
    await expect(control).toBeFocused();
  }

  async function savedIntent(page: Page, sourceCycleId: string) {
    return page.evaluate(sourceId => {
      const stored = Object.entries(localStorage).find(([key]) => key.startsWith("tesbo:retest:") && key.endsWith(`:${sourceId}`));
      return stored ? { key: stored[0], value: JSON.parse(stored[1]) } : null;
    }, sourceCycleId);
  }

  test("creates only the selected Untested occurrence and navigates its preserved source evidence by keyboard", async ({ page }, testInfo) => {
    const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
    const source = await fixture(api, true);
    try {
      const original = await (await api.get(`/api/cycles/${source.cycleId}/executions`)).json();
      const dialog = await openPreview(page, source);
      await expect(dialog.getByText("Source result: Failed", { exact: true })).toBeVisible();
      await expect(dialog.getByText(source.actualResult, { exact: true })).toBeVisible();
      await expect(dialog).toContainText("1 evidence file · 1 defect link");
      const targetName = `Retest after fix ${source.cycleId}`;
      await dialog.getByLabel("Run name", { exact: true }).fill(targetName);
      await dialog.getByLabel("Environment", { exact: true }).fill("Manual QA after fix");
      await dialog.getByLabel("Build to test", { exact: true }).fill("after-fix");
      await testInfo.attach("native-retest-reviewed-selection", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
      const create = dialog.getByRole("button", { name: "Create retest", exact: true });
      await expect(create).toBeEnabled();
      await create.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("heading", { name: targetName, exact: true })).toBeVisible();
      const created = await children(api, source.cycleId);
      expect(created).toHaveLength(1);
      const targetId = created[0].id;
      const newRows = await (await api.get(`/api/cycles/${targetId}/executions`)).json();
      expect(newRows).toHaveLength(1);
      expect(newRows[0]).toMatchObject({ testcaseId: source.testcaseIds[0], status: "Untested" });
      expect(newRows[0].actualResult || "").toBe("");
      expect(await (await api.get(`/api/cycles/${source.cycleId}/executions`)).json()).toEqual(original);
      await expect(page.getByTestId("run-retest-origin")).toContainText(source.name);
      await testInfo.attach("native-retest-new-untested-run", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
      await page.getByRole("button", { name: source.title, exact: true }).click();
      await expect(page.getByTestId("retest-source-observation")).toContainText(source.actualResult);
      await expect(page.getByTestId("retest-source-observation")).toContainText("1 prior evidence file · 1 prior defect link");
      await testInfo.attach("native-retest-source-observation-drawer", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
      await page.keyboard.press("Escape");
      await page.goto(`/projects/${ctx.projectId}/cycles/${targetId}/execute/${newRows[0].id}`);
      const observation = page.getByTestId("retest-source-observation");
      await expect(observation).toContainText("Failed");
      await testInfo.attach("native-retest-source-observation-full-page", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
      await observation.getByRole("link").focus();
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("retest-source-observation")).toHaveCount(0);
      await expect(page.locator("textarea")).toHaveValue(source.actualResult);
      await expect(page.getByRole("img", { name: "original-order.png" })).toBeVisible();
      await page.goto(`/projects/${ctx.projectId}/cycles/${source.cycleId}`);
      await expect(page.getByTestId("run-retests").getByRole("link", { name: new RegExp(targetName) })).toBeVisible();
    } finally { await cleanup(api, source); }
  });

  test("failed lineage and preview reads remain errors and recover with a real fresh preview", async ({ page }) => {
    const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
    const source = await fixture(api);
    let failList = true, failPreview = true;
    try {
      await page.route(`**/api/cycles/${source.cycleId}/retests`, async route => {
        if (route.request().method() === "GET" && failList) await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Lineage service unavailable" }) });
        else await route.continue();
      });
      await page.route(`**/api/cycles/${source.cycleId}/retests/preview?*`, async route => {
        if (failPreview) await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Selected observations unavailable" }) });
        else await route.continue();
      });
      const dialog = await openPreview(page, source);
      await expect(dialog.getByRole("alert")).toHaveText("Selected observations unavailable");
      await expect(dialog.getByRole("button", { name: "Create retest", exact: true })).toBeDisabled();
      await expect(page.getByTestId("run-retests")).toContainText("Retests are unavailable");
      await expect(page.getByTestId("run-retests")).not.toContainText("No retests recorded");
      failPreview = false;
      await dialog.getByRole("button", { name: "Reload preview", exact: true }).click();
      await expect(dialog.getByText("Source result: Failed", { exact: true })).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Create retest", exact: true })).toBeEnabled();
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      failList = false;
      await page.getByRole("button", { name: "Retry retests", exact: true }).click();
      await expect(page.getByTestId("run-retests")).toContainText("No retests recorded");
      expect(await children(api, source.cycleId)).toEqual([]);
    } finally { await cleanup(api, source); }
  });

  test("a lost creation response survives reload and reads the original receipt without another POST", async ({ page }) => {
    const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
    const source = await fixture(api);
    let posts = 0;
    let allowLookup = false;
    let savedBeforePost: Record<string, unknown> | null = null;
    let posted: Record<string, unknown> | null = null;
    try {
      await page.route(`**/api/cycles/${source.cycleId}/retests`, async route => {
        if (route.request().method() !== "POST") { await route.continue(); return; }
        posts += 1;
        posted = route.request().postDataJSON();
        savedBeforePost = await page.evaluate(sourceId => {
          const stored = Object.entries(localStorage).find(([key]) => key.startsWith("tesbo:retest:") && key.endsWith(`:${sourceId}`));
          return stored ? JSON.parse(stored[1]).request : null;
        }, source.cycleId);
        const committed = await route.fetch();
        expect(committed.status(), await committed.text()).toBe(201);
        await route.abort("failed");
      });
      await page.route(`**/api/cycles/${source.cycleId}/retests/requests/*`, async route => {
        if (allowLookup) await route.continue();
        else await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Receipt lookup temporarily unavailable" }) });
      });
      const dialog = await openPreview(page, source);
      await expect(dialog.getByRole("button", { name: "Create retest", exact: true })).toBeEnabled();
      await dialog.getByRole("button", { name: "Create retest", exact: true }).click();
      await expect(dialog.getByRole("button", { name: "Retry saved request", exact: true })).toBeEnabled();
      await expect(dialog).toContainText("Receipt lookup temporarily unavailable");
      expect(savedBeforePost).toEqual(posted);
      expect(posts).toBe(1);
      allowLookup = true;
      await page.reload();
      const banner = page.getByTestId("retest-recovery-banner");
      await expect(banner).toContainText("Your saved retest request was created.");
      const created = await children(api, source.cycleId);
      expect(created).toHaveLength(1);
      await banner.getByRole("button", { name: "Open retest", exact: true }).click();
      await expect(page.getByRole("heading", { name: created[0].name, exact: true })).toBeVisible();
      expect(posts).toBe(1);
      expect(await children(api, source.cycleId)).toHaveLength(1);
    } finally { await cleanup(api, source); }
  });

  test("a lost response recovers after the source is deleted and its readable URL is reloaded", async ({ page }, testInfo) => {
    const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
    const source = await fixture(api);
    const targetName = `Recovered retest after source deletion ${source.cycleId}`;
    const committedIds = new Set<string>();
    let targetId = "", requestKey = "";
    let posts = 0, receiptReads = 0, unavailableReads = 0;
    let allowLookup = false, sourceDeleted = false;
    let releaseSourceReads!: () => void;
    const sourceReadGate = new Promise<void>(resolve => { releaseSourceReads = resolve; });
    try {
      await page.route(`**/api/cycles/${source.cycleId}/retests`, async route => {
        if (route.request().method() !== "POST") { await route.continue(); return; }
        posts += 1;
        requestKey = route.request().postDataJSON().requestKey;
        const committed = await route.fetch();
        expect(committed.status(), await committed.text()).toBe(201);
        targetId = (await committed.json()).cycleId;
        committedIds.add(targetId);
        await route.abort("failed");
      });
      await page.route(`**/api/cycles/${source.cycleId}/retests/requests/*`, async route => {
        if (!allowLookup) {
          await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Receipt lookup temporarily unavailable" }) });
          return;
        }
        const response = await route.fetch();
        expect(response.status(), await response.text()).toBe(200);
        expect(await response.json()).toMatchObject({ cycleId: targetId, sourceCycleId: source.cycleId, requestKey, available: true });
        receiptReads += 1;
        await route.fulfill({ response });
      });
      await page.route(new RegExp(`/api/cycles/${source.cycleId}(?:/executions)?(?:\\?.*)?$`), async route => {
        if (route.request().method() !== "GET" || !sourceDeleted) { await route.continue(); return; }
        const response = await route.fetch();
        expect(response.status(), await response.text()).toBe(404);
        unavailableReads += 1;
        // Return the real source errors after receipt recovery. Its confirmation must survive
        // the loading-to-unavailable transition even though its saved intent was already cleared.
        await sourceReadGate;
        await route.fulfill({ response });
      });
      const dialog = await openPreview(page, source);
      await expect(page).toHaveURL(/\/cycles\/[^/]+-RUN-\d+$/);
      const sourceUrl = page.url();
      await dialog.getByLabel("Run name", { exact: true }).fill(targetName);
      await expect(dialog.getByRole("button", { name: "Create retest", exact: true })).toBeEnabled();
      await dialog.getByRole("button", { name: "Create retest", exact: true }).click();
      await expect(dialog.getByRole("button", { name: "Retry saved request", exact: true })).toBeEnabled();
      await expect(dialog).toContainText("Receipt lookup temporarily unavailable");
      expect(posts).toBe(1);
      expect(committedIds.size).toBe(1);
      const deleted = await api.delete(`/api/cycles/${source.cycleId}`);
      expect(deleted.ok(), await deleted.text()).toBeTruthy();
      expect((await api.get(`/api/cycles/${source.cycleId}`)).status()).toBe(404);
      sourceDeleted = true;
      allowLookup = true;
      await page.reload();
      await expect(page).toHaveURL(sourceUrl);
      const banner = page.getByTestId("retest-recovery-banner");
      await expect(banner).toContainText("Your saved retest request was created.");
      expect(receiptReads).toBeGreaterThan(0);
      await expect.poll(() => unavailableReads).toBeGreaterThan(0);
      releaseSourceReads();
      await expect(page.getByRole("region", { name: "Run unavailable", exact: true })).toBeVisible();
      await expect(banner).toContainText("Your saved retest request was created.");
      await expect(page.getByTestId("run-retest-selected")).toHaveCount(0);
      await testInfo.attach("native-retest-deleted-source-recovery", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
      await banner.getByRole("button", { name: "Open retest", exact: true }).click();
      await expect(page.getByRole("heading", { name: targetName, exact: true })).toBeVisible();
      const target = await api.get(`/api/cycles/${targetId}`);
      expect(target.status(), await target.text()).toBe(200);
      expect(await target.json()).toMatchObject({ id: targetId, name: targetName, retestSourceCycleId: source.cycleId });
      const rows = await (await api.get(`/api/cycles/${targetId}/executions`)).json();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ testcaseId: source.testcaseIds[0], status: "Untested" });
      expect(posts).toBe(1);
      expect(committedIds.size).toBe(1);
    } finally {
      releaseSourceReads();
      for (const id of committedIds) await api.delete(`/api/cycles/${id}`, { failOnStatusCode: false });
      await cleanUpRun(api, source.cycleId, source.testcaseIds);
      await api.dispose();
    }
  });

  test("a 404 recovery read keeps uncertainty and explicit retry uses the identical request", async ({ page }) => {
    const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
    const source = await fixture(api);
    const posted: Array<Record<string, unknown>> = [];
    try {
      await page.route(`**/api/cycles/${source.cycleId}/retests`, async route => {
        if (route.request().method() !== "POST") { await route.continue(); return; }
        posted.push(route.request().postDataJSON());
        if (posted.length === 1) await route.abort("failed");
        else await route.continue();
      });
      const dialog = await openPreview(page, source);
      await expect(dialog.getByRole("button", { name: "Create retest", exact: true })).toBeEnabled();
      await dialog.getByRole("button", { name: "Create retest", exact: true }).click();
      await expect(dialog).toContainText("The earlier request may still be running");
      await expect(dialog.getByRole("button", { name: "Retry saved request", exact: true })).toBeEnabled();
      expect(await children(api, source.cycleId)).toEqual([]);
      await dialog.getByRole("button", { name: "Retry saved request", exact: true }).click();
      const createdName = String(posted[0].name);
      await expect(page.getByRole("heading", { name: createdName, exact: true })).toBeVisible();
      expect(posted).toHaveLength(2);
      expect(posted[1]).toEqual(posted[0]);
      expect(await children(api, source.cycleId)).toHaveLength(1);
    } finally { await cleanup(api, source); }
  });

  test("a stale uncertain request can be stopped before a fresh reviewed request uses a new key", async ({ page }, testInfo) => {
    const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
    const source = await fixture(api);
    const posted: Array<Record<string, unknown>> = [];
    const stopBodies: Array<Record<string, unknown>> = [];
    try {
      await page.route(`**/api/cycles/${source.cycleId}/retests`, async route => {
        if (route.request().method() !== "POST") { await route.continue(); return; }
        posted.push(route.request().postDataJSON());
        if (posted.length === 1) await route.abort("failed");
        else await route.continue();
      });
      await page.route(`**/api/cycles/${source.cycleId}/retests/requests/*/cancel`, async route => {
        stopBodies.push(route.request().postDataJSON());
        const response = await route.fetch();
        expect(response.ok(), await response.text()).toBeTruthy();
        expect((await response.json()).outcome).toBe("cancelled");
        await route.fulfill({ response });
      });
      const dialog = await openPreview(page, source);
      await expect(dialog.getByRole("button", { name: "Create retest", exact: true })).toBeEnabled();
      await dialog.getByRole("button", { name: "Create retest", exact: true }).click();
      await expect(dialog).toContainText("The earlier request may still be running");
      expect(await children(api, source.cycleId)).toEqual([]);
      const endpoint = `/api/projects/${source.projectId}/testcases/${source.testcaseIds[0]}`;
      const current = await (await api.get(endpoint)).json();
      const changedTitle = `${source.title} reviewed after uncertainty`;
      const changed = await api.put(endpoint, { data: { title: changedTitle, expectedRevision: current.editRevision } });
      expect(changed.ok(), await changed.text()).toBeTruthy();
      const approved = await approveTestcase(api, source.projectId, source.testcaseIds[0]);
      const retryResponse = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === `/api/cycles/${source.cycleId}/retests`);
      await dialog.getByRole("button", { name: "Retry saved request", exact: true }).click();
      expect((await retryResponse).status()).toBe(409);
      await expect(dialog.getByRole("button", { name: "Stop request and review again", exact: true })).toBeEnabled();
      expect(posted[1]).toEqual(posted[0]);
      expect((await savedIntent(page, source.cycleId))?.value.request).toEqual(posted[0]);
      await dialog.getByRole("button", { name: "Stop request and review again", exact: true }).click();
      await expect(dialog).toContainText("This saved request was stopped. It cannot create a Run");
      expect(stopBodies).toEqual([posted[0]]);
      expect(await savedIntent(page, source.cycleId)).toBeNull();
      const stopped = await api.get(`/api/cycles/${source.cycleId}/retests/requests/${posted[0].requestKey}`);
      expect(stopped.status(), await stopped.text()).toBe(200);
      expect(await stopped.json()).toMatchObject({ outcome: "cancelled", projectId: source.projectId, sourceCycleId: source.cycleId, requestKey: posted[0].requestKey });
      const late = await api.post(`/api/cycles/${source.cycleId}/retests`, { data: posted[0], failOnStatusCode: false });
      expect(late.status(), await late.text()).toBe(409);
      expect((await late.json()).code).toBe("RETEST_REQUEST_CANCELLED");
      expect(await children(api, source.cycleId)).toEqual([]);
      await dialog.getByRole("button", { name: "Review again", exact: true }).click();
      await expect(dialog.getByRole("region", { name: "Current approved definition", exact: true })).toContainText(changedTitle);
      await expect(dialog.getByRole("button", { name: "Create retest", exact: true })).toBeDisabled();
      const targetName = `Fresh reviewed retest ${source.cycleId}`;
      await dialog.getByLabel("Run name", { exact: true }).fill(targetName);
      await dialog.getByRole("checkbox", { name: "I reviewed the definition differences and want to retest the current approved definitions.", exact: true }).check();
      await testInfo.attach("native-retest-fresh-review-after-stop", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
      await dialog.getByRole("button", { name: "Create retest", exact: true }).click();
      await expect(page.getByRole("heading", { name: targetName, exact: true })).toBeVisible();
      expect(posted).toHaveLength(3);
      expect(posted[2].requestKey).not.toBe(posted[0].requestKey);
      const created = await children(api, source.cycleId);
      expect(created).toHaveLength(1);
      const target = await (await api.get(`/api/cycles/${created[0].id}`)).json();
      expect(target.retestManifest.occurrences[0]).toMatchObject({ sourceExecutionId: source.executionId, targetApprovalRevision: approved.approvalRevision });
    } finally { await cleanup(api, source); }
  });

  test("a lost stop response retains the intent until reload reads its exact cancellation", async ({ page }) => {
    const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
    const source = await fixture(api);
    let posts = 0, stops = 0;
    let allowLookup = false;
    let original: Record<string, unknown> = {};
    try {
      await page.route(`**/api/cycles/${source.cycleId}/retests`, async route => {
        if (route.request().method() !== "POST") { await route.continue(); return; }
        posts += 1;
        original = route.request().postDataJSON();
        await route.abort("failed");
      });
      await page.route(`**/api/cycles/${source.cycleId}/retests/requests/*`, async route => {
        if (allowLookup) await route.continue();
        else await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Outcome lookup temporarily unavailable" }) });
      });
      await page.route(`**/api/cycles/${source.cycleId}/retests/requests/*/cancel`, async route => {
        stops += 1;
        expect(route.request().postDataJSON()).toEqual(original);
        const response = await route.fetch();
        expect(response.ok(), await response.text()).toBeTruthy();
        expect((await response.json()).outcome).toBe("cancelled");
        await route.abort("failed");
      });
      const dialog = await openPreview(page, source);
      await expect(dialog.getByRole("button", { name: "Create retest", exact: true })).toBeEnabled();
      await dialog.getByRole("button", { name: "Create retest", exact: true }).click();
      await expect(dialog.getByRole("button", { name: "Stop request and review again", exact: true })).toBeEnabled();
      await dialog.getByRole("button", { name: "Stop request and review again", exact: true }).click();
      await expect(dialog).toContainText("Outcome lookup temporarily unavailable");
      await expect(dialog.getByRole("button", { name: "Check outcome", exact: true })).toBeEnabled();
      expect((await savedIntent(page, source.cycleId))?.value.request).toEqual(original);
      expect(await children(api, source.cycleId)).toEqual([]);
      allowLookup = true;
      await page.reload();
      await expect(page.getByTestId("retest-recovery-banner")).toContainText("Your saved retest request was stopped.");
      expect(await savedIntent(page, source.cycleId)).toBeNull();
      expect(posts).toBe(1);
      expect(stops).toBe(1);
      const late = await api.post(`/api/cycles/${source.cycleId}/retests`, { data: original, failOnStatusCode: false });
      expect(late.status(), await late.text()).toBe(409);
      expect((await late.json()).code).toBe("RETEST_REQUEST_CANCELLED");
      expect(await children(api, source.cycleId)).toEqual([]);
    } finally { await cleanup(api, source); }
  });

  test("stopping a request that already created a retest recovers that destination", async ({ page }) => {
    const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
    const source = await fixture(api);
    let posts = 0, stops = 0;
    let targetId = "";
    try {
      await page.route(`**/api/cycles/${source.cycleId}/retests`, async route => {
        if (route.request().method() !== "POST") { await route.continue(); return; }
        posts += 1;
        const response = await route.fetch();
        expect(response.status(), await response.text()).toBe(201);
        targetId = (await response.json()).cycleId;
        await route.abort("failed");
      });
      await page.route(`**/api/cycles/${source.cycleId}/retests/requests/*`, route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Outcome lookup temporarily unavailable" }) }));
      await page.route(`**/api/cycles/${source.cycleId}/retests/requests/*/cancel`, async route => {
        stops += 1;
        const response = await route.fetch();
        expect(response.ok(), await response.text()).toBeTruthy();
        expect(await response.json()).toMatchObject({ outcome: "created", cycleId: targetId });
        await route.fulfill({ response });
      });
      const dialog = await openPreview(page, source);
      await expect(dialog.getByRole("button", { name: "Create retest", exact: true })).toBeEnabled();
      await dialog.getByRole("button", { name: "Create retest", exact: true }).click();
      await expect(dialog.getByRole("button", { name: "Stop request and review again", exact: true })).toBeEnabled();
      await dialog.getByRole("button", { name: "Stop request and review again", exact: true }).click();
      await expect(dialog.getByRole("button", { name: "Open retest", exact: true })).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Review again", exact: true })).toHaveCount(0);
      expect(await savedIntent(page, source.cycleId)).toBeNull();
      await dialog.getByRole("button", { name: "Open retest", exact: true }).click();
      await expect(page.getByTestId("run-retest-origin")).toContainText(source.name);
      const created = await children(api, source.cycleId);
      expect(created).toHaveLength(1);
      expect(created[0].id).toBe(targetId);
      expect(posts).toBe(1);
      expect(stops).toBe(1);
    } finally { await cleanup(api, source); }
  });

  for (const hintPersistence of ["available", "write-failure", "readback-failure"] as const) {
    test(`a deleted source with no server outcome reloads only through its current user's pending intent${hintPersistence === "available" ? "" : ` after hint ${hintPersistence}`}`, async ({ page, browser }) => {
      const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
      const source = await fixture(api);
      let posts = 0;
      let original: Record<string, unknown> = {};
      let holdResolution = true;
      let releaseResolution!: () => void;
      const resolutionGate = new Promise<void>(resolve => { releaseResolution = resolve; });
      const withoutIntent = await browser.newContext({ baseURL: env.webBaseUrl, storageState: STATE_PATH });
      try {
        await page.route("**/api/route-resolve?*", async route => {
          if (!holdResolution || new URL(route.request().url()).searchParams.get("cycle") !== source.cycleId) { await route.continue(); return; }
          const response = await route.fetch();
          expect(response.status(), await response.text()).toBe(200);
          await resolutionGate;
          await route.fulfill({ response });
        });
        await page.route(`**/api/cycles/${source.cycleId}/retests`, async route => {
          if (route.request().method() !== "POST") { await route.continue(); return; }
          posts += 1;
          original = route.request().postDataJSON();
          await route.abort("failed");
        });
        const dialog = await openPreview(page, source);
        await expect(page).toHaveURL(new RegExp(`/cycles/${source.cycleId}$`));
        const uuidUrl = page.url();
        await expect(dialog.getByRole("button", { name: "Create retest", exact: true })).toBeEnabled();
        await dialog.getByRole("button", { name: "Create retest", exact: true }).click();
        await expect(dialog).toContainText("The earlier request may still be running");
        const originalIntent = await savedIntent(page, source.cycleId);
        expect(originalIntent?.value.routeHint).toEqual({ projectRef: source.projectId, cycleRef: source.cycleId });
        if (hintPersistence !== "available") {
          // The initial durable request already exists. Fail only its later URL-hint enrichment,
          // either before the write or during readback after the real storage write succeeded.
          await page.evaluate(({ storageKey, sourceId, failureMode }) => {
            const originalSet = Storage.prototype.setItem;
            const originalGet = Storage.prototype.getItem;
            const state = {
              writes: 0, readbacks: 0, failNextRead: false,
              restore() { Storage.prototype.setItem = originalSet; Storage.prototype.getItem = originalGet; },
            };
            (window as unknown as { retestHintStorageFault: typeof state }).retestHintStorageFault = state;
            Storage.prototype.setItem = function(key, value) {
              if (this === localStorage && key === storageKey && JSON.parse(value).routeHint?.cycleRef !== sourceId) {
                state.writes += 1;
                if (failureMode === "write-failure") throw new DOMException("Hint storage write unavailable", "QuotaExceededError");
                originalSet.call(this, key, value);
                state.failNextRead = true;
                return;
              }
              originalSet.call(this, key, value);
            };
            Storage.prototype.getItem = function(key) {
              if (this === localStorage && key === storageKey && state.failNextRead) {
                state.failNextRead = false;
                state.readbacks += 1;
                throw new DOMException("Hint storage readback unavailable", "SecurityError");
              }
              return originalGet.call(this, key);
            };
          }, { storageKey: originalIntent!.key, sourceId: source.cycleId, failureMode: hintPersistence });
        }
        // Canonicalization can finish after the uncertain POST. Enrich only its route hint; the
        // original request must remain unchanged for cancellation and exact replay.
        holdResolution = false;
        releaseResolution();
        if (hintPersistence === "available") {
          await expect(page).toHaveURL(/\/cycles\/[^/]+-RUN-\d+$/);
        } else {
          await expect.poll(() => page.evaluate(() => (window as unknown as { retestHintStorageFault: { writes: number } }).retestHintStorageFault.writes)).toBeGreaterThan(0);
          if (hintPersistence === "readback-failure") {
            expect(await page.evaluate(() => (window as unknown as { retestHintStorageFault: { readbacks: number } }).retestHintStorageFault.readbacks)).toBeGreaterThan(0);
          }
          await expect(page).toHaveURL(uuidUrl);
          await page.evaluate(() => (window as unknown as { retestHintStorageFault: { restore: () => void } }).retestHintStorageFault.restore());
        }
        const sourceUrl = page.url();
        const saved = await savedIntent(page, source.cycleId);
        expect(saved?.value.request).toEqual(original);
        expect(saved?.value).toMatchObject({
          version: originalIntent!.value.version, userId: originalIntent!.value.userId,
          projectId: source.projectId, sourceCycleId: source.cycleId,
        });
        if (hintPersistence === "write-failure") expect(saved).toEqual(originalIntent);
        else {
          expect(saved?.value.routeHint.cycleRef).toMatch(/-RUN-\d+$/);
          if (hintPersistence === "available") expect(saved?.value.routeHint).toEqual({
            projectRef: decodeURIComponent(new URL(sourceUrl).pathname.split("/")[2]),
            cycleRef: decodeURIComponent(new URL(sourceUrl).pathname.split("/")[4]),
          });
        }
        expect(await children(api, source.cycleId)).toEqual([]);
        const deleted = await api.delete(`/api/cycles/${source.cycleId}`);
        expect(deleted.ok(), await deleted.text()).toBeTruthy();
        const resolveQuery = new URLSearchParams({ project: saved!.value.routeHint.projectRef, cycle: saved!.value.routeHint.cycleRef });
        expect((await api.get(`/api/route-resolve?${resolveQuery}`)).status()).toBe(404);

        // A readable URL keeps the resolver's not-found UI; UUID URLs can mount the unavailable
        // Run without a hint. Neither browser may discover another user's pending recovery state.
        const otherPage = await withoutIntent.newPage();
        await otherPage.goto(sourceUrl);
        if (hintPersistence === "available") await expect(otherPage.getByRole("heading", { name: "Page not found", exact: true })).toBeVisible();
        else await expect(otherPage.getByRole("region", { name: "Run unavailable", exact: true })).toBeVisible();
        await expect(otherPage.getByTestId("retest-recovery-banner")).toHaveCount(0);
        const foreignUser = "00000000-0000-4000-8000-000000000099";
        await otherPage.evaluate(({ savedValue, foreignId }) => {
          localStorage.setItem(`tesbo:retest:${foreignId}:${savedValue.projectId}:${savedValue.sourceCycleId}`, JSON.stringify({ ...savedValue, userId: foreignId }));
        }, { savedValue: saved!.value, foreignId: foreignUser });
        await otherPage.reload();
        if (hintPersistence === "available") await expect(otherPage.getByRole("heading", { name: "Page not found", exact: true })).toBeVisible();
        else await expect(otherPage.getByRole("region", { name: "Run unavailable", exact: true })).toBeVisible();
        await expect(otherPage.getByTestId("retest-recovery-banner")).toHaveCount(0);

        await page.reload();
        await expect(page).toHaveURL(sourceUrl);
        await expect(page.getByRole("region", { name: "Run unavailable", exact: true })).toBeVisible();
        const banner = page.getByTestId("retest-recovery-banner");
        await expect(banner).toContainText("A retest request is awaiting confirmation.");
        await banner.getByRole("button", { name: "Review retest request", exact: true }).click();
        await expect(dialog.getByRole("button", { name: "Stop request and review again", exact: true })).toBeEnabled();
        await dialog.getByRole("button", { name: "Stop request and review again", exact: true }).click();
        await expect(dialog).toContainText("This saved request was stopped. It cannot create a Run");
        await expect(dialog.getByRole("button", { name: "Review again", exact: true })).toHaveCount(0);
        expect(await savedIntent(page, source.cycleId)).toBeNull();
        const outcome = await api.get(`/api/cycles/${source.cycleId}/retests/requests/${original.requestKey}`);
        expect(outcome.status(), await outcome.text()).toBe(200);
        expect(await outcome.json()).toMatchObject({ outcome: "cancelled", sourceCycleId: source.cycleId, requestKey: original.requestKey });
        const late = await api.post(`/api/cycles/${source.cycleId}/retests`, { data: original, failOnStatusCode: false });
        expect(late.status(), await late.text()).toBe(409);
        expect((await late.json()).code).toBe("RETEST_REQUEST_CANCELLED");
        const runs = await api.get(`/api/projects/${source.projectId}/cycles`);
        expect(runs.status(), await runs.text()).toBe(200);
        expect((await runs.json()).filter((run: { name: string }) => run.name === original.name)).toEqual([]);
        expect(posts).toBe(1);
      } finally {
        releaseResolution();
        await withoutIntent.close();
        await cleanUpRun(api, source.cycleId, source.testcaseIds);
        await api.dispose();
      }
    });
  }

  test("keyboard focus stays in the dialog through preview reload, uncertain submit, and recovery reload", async ({ page }) => {
    const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
    const source = await fixture(api);
    let failPreview = true;
    let releasePreview!: () => void, releaseLookup!: () => void;
    const previewGate = new Promise<void>(resolve => { releasePreview = resolve; });
    const lookupGate = new Promise<void>(resolve => { releaseLookup = resolve; });
    try {
      await page.route(`**/api/cycles/${source.cycleId}/retests/preview?*`, async route => {
        if (failPreview) {
          await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Preview temporarily unavailable" }) });
          return;
        }
        const response = await route.fetch();
        await previewGate;
        await route.fulfill({ response });
      });
      await page.route(`**/api/cycles/${source.cycleId}/retests`, async route => {
        if (route.request().method() === "POST") await route.abort("failed");
        else await route.continue();
      });
      await page.route(`**/api/cycles/${source.cycleId}/retests/requests/*`, async route => {
        await lookupGate;
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Outcome lookup temporarily unavailable" }) });
      });
      await page.goto(`/projects/${source.projectId}/cycles/${source.cycleId}`);
      await expect(page.getByRole("heading", { name: source.name, exact: true })).toBeVisible();
      await page.getByRole("checkbox", { name: `Select ${source.title}`, exact: true }).check();
      const trigger = page.getByTestId("run-retest-selected");
      await tabTo(page, trigger, { backwards: true });
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog", { name: "Create retest", exact: true });
      await expect(dialog).toBeFocused();
      await expect(dialog.getByRole("alert")).toHaveText("Preview temporarily unavailable");
      await page.keyboard.press("Tab");
      await expect(dialog.getByLabel("Run name", { exact: true })).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
      await tabTo(page, dialog.getByRole("button", { name: "Reload preview", exact: true }), { within: dialog });
      failPreview = false;
      await page.keyboard.press("Enter");
      await expect(dialog).toContainText("Loading the selected observations");
      await expect(dialog).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(dialog.getByLabel("Run name", { exact: true })).toBeFocused();
      releasePreview();
      const create = dialog.getByRole("button", { name: "Create retest", exact: true });
      await expect(create).toBeEnabled();
      await tabTo(page, create, { within: dialog });
      await page.keyboard.press("Enter");
      await expect(dialog.getByRole("button", { name: "Check outcome", exact: true })).toBeDisabled();
      await expect(dialog).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(dialog).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(dialog).toBeFocused();
      releaseLookup();
      await expect(dialog.getByRole("button", { name: "Check outcome", exact: true })).toBeEnabled();
      await page.keyboard.press("Tab");
      await expect(dialog.getByRole("button", { name: "Close and keep request", exact: true })).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(dialog.getByRole("button", { name: "Stop request and review again", exact: true })).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(dialog.getByRole("button", { name: "Close and keep request", exact: true })).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
      await page.reload();
      const review = page.getByTestId("retest-recovery-banner").getByRole("button", { name: "Review retest request", exact: true });
      await expect(review).toBeVisible();
      await tabTo(page, review);
      await page.keyboard.press("Enter");
      await expect(dialog.getByRole("button", { name: "Check outcome", exact: true })).toBeEnabled();
      await expect(dialog).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(dialog.getByRole("button", { name: "Stop request and review again", exact: true })).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(dialog.getByRole("button", { name: "Close and keep request", exact: true })).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(review).toBeFocused();
      expect(await children(api, source.cycleId)).toEqual([]);
    } finally {
      releasePreview();
      releaseLookup();
      await cleanup(api, source);
    }
  });

  test("a completed source can start a distinct retest while its status and results stay sealed", async ({ page }) => {
    const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
    const source = await fixture(api);
    try {
      const completed = await api.patch(`/api/cycles/${source.cycleId}`, { data: { status: "Completed" } });
      expect(completed.ok(), await completed.text()).toBeTruthy();
      const original = await (await api.get(`/api/cycles/${source.cycleId}/executions`)).json();
      const dialog = await openPreview(page, source);
      await expect(page.getByTestId("run-bulk-status")).toHaveCount(0);
      await expect(page.getByTestId("run-bulk-remove")).toHaveCount(0);
      await expect(page.getByTestId("run-bulk-assign")).toHaveCount(0);
      await expect(dialog.getByRole("button", { name: "Create retest", exact: true })).toBeEnabled();
      await dialog.getByRole("button", { name: "Create retest", exact: true }).click();
      await expect(page.getByTestId("run-retest-origin")).toContainText(source.name);
      const created = await children(api, source.cycleId);
      expect(created).toHaveLength(1);
      expect(await (await api.get(`/api/cycles/${source.cycleId}`)).json()).toMatchObject({ status: "Completed" });
      expect(await (await api.get(`/api/cycles/${source.cycleId}/executions`)).json()).toEqual(original);
      expect(await (await api.get(`/api/cycles/${created[0].id}`)).json()).toMatchObject({ status: "Planning" });
    } finally { await cleanup(api, source); }
  });

  test("changed definitions are compared and require an explicit acknowledgment before retesting", async ({ page }, testInfo) => {
    const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
    const source = await fixture(api);
    try {
      const endpoint = `/api/projects/${ctx.projectId}/testcases/${source.testcaseIds[0]}`;
      const current = await (await api.get(endpoint)).json();
      const newTitle = `${source.title} corrected expectation`;
      const edited = await api.put(endpoint, { data: {
        title: newTitle, expectedRevision: current.editRevision,
        steps: JSON.stringify([{ action: "Confirm the order and open its receipt", expectedResult: "The order number and saved timestamp are visible." }]),
      } });
      expect(edited.ok(), await edited.text()).toBeTruthy();
      await approveTestcase(api, ctx.projectId, source.testcaseIds[0]);
      const dialog = await openPreview(page, source);
      await expect(dialog).toContainText("The case definition changed since this source observation.");
      await expect(dialog.getByRole("region", { name: "Source definition", exact: true })).toContainText("The receipt shows the saved order number.");
      await expect(dialog.getByRole("region", { name: "Current approved definition", exact: true })).toContainText("The order number and saved timestamp are visible.");
      const create = dialog.getByRole("button", { name: "Create retest", exact: true });
      await expect(create).toBeDisabled();
      await testInfo.attach("native-retest-changed-definition-comparison", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
      await dialog.getByRole("checkbox", { name: "I reviewed the definition differences and want to retest the current approved definitions.", exact: true }).check();
      await expect(create).toBeEnabled();
      await create.click();
      await expect(page.getByTestId("run-retest-origin")).toContainText(source.name);
      const created = await children(api, source.cycleId);
      const newRows = await (await api.get(`/api/cycles/${created[0].id}/executions`)).json();
      expect(newRows).toHaveLength(1);
      expect(newRows[0]).toMatchObject({ title: newTitle, status: "Untested" });
      const original = await (await api.get(`/api/cycles/${source.cycleId}/executions`)).json();
      expect(original.find((row: { id: string }) => row.id === source.executionId)).toMatchObject({ title: source.title, status: "Failed", actualResult: source.actualResult });
    } finally { await cleanup(api, source); }
  });

  test("custom-field configuration changes remain inspectable when the field name and value stay the same", async ({ page }, testInfo) => {
    const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
    let projectId = "";
    let source: Awaited<ReturnType<typeof fixture>> | undefined;
    try {
      // A definition edit invalidates every case approval in its project. An isolated project
      // keeps this real dependency change from altering other files' concurrent smoke fixtures.
      const suffix = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
      const project = await api.post("/api/projects", { data: { name: `E2E Retest fields ${suffix}`.slice(0, 30), key: `RF${suffix}` } });
      expect(project.status(), await project.text()).toBe(201);
      projectId = (await project.json()).id;
      const definitions = `/api/projects/${projectId}/custom-fields/definitions`;
      const fieldName = `Review field ${suffix}`;
      const definition = await api.post(definitions, { data: { name: fieldName, fieldType: "text", required: false, config: { maxLength: 20 } } });
      expect(definition.status(), await definition.text()).toBe(201);
      const field = await definition.json();
      source = await fixture(api, false, projectId, { customFieldValues: { [field.id]: "same saved value" } });
      const changed = await api.patch(`${definitions}/${field.id}`, { data: { required: true, config: { maxLength: 80 } } });
      expect(changed.status(), await changed.text()).toBe(200);
      const approved = await approveTestcase(api, projectId, source.testcaseIds[0]);
      const dialog = await openPreview(page, source);
      await expect(dialog).toContainText("The case definition changed since this source observation.");
      const before = dialog.getByRole("region", { name: "Source definition", exact: true });
      const after = dialog.getByRole("region", { name: "Current approved definition", exact: true });
      await expect(before.getByText("same saved value", { exact: true })).toBeVisible();
      await expect(after.getByText("same saved value", { exact: true })).toBeVisible();
      const oldSummary = before.getByText(`Field definition: ${fieldName}`, { exact: true });
      const newSummary = after.getByText(`Field definition: ${fieldName}`, { exact: true });
      await oldSummary.click();
      await newSummary.click();
      const oldField = oldSummary.locator("..");
      const newField = newSummary.locator("..");
      await expect(oldField.getByText("Type", { exact: true })).toBeVisible();
      await expect(oldField.getByText("text", { exact: true })).toBeVisible();
      await expect(oldField.getByText("Maximum length", { exact: true })).toBeVisible();
      await expect(oldField.getByText("20", { exact: true })).toBeVisible();
      await expect(newField.getByText("80", { exact: true })).toBeVisible();
      await expect(oldField.getByText("Required", { exact: true }).locator("..")).toHaveText(/Required\s*false/);
      await expect(newField.getByText("Required", { exact: true }).locator("..")).toHaveText(/Required\s*true/);
      const create = dialog.getByRole("button", { name: "Create retest", exact: true });
      await expect(create).toBeDisabled();
      await testInfo.attach("native-retest-custom-field-definition-comparison", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
      await dialog.getByRole("checkbox", { name: "I reviewed the definition differences and want to retest the current approved definitions.", exact: true }).check();
      await create.click();
      await expect(page.getByTestId("run-retest-origin")).toContainText(source.name);
      const created = await children(api, source.cycleId);
      expect(created).toHaveLength(1);
      const target = await (await api.get(`/api/cycles/${created[0].id}`)).json();
      const occurrence = target.retestManifest.occurrences[0];
      expect(occurrence.targetApprovalRevision).toBe(approved.approvalRevision);
      expect(occurrence.sourceDefinition.customFields.find((item: { definition: { id: string } }) => item.definition.id === field.id)).toMatchObject({ definition: { name: fieldName, required: false, config: { maxLength: 20 } }, value: "same saved value" });
      expect(occurrence.targetDefinition.customFields.find((item: { definition: { id: string } }) => item.definition.id === field.id)).toMatchObject({ definition: { name: fieldName, required: true, config: { maxLength: 80 } }, value: "same saved value" });
    } finally {
      if (source) {
        for (const child of await children(api, source.cycleId)) await api.delete(`/api/cycles/${child.id}`, { failOnStatusCode: false });
        await cleanUpRun(api, source.cycleId, source.testcaseIds, projectId);
      }
      if (projectId) await api.delete(`/api/projects/${projectId}`, { failOnStatusCode: false });
      await api.dispose();
    }
  });

  test("an in-place Run refresh clears a replaced occurrence until the replacement is explicitly selected", async ({ page }) => {
    const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
    const source = await fixture(api);
    let previews = 0;
    try {
      page.on("request", request => { if (new URL(request.url()).pathname === `/api/cycles/${source.cycleId}/retests/preview`) previews += 1; });
      const original = await (await api.get(`/api/cycles/${source.cycleId}/executions`)).json();
      const unaffected = original.find((row: { testcaseId: string }) => row.testcaseId === source.testcaseIds[1]);
      await page.goto(`/projects/${source.projectId}/cycles/${source.cycleId}`);
      await expect(page.getByRole("heading", { name: source.name, exact: true })).toBeVisible();
      const checkbox = page.getByRole("checkbox", { name: `Select ${source.title}`, exact: true });
      await checkbox.check();
      await expect(page.getByTestId("run-retest-selected")).toBeVisible();
      const removed = await api.delete(`/api/cycles/${source.cycleId}/testcases/${source.testcaseIds[0]}`);
      expect(removed.ok(), await removed.text()).toBeTruthy();
      const added = await api.post(`/api/cycles/${source.cycleId}/testcases`, { data: { testcaseIds: [source.testcaseIds[0]] } });
      expect(added.ok(), await added.text()).toBeTruthy();
      const replacement = (await (await api.get(`/api/cycles/${source.cycleId}/executions`)).json()).find((row: { testcaseId: string }) => row.testcaseId === source.testcaseIds[0]);
      expect(replacement.id).not.toBe(source.executionId);
      expect(replacement.status).toBe("Untested");

      // Log Bug's onLogged callback calls load() on this same mounted Run. A full navigation
      // would clear selection even in the broken version and would not test the replacement bug.
      await page.getByRole("button", { name: unaffected.title, exact: true }).click();
      await page.getByTestId("panel-log-bug").click();
      const bugTitle = `E2E Refresh retained selection ${source.cycleId}`;
      await page.getByPlaceholder("Brief summary of the bug…").fill(bugTitle);
      const bugResponse = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === `/api/projects/${source.projectId}/bugs`);
      await page.getByRole("button", { name: "Report Bug", exact: true }).click();
      const logged = await bugResponse;
      expect(logged.ok(), await logged.text()).toBeTruthy();
      source.bugId = (await logged.json()).id;
      await expect(page.getByRole("heading", { name: "Report a Bug", exact: true })).toBeHidden();
      await expect(page.getByTestId("run-selection-changed")).toContainText("Their selection was cleared");
      await page.keyboard.press("Escape");
      await expect(checkbox).not.toBeChecked();
      await expect(page.getByTestId("run-retest-selected")).toHaveCount(0);
      expect(previews).toBe(0);
      await checkbox.check();
      await expect(page.getByTestId("run-bulk-remove")).toBeVisible();
      await expect(page.getByTestId("run-bulk-assign")).toBeVisible();
      await expect(page.getByTestId("run-bulk-status")).toBeVisible();
      await page.getByTestId("run-retest-selected").click();
      const dialog = page.getByRole("dialog", { name: "Create retest", exact: true });
      await expect(dialog.getByText("Source result: Untested", { exact: true })).toBeVisible();
      await expect(dialog).not.toContainText(source.actualResult);
      await expect(dialog.getByRole("button", { name: "Create retest", exact: true })).toBeEnabled();
      await dialog.getByRole("button", { name: "Create retest", exact: true }).click();
      await expect(page.getByTestId("run-retest-origin")).toContainText(source.name);
      const created = await children(api, source.cycleId);
      expect(created).toHaveLength(1);
      const target = await (await api.get(`/api/cycles/${created[0].id}`)).json();
      expect(target.retestManifest.occurrences).toHaveLength(1);
      expect(target.retestManifest.occurrences[0]).toMatchObject({ sourceExecutionId: replacement.id, sourceResult: { status: "Untested" } });
    } finally { await cleanup(api, source); }
  });

  for (const outcome of ["created", "cancelled"] as const) {
    for (const sourceDeleted of [false, true]) {
      test(`closing ${outcome} recovery without a selection returns keyboard focus to the ${sourceDeleted ? "unavailable source's Back to Test Runs link" : "source Run heading"}`, async ({ page }) => {
        const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
        const source = await fixture(api);
        const targetName = `Terminal focus ${outcome} ${source.cycleId}`;
        let posts = 0;
        let allowLookup = false;
        let targetId = "";
        let posted: Record<string, unknown> | null = null;
        try {
          await page.route(`**/api/cycles/${source.cycleId}/retests`, async route => {
            if (route.request().method() !== "POST") { await route.continue(); return; }
            posts += 1;
            posted = route.request().postDataJSON();
            await route.abort("failed");
          });
          await page.route(`**/api/cycles/${source.cycleId}/retests/requests/*`, async route => {
            if (allowLookup) await route.continue();
            else await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Outcome lookup temporarily unavailable" }) });
          });
          const dialog = await openPreview(page, source);
          await dialog.getByLabel("Run name", { exact: true }).fill(targetName);
          await expect(dialog.getByRole("button", { name: "Create retest", exact: true })).toBeEnabled();
          await dialog.getByRole("button", { name: "Create retest", exact: true }).click();
          await expect(dialog.getByRole("button", { name: "Retry saved request", exact: true })).toBeEnabled();
          const saved = await savedIntent(page, source.cycleId);
          expect(saved).not.toBeNull();
          const original = saved!.value.request;
          expect(original).toEqual(posted);
          expect(posts).toBe(1);

          // Complete the exact saved command through the real server while its browser outcome
          // is unknown. Reload must recover that terminal fact, with no checkbox selection left.
          const disposition = outcome === "created"
            ? await api.post(`/api/cycles/${source.cycleId}/retests`, { data: original })
            : await api.post(`/api/cycles/${source.cycleId}/retests/requests/${original.requestKey}/cancel`, { data: original });
          expect(disposition.status(), await disposition.text()).toBe(outcome === "created" ? 201 : 200);
          const terminal = await disposition.json();
          expect(terminal).toMatchObject({ outcome, sourceCycleId: source.cycleId, requestKey: original.requestKey });
          if (outcome === "created") targetId = terminal.cycleId;
          if (sourceDeleted) {
            const removed = await api.delete(`/api/cycles/${source.cycleId}`);
            expect(removed.ok(), await removed.text()).toBeTruthy();
            expect((await api.get(`/api/cycles/${source.cycleId}`)).status()).toBe(404);
          }
          allowLookup = true;
          await page.reload();
          const banner = page.getByTestId("retest-recovery-banner");
          await expect(banner).toContainText(outcome === "created" ? "Your saved retest request was created." : "Your saved retest request was stopped.");
          if (sourceDeleted) await expect(page.getByRole("region", { name: "Run unavailable", exact: true })).toBeVisible();
          else await expect(page.getByRole("heading", { name: source.name, exact: true })).toBeVisible();
          await expect(page.getByTestId("run-retest-selected")).toHaveCount(0);
          expect(await savedIntent(page, source.cycleId)).toBeNull();
          await tabTo(page, banner.getByRole("button", { name: "Review retest request", exact: true }));
          await page.keyboard.press("Enter");
          await expect(dialog).toContainText(outcome === "created" ? targetName : "This saved request was stopped.");
          await tabTo(page, dialog.getByRole("button", { name: "Close", exact: true }), { within: dialog });
          await page.keyboard.press(sourceDeleted ? "Escape" : "Enter");
          await expect(dialog).toBeHidden();
          await expect(banner).toHaveCount(0);
          const destination = sourceDeleted
            ? page.getByRole("link", { name: "Back to Test Runs", exact: true })
            : page.getByRole("heading", { name: source.name, exact: true });
          await expect(destination).toBeFocused();

          const runs = await api.get(`/api/projects/${source.projectId}/cycles`);
          expect(runs.status(), await runs.text()).toBe(200);
          const matching = (await runs.json()).filter((run: { name: string }) => run.name === targetName);
          if (outcome === "created") {
            expect(matching).toHaveLength(1);
            expect(matching[0].id).toBe(targetId);
            const rows = await (await api.get(`/api/cycles/${targetId}/executions`)).json();
            expect(rows).toHaveLength(1);
            expect(rows[0]).toMatchObject({ testcaseId: source.testcaseIds[0], status: "Untested" });
          } else {
            expect(matching).toEqual([]);
            const late = await api.post(`/api/cycles/${source.cycleId}/retests`, { data: original, failOnStatusCode: false });
            expect(late.status(), await late.text()).toBe(409);
            expect((await late.json()).code).toBe("RETEST_REQUEST_CANCELLED");
          }
          expect(posts).toBe(1);
        } finally {
          if (targetId) await api.delete(`/api/cycles/${targetId}`, { failOnStatusCode: false });
          await cleanUpRun(api, source.cycleId, source.testcaseIds, source.projectId);
          await api.dispose();
        }
      });
    }
  }
});
