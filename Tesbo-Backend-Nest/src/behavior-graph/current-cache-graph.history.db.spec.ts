import { randomUUID } from "node:crypto";
import { Client, Pool } from "pg";
import { DatabaseService } from "../database/database.service";
import { makeLegacy } from "../legacy/test-helpers/legacy-service.fixture";
import { CurrentCacheGraphReader } from "./current-cache-graph.reader";
import { CurrentCacheGraphHistory } from "./current-cache-graph.history";

const url = process.env.DATABASE_URL ?? "";
(/\/tesbo_ci(?:\?|$)/.test(url) ? describe : describe.skip)(
  "current cache graph history — real migrated PostgreSQL", () => {
    let admin: Client, pool: Pool, store: CurrentCacheGraphHistory;
    let org: string, project: string, user: string, caseId: string;
    const stamp = randomUUID();

    beforeAll(async () => {
      admin = new Client({ connectionString: url });
      await admin.connect();
      pool = new Pool({ connectionString: url, max: 5 });
      user = (await admin.query("INSERT INTO users(email,name) VALUES ($1,'Graph history QA') RETURNING id",
        [`history-${stamp}@tesbo.invalid`])).rows[0].id;
      org = (await admin.query("INSERT INTO organizations(name,slug) VALUES ('Graph history QA',$1) RETURNING id",
        [`history-${stamp}`])).rows[0].id;
      await admin.query("UPDATE users SET active_organization_id=$2 WHERE id=$1", [user, org]);
      project = (await admin.query("INSERT INTO projects(organization_id,key,name) VALUES ($1,'GHIS','Graph history') RETURNING id", [org])).rows[0].id;
      await admin.query("INSERT INTO organization_members(organization_id,user_id,role) VALUES ($1,$2,'member')", [org,user]);
      await admin.query("INSERT INTO project_members(project_id,user_id,role) VALUES ($1,$2,'qa_engineer')", [project,user]);
      caseId = (await admin.query("INSERT INTO testcases(project_id,external_id,title) VALUES ($1,'GHIS-TC-1','Original') RETURNING id", [project])).rows[0].id;
      const db = new DatabaseService(pool);
      store = new CurrentCacheGraphHistory(db, new CurrentCacheGraphReader(db, makeLegacy(db)));
    });

    afterAll(async () => {
      await pool?.end();
      await admin?.end();
    });

    it("writes an authorized initial observation, not a fictitious changed-requirement notice", async () => {
      const result = await store.captureForUser(user, project);
      expect(result.stored).toBe(true);
      expect(result.reviewReceipt).toBeNull();
      const row = await admin.query("SELECT capture_json, review_receipt_json FROM graph_capture_history WHERE id=$1", [result.id]);
      expect(row.rows[0].capture_json.snapshot.nodes).toHaveLength(1);
      expect(row.rows[0].capture_json.upstreamFreshness).toBe("unverified");
      expect(row.rows[0].review_receipt_json).toBeNull();
    });

    it("is idempotent on an unchanged project snapshot and serializes concurrent retries", async () => {
      const [a,b] = await Promise.all([store.captureForUser(user,project),store.captureForUser(user,project)]);
      expect(a.id).toBe(b.id);
      expect(a.stored).toBe(false);
      expect(b.stored).toBe(false);
      const rows = await admin.query("SELECT COUNT(*)::int AS count FROM graph_capture_history WHERE project_id=$1", [project]);
      expect(rows.rows[0].count).toBe(1);
    });

    it("appends an exact versioned case change receipt and retains both historical captures", async () => {
      await admin.query("UPDATE testcases SET title='Changed' WHERE id=$1", [caseId]);
      const result = await store.captureForUser(user, project);
      expect(result.stored).toBe(true);
      expect(result.reviewReceipt?.candidates[0].reasons).toContain("case_changed");
      expect(result.reviewReceipt?.evidence.executionAssertion).toBe("none");
      const saved = await admin.query("SELECT review_receipt_json FROM graph_capture_history WHERE id=$1", [result.id]);
      expect(saved.rows[0].review_receipt_json.id).toBe(result.reviewReceipt?.id);
      expect((await admin.query("SELECT COUNT(*)::int AS count FROM graph_capture_history WHERE project_id=$1", [project])).rows[0].count).toBe(2);
    });

    it("refuses missing authorization and does not write another history row", async () => {
      await expect(store.captureForUser(randomUUID(), project)).rejects.toBeDefined();
      await expect(store.captureForUser(null, project)).rejects.toBeDefined();
      expect((await admin.query("SELECT COUNT(*)::int AS count FROM graph_capture_history WHERE project_id=$1", [project])).rows[0].count).toBe(2);
    });

    it("lists history with current membership, stable newest-first pagination and no raw snapshot exposure", async () => {
      const full = await store.listForUser(user, project);
      expect(full).toHaveLength(2);
      expect(BigInt(full[0].id)).toBeGreaterThan(BigInt(full[1].id));
      expect(full[0].reviewReceipt?.evidence.coverageAssertion).toBe("none");
      expect(full[0]).not.toHaveProperty("capture_json");
      expect(full[0]).not.toHaveProperty("captureJson");
      const page = await store.listForUser(user, project, 1);
      const older = await store.listForUser(user, project, 1, page[0].id);
      expect(page.map((e) => e.id)).toEqual([full[0].id]);
      expect(older.map((e) => e.id)).toEqual([full[1].id]);
      expect(await store.listForUser(user, project, 1, full[1].id)).toEqual([]);
    });

    it("refuses cross-project history reads and invalid pagination without exposing records", async () => {
      await expect(store.listForUser(randomUUID(), project)).rejects.toMatchObject({ status: 403 });
      await expect(store.listForUser(null, project)).rejects.toMatchObject({ status: 403 });
      await expect(store.listForUser(user, project, 0)).rejects.toMatchObject({ status: 409 });
      await expect(store.listForUser(user, project, 101)).rejects.toMatchObject({ status: 409 });
      await expect(store.listForUser(user, project, 1, "0 OR TRUE")).rejects.toMatchObject({ status: 409 });
      const foreign = (await admin.query(
        "INSERT INTO projects(organization_id,key,name) VALUES ($1,'GHIF','Foreign graph') RETURNING id",
        [org]
      )).rows[0].id;
      await expect(store.listForUser(user, foreign)).rejects.toMatchObject({ status: 403 });
    });

    it("refuses incomplete local source cache rather than persisting false completeness", async () => {
      await admin.query("UPDATE testcases SET jira_issue_key='UNSYNCED-1' WHERE id=$1", [caseId]);
      try {
        await expect(store.captureForUser(user, project)).rejects.toMatchObject({
          status: 409,
          response: { error: "Graph capture not comparable: cached source inventory incomplete or ambiguous" }
        });
        expect((await admin.query("SELECT COUNT(*)::int AS count FROM graph_capture_history WHERE project_id=$1", [project])).rows[0].count).toBe(2);
      } finally {
        await admin.query("UPDATE testcases SET jira_issue_key=NULL WHERE id=$1", [caseId]);
      }
    });
  }
);
