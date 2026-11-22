import { randomUUID } from "node:crypto";
import type { DatabaseService } from "../database/database.service";
import { makeLegacy } from "./test-helpers/legacy-service.fixture";

describe("Plan/Run project-lineage write boundary", () => {
  const project = randomUUID(), local = randomUUID(), foreign = randomUUID(), plan = randomUUID(), cycle = randomUUID(), user = randomUUID();
  function fixture() {
    const query = jest.fn(async (sql: string, values: unknown[] = []) => {
      if (/^SELECT/.test(sql.trim())) return { rows: values[0] === foreign ? [] : [{ id: values[0], project_id: project }] };
      return { rows: [{ id: randomUUID() }] };
    });
    const svc = makeLegacy({ query, transaction: async (fn: (client: unknown) => Promise<unknown>) => fn({ query }) } as unknown as DatabaseService);
    jest.spyOn(svc, "requireProjectAccess").mockResolvedValue({} as never);
    const privateSvc = svc as unknown as {
      requirePlanAccess: () => Promise<string>; requireCycleAccess: () => Promise<string>;
      lockActiveCycle: () => Promise<{ source: string; closed_at: null }>;
    };
    jest.spyOn(privateSvc, "requirePlanAccess").mockResolvedValue(project);
    jest.spyOn(privateSvc, "requireCycleAccess").mockResolvedValue(project);
    jest.spyOn(privateSvc, "lockActiveCycle").mockResolvedValue({ source: "manual", closed_at: null });
    return { svc, query };
  }
  it.each(["suiteId", "testcaseId"])("rejects a foreign %s before inserting a Plan item", async (field) => {
    const { svc, query } = fixture();
    await expect(svc.addPlanItem(user, plan, { [field]: foreign })).rejects.toMatchObject({ status: 404 });
    expect(query.mock.calls.some(([sql]) => /INSERT/.test(sql))).toBe(false);
  });
  it("checks both supplied child references, not only the first", async () => {
    const { svc, query } = fixture();
    await expect(svc.addPlanItem(user, plan, { suiteId: local, testcaseId: foreign })).rejects.toMatchObject({ status: 404 });
    expect(query.mock.calls.some(([sql]) => /INSERT/.test(sql))).toBe(false);
  });
  it("rejects a foreign Plan before creating a Run through the shared writer", async () => {
    const { svc, query } = fixture();
    await expect(svc.createCycle(project, { name: "Must not persist", planId: foreign })).rejects.toMatchObject({ status: 404 });
    expect(query.mock.calls.some(([sql]) => /INSERT/.test(sql))).toBe(false);
  });
  it("rejects a foreign Plan before an existing Run's metadata can change", async () => {
    const { svc, query } = fixture();
    await expect(svc.updateCycle(cycle, user, { name: "Must not persist", planId: foreign })).rejects.toMatchObject({ status: 404 });
    expect(query.mock.calls.some(([sql]) => /UPDATE/.test(sql))).toBe(false);
  });
});
