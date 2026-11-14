import { randomUUID } from "node:crypto";
import { Client, Pool } from "pg";
import { DatabaseService } from "../database/database.service";
import { makeLegacy } from "../legacy/test-helpers/legacy-service.fixture";
import { compareComparableGraphCaptures } from "./graph-comparison-gate";
import { diffGraphSnapshots } from "./graph-change-impact";
import { CURRENT_CACHE_CAPTURE_SQL, CurrentCacheGraphReader } from "./current-cache-graph.reader";

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
    it("distinguishes identical Jira and Linear keys and refuses a Team-to-Project remap", async () => {
      const linearConnection = (await admin.query(
        `INSERT INTO integration_connections
          (organization_id,provider,external_id,site_url,access_token,token_expires_at)
         VALUES ($1,'linear','linear-workspace','https://linear.app',
                 'TEST_FIXTURE_NEVER_VALID',now() + interval '1 day') RETURNING id`,
        [org]
      )).rows[0].id;
      await admin.query(
        `INSERT INTO linear_project_mappings
          (integration_connection_id,project_id,linear_team_id,linear_team_key,linear_team_name,enabled)
         VALUES ($1,$2,'remote-team-1','TEAM','Graph Linear Team',true)`,
        [linearConnection,projectA]
      );
      await admin.query(
        `INSERT INTO linear_tickets
           (project_id,integration_connection_id,linear_issue_id,linear_issue_key,
            mapped_remote_id,summary,description)
         VALUES ($1,$2,'linear-issue-42','GRA-42','remote-team-1',
                 'Linear issue with colliding display key','Source-specific Linear text')`,
        [projectA,linearConnection]
      );
      await admin.query("UPDATE testcases SET linear_issue_key='GRA-42' WHERE id=$1", [caseA]);
      try {
        const before = await reader.captureForUser(user, projectA);
        expect(before.inventoryStatus).toBe("complete");
        expect(before.snapshot?.nodes).toHaveLength(3);
        expect(before.snapshot?.edges).toHaveLength(2);
        expect(new Set(before.snapshot!.edges.map((edge) => edge.to)).size).toBe(2);
        expect(before.snapshot!.edges.every((edge) => edge.type === "references_cached_requirement")).toBe(true);

        await admin.query(
          "UPDATE linear_project_mappings SET entity_type='project' WHERE project_id=$1",
          [projectA]
        );
        const after = await reader.captureForUser(user, projectA);
        expect(after.sourceScopeFingerprint).not.toBe(before.sourceScopeFingerprint);
        expect(() => compareComparableGraphCaptures(before,after)).toThrow("source scopes differ");
      } finally {
        await admin.query("UPDATE testcases SET linear_issue_key=NULL WHERE id=$1", [caseA]);
        await admin.query("DELETE FROM integration_connections WHERE id=$1", [linearConnection]);
      }
    });

    it("links Notion only by full page ID and refuses archived or short-key references", async () => {
      const notionConnection = (await admin.query(
        `INSERT INTO integration_connections
          (organization_id,provider,external_id,site_url,access_token,token_expires_at)
         VALUES ($1,'notion','notion-workspace','https://www.notion.so',
                 'TEST_FIXTURE_NEVER_VALID',now() + interval '1 day') RETURNING id`,
        [org]
      )).rows[0].id;
      const pageId = randomUUID();
      const shortKey = `notion:${pageId.replace(/-/g, "").slice(0, 8)}`;
      await admin.query(
        `INSERT INTO notion_project_mappings
           (integration_connection_id,project_id,notion_database_id,notion_database_name,enabled)
         VALUES ($1,$2,'remote-database-1','Graph Notion Database',true)`,
        [notionConnection,projectA]
      );
      await admin.query(
        `INSERT INTO notion_pages
           (project_id,integration_connection_id,notion_page_id,notion_page_key,
            mapped_remote_id,summary,description,properties_json)
         VALUES ($1,$2,$3,$4,'remote-database-1',
                 'Notion full page reference','Source property text',$5::jsonb)`,
        [projectA,notionConnection,pageId,shortKey,JSON.stringify({kind:"requirement"})]
      );
      await admin.query("UPDATE testcases SET notion_page_id=$2 WHERE id=$1", [caseA,pageId]);
      try {
        const original = await reader.captureForUser(user,projectA);
        expect(original.snapshot?.nodes).toHaveLength(3);
        expect(original.snapshot?.edges).toHaveLength(2);
        expect(original.snapshot?.nodes.some((node) => node.id.includes(pageId))).toBe(false);
        // Canonical graph uses the local cache row ID, not the remote page/display key.
        expect(original.snapshot?.edges.some((edge) => edge.type === "references_cached_requirement")).toBe(true);

        await admin.query("UPDATE notion_pages SET archived=true WHERE notion_page_id=$1", [pageId]);
        const archived = await reader.captureForUser(user,projectA);
        expect(archived.snapshot).toBeNull();
        expect(archived.unresolvedDiagnostics.join(" ")).toContain("unresolved");
        await admin.query("UPDATE notion_pages SET archived=false WHERE notion_page_id=$1", [pageId]);

        await admin.query("UPDATE testcases SET notion_page_id=$2 WHERE id=$1", [caseA,shortKey]);
        const short = await reader.captureForUser(user,projectA);
        expect(short.snapshot).toBeNull();
        expect(short.unresolvedDiagnostics.join(" ")).toContain("unresolved");
      } finally {
        await admin.query("UPDATE testcases SET notion_page_id=NULL WHERE id=$1", [caseA]);
        await admin.query("DELETE FROM integration_connections WHERE id=$1", [notionConnection]);
      }
    });

    it("reads one coherent pre-commit cache state under a verified concurrent transaction barrier", async () => {
      const before = await reader.captureForUser(user, projectA);
      const writer = new Client({ connectionString: url });
      const captured = new Client({ connectionString: url });
      await writer.connect();
      await captured.connect();
      const writerPid = Number((await writer.query("SELECT pg_backend_pid() AS pid")).rows[0].pid);
      const readerPid = Number((await captured.query("SELECT pg_backend_pid() AS pid")).rows[0].pid);
      const advisoryKey = Number.parseInt(stamp.replace(/-/g, "").slice(0, 8), 16);
      // The test adds an advisory lock inside the SAME production SELECT statement,
      // creating a deterministic barrier without changing the shipping query.
      const gatedSql = CURRENT_CACHE_CAPTURE_SQL
        .replace(
          "WITH allowed AS (",
          "WITH capture_gate AS MATERIALIZED (SELECT pg_advisory_xact_lock($4::bigint)), allowed AS ("
        )
        .replace("FROM projects p\n", "FROM projects p CROSS JOIN capture_gate\n");
      expect(gatedSql).toContain("CROSS JOIN capture_gate");
      let pending: ReturnType<typeof captured.query> | null = null;
      let committed = false;
      try {
        await writer.query("BEGIN");
        await writer.query("SELECT pg_advisory_xact_lock($1::bigint)", [advisoryKey]);
        await writer.query(
          "UPDATE testcases SET title='Concurrent updated case' WHERE id=$1", [caseA]
        );
        await writer.query(
          "UPDATE jira_tickets SET summary='Concurrent updated requirement' WHERE id=$1", [ticketA]
        );
        pending = captured.query(gatedSql, [projectA, org, user, advisoryKey]);
        // Require actual PostgreSQL lock contention, not a sleep-based timing guess.
        let observedBlock = false;
        for (let i = 0; i < 200; i++) {
          const state = await admin.query<{ blockers: number[] }>(
            `SELECT pg_blocking_pids(pid) AS blockers FROM pg_stat_activity
              WHERE pid=$1 AND wait_event_type='Lock'`, [readerPid]
          );
          observedBlock = state.rows.some((row) => row.blockers.includes(writerPid));
          if (observedBlock) break;
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        expect(observedBlock).toBe(true);
        await writer.query("COMMIT");
        committed = true;
        const response = await pending;
        const row = response.rows[0];
        expect(row.authorized).toBe(true);
        expect(row.cases.find((item: { id: string }) => item.id === caseA)?.title)
          .toBe("Project A scenario");
        expect(row.jira_requirements.find((item: { rowId: string }) => item.rowId === ticketA)?.summary)
          .toBe("First project only");
        const after = await reader.captureForUser(user, projectA);
        const delta = compareComparableGraphCaptures(before, after);
        expect(delta.modifiedNodes).toHaveLength(2);
        expect(delta.modifiedEdges).toEqual([]);
      } finally {
        if (!committed) await writer.query("ROLLBACK");
        if (pending) await pending.catch(() => undefined);
        await admin.query("UPDATE testcases SET title='Project A scenario' WHERE id=$1", [caseA]);
        await admin.query("UPDATE jira_tickets SET summary='First project only' WHERE id=$1", [ticketA]);
        await writer.end();
        await captured.end();
      }
    }, 15000);

  }
);
