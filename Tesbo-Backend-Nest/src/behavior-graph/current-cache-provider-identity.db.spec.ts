import { randomUUID } from "node:crypto";
import { Client, Pool } from "pg";
import { DatabaseService } from "../database/database.service";
import { makeLegacy } from "../legacy/test-helpers/legacy-service.fixture";
import { compareComparableGraphCaptures } from "./graph-comparison-gate";
import { diffGraphSnapshots } from "./graph-change-impact";
import { CurrentCacheGraphReader } from "./current-cache-graph.reader";

const url = process.env.DATABASE_URL ?? "";

/**
 * Real migrated PostgreSQL fixtures, not mocked source rows.
 * A Jira cache row is project-scoped even if two projects reference identical
 * remote identifiers in the same organization/connection.
 */
(/\/tesbo_ci(?:\?|$)/.test(url) ? describe : describe.skip)(
  "current-cache graph provider identity — migrated PostgreSQL",
  () => {
    let admin: Client;
    let pool: Pool;
    let reader: CurrentCacheGraphReader;
    let user: string;
    let org: string;
    let projectA: string;
    let projectB: string;
    let connection: string;
    let caseA: string;
    let caseB: string;
    let ticketA: string;
    const stamp = randomUUID();

    beforeAll(async () => {
      admin = new Client({ connectionString: url });
      await admin.connect();
      pool = new Pool({ connectionString: url, max: 4, connectionTimeoutMillis: 3000 });
      org = (await admin.query(
        "INSERT INTO organizations (name,slug) VALUES ('Graph provider fixture',$1) RETURNING id",
        [`graph-provider-${stamp}`]
      )).rows[0].id;
      user = (await admin.query(
        "INSERT INTO users (email,name,active_organization_id) VALUES ($1,'Graph provider QA',$2) RETURNING id",
        [`graph-provider-${stamp}@tesbo.invalid`, org]
      )).rows[0].id;
      await admin.query(
        "INSERT INTO organization_members (organization_id,user_id,role) VALUES ($1,$2,'member')",
        [org, user]
      );
      projectA = (await admin.query(
        "INSERT INTO projects (organization_id,key,name) VALUES ($1,'GPA','Graph Provider A') RETURNING id",
        [org]
      )).rows[0].id;
      projectB = (await admin.query(
        "INSERT INTO projects (organization_id,key,name) VALUES ($1,'GPB','Graph Provider B') RETURNING id",
        [org]
      )).rows[0].id;
      await admin.query(
        "INSERT INTO project_members (project_id,user_id,role) VALUES ($1,$2,'qa_engineer'),($3,$2,'qa_engineer')",
        [projectA, user, projectB]
      );

      connection = (await admin.query(
        `INSERT INTO integration_connections (organization_id,provider,external_id,site_url,access_token,token_expires_at)
         VALUES ($1,'jira','workspace-one','https://workspace-one.atlassian.net','TEST_FIXTURE_NEVER_VALID',now() + interval '1 day') RETURNING id`,
        [org]
      )).rows[0].id;
      await admin.query(
        `INSERT INTO jira_project_mappings (project_id,jira_connection_id,jira_project_id,jira_project_key,jira_project_name,enabled)
         VALUES ($1,$3,'remote-project-1','GRA','Graph Remote',true),
                ($2,$3,'remote-project-1','GRA','Graph Remote',true)`,
        [projectA, projectB, connection]
      );
      ticketA = (await admin.query(
        `INSERT INTO jira_tickets (project_id,jira_connection_id,jira_issue_id,jira_issue_key,
           mapped_remote_id,summary,description)
         VALUES ($1,$2,'remote-issue-42','GRA-42','remote-project-1','First project only','Same upstream key')
         RETURNING id`,
        [projectA, connection]
      )).rows[0].id;
      await admin.query(
        `INSERT INTO jira_tickets (project_id,jira_connection_id,jira_issue_id,jira_issue_key,
           mapped_remote_id,summary,description)
         VALUES ($1,$2,'remote-issue-42','GRA-42','remote-project-1','Second project only','Other scoped row')`,
        [projectB, connection]
      );
      caseA = (await admin.query(
        `INSERT INTO testcases (project_id,external_id,title,jira_issue_key)
         VALUES ($1,'GPA-TC-1','Project A scenario','GRA-42') RETURNING id`,
        [projectA]
      )).rows[0].id;
      caseB = (await admin.query(
        `INSERT INTO testcases (project_id,external_id,title,jira_issue_key)
         VALUES ($1,'GPB-TC-1','Project B private scenario','GRA-42') RETURNING id`,
        [projectB]
      )).rows[0].id;

      const db = new DatabaseService(pool);
      reader = new CurrentCacheGraphReader(db, makeLegacy(db));
    });

    afterAll(async () => {
      await pool?.end();
      await admin?.end();
    });

    it("keeps identical Jira issue identifiers and linked tests isolated by project", async () => {
      const a = await reader.captureForUser(user, projectA);
      const b = await reader.captureForUser(user, projectB);
      expect(a.inventoryStatus).toBe("complete");
      expect(b.inventoryStatus).toBe("complete");
      expect(a.snapshot?.nodes).toHaveLength(2);
      expect(b.snapshot?.nodes).toHaveLength(2);
      expect(a.snapshot?.edges).toHaveLength(1);
      expect(b.snapshot?.edges).toHaveLength(1);
      expect(JSON.stringify(a)).toContain(caseA);
      expect(JSON.stringify(a)).toContain(ticketA);
      expect(JSON.stringify(a)).not.toContain(caseB);
      expect(JSON.stringify(a)).not.toContain("Project B private scenario");
      expect(JSON.stringify(b)).toContain(caseB);
      expect(() => compareComparableGraphCaptures(a, b)).toThrow("source scopes differ");
      expect(() => diffGraphSnapshots(a.snapshot!, b.snapshot!)).toThrow("different projects");
    });

    it("refuses comparison after connection is repointed without changing the connection UUID", async () => {
      const before = await reader.captureForUser(user, projectA);
      await admin.query(
        "UPDATE integration_connections SET external_id=$2,site_url=$3 WHERE id=$1",
        [connection, "workspace-two", "https://workspace-two.atlassian.net"]
      );
      try {
        const after = await reader.captureForUser(user, projectA);
        expect(after.inventoryStatus).toBe("complete");
        expect(before.sourceScopeFingerprint).not.toBe(after.sourceScopeFingerprint);
        expect(() => compareComparableGraphCaptures(before, after)).toThrow("source scopes differ");
      } finally {
        await admin.query(
          "UPDATE integration_connections SET external_id='workspace-one',site_url='https://workspace-one.atlassian.net' WHERE id=$1",
          [connection]
        );
      }
    });

    it("refuses an unresolved case link when the mapped project changes, not fabricating deletion", async () => {
      const before = await reader.captureForUser(user, projectA);
      await admin.query(
        "UPDATE jira_project_mappings SET jira_project_id='remote-project-2' WHERE project_id=$1",
        [projectA]
      );
      try {
        const after = await reader.captureForUser(user, projectA);
        expect(after.snapshot).toBeNull();
        expect(after.inventoryStatus).toBe("incomplete");
        expect(after.unresolvedDiagnostics.join(" ")).toContain("unresolved");
        expect(after.sourceScopeFingerprint).not.toBe(before.sourceScopeFingerprint);
        expect(() => compareComparableGraphCaptures(before, after)).toThrow("source inventory is not complete");
      } finally {
        await admin.query(
          "UPDATE jira_project_mappings SET jira_project_id='remote-project-1' WHERE project_id=$1",
          [projectA]
        );
      }
    });

    it("rejects disconnected sources rather than silently treating stale cache as a valid comparison", async () => {
      const before = await reader.captureForUser(user, projectA);
      await admin.query(
        "UPDATE integration_connections SET disconnected_at=now() WHERE id=$1", [connection]
      );
      try {
        const after = await reader.captureForUser(user, projectA);
        expect(after.snapshot).toBeNull();
        expect(after.inventoryStatus).toBe("incomplete");
        expect(after.unresolvedDiagnostics.join(" ")).toContain("disconnected");
        expect(after.sourceScopeFingerprint).not.toBe(before.sourceScopeFingerprint);
        expect(() => compareComparableGraphCaptures(before, after))
          .toThrow("source inventory is not complete");
      } finally {
        await admin.query("UPDATE integration_connections SET disconnected_at=NULL WHERE id=$1", [connection]);
      }
    });

    it("rejects a project mapping redirected to a different organization's connection", async () => {
      const foreignOrg = (await admin.query(
        "INSERT INTO organizations (name,slug) VALUES ('Foreign graph provider',$1) RETURNING id",
        [`other-provider-${stamp}`]
      )).rows[0].id;
      const foreignConnection = (await admin.query(
        `INSERT INTO integration_connections
           (organization_id,provider,external_id,site_url,access_token,token_expires_at)
         VALUES ($1,'jira','other-workspace','https://other.atlassian.net',
                 'TEST_FIXTURE_NEVER_VALID',now() + interval '1 day') RETURNING id`,
        [foreignOrg]
      )).rows[0].id;
      await admin.query(
        "UPDATE jira_project_mappings SET jira_connection_id=$2 WHERE project_id=$1",
        [projectA, foreignConnection]
      );
      try {
        const capture = await reader.captureForUser(user, projectA);
        expect(capture.snapshot).toBeNull();
        expect(capture.inventoryStatus).toBe("incomplete");
        expect(capture.unresolvedDiagnostics.join(" ")).toContain("invalid current source scope");
      } finally {
        await admin.query(
          "UPDATE jira_project_mappings SET jira_connection_id=$2 WHERE project_id=$1",
          [projectA, connection]
        );
      }
    });

    it("detects a cached source content change without manufacturing a coverage verdict", async () => {
      const before = await reader.captureForUser(user, projectA);
      await admin.query("UPDATE jira_tickets SET summary='Changed content' WHERE id=$1", [ticketA]);
      try {
        const after = await reader.captureForUser(user, projectA);
        const diff = compareComparableGraphCaptures(before, after);
        expect(diff.modifiedNodes).toHaveLength(1);
        expect(diff.modifiedEdges).toEqual([]);
        expect(diff.directlyAffectedNodeIds).toHaveLength(1);
        expect(after.coverageAssertion).toBe("none");
        expect(after.upstreamFreshness).toBe("unverified");
      } finally {
        await admin.query("UPDATE jira_tickets SET summary='First project only' WHERE id=$1", [ticketA]);
      }
    });
  }
);
