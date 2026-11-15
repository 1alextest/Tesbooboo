import { randomUUID } from "node:crypto";
import { Client } from "pg";
import type { PoolClient } from "pg";
import type { DatabaseService } from "../database/database.service";
import { makeLegacy } from "./test-helpers/legacy-service.fixture";
import { assertApprovedRunCases } from "./approved-run-case-guard";

const url = process.env.DATABASE_URL ?? "";
(/\/tesbo_ci(?:\?|$)/.test(url) ? describe : describe.skip)(
  "Approved-only native test-run writes — real migrated PostgreSQL", () => {
    let setup: Client, writer: Client, demoter: Client;
    let org: string, project: string, cycle: string;
    let approved: string, draft: string, other: string;
    let svc: ReturnType<typeof makeLegacy>;
    const suffix = randomUUID().slice(0, 8);

    const count = async () => Number((await setup.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM cycle_items WHERE cycle_id=$1 AND deleted_at IS NULL",
      [cycle]
    )).rows[0].count);

    beforeAll(async () => {
      setup = new Client({ connectionString: url });
      writer = new Client({ connectionString: url });
      demoter = new Client({ connectionString: url });
      await Promise.all([setup.connect(), writer.connect(), demoter.connect()]);
      org = (await setup.query<{ id: string }>(
        "INSERT INTO organizations(name,slug) VALUES ('Approved run QA',$1) RETURNING id",
        ["approved-run-" + suffix]
      )).rows[0].id;
      project = (await setup.query<{ id: string }>(
        "INSERT INTO projects(organization_id,key,name) VALUES ($1,'APR','Approved Run QA') RETURNING id",
        [org]
      )).rows[0].id;
      cycle = (await setup.query<{ id: string }>(
        "INSERT INTO cycles(project_id,name) VALUES ($1,'Manual approved run') RETURNING id",
        [project]
      )).rows[0].id;
      approved = (await setup.query<{ id: string }>(
        "INSERT INTO testcases(project_id,external_id,title,status) VALUES ($1,'APR-TC-1','Approved case','Approved') RETURNING id",
        [project]
      )).rows[0].id;
      draft = (await setup.query<{ id: string }>(
        "INSERT INTO testcases(project_id,external_id,title,status) VALUES ($1,'APR-TC-2','Draft case','Draft') RETURNING id",
        [project]
      )).rows[0].id;
      other = (await setup.query<{ id: string }>(
        "INSERT INTO testcases(project_id,external_id,title,status) VALUES ($1,'APR-TC-3','In review case','In Review') RETURNING id",
        [project]
      )).rows[0].id;

      svc = makeLegacy({
        query: (sql: string, args?: unknown[]) => writer.query(sql, args),
        transaction: async <T>(fn: (client: PoolClient) => Promise<T>): Promise<T> => {
          await writer.query("BEGIN");
          try {
            const result = await fn(writer as unknown as PoolClient);
            await writer.query("COMMIT");
            return result;
          } catch (error) {
            await writer.query("ROLLBACK");
            throw error;
          }
        }
      } as unknown as DatabaseService);
      jest.spyOn(svc as unknown as { requireCycleAccess: (...args: unknown[]) => Promise<string> },
        "requireCycleAccess").mockResolvedValue(project);
    });

    afterAll(async () => {
      try {
        if (cycle) {
          await setup.query(
            "DELETE FROM executions WHERE cycle_item_id IN (SELECT id FROM cycle_items WHERE cycle_id=$1)",
            [cycle]
          );
          await setup.query("DELETE FROM cycle_items WHERE cycle_id=$1", [cycle]);
          await setup.query("DELETE FROM cycles WHERE id=$1", [cycle]);
        }
        if (project) await setup.query("DELETE FROM testcases WHERE project_id=$1", [project]);
        if (project) await setup.query("DELETE FROM projects WHERE id=$1", [project]);
        if (org) await setup.query("DELETE FROM organizations WHERE id=$1", [org]);
      } finally {
        await Promise.all([setup?.end(), writer?.end(), demoter?.end()].filter(Boolean));
      }
    });

    afterEach(async () => {
      await setup.query(
        "DELETE FROM executions WHERE cycle_item_id IN (SELECT id FROM cycle_items WHERE cycle_id=$1)",
        [cycle]
      );
      await setup.query("DELETE FROM cycle_items WHERE cycle_id=$1", [cycle]);
      await setup.query(
        "UPDATE testcases SET status=CASE WHEN id=$2 THEN 'Approved' WHEN id=$3 THEN 'Draft' ELSE 'In Review' END WHERE project_id=$1",
        [project, approved, draft]
      );
    });

    const add = (ids: string[]) => svc.addCycleTestCases(cycle, randomUUID(), { testcaseIds: ids });

    it("accepts Approved cases and keeps idempotent retry counts", async () => {
      const first = await add([approved]);
      expect(first).toEqual({ requested: 1, added: 1, skipped: 0 });
      expect(await add([approved])).toEqual({ requested: 1, added: 0, skipped: 1 });
      expect(await count()).toBe(1);
      expect((await setup.query<{ count: number }>(
        "SELECT COUNT(*)::int AS count FROM executions e JOIN cycle_items ci ON ci.id=e.cycle_item_id WHERE ci.cycle_id=$1",
        [cycle]
      )).rows[0].count).toBe(1);
    });

    it.each(["Draft", "In Review", "Deprecated"])(
      "rejects a mixed Approved and %s selection atomically", async (status) => {
        await setup.query("UPDATE testcases SET status=$2 WHERE id=$1", [draft, status]);
        await expect(add([approved, draft])).rejects.toMatchObject({ status: 409 });
        expect(await count()).toBe(0);
      }
    );

    it("rejects the separately seeded In Review case without creating a run item", async () => {
      await expect(add([approved, other])).rejects.toMatchObject({ status: 409 });
      expect(await count()).toBe(0);
    });

    it("preserves skipped counts for unknown, duplicate and malformed case ids", async () => {
      const unknown = randomUUID();
      expect(await add([approved, approved, unknown, "bad-id"])).toEqual({
        requested: 4, added: 1, skipped: 3
      });
      expect(await count()).toBe(1);
    });

    it("waits for an in-flight demotion and refuses the newly unapproved case", async () => {
      await demoter.query("BEGIN");
      await demoter.query("UPDATE testcases SET status='Draft' WHERE id=$1", [approved]);
      let settled = false;
      const pending = add([approved]).finally(() => { settled = true; });
      await new Promise((resolve) => setTimeout(resolve, 80));
      expect(settled).toBe(false);
      await demoter.query("COMMIT");
      await expect(pending).rejects.toMatchObject({ status: 409 });
      expect(await count()).toBe(0);
    });

    it("holds a shared status lock until the native add commits", async () => {
      await writer.query("BEGIN");
      await assertApprovedRunCases(writer as unknown as PoolClient, project, [approved]);
      let demotionFinished = false;
      const demotion = demoter.query("UPDATE testcases SET status='Draft' WHERE id=$1", [approved])
        .finally(() => { demotionFinished = true; });
      try {
        await new Promise((resolve) => setTimeout(resolve, 80));
        expect(demotionFinished).toBe(false);
      } finally {
        await writer.query("COMMIT");
      }
      await demotion;
      expect(demotionFinished).toBe(true);
    });
  }
);
