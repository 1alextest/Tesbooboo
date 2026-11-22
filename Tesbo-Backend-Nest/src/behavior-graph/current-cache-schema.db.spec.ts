import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL ?? "";

/**
 * Proves the migration-derived source fields needed by the proposed internal
 * current-cache reader. Missing fields are a contract failure, not a reason
 * to substitute null, skip the provider, or report an empty graph.
 */
(/\/tesbo_ci(?:\?|$)/.test(databaseUrl) ? describe : describe.skip)(
  "behavior graph source contract — migrated PostgreSQL",
  () => {
    let db: Client;

    beforeAll(async () => {
      db = new Client({ connectionString: databaseUrl });
      await db.connect();
    });

    afterAll(async () => {
      await db?.end();
    });

    const columns: Record<string, readonly string[]> = {
      projects: ["id", "organization_id"],
      project_members: ["project_id", "user_id"],
      testcases: [
        "id", "project_id", "title", "description", "preconditions", "postconditions",
        "steps", "test_data", "jira_issue_key", "linear_issue_key", "notion_page_id", "deleted_at"
      ],
      jira_tickets: [
        "id", "project_id", "jira_connection_id", "jira_issue_id", "jira_issue_key",
        "mapped_remote_id", "summary", "description"
      ],
      linear_tickets: [
        "id", "project_id", "integration_connection_id", "linear_issue_id", "linear_issue_key",
        "mapped_remote_id", "summary", "description"
      ],
      notion_pages: [
        "id", "project_id", "integration_connection_id", "notion_page_id",
        "mapped_remote_id", "summary", "description", "properties_json", "archived"
      ],
      jira_project_mappings: ["id", "project_id", "enabled", "jira_project_id"],
      linear_project_mappings: ["id", "project_id", "enabled", "linear_team_id", "entity_type"],
      notion_project_mappings: ["id", "project_id", "enabled", "notion_database_id"],
      integration_connections: ["id", "organization_id", "provider", "external_id", "site_url"]
    };

    it.each(Object.entries(columns))(
      "%s retains all exact source columns required by the proposed projection",
      async (table, required) => {
        const res = await db.query<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns
           WHERE table_schema = current_schema() AND table_name = $1`,
          [table]
        );
        const actual = new Set(res.rows.map((r) => r.column_name));
        expect(actual.size).toBeGreaterThan(0);
        expect(required.filter((name) => !actual.has(name))).toEqual([]);
      }
    );

    it("can query project-owned active cases and native source fields without mutation", async () => {
      const res = await db.query<{ id: string }>(
        `SELECT t.id FROM testcases t
          WHERE t.project_id = $1::uuid AND t.deleted_at IS NULL
          ORDER BY t.id`,
        ["00000000-0000-0000-0000-000000000000"]
      );
      expect(res.rows).toEqual([]);
    });
  }
);
