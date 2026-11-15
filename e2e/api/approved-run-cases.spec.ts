import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { exec, literal, scalar } from "../utils/psql";
import {
  loginAs, provisionRbacTenant, rbacSuiteSkipReason, type RbacTenant
} from "../utils/rbac-tenant";

/**
 * T457: real REST policy boundary against a distinct disposable tenant.
 * This file does not modify an existing customer's Test Runs or tests.
 * MCP atomicity and automation attachment additionally run in migrated-PG CI.
 */
test.describe("native Approved-only test run insertion", () => {
  let tenant: RbacTenant | null = null;
  let qa: APIRequestContext;

  test.beforeAll(async () => {
    tenant = await provisionRbacTenant("run-approval");
    if (tenant) qa = await loginAs(tenant.qa);
  });

  test.afterAll(async () => { await qa?.dispose(); });
  test.beforeEach(() => {
    const reason = rbacSuiteSkipReason(tenant);
    test.skip(reason !== null, reason ?? "");
  });

  test("T457 Approved-only direct run API rejects unapproved cases atomically and preserves old runs", async () => {
    const project = tenant!.mainProjectId;
    const foreignProject = tenant!.secondProjectId;
    const stamp = randomUUID().slice(0, 8);
    const name = "T457 native policy " + stamp;
    let firstRun: string | null = null, secondRun: string | null = null;
    const testcaseIds: string[] = [];

    const createCase = (owner: string, key: string, status: string): string => {
      const id = scalar("INSERT INTO testcases(project_id,external_id,title,status)" +
        " VALUES (" + literal(owner) + ", " + literal("T457-" + key + stamp) +
        ", " + literal("T457 policy " + key) + ", " + literal(status) + ") RETURNING id;");
      testcaseIds.push(id);
      return id;
    };
    const counts = (runId: string) => ({
      items: Number(scalar("SELECT COUNT(*)::int FROM cycle_items WHERE cycle_id=" + literal(runId) +
        " AND deleted_at IS NULL;")),
      executions: Number(scalar("SELECT COUNT(*)::int FROM executions e JOIN cycle_items ci" +
        " ON ci.id=e.cycle_item_id WHERE ci.cycle_id=" + literal(runId) + " AND e.deleted_at IS NULL;"))
    });
    try {
      const approved = createCase(project, "A", "Approved");
      const draft = createCase(project, "D", "Draft");
      const review = createCase(project, "R", "In Review");
      const foreign = createCase(foreignProject, "F", "Approved");
      const create = async (suffix: string) => {
        const r = await qa.post("/api/projects/" + project + "/cycles", {
          data: { name: name + suffix, environment: "CI" }
        });
        expect(r.ok(), await r.text()).toBe(true);
        return (await r.json()).id as string;
      };
      firstRun = await create(" one");
      const add = (runId: string, ids: string[]) => qa.post(
        "/api/cycles/" + runId + "/testcases",
        { data: { testcaseIds: ids }, failOnStatusCode: false }
      );
      for (const rejected of [[approved, draft], [approved, review]]) {
        const r = await add(firstRun, rejected);
        expect(r.status(), await r.text()).toBe(409);
        expect(await r.text()).toContain("Only Approved test cases");
        expect(counts(firstRun)).toEqual({ items: 0, executions: 0 });
      }
      const missing = randomUUID();
      const accepted = await add(firstRun, [approved, foreign, missing]);
      expect(accepted.ok(), await accepted.text()).toBeTruthy();
      expect(await accepted.json()).toMatchObject({ requested: 3, added: 1, skipped: 2 });
      expect(counts(firstRun)).toEqual({ items: 1, executions: 1 });
      const retry = await add(firstRun, [approved]);
      expect(retry.ok()).toBeTruthy();
      expect(await retry.json()).toMatchObject({ requested: 1, added: 0, skipped: 1 });
      expect(counts(firstRun)).toEqual({ items: 1, executions: 1 });
      // Demotion must not erase the historical execution or permit a new one.
      exec("UPDATE testcases SET status='Draft' WHERE id=" + literal(approved) + ";");
      const old = await add(firstRun, [approved]);
      expect(old.ok(), await old.text()).toBeTruthy();
      expect(await old.json()).toMatchObject({ added: 0, skipped: 1 });
      secondRun = await create(" two");
      const refused = await add(secondRun, [approved]);
      expect(refused.status()).toBe(409);
      expect(counts(secondRun)).toEqual({ items: 0, executions: 0 });
      expect(counts(firstRun)).toEqual({ items: 1, executions: 1 });
    } finally {
      for (const id of testcaseIds) {
        exec("UPDATE testcases SET deleted_at=now() WHERE id=" + literal(id) + ";");
      }
      for (const id of [firstRun, secondRun].filter((v): v is string => !!v)) {
        await qa.delete("/api/cycles/" + id, { failOnStatusCode: false });
      }
    }
  });
});
