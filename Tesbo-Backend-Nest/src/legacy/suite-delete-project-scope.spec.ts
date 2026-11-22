import { randomUUID } from "node:crypto";
import type { DatabaseService } from "../database/database.service";
import type { SuitesCacheService } from "../cache/suites-cache.service";
import type { TestcasesListCacheService } from "../cache/testcases-list-cache.service";
import { makeLegacy } from "./test-helpers/legacy-service.fixture";

describe("suite subtree deletion — testcase project scope", () => {
  it.each(["moveToDefault", "deleteTestcases"])("%s never alters a foreign testcase with an inconsistent suite reference", async (mode) => {
    const project = randomUUID(), other = randomUUID(), suite = randomUUID(), owner = randomUUID();
    const local = { id: randomUUID(), project_id: project, suite_id: suite };
    const foreign = { id: randomUUID(), project_id: other, suite_id: suite };
    const touched: string[] = [];
    const query = jest.fn(async (sql: string, values: unknown[] = []) => {
      if (/WITH RECURSIVE subtree/.test(sql)) return { rows: [{ id: suite }] };
      if (/UPDATE testcases/.test(sql)) {
        // Selection fixture only; native DB tests own actual SQL, triggers and rollback.
        const scope = /project_id\s*=\s*\$(\d+)/.exec(sql);
        touched.push(...[local, foreign].filter((row) => (values[0] as string[]).includes(row.suite_id) && (!scope || row.project_id === values[Number(scope[1]) - 1])).map((row) => row.id));
      }
      return { rows: [] };
    });
    const svc = makeLegacy({ query, transaction: async (work: (client: unknown) => Promise<unknown>) => work({ query }) } as unknown as DatabaseService);
    const internals = svc as unknown as { requireSuiteAccess: () => Promise<string>; suitesCache: SuitesCacheService; testcasesListCache: TestcasesListCacheService };
    jest.spyOn(internals, "requireSuiteAccess").mockResolvedValue(project);
    jest.spyOn(internals.suitesCache, "invalidate").mockResolvedValue(undefined);
    jest.spyOn(internals.testcasesListCache, "invalidate").mockResolvedValue(undefined);
    await svc.deleteSuite(owner, suite, mode);
    expect(touched).toEqual([local.id]);
  });
});
