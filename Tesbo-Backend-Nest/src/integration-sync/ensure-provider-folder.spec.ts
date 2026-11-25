import { IntegrationSyncService } from "./integration-sync.service";
import type { Queue } from "bullmq";
import type { DatabaseService } from "../database/database.service";
import type { PlanLimitsService } from "../plan-limits/plan-limits.service";

/*
 * ensureProviderFolder resolves-or-creates the "Jira"/"Linear" Knowledge Base folder every sync
 * writes mirrored tickets into. It used to look the folder up by NAME, which is also how
 * legacy.service.ts's integrationDisconnect used to (before this fix) fail to find it at all. Both
 * paths now key off the source_provider column instead, added by V103 alongside the disconnect
 * cleanup — this file pins the lookup/creation side of that same contract: a user renaming the
 * folder must not cause a second one to be created, and a name collision with a DIFFERENT
 * provider's folder must fail loudly rather than silently misfile tickets into it.
 */

type Route = { match: string; rows?: Record<string, unknown>[]; handler?: (params: unknown[]) => { rows: Record<string, unknown>[] } };

function makeDb(routes: Route[]) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const query = jest.fn((sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    for (const route of routes) {
      if (sql.includes(route.match)) {
        return Promise.resolve(route.handler ? route.handler(params) : { rows: route.rows ?? [] });
      }
    }
    return Promise.resolve({ rows: [] });
  });
  return { db: { query } as unknown as DatabaseService, calls };
}

function makeService(db: DatabaseService): IntegrationSyncService {
  return new IntegrationSyncService({} as unknown as Queue, db, {} as unknown as PlanLimitsService);
}

/** Every call here already has a root folder — only ensureProviderFolder's own query is under test. */
function rootFolderRoute(): Route {
  return { match: "is_root = true", rows: [{ id: "root-1" }] };
}

describe("IntegrationSyncService#ensureProviderFolder", () => {
  it("finds an existing provider folder by source_provider, even after it was renamed away from the default name", async () => {
    const { db, calls } = makeDb([
      rootFolderRoute(),
      {
        match: "WHERE project_id = $1 AND parent_folder_id = $2 AND source_provider = $3",
        rows: [{ id: "renamed-folder-1" }]
      }
    ]);
    const svc = makeService(db);
    const id = await svc.ensureProviderFolder("org-1", "proj-1", "jira", "user-1");
    expect(id).toBe("renamed-folder-1");
    // Never falls back to a name-based lookup, and never reaches the INSERT.
    expect(calls.some((c) => c.sql.includes("INSERT INTO knowledge_folders"))).toBe(false);
  });

  it("creates a fresh, source_provider-tagged folder when none exists yet", async () => {
    const { db, calls } = makeDb([
      rootFolderRoute(),
      { match: "WHERE project_id = $1 AND parent_folder_id = $2 AND source_provider = $3", rows: [] },
      {
        match: "INSERT INTO knowledge_folders",
        handler: (params) => ({ rows: [{ id: "new-folder-1", source_provider: params[5] }] })
      }
    ]);
    const svc = makeService(db);
    const id = await svc.ensureProviderFolder("org-1", "proj-1", "linear", "user-1");
    expect(id).toBe("new-folder-1");
    const insertCall = calls.find((c) => c.sql.includes("INSERT INTO knowledge_folders"));
    expect(insertCall!.params).toEqual(["org-1", "proj-1", "root-1", "Linear", expect.any(String), "linear", "user-1"]);
  });

  it("refuses to reuse a same-named folder that belongs to a different provider, rather than silently misfiling tickets into it", async () => {
    const { db } = makeDb([
      rootFolderRoute(),
      { match: "WHERE project_id = $1 AND parent_folder_id = $2 AND source_provider = $3", rows: [] },
      // The DO UPDATE ... WHERE guard excludes a conflicting row owned by a different provider, so
      // the INSERT returns no row at all — modeled here as the real ON CONFLICT ... WHERE would.
      { match: "INSERT INTO knowledge_folders", rows: [] }
    ]);
    const svc = makeService(db);
    await expect(svc.ensureProviderFolder("org-1", "proj-1", "jira", "user-1")).rejects.toThrow(/different provider/i);
  });
});

describe("IntegrationSyncService#findProviderFolderForWrite", () => {
  function makeClient(routes: Route[]) {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const query = jest.fn((sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      for (const route of routes) {
        if (sql.includes(route.match)) return Promise.resolve({ rows: route.rows ?? [] });
      }
      return Promise.resolve({ rows: [] });
    });
    return { client: { query } as unknown as Parameters<IntegrationSyncService["findProviderFolderForWrite"]>[2], calls };
  }

  it("finds the source_provider-tagged folder under the root", async () => {
    const svc = makeService({} as DatabaseService);
    const { client, calls } = makeClient([
      rootFolderRoute(),
      { match: "AND source_provider = $3", rows: [{ id: "tagged-folder-1" }] }
    ]);
    expect(await svc.findProviderFolderForWrite("proj-1", "jira", client)).toBe("tagged-folder-1");
    expect(calls.some((call) => call.sql.includes("source_provider IS NULL"))).toBe(false);
  });

  it("sees the untagged default-named folder the coordinator adopted, so tickets are not failed after a successful adoption", async () => {
    const svc = makeService({} as DatabaseService);
    const { client, calls } = makeClient([
      rootFolderRoute(),
      { match: "AND source_provider = $3", rows: [] },
      { match: "AND name = $3 AND source_provider IS NULL", rows: [{ id: "adopted-folder-1" }] }
    ]);
    expect(await svc.findProviderFolderForWrite("proj-1", "jira", client)).toBe("adopted-folder-1");
    const adopted = calls.find((call) => call.sql.includes("source_provider IS NULL"));
    expect(adopted!.params).toEqual(["proj-1", "root-1", "Jira"]);
  });

  it("returns null when the provider folder is gone, without creating one", async () => {
    const svc = makeService({} as DatabaseService);
    const { client, calls } = makeClient([rootFolderRoute()]);
    expect(await svc.findProviderFolderForWrite("proj-1", "linear", client)).toBeNull();
    expect(calls.some((call) => call.sql.includes("INSERT INTO knowledge_folders"))).toBe(false);
  });
});
