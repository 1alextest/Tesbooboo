import { randomUUID } from "node:crypto";
import { Client, Pool } from "pg";
import { DatabaseService } from "../database/database.service";
import { makeLegacy } from "../legacy/test-helpers/legacy-service.fixture";
import { CurrentCacheGraphReader } from "./current-cache-graph.reader";

const url = process.env.DATABASE_URL ?? "";

(/\/tesbo_ci(?:\?|$)/.test(url) ? describe : describe.skip)(
  "current-cache graph authorization boundary — migrated PostgreSQL",
  () => {
    let db: Client, pool: Pool, user: string, project: string, org: string;
    const stamp = randomUUID();

    beforeAll(async () => {
      db = new Client({ connectionString: url });
      await db.connect();
      pool = new Pool({ connectionString: url, max: 3, connectionTimeoutMillis: 3000 });
      org = (await db.query(
        "INSERT INTO organizations (name,slug) VALUES ('Graph auth fixture',$1) RETURNING id",
        [`graph-auth-${stamp}`]
      )).rows[0].id;
      user = (await db.query(
        "INSERT INTO users (email,name,active_organization_id) VALUES ($1,'Graph auth tester',$2) RETURNING id",
        [`graph-auth-${stamp}@tesbo.invalid`, org]
      )).rows[0].id;
      project = (await db.query(
        "INSERT INTO projects (organization_id,key,name) VALUES ($1,'GRA','Graph auth project') RETURNING id",
        [org]
      )).rows[0].id;
      await db.query("INSERT INTO organization_members (organization_id,user_id,role) VALUES ($1,$2,'member')", [org,user]);
      await db.query("INSERT INTO project_members (project_id,user_id,role) VALUES ($1,$2,'qa_engineer')", [project,user]);
    });
    afterAll(async () => { await pool?.end(); await db?.end(); });

    function captureWithPreauth(preauth: () => Promise<unknown>) {
      const service = new DatabaseService(pool);
      const legacy = makeLegacy(service);
      jest.spyOn(legacy, "requireProjectAccess")
        .mockImplementation(async () => preauth() as Promise<never>);
      return new CurrentCacheGraphReader(service, legacy).captureForUser(user, project);
    }

    it("refuses a lost organization membership between preauth and source capture", async () => {
      try {
        await expect(captureWithPreauth(async () => {
          await db.query("DELETE FROM organization_members WHERE organization_id=$1 AND user_id=$2", [org,user]);
          return { organization_id: org };
        })).rejects.toMatchObject({ status: 403 });
      } finally {
        await db.query("INSERT INTO organization_members (organization_id,user_id,role) VALUES ($1,$2,'member')", [org,user]);
      }
    });

    it("refuses organization substitution even when the project and principal are real", async () => {
      const otherOrg = randomUUID();
      await expect(captureWithPreauth(async () => ({ organization_id: otherOrg })))
        .rejects.toMatchObject({ status: 403 });
    });

    it("refuses after a project member disappears without creating an empty snapshot", async () => {
      try {
        await expect(captureWithPreauth(async () => {
          await db.query("DELETE FROM project_members WHERE project_id=$1 AND user_id=$2", [project,user]);
          return { organization_id: org };
        })).rejects.toMatchObject({ status: 403 });
      } finally {
        await db.query("INSERT INTO project_members (project_id,user_id,role) VALUES ($1,$2,'qa_engineer')", [project,user]);
      }
    });
  }
);
