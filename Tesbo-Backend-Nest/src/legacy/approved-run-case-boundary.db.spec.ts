import { randomUUID } from "node:crypto";
import { Client, Pool } from "pg";
import { ConflictException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { makeLegacy } from "./test-helpers/legacy-service.fixture";

const url = process.env.DATABASE_URL ?? "";
(/\/tesbo_ci(?:\?|$)/.test(url) ? describe : describe.skip)(
  "shared Approved-only run/case mutation boundary — real migrated PostgreSQL", () => {
    let admin: Client, pool: Pool, legacy: ReturnType<typeof makeLegacy>;
    let org: string, project: string, other: string, user: string, run: string;
    let approved: string, draft: string, review: string, deprecated: string, foreign: string;
    const stamp = randomUUID();

    beforeAll(async () => {
      admin = new Client({ connectionString: url });
      await admin.connect();
      pool = new Pool({ connectionString: url, max: 5 });
      const db = new DatabaseService(pool);
      legacy = makeLegacy(db);
      user = (await admin.query(
        "INSERT INTO users(email,name) VALUES ($1,'Approved boundary QA') RETURNING id",
        ["run-approval-" + stamp + "@tesbo.invalid"]
      )).rows[0].id;
      org = (await admin.query(
        "INSERT INTO organizations(name,slug) VALUES ('Approved boundary QA',$1) RETURNING id",
        ["approved-boundary-" + stamp]
      )).rows[0].id;
      await admin.query("UPDATE users SET active_organization_id=$2 WHERE id=$1", [user, org]);
      project = (await admin.query(
        "INSERT INTO projects(organization_id,key,name) VALUES ($1,'APBR','Approved run boundary') RETURNING id",
        [org]
      )).rows[0].id;
      other = (await admin.query(
        "INSERT INTO projects(organization_id,key,name) VALUES ($1,'APBO','Foreign project') RETURNING id",
        [org]
      )).rows[0].id;
      await admin.query(
        "INSERT INTO organization_members(organization_id,user_id,role) VALUES ($1,$2,'member')",
        [org, user]
      );
      await admin.query(
        "INSERT INTO project_members(project_id,user_id,role) VALUES ($1,$2,'qa_engineer')",
        [project, user]
      );
      const makeCase = async (p: string, code: string, status: string) =>
        (await admin.query<{ id: string }>(
          "INSERT INTO testcases(project_id,external_id,title,status) VALUES ($1,$2,$3,$4) RETURNING id",
          [p, code, "Boundary " + code, status]
        )).rows[0].id;
      approved = await makeCase(project, "APBR-TC-A", "Approved");
      draft = await makeCase(project, "APBR-TC-D", "Draft");
      review = await makeCase(project, "APBR-TC-R", "In Review");
      deprecated = await makeCase(project, "APBR-TC-X", "Deprecated");
      foreign = await makeCase(other, "APBO-TC-F", "Approved");
      run = (await admin.query<{ id: string }>(
        "INSERT INTO cycles(project_id,name) VALUES ($1,'Native Approved boundary') RETURNING id",
        [project]
      )).rows[0].id;
    });

    afterAll(async () => {
      // Only disposable fixture records. Existing user/organization audit
      // references can be immutable, so do not delete unrelated customers.
      try {
        if (admin && run) {
          await admin.query("DELETE FROM executions WHERE cycle_item_id IN (SELECT id FROM cycle_items WHERE cycle_id=$1)", [run]);
          await admin.query("DELETE FROM cycle_items WHERE cycle_id=$1", [run]);
          await admin.query("DELETE FROM cycles WHERE id=$1", [run]);
        }
      } finally {
        await pool?.end();
        await admin?.end();
      }
    });

    const activeCount = async () => (await admin.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM cycle_items WHERE cycle_id=$1 AND deleted_at IS NULL", [run]
    )).rows[0].count;

    it("rejects mixed Approved + Draft and does not partially write any case or execution", async () => {
      await expect(legacy.addCycleTestCases(run, user, { testcaseIds: [approved, draft] }))
        .rejects.toBeInstanceOf(ConflictException);
      expect(await activeCount()).toBe(0);
      expect((await admin.query<{ count: number }>(
        "SELECT COUNT(*)::int AS count FROM executions e JOIN cycle_items ci ON ci.id=e.cycle_item_id WHERE ci.cycle_id=$1", [run]
      )).rows[0].count).toBe(0);
    });

    it.each(["Draft", "In Review", "Deprecated"])(
      "refuses %s even when it is the only case requested", async (status) => {
        const id = status === "Draft" ? draft : status === "In Review" ? review : deprecated;
        await expect(legacy.addCycleTestCases(run, user, { testcaseIds: [id] }))
          .rejects.toMatchObject({ status: 409 });
        expect(await activeCount()).toBe(0);
      }
    );

    it("adds an Approved case exactly once and preserves old skipped semantics for missing/foreign IDs", async () => {
      const first = await legacy.addCycleTestCases(run, user, {
        testcaseIds: [approved, randomUUID(), foreign]
      });
      expect(first).toEqual({ requested: 3, added: 1, skipped: 2 });
      const replay = await legacy.addCycleTestCases(run, user, { testcaseIds: [approved] });
      expect(replay).toEqual({ requested: 1, added: 0, skipped: 1 });
      expect(await activeCount()).toBe(1);
      expect((await admin.query<{ count: number }>(
        "SELECT COUNT(*)::int AS count FROM executions e JOIN cycle_items ci ON ci.id=e.cycle_item_id WHERE ci.cycle_id=$1",
        [run]
      )).rows[0].count).toBe(1);
    });

    it("refuses a case demoted after an earlier successful add and leaves prior snapshot and execution intact", async () => {
      await admin.query("UPDATE testcases SET status='Draft' WHERE id=$1", [approved]);
      try {
        await expect(legacy.addCycleTestCases(run, user, { testcaseIds: [approved] }))
          .rejects.toMatchObject({ status: 409 });
        expect(await activeCount()).toBe(1);
        const row = (await admin.query<{ title: string; status: string }>(
          `SELECT ci.snapshot_title AS title, e.status FROM cycle_items ci
             JOIN executions e ON e.cycle_item_id=ci.id WHERE ci.cycle_id=$1 AND ci.testcase_id=$2`,
          [run, approved]
        )).rows[0];
        expect(row).toEqual({ title: "Boundary APBR-TC-A", status: "Untested" });
      } finally {
        await admin.query("UPDATE testcases SET status='Approved' WHERE id=$1", [approved]);
      }
    });
  }
);
