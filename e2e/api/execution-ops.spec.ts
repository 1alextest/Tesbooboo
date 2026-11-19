import { approveTestcase, createTestcaseFixtureResponse } from "../utils/testcase-approval";
import { expect, test, type APIRequestContext, type APIResponse } from "@playwright/test";
import { column, exec, literal, scalar } from "../utils/psql";
import {
  anonymousContext,
  loginAs,
  provisionRbacTenant,
  rbacSuiteSkipReason,
  type RbacTenant,
} from "../utils/rbac-tenant";

/*
 * Execution bulk operations, run schedules, and public share links.
 *
 * Wave 7, on its own workspace ("exec-ops") because it deletes runs.
 *
 * READ THIS BEFORE "FIXING" A RED TEST IN HERE. The two bulk routes are still controller stubs with
 * empty bodies that answer 2xx without doing anything:
 *
 *   POST   /api/cycles/:cycleId/executions/bulk-assign     bulkAssign() {}
 *   POST   /api/cycles/:cycleId/executions/bulk-status     bulkStatus() {}
 *
 * Their tests are RED until the product either implements them or removes them — the same two valid
 * outcomes §3 bug 15 had for the import stubs. They are deliberately not weakened: a bulk-status call
 * that reports success and changes nothing is exactly the failure a suite exists to catch, and a
 * green test here would convert it into silence.
 *
 * Run schedules used to be stubs too. They are now persisted in cycle_run_schedules (EXO-A-07/08),
 * and a worker creates a new Test Run for each due occurrence (EXO-A-08b).
 */

