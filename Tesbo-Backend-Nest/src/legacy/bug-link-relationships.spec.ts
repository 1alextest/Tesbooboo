import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { PoolClient } from "pg";
import type { DatabaseService } from "../database/database.service";
import { makeLegacy } from "./test-helpers/legacy-service.fixture";

type Link = { testcaseId: string | null; cycleId: string | null; executionId: string | null };
const project = "11111111-1111-4111-8111-111111111111";
const testcase = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const run = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const execution = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const other = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const full: Link = { testcaseId: testcase, cycleId: run, executionId: execution };

function fixture() {
  const service = makeLegacy({} as DatabaseService) as unknown as {
    parseBugLinks: (raw: unknown) => Link[];
    lockBugLinkTargets: (client: PoolClient, projectId: string, links: Link[]) => Promise<(existing?: Link[]) => void>;
  };
  const rows = {
    cycles: [{ id: run, deleted_at: null as Date | null }],
    cases: [{ id: testcase, deleted_at: null as Date | null }],
    memberships: [{ testcase_id: testcase, cycle_id: run, deleted_at: null as Date | null }],
    executions: [{ id: execution, testcase_id: testcase, cycle_id: run, deleted_at: null as Date | null, item_deleted_at: null as Date | null }]
  };
  const query = jest.fn(async (sql: string) => {
    if (sql.includes("SELECT id, deleted_at FROM cycles")) return { rows: rows.cycles };
    if (sql.includes("SELECT id, deleted_at FROM testcases")) return { rows: rows.cases };
    if (sql.includes("JOIN unnest")) return { rows: rows.memberships };
    if (sql.includes("FROM executions e")) return { rows: rows.executions };
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  const validate = async (raw: unknown, existing: Link[] = []) => {
    const links = service.parseBugLinks(raw);
    const check = await service.lockBugLinkTargets({ query } as unknown as PoolClient, project, links);
    check(existing);
    return links;
  };
  return { service, rows, query, validate };
}

describe("strict bug-link relationship validation", () => {
  it.each([null, {}, "[]", [null], [[]], [{}], [{ testcaseId: 1 }], [{ executionId: "bad" }]])("rejects malformed links: %j", (raw) => {
    expect(() => fixture().service.parseBugLinks(raw)).toThrow(BadRequestException);
  });

  it("normalizes UUID case and deduplicates identical bindings, but rejects conflicting pair bindings", () => {
    const { service } = fixture();
    expect(service.parseBugLinks([full, { ...full, testcaseId: testcase.toUpperCase() }])).toEqual([full]);
    expect(() => service.parseBugLinks([full, { ...full, executionId: other }])).toThrow(BadRequestException);
    expect(service.parseBugLinks(undefined)).toEqual([]);
    expect(service.parseBugLinks([])).toEqual([]);
  });

  it.each([
    full, { testcaseId: testcase }, { cycleId: run }, { executionId: execution },
    { testcaseId: testcase, cycleId: run }, { testcaseId: testcase, executionId: execution }, { cycleId: run, executionId: execution }
  ])("accepts a valid complete or deliberately partial association: %j", async (link) => {
    await expect(fixture().validate([link])).resolves.toHaveLength(1);
  });

  it.each(["cycles", "cases", "executions"] as const)("refuses an unavailable/foreign %s target instead of dropping it", async (key) => {
    const f = fixture();
    f.rows[key].length = 0;
    await expect(f.validate([full])).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects a real case/run pair with no membership", async () => {
    const f = fixture();
    f.rows.memberships.length = 0;
    await expect(f.validate([{ testcaseId: testcase, cycleId: run }])).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects an execution whose authoritative case differs even when the supplied pair exists", async () => {
    const f = fixture();
    f.rows.cases.push({ id: other, deleted_at: null });
    f.rows.memberships.push({ testcase_id: other, cycle_id: run, deleted_at: null });
    await expect(f.validate([{ ...full, testcaseId: other }])).rejects.toBeInstanceOf(BadRequestException);
  });

  it("keeps exact valid deleted history only when re-read as an existing association", async () => {
    const f = fixture();
    f.rows.cycles[0].deleted_at = new Date();
    f.rows.cases[0].deleted_at = new Date();
    f.rows.memberships[0].deleted_at = new Date();
    f.rows.executions[0].deleted_at = new Date();
    f.rows.executions[0].item_deleted_at = new Date();
    await expect(f.validate([full])).rejects.toBeInstanceOf(NotFoundException);
    await expect(f.validate([full], [full])).resolves.toEqual([full]);
    await expect(f.validate([{ ...full, executionId: null }], [full])).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each(["cycles", "cases", "executions"] as const)("does not exempt foreign/missing historical %s targets", async (key) => {
    const f = fixture();
    f.rows[key].length = 0;
    await expect(f.validate([full], [full])).rejects.toBeInstanceOf(NotFoundException);
  });

  it("does not exempt inconsistent historical membership or grant access through a supplied link ID", async () => {
    const f = fixture();
    f.rows.memberships.length = 0;
    await expect(f.validate([full], [full])).rejects.toBeInstanceOf(BadRequestException);
    f.rows.cycles[0].deleted_at = new Date();
    await expect(f.validate([{ ...full, id: other }])).rejects.toBeInstanceOf(NotFoundException);
  });

  it("locks actual parents before children and does not acquire foreign membership locks", async () => {
    const f = fixture();
    await f.validate([full]);
    const sql = f.query.mock.calls.map(([text]) => text);
    expect(sql[1]).toContain("ORDER BY id FOR UPDATE");
    expect(sql[2]).toContain("ORDER BY id FOR SHARE");
    expect(sql[3]).toContain("c.project_id = $3");
    expect(sql[3]).toContain("t.project_id = $3");
    expect(sql[4]).toContain("FOR KEY SHARE OF e");
    expect(sql.every((text) => text.trim().startsWith("SELECT"))).toBe(true);
  });
});
