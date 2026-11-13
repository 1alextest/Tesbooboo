import { randomUUID } from "node:crypto";
import type { DatabaseService } from "../database/database.service";
import type { SuitesCacheService } from "../cache/suites-cache.service";
import type { TestcasesListCacheService } from "../cache/testcases-list-cache.service";
import { makeLegacy } from "./test-helpers/legacy-service.fixture";

describe("testcase bulk writers — project scope at the actual UPDATE", () => {
  const project = randomUUID(), other = randomUUID(), user = randomUUID();
  const local = randomUUID(), foreign = randomUUID(), deleted = randomUUID();
  function fixture() {
    const rows = [
      { id: local, project_id: project, deleted_at: null as string | null },
      { id: foreign, project_id: other, deleted_at: null as string | null },
      { id: deleted, project_id: project, deleted_at: "already deleted" as string | null },
    ];
    const writes: string[] = [];
    const query = jest.fn(async (sql: string, values: unknown[] = []) => {
      // SQL-selection double only: native PostgreSQL owns actual predicates, triggers and rollback.
      const scope = /project_id\s*=\s*\$(\d+)/.exec(sql);
      const selected = rows.filter((row) => (values[0] as string[]).includes(row.id) && row.deleted_at === null && (!scope || row.project_id === values[Number(scope[1]) - 1]));
      writes.push(...selected.map((row) => row.id));
      return { rows: selected.map(({ id }) => ({ id })) };
    });
    const svc = makeLegacy({ query } as unknown as DatabaseService);
    jest.spyOn(svc, "requireProjectAccess").mockResolvedValue({} as never);
    const activity = jest.spyOn(svc, "logProjectActivity").mockResolvedValue(undefined);
    const internals = svc as unknown as { suitesCache: SuitesCacheService; testcasesListCache: TestcasesListCacheService };
    jest.spyOn(internals.suitesCache, "invalidate").mockResolvedValue(undefined);
    jest.spyOn(internals.testcasesListCache, "invalidate").mockResolvedValue(undefined);
    const run = (kind: string, ids: string[]) => kind === "update"
      ? svc.bulkUpdateTestCases(project, user, { testcaseIds: ids, priority: "P0" })
      : svc.bulkDeleteTestCases(project, user, ids);
    return { writes, query, activity, run };
  }
  it.each(["update", "delete"])("%s never touches a foreign case even in an otherwise valid mixed selection", async (kind) => {
    const f = fixture(); await f.run(kind, [local, foreign, deleted]);
    expect(f.writes).toEqual([local]);
    expect(f.activity.mock.calls[0][6]).toMatchObject({ testcaseIds: [local] });
  });
  it.each(["update", "delete"])("%s retains the empty-selection no-op", async (kind) => {
    const f = fixture(); await f.run(kind, []);
    expect(f.query).not.toHaveBeenCalled(); expect(f.activity).not.toHaveBeenCalled();
  });
});
