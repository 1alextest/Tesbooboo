import type { DatabaseService } from "../database/database.service";
import { makeLegacy } from "./test-helpers/legacy-service.fixture";

const PROJECT = "12345678-1234-4234-8234-123456789abc";
const USER = "22345678-1234-4234-8234-123456789abc";
const TASK = "32345678-1234-4234-8234-123456789abc";
type Page = { rows: Array<{ id: string; title: string; status: string }>; total: number };

// This suite owns the post-transaction handoff, not the transaction's SQL/authority proof.
// Existing migrated-DB and native requirements API suites exercise the actual reviewed transaction.
function fixture() {
  const before: Page = { rows: [], total: 0 };
  const after: Page = { rows: [{ id: "new-case", title: "Applied reviewed case", status: "Draft" }], total: 1 };
  let authoritative = before;
  let cached: Page | undefined;
  let complete!: (result: { receipt: { testcase: { id: string } | null }; replayed: boolean }) => void;
  let reject!: (error: Error) => void;
  let entered!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const completion = new Promise<{ receipt: { testcase: { id: string } | null }; replayed: boolean }>((resolve, fail) => {
    complete = resolve;
    reject = fail;
  });
  const transaction = jest.fn(async () => {
    entered();
    return completion;
  });
  const query = jest.fn(async () => { throw new Error("Post-commit unit fixture must not query a database"); });
  const service = makeLegacy({ query, transaction } as unknown as DatabaseService);
  jest.spyOn(service, "requireProjectAccess").mockResolvedValue({ caller_role: "owner" });
  const cache = {
    read: jest.fn(async () => ({ generation: "controlled-generation", value: cached })),
    set: jest.fn(async (_project: string, _limit: number, _offset: number, page: Page) => { cached = page; }),
    invalidate: jest.fn(async () => { cached = undefined; }),
  };
  const suitesCache = { invalidate: jest.fn(async () => undefined) };
  const internals = service as unknown as {
    testcasesListCache: typeof cache;
    suitesCache: typeof suitesCache;
    listTestCasesUncached: () => Promise<Page>;
  };
  internals.testcasesListCache = cache;
  internals.suitesCache = suitesCache;
  const load = jest.spyOn(internals, "listTestCasesUncached").mockImplementation(async () => authoritative);
  const list = () => service.listTestCases(PROJECT, { limit: 25, offset: 0 });
  const apply = () => service.applyRequirementProposal(
    PROJECT, USER, TASK, { expectedProposalRevision: "a".repeat(64) }, { kind: "human_session" }
  );
  return {
    before, after, cache, suitesCache, load, query, started, list, apply, reject,
    complete: (replayed = false, createsCase = true) => {
      if (!replayed && createsCase) authoritative = after;
      complete({ receipt: { testcase: createsCase ? { id: "new-case" } : null }, replayed });
    },
  };
}

describe("requirement bundle publication — repository cache handoff", () => {
  it("refreshes a warmed repository only after the reviewed case transaction commits", async () => {
    const f = fixture();
    expect(await f.list()).toEqual(f.before);
    expect(await f.list()).toEqual(f.before);
    expect(f.load).toHaveBeenCalledTimes(1); // A real cache hit is required for this seam regression.
    const pending = f.apply();
    try {
      await Promise.race([f.started, pending]);
      expect(await f.list()).toEqual(f.before);
      expect(f.cache.invalidate).not.toHaveBeenCalled();
      expect(f.suitesCache.invalidate).not.toHaveBeenCalled();
      f.complete();
      await pending;
      expect(await f.list()).toEqual(f.after);
      expect(await f.list()).toEqual(f.after);
      expect(f.load).toHaveBeenCalledTimes(2);
      expect(f.suitesCache.invalidate).toHaveBeenCalledWith(PROJECT);
      expect(f.query).not.toHaveBeenCalled();
    } finally {
      f.complete();
      await pending.catch(() => undefined);
    }
  });

  it.each([
    { label: "a true replay", replayed: true, createsCase: true },
    { label: "a requirement-only bundle", replayed: false, createsCase: false },
  ])("retains a healthy page for $label", async ({ replayed, createsCase }) => {
    const f = fixture();
    expect(await f.list()).toEqual(f.before);
    const pending = f.apply();
    await Promise.race([f.started, pending]);
    f.complete(replayed, createsCase);
    await pending;
    expect(await f.list()).toEqual(f.before);
    expect(f.load).toHaveBeenCalledTimes(1);
    expect(f.cache.invalidate).not.toHaveBeenCalled();
    expect(f.suitesCache.invalidate).not.toHaveBeenCalled();
  });

  it("preserves a rejected transaction's error and existing cached page", async () => {
    const f = fixture();
    expect(await f.list()).toEqual(f.before);
    const failure = new Error("controlled transaction rollback");
    const pending = f.apply();
    const refused = expect(pending).rejects.toBe(failure);
    await Promise.race([f.started, pending]);
    f.reject(failure);
    await refused;
    expect(await f.list()).toEqual(f.before);
    expect(f.load).toHaveBeenCalledTimes(1);
    expect(f.cache.invalidate).not.toHaveBeenCalled();
    expect(f.suitesCache.invalidate).not.toHaveBeenCalled();
  });
});
