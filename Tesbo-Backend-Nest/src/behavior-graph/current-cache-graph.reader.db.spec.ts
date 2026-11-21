import { randomUUID } from "node:crypto";
import { Client, Pool } from "pg";
import { DatabaseService } from "../database/database.service";
import { makeLegacy } from "../legacy/test-helpers/legacy-service.fixture";
import { CurrentCacheGraphReader } from "./current-cache-graph.reader";

const url = process.env.DATABASE_URL ?? "";

/** Selected by the migrated PostgreSQL job, not inferred from a green skipped suite. */
(/\/tesbo_ci(?:\?|$)/.test(url) ? describe : describe.skip)(
  "current-cache graph internal reader — migrated PostgreSQL",
  () => {
    let admin: Client, pool: Pool, reader: CurrentCacheGraphReader;
    let org: string, project: string, other: string, user: string, caseId: string;
    const stamp = randomUUID();

    beforeAll(async () => {
      admin = new Client({ connectionString: url });
      await admin.connect();
      pool = new Pool({ connectionString: url, max: 4, connectionTimeoutMillis: 3000 });
      user = (await admin.query(
        "INSERT INTO users (email,name) VALUES ($1,'Graph capture QA') RETURNING id",
        [`graph-${stamp}@tesbo.invalid`]
      )).rows[0].id;
      org = (await admin.query(
        "INSERT INTO organizations (name,slug) VALUES ('Graph capture QA',$1) RETURNING id",
        [`graph-${stamp}`]
      )).rows[0].id;
      await admin.query("UPDATE users SET active_organization_id=$2 WHERE id=$1", [user, org]);
      project = (await admin.query(
        "INSERT INTO projects (organization_id,key,name) VALUES ($1,'GRPA','Graph local') RETURNING id", [org]
      )).rows[0].id;
      other = (await admin.query(
        "INSERT INTO projects (organization_id,key,name) VALUES ($1,'GRPB','Graph foreign') RETURNING id", [org]
      )).rows[0].id;
      await admin.query(
        "INSERT INTO organization_members (organization_id,user_id,role) VALUES ($1,$2,'member')",
        [org, user]
      );
      await admin.query(
        "INSERT INTO project_members (project_id,user_id,role) VALUES ($1,$2,'qa_engineer')",
        [project, user]
      );
      caseId = (await admin.query(
        "INSERT INTO testcases (project_id,external_id,title) VALUES ($1,'GRPA-TC-1','Visible case') RETURNING id",
        [project]
      )).rows[0].id;
      await admin.query(
        "INSERT INTO testcases (project_id,external_id,title) VALUES ($1,'GRPB-TC-1','Foreign private case')",
        [other]
      );
      const db = new DatabaseService(pool);
      reader = new CurrentCacheGraphReader(db, makeLegacy(db));
    });

    afterAll(async () => {
      await pool?.end();
      await admin?.end();
    });

    it("captures all active local cases in a single snapshot without reading foreign project data", async () => {
      const capture = await reader.captureForUser(user, project);
      expect(capture).toMatchObject({
        cacheOnly: true, inventoryStatus: "complete", upstreamFreshness: "unverified",
        originAttestation: "not_recorded", coverageAssertion: "none"
      });
      expect(capture.snapshot?.nodes).toHaveLength(1);
      expect(capture.snapshot?.nodes[0].id).toContain(caseId);
      expect(JSON.stringify(capture)).not.toContain("Foreign private case");
      expect(capture.snapshot?.edges).toEqual([]);
    });

    it("does not modify cases, historical versions, run records, or project membership on a capture", async () => {
      const before = await admin.query("SELECT * FROM testcases WHERE project_id = $1", [project]);
      const history = await admin.query("SELECT * FROM testcase_versions WHERE testcase_id=$1", [caseId]);
      const membership = await admin.query("SELECT * FROM project_members WHERE project_id=$1", [project]);
      await reader.captureForUser(user, project);
      expect((await admin.query("SELECT * FROM testcases WHERE project_id=$1", [project])).rows).toEqual(before.rows);
      expect((await admin.query("SELECT * FROM testcase_versions WHERE testcase_id=$1", [caseId])).rows).toEqual(history.rows);
      expect((await admin.query("SELECT * FROM project_members WHERE project_id=$1", [project])).rows).toEqual(membership.rows);
    });

    it("refuses an unsynced requirement link instead of inventing a matching requirement", async () => {
      await admin.query("UPDATE testcases SET jira_issue_key='GRPA-UNSYNCED' WHERE id=$1", [caseId]);
      try {
        const capture = await reader.captureForUser(user, project);
        expect(capture.snapshot).toBeNull();
        expect(capture.unresolvedDiagnostics.join(" ")).toContain("unresolved");
      } finally {
        await admin.query("UPDATE testcases SET jira_issue_key=NULL WHERE id=$1", [caseId]);
      }
    });

    it("refuses a foreign user, even when a caller attempts to bypass preauthorization", async () => {
      const foreign = randomUUID();
      const db = new DatabaseService(pool), svc = makeLegacy(db);
      jest.spyOn(svc, "requireProjectAccess").mockResolvedValue({ organization_id: org } as never);
      await expect(new CurrentCacheGraphReader(db, svc).captureForUser(foreign, project))
        .rejects.toMatchObject({ status: 403 });
    });

    it("rechecks revoked project membership inside the same SQL statement", async () => {
      const db = new DatabaseService(pool), svc = makeLegacy(db);
      jest.spyOn(svc, "requireProjectAccess").mockImplementation(async () => {
        await admin.query("DELETE FROM project_members WHERE project_id=$1 AND user_id=$2", [project, user]);
        return { organization_id: org } as never;
      });
      try {
        await expect(new CurrentCacheGraphReader(db, svc).captureForUser(user, project))
          .rejects.toMatchObject({ status: 403 });
      } finally {
        await admin.query(
          "INSERT INTO project_members (project_id,user_id,role) VALUES ($1,$2,'qa_engineer')",
          [project, user]
        );
      }
    });

    it("refuses an absent or unauthenticated principal before database capture", async () => {
      await expect(reader.captureForUser(null, project)).rejects.toMatchObject({ status: 403 });
    });
  }
);