test.describe("execution bulk operations, schedules and share links", () => {
  let tenant: RbacTenant | null = null;
  let asOwner: APIRequestContext;
  let asQa: APIRequestContext;
  let asGuest: APIRequestContext;
  let anon: APIRequestContext;

  test.beforeAll(async () => {
    tenant = await provisionRbacTenant("exec-ops");
    if (!tenant) return;
    asOwner = await loginAs(tenant.owner);
    asQa = await loginAs(tenant.qa);
    asGuest = await loginAs(tenant.guest);
    anon = await anonymousContext();
    purge(tenant);
  });

  test.afterAll(async () => {
    if (tenant) purge(tenant);
    await Promise.all([asOwner, asQa, asGuest, anon].filter(Boolean).map((c) => c.dispose()));
  });

  test.beforeEach(() => {
    const reason = rbacSuiteSkipReason(tenant);
    test.skip(reason !== null, reason ?? "");
  });

  test.afterEach(() => {
    if (tenant) purge(tenant);
  });

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function purge(t: RbacTenant): void {
    const projects = `${literal(t.mainProjectId)}, ${literal(t.secondProjectId)}`;
    exec(
      "DELETE FROM executions WHERE cycle_item_id IN (SELECT ci.id FROM cycle_items ci JOIN cycles c " +
        `ON c.id = ci.cycle_id WHERE c.project_id IN (${projects}));`,
    );
    exec(`DELETE FROM cycle_items WHERE cycle_id IN (SELECT id FROM cycles WHERE project_id IN (${projects}));`);
    exec(`DELETE FROM cycles WHERE project_id IN (${projects});`);
    exec(`DELETE FROM testcases WHERE project_id IN (${projects}) AND title LIKE 'E2E ExecOps%';`);
  }

  function stamp(label: string): string {
    return `E2E ExecOps ${label} ${Date.now()}${Math.floor(Math.random() * 1000)}`;
  }

  async function approveBulkFixtureCases(testcaseIds: string[]): Promise<void> {
    // Setup uses genuine human review receipts. Keep concurrency bounded so the large-selection
    // timing below measures only adding cases to the run, not approval fixture preparation.
    for (let offset = 0; offset < testcaseIds.length; offset += 8) {
      await Promise.all(testcaseIds.slice(offset, offset + 8).map((id) => approveTestcase(asOwner, tenant!.mainProjectId, id)));
    }
  }

  /** A run with `count` test cases in it, each with a fresh Untested execution. */
  async function seedRun(count = 3, projectId?: string): Promise<{ cycleId: string; executionIds: string[] }> {
    const project = projectId ?? tenant!.mainProjectId;
    const testcaseIds: string[] = [];
    for (let i = 0; i < count; i++) {
      const res = await createTestcaseFixtureResponse(asOwner, `/api/projects/${project}/testcases`, {
        data: { title: stamp(`case ${i + 1}`), status: "Approved" },
        failOnStatusCode: false,
      });
      expect(res.status(), `seeding a test case — ${await res.text()}`).toBe(201);
      testcaseIds.push((await res.json()).id);
    }

    const cycle = await asOwner.post(`/api/projects/${project}/cycles`, {
      data: { name: stamp("run") },
      failOnStatusCode: false,
    });
    expect(cycle.status(), `seeding a run — ${await cycle.text()}`).toBe(201);
    const cycleId = (await cycle.json()).id;

    const added = await asOwner.post(`/api/cycles/${cycleId}/testcases`, {
      data: { testcaseIds },
      failOnStatusCode: false,
    });
    expect(added.status()).toBeLessThan(400);

    const executions = await (await asOwner.get(`/api/cycles/${cycleId}/executions`)).json();
    return { cycleId, executionIds: executions.map((e: any) => e.id) };
  }

  async function expectRefused(res: APIResponse, what: string): Promise<void> {
    expect([400, 401, 403, 404], `${what} answered with ${res.status()}: ${await res.text()}`).toContain(res.status());
  }

  function executionStatuses(cycleId: string): string[] {
    return scalar(
      "SELECT COALESCE(string_agg(e.status, ',' ORDER BY e.id), '') FROM executions e JOIN cycle_items ci " +
        `ON ci.id = e.cycle_item_id WHERE ci.cycle_id = ${literal(cycleId)};`,
    )
      .split(",")
      .filter(Boolean);
  }

  // ─── Bulk status ──────────────────────────────────────────────────────────

  test("EXO-A-01 setting the status of several executions at once applies it to all of them", { tag: '@tesbo.testId("TES-TC-174")' }, async () => {
    const { cycleId, executionIds } = await seedRun(3);
    expect(executionStatuses(cycleId)).toEqual(["Untested", "Untested", "Untested"]);

    const res = await asOwner.post(`/api/cycles/${cycleId}/executions/bulk-status`, {
      data: { executionIds, status: "Passed" },
      failOnStatusCode: false,
    });
    expect(res.status(), `bulk-status answered ${res.status()}: ${await res.text()}`).toBeLessThan(400);

    // The assertion the route exists for. `bulkStatus() {}` is an empty controller method, so this
    // is red: the call reports success and every execution is still Untested. Do not relax it — the
    // UI offers this action on a multi-select and tells the user it worked.
    const statuses = executionStatuses(cycleId);
    expect(statuses, "bulk-status reported success but changed nothing").toEqual(["Passed", "Passed", "Passed"]);
  });

  test("EXO-A-02 bulk status leaves executions outside the selection alone", { tag: '@tesbo.testId("TES-TC-175")' }, async () => {
    const { cycleId, executionIds } = await seedRun(3);
    const selected = executionIds.slice(0, 2);

    await asOwner.post(`/api/cycles/${cycleId}/executions/bulk-status`, {
      data: { executionIds: selected, status: "Failed" },
      failOnStatusCode: false,
    });

    const failed = Number(
      scalar(
        "SELECT COUNT(*) FROM executions e JOIN cycle_items ci ON ci.id = e.cycle_item_id " +
          `WHERE ci.cycle_id = ${literal(cycleId)} AND e.status = 'Failed';`,
      ),
    );
    expect(failed, "a partial bulk selection did not apply to exactly the selected executions").toBe(2);
  });

  test("EXO-A-03 bulk status refuses an unknown status value", { tag: '@tesbo.testId("TES-TC-176")' }, async () => {
    const { cycleId, executionIds } = await seedRun(2);
    const res = await asOwner.post(`/api/cycles/${cycleId}/executions/bulk-status`, {
      data: { executionIds, status: "Bananas" },
      failOnStatusCode: false,
    });
    // executions.status has a CHECK constraint, so an unknown value must be refused at the edge
    // rather than reaching Postgres — and it must certainly not be stored.
    expect(res.status(), `an unknown status answered ${res.status()}`).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
    expect(executionStatuses(cycleId).every((s) => s === "Untested")).toBe(true);
  });

  test("EXO-A-04 bulk assignment sets the assignee on every selected execution", { tag: '@tesbo.testId("TES-TC-177")' }, async () => {
    const { cycleId, executionIds } = await seedRun(2);
    const res = await asOwner.post(`/api/cycles/${cycleId}/executions/bulk-assign`, {
      data: { executionIds, assigneeId: tenant!.qa.userId },
      failOnStatusCode: false,
    });
    expect(res.status(), `bulk-assign answered ${res.status()}: ${await res.text()}`).toBeLessThan(400);

    // Red for the same reason as EXO-A-01: `bulkAssign() {}` does nothing.
    const assigned = Number(
      scalar(
        "SELECT COUNT(*) FROM executions e JOIN cycle_items ci ON ci.id = e.cycle_item_id " +
          `WHERE ci.cycle_id = ${literal(cycleId)} AND e.assignee_id = ${literal(tenant!.qa.userId)};`,
      ),
    );
    expect(assigned, "bulk-assign reported success but assigned nobody").toBe(2);
  });

  test("EXO-A-05 bulk assignment refuses someone who is not a member of the project", { tag: '@tesbo.testId("TES-TC-178")' }, async () => {
    const { cycleId, executionIds } = await seedRun(1);
    const res = await asOwner.post(`/api/cycles/${cycleId}/executions/bulk-assign`, {
      data: { executionIds, assigneeId: tenant!.guest.userId },
      failOnStatusCode: false,
    });
    // Assigning work to somebody who cannot open the project produces an execution nobody can
    // action, so the guard belongs here rather than in the UI's picker.
    expect(res.status(), `assigning a non-member answered ${res.status()}`).toBeGreaterThanOrEqual(400);
    expect(
      scalar(
        "SELECT COUNT(*) FROM executions e JOIN cycle_items ci ON ci.id = e.cycle_item_id " +
          `WHERE ci.cycle_id = ${literal(cycleId)} AND e.assignee_id IS NOT NULL;`,
      ),
    ).toBe("0");
  });

  test("EXO-A-06 neither bulk route answers a caller with no session or from another project", { tag: '@tesbo.testId("TES-TC-179")' }, async () => {
    const { cycleId, executionIds } = await seedRun(2);

    for (const [what, api] of [
      ["anonymous", anon],
      ["non-member", asGuest],
    ] as const) {
      for (const [route, data] of [
        ["bulk-status", { executionIds, status: "Passed" }],
        ["bulk-assign", { executionIds, assigneeId: tenant!.qa.userId }],
      ] as Array<[string, Record<string, unknown>]>) {
        const res = await api.post(`/api/cycles/${cycleId}/executions/${route}`, { data, failOnStatusCode: false });
        await expectRefused(res, `${route} (${what})`);
      }
    }
    // Whatever the routes do or don't do, an outsider must not be able to rewrite a run's results.
    expect(executionStatuses(cycleId).every((s) => s === "Untested")).toBe(true);
  });

  // ─── Single-execution assignment (the reported bug + its membership gap) ──

  test("EXO-A-08 a single-execution PATCH also refuses a non-member assignee", { tag: '@tesbo.testId("TES-TC-1903")' }, async () => {
    // Unlike bulk-assign (EXO-A-05), the single-execution PATCH used to skip this check entirely —
    // it would accept any UUID as assignee_id with no membership validation at all.
    const { cycleId, executionIds } = await seedRun(1);
    const res = await asOwner.patch(`/api/cycles/${cycleId}/executions/${executionIds[0]}`, {
      data: { assigneeId: tenant!.guest.userId },
      failOnStatusCode: false,
    });
    expect(res.status(), `assigning a non-member via PATCH answered ${res.status()}`).toBeGreaterThanOrEqual(400);
    expect(
      scalar(`SELECT assignee_id FROM executions WHERE id = ${literal(executionIds[0])};`) || null,
    ).toBeNull();
  });

  test("EXO-A-09 a status-only PATCH does not clear an assignee set via bulk-assign", { tag: '@tesbo.testId("TES-TC-1904")' }, async () => {
    // The reported bug, reached through the bulk-assign entry point instead of a direct PATCH: assign
    // via bulk-assign, then touch status only, the way the run detail screen's inline dropdown does.
    const { cycleId, executionIds } = await seedRun(1);
    await asOwner.post(`/api/cycles/${cycleId}/executions/bulk-assign`, {
      data: { executionIds, assigneeId: tenant!.qa.userId },
      failOnStatusCode: false,
    });
    expect(scalar(`SELECT assignee_id FROM executions WHERE id = ${literal(executionIds[0])};`)).toBe(
      tenant!.qa.userId,
    );

    const res = await asOwner.patch(`/api/cycles/${cycleId}/executions/${executionIds[0]}`, {
      data: { status: "Passed" },
      failOnStatusCode: false,
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    expect(
      scalar(`SELECT assignee_id FROM executions WHERE id = ${literal(executionIds[0])};`),
      "a status-only PATCH must not clear an assignee set moments earlier",
    ).toBe(tenant!.qa.userId);
  });

  // ─── Schedules ────────────────────────────────────────────────────────────

  test("EXO-A-07 a created schedule is persisted and listed for its project", { tag: '@tesbo.testId("TES-TC-180")' }, async () => {
    const { cycleId } = await seedRun(1);
    const name = stamp("nightly");
    const created = await asOwner.post(`/api/projects/${tenant!.mainProjectId}/cycles/schedules`, {
      data: { name, cycleId, scheduleType: "recurring", intervalMinutes: 1440, timezone: "UTC" },
      failOnStatusCode: false,
    });
    expect(created.status(), `creating a schedule — ${await created.text()}`).toBe(201);
    const schedule = await created.json();
    expect(schedule).toMatchObject({
      name,
      cycleId,
      enabled: true,
      scheduleType: "recurring",
      intervalMinutes: 1440,
      timezone: "UTC",
    });
    expect(schedule.nextRunAt, "a recurring schedule needs a first fire time").toBeTruthy();

    const listed = await (await asOwner.get(`/api/projects/${tenant!.mainProjectId}/cycles/schedules`)).json();
    const row = listed.find((item: { id: string }) => item.id === schedule.id);
    expect(row, "the schedule that was just created is not in the project's list").toBeTruthy();
    expect(row.cycleName, "the list shows which Test Run the schedule fires").toContain("E2E ExecOps");
  });

  test("EXO-A-08 a schedule is updated and deleted, and the list reflects both", { tag: '@tesbo.testId("TES-TC-181")' }, async () => {
    const { cycleId } = await seedRun(1);
    const created = await asOwner.post(`/api/projects/${tenant!.mainProjectId}/cycles/schedules`, {
      data: { name: stamp("weekly"), cycleId, scheduleType: "recurring", intervalMinutes: 10080 },
      failOnStatusCode: false,
    });
    expect(created.status(), await created.text()).toBe(201);
    const schedule = await created.json();

    const renamed = stamp("weekly-renamed");
    const updated = await asOwner.patch(`/api/cycles/schedules/${schedule.id}`, {
      data: { name: renamed, enabled: false, intervalMinutes: 60 },
      failOnStatusCode: false,
    });
    expect(updated.status(), await updated.text()).toBe(200);
    expect(await updated.json()).toMatchObject({ id: schedule.id, name: renamed, enabled: false, intervalMinutes: 60 });

    const afterUpdate = await (await asOwner.get(`/api/projects/${tenant!.mainProjectId}/cycles/schedules`)).json();
    expect(afterUpdate.find((item: { id: string }) => item.id === schedule.id)).toMatchObject({
      name: renamed,
      enabled: false,
      intervalMinutes: 60,
    });

    // A malformed edit is refused at the edge, not stored.
    const invalid = await asOwner.patch(`/api/cycles/schedules/${schedule.id}`, {
      data: { intervalMinutes: 0 },
      failOnStatusCode: false,
    });
    expect(invalid.status()).toBe(400);

    const deleted = await asOwner.delete(`/api/cycles/schedules/${schedule.id}`, { failOnStatusCode: false });
    expect(deleted.status()).toBe(200);
    const afterDelete = await (await asOwner.get(`/api/projects/${tenant!.mainProjectId}/cycles/schedules`)).json();
    expect(afterDelete.map((item: { id: string }) => item.id)).not.toContain(schedule.id);
  });

  test("EXO-A-08b a due schedule creates a new Test Run and records the outcome", { tag: '@tesbo.testId("TES-TC-922")' }, async () => {
    const { cycleId } = await seedRun(1);
    const source = await (await asOwner.get(`/api/cycles/${cycleId}`)).json();
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const created = await asOwner.post(`/api/projects/${tenant!.mainProjectId}/cycles/schedules`, {
      data: { name: stamp("due"), cycleId, scheduleType: "one_time", runAt: future, timezone: "UTC" },
      failOnStatusCode: false,
    });
    expect(created.status(), await created.text()).toBe(201);
    const schedule = await created.json();

    // Make it due now instead of waiting for the chosen hour; only this disposable tenant's row changes.
    exec(`UPDATE cycle_run_schedules SET next_run_at = now() WHERE id = ${literal(schedule.id)};`);

    await expect
      .poll(
        () => scalar(`SELECT COALESCE(last_status, '') FROM cycle_run_schedules WHERE id = ${literal(schedule.id)};`),
        { message: "the worker must fire the due schedule", timeout: 120_000, intervals: [2_000] },
      )
      .toBe("success");

    const spawned = JSON.parse(
      scalar(
        `SELECT COALESCE(json_build_object('id', id, 'name', name)::text, 'null') FROM cycles
         WHERE project_id = ${literal(tenant!.mainProjectId)}
           AND name LIKE ${literal(`${String(source.name).slice(0, 40)}% — scheduled %`)}
           AND id <> ${literal(cycleId)}
         ORDER BY created_at DESC LIMIT 1;`,
      ),
    );
    expect(spawned?.id, "a due schedule must create a new Test Run").toBeTruthy();
    // Only Approved cases are carried over, through the same writer every run-creation path uses.
    expect(Number(scalar(`SELECT COUNT(*)::int FROM cycle_items WHERE cycle_id = ${literal(spawned.id)};`))).toBe(1);

    const listed = await (await asOwner.get(`/api/projects/${tenant!.mainProjectId}/cycles/schedules`)).json();
    const row = listed.find((item: { id: string }) => item.id === schedule.id);
    expect(row).toMatchObject({ enabled: false, lastStatus: "success" });
    expect(row.lastRunAt).toBeTruthy();
    expect(row.nextRunAt, "a one-time schedule has no next occurrence").toBeNull();
  });

  test("EXO-A-09 the schedule routes refuse a caller with no session, and a non-member", { tag: '@tesbo.testId("TES-TC-183")' }, async () => {
    // PATCH and DELETE resolve the schedule's project from the row, so a non-member or anonymous caller
    // holding a real id is refused by the same membership check as the list and create routes.
    const { cycleId } = await seedRun(1);
    const created = await asOwner.post(`/api/projects/${tenant!.mainProjectId}/cycles/schedules`, {
      data: { name: stamp("guarded"), cycleId, scheduleType: "recurring", intervalMinutes: 60 },
      failOnStatusCode: false,
    });
    expect(created.status(), await created.text()).toBe(201);
    const schedule = await created.json();
    const createBody = { name: "intruder", cycleId, scheduleType: "recurring", intervalMinutes: 60 };

    for (const [what, attempt] of [
      [
        "list (anonymous)",
        () => anon.get(`/api/projects/${tenant!.mainProjectId}/cycles/schedules`, { failOnStatusCode: false }),
      ],
      [
        "create (anonymous)",
        () =>
          anon.post(`/api/projects/${tenant!.mainProjectId}/cycles/schedules`, {
            data: createBody,
            failOnStatusCode: false,
          }),
      ],
      [
        "update (anonymous, real id)",
        () =>
          anon.patch(`/api/cycles/schedules/${schedule.id}`, {
            data: { enabled: false },
            failOnStatusCode: false,
          }),
      ],
      [
        "delete (anonymous, real id)",
        () => anon.delete(`/api/cycles/schedules/${schedule.id}`, { failOnStatusCode: false }),
      ],
      [
        "list (non-member)",
        () => asGuest.get(`/api/projects/${tenant!.mainProjectId}/cycles/schedules`, { failOnStatusCode: false }),
      ],
      [
        "create (non-member)",
        () =>
          asGuest.post(`/api/projects/${tenant!.mainProjectId}/cycles/schedules`, {
            data: createBody,
            failOnStatusCode: false,
          }),
      ],
      [
        "update (non-member, real id)",
        () =>
          asGuest.patch(`/api/cycles/schedules/${schedule.id}`, {
            data: { enabled: false },
            failOnStatusCode: false,
          }),
      ],
      [
        "delete (non-member, real id)",
        () => asGuest.delete(`/api/cycles/schedules/${schedule.id}`, { failOnStatusCode: false }),
      ],
    ] as Array<[string, () => Promise<APIResponse>]>) {
      await expectRefused(await attempt(), `schedule ${what}`);
    }

    // None of the refusals changed the row.
    expect(
      scalar(`SELECT enabled FROM cycle_run_schedules WHERE id = ${literal(schedule.id)};`),
      "a refused update or delete must not touch the schedule",
    ).toBe("t");
  });

  test("EXO-A-10 a schedule needs a name, a run, a type and a valid fire time", { tag: '@tesbo.testId("TES-TC-184")' }, async () => {
    const { cycleId } = await seedRun(1);
    const foreign = await (
      await asOwner.post(`/api/projects/${tenant!.secondProjectId}/cycles`, {
        data: { name: stamp("foreign run") },
        failOnStatusCode: false,
      })
    ).json();
    const foreignCycleId = foreign.id;
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const base = { name: stamp("valid"), cycleId, scheduleType: "recurring", intervalMinutes: 60 };

    for (const [label, data] of [
      ["no name", { ...base, name: "" }],
      ["no run", { ...base, cycleId: "" }],
      ["unknown run", { ...base, cycleId: "11111111-1111-4111-8111-111111111111" }],
      ["another project's run", { ...base, cycleId: foreignCycleId }],
      ["unknown type", { ...base, scheduleType: "cron" }],
      ["no interval", { ...base, intervalMinutes: undefined }],
      ["zero interval", { ...base, intervalMinutes: 0 }],
      ["fractional interval", { ...base, intervalMinutes: 1.5 }],
      ["invalid timezone", { ...base, timezone: "Mars/Olympus" }],
    ] as const) {
      const res = await asOwner.post(`/api/projects/${tenant!.mainProjectId}/cycles/schedules`, {
        data,
        failOnStatusCode: false,
      });
      // Refused at the edge, and never a 5xx: a schedule that cannot be represented must not be stored.
      expect(res.status(), `${label} was accepted: ${await res.text()}`).toBeGreaterThanOrEqual(400);
      expect(res.status(), `${label} answered ${res.status()}`).toBeLessThan(500);
    }

    // The valid control: the same body without the broken field is accepted.
    const ok = await asOwner.post(`/api/projects/${tenant!.mainProjectId}/cycles/schedules`, {
      data: { ...base, scheduleType: "one_time", intervalMinutes: undefined, runAt: future },
      failOnStatusCode: false,
    });
    expect(ok.status(), `a valid one-time schedule was refused: ${await ok.text()}`).toBe(201);
  });

  /*
   * EXO-A-11: "Run At" (a one-time schedule's fire time) must not accept a past instant. A caller
   * bypassing the UI's own datetime-local `min` and submit-time check must still be refused at the
   * API, and nothing may be stored on the way to that refusal.
   */
  test("EXO-A-11 a one-time schedule refuses a past or malformed Run At", { tag: '@tesbo.testId("TES-TC-2200")' }, async () => {
    const { cycleId } = await seedRun(1);
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    // "Today with an earlier time" — a past instant that is not a different calendar day at all.
    const earlierToday = new Date(Date.now() - 60 * 1000).toISOString();

    for (const [label, runAt] of [
      ["a full day in the past", pastDate],
      ["earlier today", earlierToday],
      ["not a date at all", "not-a-date"],
      ["an empty string", ""],
    ] as const) {
      const name = stamp("bad-run-at");
      const res = await asOwner.post(`/api/projects/${tenant!.mainProjectId}/cycles/schedules`, {
        data: { name, scheduleType: "one_time", runAt, cycleId, timezone: "UTC" },
        failOnStatusCode: false,
      });
      expect(res.status(), `${label} (${JSON.stringify(runAt)}) must be refused: ${await res.text()}`).toBe(400);
      expect(
        scalar(`SELECT COUNT(*)::int FROM cycle_run_schedules WHERE project_id = ${literal(tenant!.mainProjectId)} AND name = ${literal(name)};`),
        "a refused schedule must not be stored",
      ).toBe("0");
    }
  });

  test("EXO-A-12 a one-time schedule with a future Run At is accepted and fires at that instant", { tag: '@tesbo.testId("TES-TC-2201")' }, async () => {
    const { cycleId } = await seedRun(1);
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const res = await asOwner.post(`/api/projects/${tenant!.mainProjectId}/cycles/schedules`, {
      data: { name: stamp("future-run-at"), scheduleType: "one_time", runAt: future, cycleId, timezone: "UTC" },
      failOnStatusCode: false,
    });
    expect(res.status(), `a future Run At must be accepted: ${await res.text()}`).toBe(201);
    expect((await res.json()).nextRunAt).toBe(future);
  });

  test("EXO-A-13 a recurring schedule needs no Run At and starts one interval out", { tag: '@tesbo.testId("TES-TC-2202")' }, async () => {
    const { cycleId } = await seedRun(1);
    const res = await asOwner.post(`/api/projects/${tenant!.mainProjectId}/cycles/schedules`, {
      data: { name: stamp("recurring"), scheduleType: "recurring", intervalMinutes: 60, cycleId, timezone: "UTC" },
      failOnStatusCode: false,
    });
    expect(res.status(), `a recurring schedule must not be judged by Run At: ${await res.text()}`).toBe(201);
    const schedule = await res.json();
    expect(schedule.nextRunAt).toBeTruthy();
    expect(new Date(schedule.nextRunAt).getTime()).toBeGreaterThan(Date.now());
  });

  const localTimeOf = (iso: string, timezone: string) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(iso));
  const localWeekdayOf = (iso: string, timezone: string) =>
    new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(new Date(iso));

  test("EXO-A-14 a daily schedule is stored as a local wall-clock rule", { tag: '@tesbo.testId("TES-TC-3036")' }, async () => {
    const { cycleId } = await seedRun(1);
    const timezone = "America/New_York";
    const res = await asOwner.post(`/api/projects/${tenant!.mainProjectId}/cycles/schedules`, {
      data: { name: stamp("daily"), cycleId, scheduleType: "daily", localTime: "09:00", timezone },
      failOnStatusCode: false,
    });
    expect(res.status(), await res.text()).toBe(201);
    const schedule = await res.json();
    expect(schedule).toMatchObject({ scheduleType: "daily", localTime: "09:00", daysOfWeek: null, timezone });
    expect(new Date(schedule.nextRunAt).getTime()).toBeGreaterThan(Date.now());
    expect(localTimeOf(schedule.nextRunAt, timezone), "the rule is local to its zone, not UTC").toBe("09:00");
  });

  test("EXO-A-15 a weekly schedule fires only on the chosen local days", { tag: '@tesbo.testId("TES-TC-3037")' }, async () => {
    const { cycleId } = await seedRun(1);
    const timezone = "America/New_York";
    const res = await asOwner.post(`/api/projects/${tenant!.mainProjectId}/cycles/schedules`, {
      data: { name: stamp("weekly"), cycleId, scheduleType: "weekly", localTime: "08:30", daysOfWeek: [3, 1, 3], timezone },
      failOnStatusCode: false,
    });
    expect(res.status(), await res.text()).toBe(201);
    const schedule = await res.json();
    // Duplicates are normalized away.
    expect(schedule).toMatchObject({ scheduleType: "weekly", localTime: "08:30", daysOfWeek: [1, 3] });
    expect(localTimeOf(schedule.nextRunAt, timezone)).toBe("08:30");
    expect(["Mon", "Wed"]).toContain(localWeekdayOf(schedule.nextRunAt, timezone));
  });

  test("EXO-A-16 local rules refuse a missing or malformed time and empty or invalid days", { tag: '@tesbo.testId("TES-TC-3038")' }, async () => {
    const { cycleId } = await seedRun(1);
    for (const [label, data] of [
      ["daily without a time", { scheduleType: "daily" }],
      ["daily with a malformed time", { scheduleType: "daily", localTime: "9:00" }],
      ["weekly without days", { scheduleType: "weekly", localTime: "09:00" }],
      ["weekly with empty days", { scheduleType: "weekly", localTime: "09:00", daysOfWeek: [] }],
      ["weekly with an out-of-range day", { scheduleType: "weekly", localTime: "09:00", daysOfWeek: [7] }],
      ["daily with an invalid zone", { scheduleType: "daily", localTime: "09:00", timezone: "Mars/Olympus" }],
    ] as const) {
      const res = await asOwner.post(`/api/projects/${tenant!.mainProjectId}/cycles/schedules`, {
        data: { name: stamp("bad local"), cycleId, ...data },
        failOnStatusCode: false,
      });
      expect(res.status(), `${label} was accepted: ${await res.text()}`).toBe(400);
    }
  });

  test("EXO-A-18 a schedule runs on demand without shifting its cadence", { tag: '@tesbo.testId("TES-TC-3041")' }, async () => {
    const { cycleId } = await seedRun(1);
    const created = await asOwner.post(`/api/projects/${tenant!.mainProjectId}/cycles/schedules`, {
      data: { name: stamp("run-now"), cycleId, scheduleType: "recurring", intervalMinutes: 60 },
      failOnStatusCode: false,
    });
    expect(created.status(), await created.text()).toBe(201);
    const schedule = await created.json();
    const cadence = schedule.nextRunAt;

    const run = await asOwner.post(`/api/cycles/schedules/${schedule.id}/run`, { failOnStatusCode: false });
    expect(run.status(), await run.text()).toBe(200);
    const result = await run.json();
    expect(result).toMatchObject({ ok: true, status: "success" });
    expect(result.cycleName).toContain("— scheduled");

    const listed = await (await asOwner.get(`/api/projects/${tenant!.mainProjectId}/cycles/schedules`)).json();
    const row = listed.find((item: { id: string }) => item.id === schedule.id);
    expect(row).toMatchObject({ enabled: true, lastStatus: "success" });
    expect(row.nextRunAt, "a manual run must not shift the schedule's cadence").toBe(cadence);

    const cycles = await (await asOwner.get(`/api/projects/${tenant!.mainProjectId}/cycles`)).json();
    expect(cycles.map((cycle: { id: string }) => cycle.id)).toContain(result.cycleId);

    // Running again creates a second run rather than reusing the first.
    const second = await (await asOwner.post(`/api/cycles/schedules/${schedule.id}/run`)).json();
    expect(second.status).toBe("success");
    expect(second.cycleId).not.toBe(result.cycleId);

    // The manual action is still a project-authorized write.
    await expectRefused(await anon.post(`/api/cycles/schedules/${schedule.id}/run`, { failOnStatusCode: false }), "schedule run (anonymous)");
    await expectRefused(await asGuest.post(`/api/cycles/schedules/${schedule.id}/run`, { failOnStatusCode: false }), "schedule run (non-member)");
  });

  test("EXO-A-17 a fired daily schedule re-arms for the next local day and stays enabled", { tag: '@tesbo.testId("TES-TC-3039")' }, async () => {
    const { cycleId } = await seedRun(1);
    const timezone = "America/New_York";
    const res = await asOwner.post(`/api/projects/${tenant!.mainProjectId}/cycles/schedules`, {
      data: { name: stamp("daily due"), cycleId, scheduleType: "daily", localTime: "09:00", timezone },
      failOnStatusCode: false,
    });
    expect(res.status(), await res.text()).toBe(201);
    const schedule = await res.json();
    exec(`UPDATE cycle_run_schedules SET next_run_at = now() WHERE id = ${literal(schedule.id)};`);

    await expect
      .poll(
        () => scalar(`SELECT COALESCE(last_status, '') FROM cycle_run_schedules WHERE id = ${literal(schedule.id)};`),
        { message: "the worker must fire the due daily schedule", timeout: 120_000, intervals: [2_000] },
      )
      .toBe("success");

    const listed = await (await asOwner.get(`/api/projects/${tenant!.mainProjectId}/cycles/schedules`)).json();
    const row = listed.find((item: { id: string }) => item.id === schedule.id);
    expect(row).toMatchObject({ enabled: true, lastStatus: "success" });
    expect(new Date(row.nextRunAt).getTime(), "the next occurrence must be in the future").toBeGreaterThan(Date.now());
    expect(localTimeOf(row.nextRunAt, timezone), "the re-armed instant keeps the local time").toBe("09:00");
  });

  // ─── Share links ──────────────────────────────────────────────────────────

  test("EXO-A-11 sharing a run mints a token that serves the run publicly", { tag: '@tesbo.testId("TES-TC-185")' }, async () => {
    const { cycleId } = await seedRun(2);

    const shared = await asOwner.post(`/api/cycles/${cycleId}/share`, {
      data: { enabled: true },
      failOnStatusCode: false,
    });
    expect(shared.status(), `sharing a run — ${await shared.text()}`).toBeLessThan(400);
    const body = await shared.json();
    expect(body.shareEnabled).toBe(true);
    expect(body.shareToken, "sharing produced no token").toBeTruthy();
    // 24 random bytes as hex. Short enough to be guessable is the whole risk with an unauthenticated
    // URL, so the length is part of the contract.
    expect(String(body.shareToken).length).toBeGreaterThanOrEqual(32);

    // The public routes are deliberately unauthenticated — that is what a share link is for.
    const publicRun = await anon.get(`/api/public/shared-runs/${body.shareToken}`, { failOnStatusCode: false });
    expect(publicRun.status(), `the public run answered ${publicRun.status()}`).toBe(200);
    // D2/F8a owner-approved narrowing deliberately removes public Run id. Compare all eight
    // published fields with the authoritative authenticated Run, not a weaker name-only check.
    const ownerRun = await asOwner.get(`/api/cycles/${cycleId}`);
    expect(ownerRun.status()).toBe(200);
    const internal = await ownerRun.json();
    expect(internal.id).toBe(cycleId);
    expect(internal.shareToken).toBe(body.shareToken);
    expect(await publicRun.json()).toEqual({
      name: internal.name, status: internal.status, description: internal.description, environment: internal.environment,
      buildVersion: internal.buildVersion, createdAt: internal.createdAt, startedAt: internal.startedAt, endedAt: internal.endedAt,
    });

    const publicExecutions = await anon.get(`/api/public/shared-runs/${body.shareToken}/executions`, {
      failOnStatusCode: false,
    });
    expect(publicExecutions.status()).toBe(200);
    expect((await publicExecutions.json()).length).toBe(2);
  });

  test("a shared run keeps showing a deleted test case's title, external id, priority and type", async () => {
    // publicCycleExecutions carries the same live-join-vs-snapshot gap executions() had (V119) --
    // a soft-deleted test case must not blank out what a share link publishes any more than it
    // blanks out the authenticated Runs page.
    const { cycleId } = await seedRun(1);
    const [execution] = await (await asOwner.get(`/api/cycles/${cycleId}/executions`)).json();

    const delRes = await asOwner.delete(`/api/projects/${tenant!.mainProjectId}/testcases/${execution.testcaseId}`, {
      failOnStatusCode: false,
    });
    expect(delRes.status(), await delRes.text()).toBeLessThan(300);

    const shared = await asOwner.post(`/api/cycles/${cycleId}/share`, { data: { enabled: true } });
    const { shareToken } = await shared.json();

    const publicExecutions = await (
      await anon.get(`/api/public/shared-runs/${shareToken}/executions`, { failOnStatusCode: false })
    ).json();
    expect(publicExecutions).toHaveLength(1);
    expect(publicExecutions[0].title).toBe(execution.title);
    expect(publicExecutions[0].externalId).toBe(execution.externalId);
    expect(publicExecutions[0].priority).toBe(execution.priority);
    expect(publicExecutions[0].type).toBe(execution.type);
  });

  test("EXO-A-12 revoking a share link stops it serving the run", { tag: '@tesbo.testId("TES-TC-186")' }, async () => {
    const { cycleId } = await seedRun(1);
    const token = (await (await asOwner.post(`/api/cycles/${cycleId}/share`, { data: { enabled: true } })).json())
      .shareToken;
    expect((await anon.get(`/api/public/shared-runs/${token}`, { failOnStatusCode: false })).status()).toBe(200);

    const revoked = await asOwner.post(`/api/cycles/${cycleId}/share`, {
      data: { enabled: false },
      failOnStatusCode: false,
    });
    expect(revoked.status()).toBeLessThan(400);
    expect((await revoked.json()).shareEnabled).toBe(false);

    // The token still exists on the row, so re-enabling gives back the same link — but while it is
    // off, the public route must not serve anything.
    for (const suffix of ["", "/executions"]) {
      const res = await anon.get(`/api/public/shared-runs/${token}${suffix}`, { failOnStatusCode: false });
      expect(res.status(), `a revoked share link still served ${suffix || "the run"}`).toBe(404);
    }

    const reEnabled = await (
      await asOwner.post(`/api/cycles/${cycleId}/share`, { data: { enabled: true }, failOnStatusCode: false })
    ).json();
    expect(reEnabled.shareToken).toBe(token);
    expect((await anon.get(`/api/public/shared-runs/${token}`, { failOnStatusCode: false })).status()).toBe(200);
  });

  test("EXO-A-13 an unknown or absent share token serves nothing", { tag: '@tesbo.testId("TES-TC-187")' }, async () => {
    for (const token of ["not-a-real-token", "00000000000000000000000000000000", "%20"]) {
      for (const suffix of ["", "/executions"]) {
        const res = await anon.get(`/api/public/shared-runs/${token}${suffix}`, { failOnStatusCode: false });
        expect(res.status(), `token "${token}"${suffix} answered ${res.status()}: ${await res.text()}`).toBe(404);
      }
    }
  });

  test("EXO-A-13b a soft-deleted run's public share link goes dead (hard-delete remediation Phase 1)", async () => {
    /*
     * Before migrations/V111_cycles_soft_delete.sql, deleteCycle issued `DELETE FROM cycles WHERE
     * id = $1`, which — same row, same share_token — would ALSO have made the link stop resolving,
     * so this is not a new behavior from the caller's point of view. What changed is what happens
     * underneath: the run and its share_token now survive (soft-deleted), and publicCycle /
     * publicCycleExecutions (legacy.service.ts) were extended with an explicit
     * `AND deleted_at IS NULL` so a soft-deleted run's link does not keep quietly resolving forever.
     * This pins that the two routes actually got that filter, not merely the row-existence check
     * every other query happens to share.
     */
    const { cycleId } = await seedRun(1);
    const token = (await (await asOwner.post(`/api/cycles/${cycleId}/share`, { data: { enabled: true } })).json())
      .shareToken;
    expect((await anon.get(`/api/public/shared-runs/${token}`, { failOnStatusCode: false })).status()).toBe(200);
    expect(
      (await anon.get(`/api/public/shared-runs/${token}/executions`, { failOnStatusCode: false })).status(),
    ).toBe(200);

    const deleteRes = await asOwner.delete(`/api/cycles/${cycleId}`, { failOnStatusCode: false });
    expect(deleteRes.ok(), `deleting the run — ${await deleteRes.text()}`).toBeTruthy();

    // Database-visible: the token is still on the (now soft-deleted) row — this is not "the link
    // died because the token vanished", it is the deleted_at filter doing the work.
    expect(scalar(`SELECT share_token FROM cycles WHERE id = ${literal(cycleId)};`)).toBe(token);
    expect(scalar(`SELECT deleted_at IS NOT NULL FROM cycles WHERE id = ${literal(cycleId)};`)).toBe("t");

    for (const suffix of ["", "/executions"]) {
      const res = await anon.get(`/api/public/shared-runs/${token}${suffix}`, { failOnStatusCode: false });
      expect(res.status(), `a soft-deleted run's share link still served ${suffix || "the run"}`).toBe(404);
    }
  });

  test("EXO-A-14 only someone inside the project can mint a share link for its run", { tag: '@tesbo.testId("TES-TC-188")' }, async () => {
    const { cycleId } = await seedRun(1);

    // A public URL to a whole run — case titles, results, linked defect keys — must not be
    // creatable by someone who cannot even open the run.
    for (const [what, api] of [
      ["anonymous", anon],
      ["non-member", asGuest],
    ] as const) {
      const res = await api.post(`/api/cycles/${cycleId}/share`, { data: { enabled: true }, failOnStatusCode: false });
      await expectRefused(res, `share (${what})`);
    }
    expect(
      scalar(`SELECT COALESCE(share_token, '') FROM cycles WHERE id = ${literal(cycleId)};`),
      "an outsider minted a share token",
    ).toBe("");
  });

  test("EXO-A-15 a malformed or unknown cycle id is refused without a 500", { tag: '@tesbo.testId("TES-TC-189")' }, async () => {
    for (const bad of ["not-a-uuid", "11111111-1111-4111-8111-111111111111"]) {
      for (const [what, attempt] of [
        ["share", () => asOwner.post(`/api/cycles/${bad}/share`, { data: { enabled: true }, failOnStatusCode: false })],
        [
          "bulk-status",
          () =>
            asOwner.post(`/api/cycles/${bad}/executions/bulk-status`, {
              data: { executionIds: [], status: "Passed" },
              failOnStatusCode: false,
            }),
        ],
        ["executions", () => asOwner.get(`/api/cycles/${bad}/executions`, { failOnStatusCode: false })],
      ] as Array<[string, () => Promise<APIResponse>]>) {
        const res = await attempt();
        expect(res.status(), `${what} on cycle "${bad}" answered ${res.status()}: ${await res.text()}`).toBeLessThan(500);
      }
    }
  });

  // ─── The rest of /api/cycles/*, which the export fix left behind ───────────

  test("EXO-A-16 a run's executions, edits and deletion are not reachable without project access", { tag: '@tesbo.testId("TES-TC-190")' }, async () => {
    /*
     * The comment above exportCycleExecutions in legacy.service.ts records this gap in the product's
     * own words: "the rest of /api/cycles/* still has the original gap — executions(), getCycle(),
     * updateCycle(), deleteCycle() and the cycle_items routes take no @Req() either, so these same
     * rows remain readable through GET /api/cycles/:cycleId/executions."
     *
     * That is the same shape as §3 bugs 1–2 and 11, and it is what this test pins: a run holds case
     * titles, actual results and linked defect keys, and DELETE /api/cycles/:cycleId removes it
     * outright.
     */
    const { cycleId } = await seedRun(1);

    for (const [what, api] of [
      ["anonymous", anon],
      ["non-member", asGuest],
    ] as const) {
      for (const [route, attempt] of [
        ["GET cycle", () => api.get(`/api/cycles/${cycleId}`, { failOnStatusCode: false })],
        ["GET executions", () => api.get(`/api/cycles/${cycleId}/executions`, { failOnStatusCode: false })],
        [
          "PATCH cycle",
          () => api.patch(`/api/cycles/${cycleId}`, { data: { name: "renamed by an outsider" }, failOnStatusCode: false }),
        ],
        ["DELETE cycle", () => api.delete(`/api/cycles/${cycleId}`, { failOnStatusCode: false })],
      ] as Array<[string, () => Promise<APIResponse>]>) {
        const res = await attempt();
        await expectRefused(res, `${route} (${what})`);
      }
    }

    // And the run is still there, under its own name.
    expect(scalar(`SELECT COUNT(*) FROM cycles WHERE id = ${literal(cycleId)};`)).toBe("1");
    expect(scalar(`SELECT name FROM cycles WHERE id = ${literal(cycleId)};`)).not.toBe("renamed by an outsider");
  });

  // ─── Adding a large selection to a run ────────────────────────────────────

  /*
   * The production incident this covers: a "select all" on a project with a couple of thousand cases
   * POSTed one request that the backend served with three sequential round trips per case. It ran
   * for minutes, Cloudflare cut it off at 100s with a 524, and the rows already committed stayed in
   * the run.
   *
   * Draft rows are seeded through psql, then each gets a real human review receipt before the
   * timed ADD. This suite owns a disposable tenant, which is the only place bulk-seeding like
   * this is allowed.
   */
  test("EXO-E-01 a large selection is added completely, and fast enough not to hit a proxy timeout", { tag: '@tesbo.testId("TES-TC-923")' }, async () => {
    test.slow(); // Human approval setup is outside the unchanged 30-second add ceiling.
    const BATCH = 250;
    const cycle = await asOwner.post(`/api/projects/${tenant!.mainProjectId}/cycles`, {
      data: { name: stamp("bulk run") },
      failOnStatusCode: false,
    });
    expect(cycle.status()).toBe(201);
    const cycleId = (await cycle.json()).id;

    exec(
      `INSERT INTO testcases (project_id, external_id, title, status)
       SELECT ${literal(tenant!.mainProjectId)}, 'E2EBULK-' || g, 'E2E ExecOps bulk ' || lpad(g::text, 4, '0'), 'Draft'
         FROM generate_series(1, ${BATCH}) AS g;`,
    );
    const testcaseIds = column(
      `SELECT id FROM testcases WHERE project_id = ${literal(tenant!.mainProjectId)} ` +
        "AND title LIKE 'E2E ExecOps bulk %' ORDER BY title;",
    );
    expect(testcaseIds, "seeding the bulk test cases").toHaveLength(BATCH);
    await approveBulkFixtureCases(testcaseIds);

    const started = Date.now();
    const res = await asOwner.post(`/api/cycles/${cycleId}/testcases`, {
      data: { testcaseIds },
      failOnStatusCode: false,
    });
    const elapsed = Date.now() - started;

    expect(res.status(), `adding ${BATCH} cases answered ${res.status()}: ${await res.text()}`).toBeLessThan(400);

    // Completeness first — the half-imported run is the symptom users actually reported.
    expect(
      scalar(`SELECT COUNT(*) FROM cycle_items WHERE cycle_id = ${literal(cycleId)};`),
      "the run did not receive the whole selection",
    ).toBe(String(BATCH));
    expect(
      scalar(
        "SELECT COUNT(*) FROM executions e JOIN cycle_items ci ON ci.id = e.cycle_item_id " +
          `WHERE ci.cycle_id = ${literal(cycleId)};`,
      ),
      "some cycle items were left without an execution",
    ).toBe(String(BATCH));

    // Ordering, over the whole batch. The rows are written by one statement now, so they share a
    // created_at and `position` is the only thing carrying the caller's order — a regression there
    // would leave the run's list shuffled. Asserted here rather than in cycles.spec.ts because these
    // the fixture insertion is shared with the large-selection regression.
    expect(
      column(
        `SELECT testcase_id FROM cycle_items WHERE cycle_id = ${literal(cycleId)} ORDER BY position, created_at;`,
      ),
      "the run's order does not match the order the cases were sent in",
    ).toEqual(testcaseIds);

    /*
     * A generous ceiling, not a benchmark. The add is one statement now, so this lands in well under
     * a second against a local database and a couple of seconds against a hosted one. The old
     * per-case loop needed 3 x 250 = 750 sequential round trips, which blows past 30s on anything
     * with real network latency — the condition that produced the 524. Widening this to make a red
     * run green would be re-admitting exactly that bug.
     */
    expect(elapsed, `adding ${BATCH} cases took ${elapsed}ms`).toBeLessThan(30_000);
  });

  test("EXO-E-02 re-adding a large selection after a partial import does not duplicate it", { tag: '@tesbo.testId("TES-TC-924")' }, async () => {
    const BATCH = 40;
    const cycle = await asOwner.post(`/api/projects/${tenant!.mainProjectId}/cycles`, {
      data: { name: stamp("retry run") },
      failOnStatusCode: false,
    });
    const cycleId = (await cycle.json()).id;

    exec(
      `INSERT INTO testcases (project_id, external_id, title, status)
       SELECT ${literal(tenant!.mainProjectId)}, 'E2ERETRY-' || g, 'E2E ExecOps retry ' || lpad(g::text, 4, '0'), 'Draft'
         FROM generate_series(1, ${BATCH}) AS g;`,
    );
    const testcaseIds = column(
      `SELECT id FROM testcases WHERE project_id = ${literal(tenant!.mainProjectId)} ` +
        "AND title LIKE 'E2E ExecOps retry %' ORDER BY title;",
    );
    await approveBulkFixtureCases(testcaseIds);

    // Stand in for the partial import a timed-out request leaves behind: the first half is already
    // in the run when the user hits "add" again with the full selection.
    await asOwner.post(`/api/cycles/${cycleId}/testcases`, {
      data: { testcaseIds: testcaseIds.slice(0, BATCH / 2) },
      failOnStatusCode: false,
    });
    expect(scalar(`SELECT COUNT(*) FROM cycle_items WHERE cycle_id = ${literal(cycleId)};`)).toBe(String(BATCH / 2));

    const retry = await asOwner.post(`/api/cycles/${cycleId}/testcases`, {
      data: { testcaseIds },
      failOnStatusCode: false,
    });
    expect(retry.status()).toBeLessThan(400);

    // The retry completes the run instead of doubling the half that was already there.
    expect(
      scalar(`SELECT COUNT(*) FROM cycle_items WHERE cycle_id = ${literal(cycleId)};`),
      "retrying after a partial import duplicated the cases that had already landed",
    ).toBe(String(BATCH));
    expect(
      scalar(
        "SELECT COUNT(*) FROM (SELECT 1 FROM cycle_items WHERE cycle_id = " +
          `${literal(cycleId)} GROUP BY testcase_id HAVING COUNT(*) > 1) d;`,
      ),
      "the run holds the same test case more than once",
    ).toBe("0");
  });
});
