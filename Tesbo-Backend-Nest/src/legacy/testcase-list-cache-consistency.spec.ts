import type Redis from "ioredis";
import { Logger } from "@nestjs/common";
import { TestcasesListCacheService } from "../cache/testcases-list-cache.service";
import type { AppConfigService } from "../config/app-config.service";
import type { DatabaseService } from "../database/database.service";
import { CustomFieldsService } from "../custom-fields/custom-fields.service";
import type { QueryRunner } from "../custom-fields/custom-fields.types";
import type { PlanLimitsService } from "../plan-limits/plan-limits.service";
import type { ProjectLookupService } from "../request-cache/project-lookup.service";
import { makeLegacy } from "./test-helpers/legacy-service.fixture";

const PROJECT = "11111111-1111-4111-8111-111111111111";
const OTHER_PROJECT = "22222222-2222-4222-8222-222222222222";
const MIXED_CASE_PROJECT = "a1b2c3d4-1234-4abc-8def-abcdef123456";
type ListResult = { rows: Array<{ id: string; title: string; status: string; approvalCurrent?: boolean; customFieldValues?: Record<string, unknown> }>; total: number };

const generationKey = (projectId: string) => `testcases-nofilter:v2:{${projectId.toLowerCase()}}:generation`;
const pageKey = (projectId: string, limit = 25, offset = 0) =>
  `testcases-nofilter:v2:{${projectId.toLowerCase()}}:page:${limit}:${offset}`;
const result = (id: string): ListResult => ({ rows: [{ id, title: id, status: "Draft" }], total: 1 });
const doubles: Array<{ unexpected: string[] }> = [];

// This is an explicit model of the two Redis commands, not a Lua interpreter or evidence of
// real Redis atomicity. The companion opt-in Redis suite executes the actual scripts on two
// independent clients. Unknown scripts/arguments are recorded and fail afterEach, even when
// production's best-effort error handler catches the model's exception.
function memoryRedis() {
  const values = new Map<string, string>();
  const expirySeconds = new Map<string, number>();
  const unexpected: string[] = [];
  const refuse = (message: string): never => {
    unexpected.push(message);
    throw new Error(message);
  };
  const redis = {
    values,
    expirySeconds,
    unexpected,
    eval: jest.fn(async (script: string, keyCount: number, ...args: Array<string | number>) => {
      if (keyCount !== 2) return refuse("cache script must declare exactly its generation and page keys");
      const [generation, page, ...argv] = args.map(String);
      if (!generation.endsWith(":generation") || !page.includes(":page:")) return refuse("unknown cache key order");
      if (script.startsWith("-- testcase-list-read-v2")) {
        if (argv.length !== 2 || Number(argv[1]) !== 20) return refuse("unknown cache read arguments");
        if (!values.has(generation)) {
          values.set(generation, argv[0]);
          expirySeconds.set(generation, Number(argv[1]));
        }
        return [values.get(generation)!, values.get(page) ?? null];
      }
      if (script.startsWith("-- testcase-list-publish-v2")) {
        if (argv.length !== 4 || Number(argv[2]) !== 10 || Number(argv[3]) !== 20) return refuse("unknown cache publish arguments");
        if (values.get(generation) !== argv[0]) return 0;
        values.set(page, argv[1]);
        expirySeconds.set(page, Number(argv[2]));
        expirySeconds.set(generation, Number(argv[3]));
        return 1;
      }
      return refuse("unknown testcase-list Redis script");
    }),
    set: jest.fn(async (key: string, value: string, expiry: string, seconds: number) => {
      if (expiry !== "EX" || seconds !== 20) return refuse("unknown generation invalidation expiry");
      values.set(key, value);
      expirySeconds.set(key, seconds);
      return "OK";
    }),
  };
  doubles.push(redis);
  return redis;
}

function cacheWith(redis = memoryRedis(), enabled = true) {
  return new TestcasesListCacheService(redis as unknown as Redis,
    { testcasesListCacheEnabled: enabled } as unknown as AppConfigService);
}

function legacyWith(cache: TestcasesListCacheService) {
  const query = jest.fn(async () => { throw new Error("This isolated unit test must not query a database"); });
  const svc = makeLegacy({ query } as unknown as DatabaseService);
  const internals = svc as unknown as {
    testcasesListCache: TestcasesListCacheService;
    listTestCasesUncached: (projectId: string, filters: unknown, limit: number, offset: number) => Promise<ListResult>;
  };
  internals.testcasesListCache = cache;
  return { svc, query, load: jest.spyOn(internals, "listTestCasesUncached") };
}

function barrier() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => { jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined); });
afterEach(() => {
  const unexpected = doubles.splice(0).flatMap(redis => redis.unexpected);
  jest.restoreAllMocks();
  expect(unexpected).toEqual([]);
});

describe("testcase list cache — reads crossing committed invalidation", () => {
  it("does not let an older in-flight list repopulate the collection after invalidation", async () => {
    const before: ListResult = { rows: [{ id: "old-case", title: "Old approved case", status: "Approved" }], total: 1 };
    const after: ListResult = { rows: [{ id: "new-case", title: "New draft case", status: "Draft" }], total: 1 };
    let authoritative = before;
    let readCaptured!: () => void;
    let releaseRead!: () => void;
    const captured = new Promise<void>(resolve => { readCaptured = resolve; });
    const released = new Promise<void>(resolve => { releaseRead = resolve; });
    const query = jest.fn(async () => { throw new Error("This unit diagnostic must not query a database"); });
    const svc = makeLegacy({ query } as unknown as DatabaseService);
    const redis = memoryRedis();
    const cache = cacheWith(redis);
    const internals = svc as unknown as {
      testcasesListCache: TestcasesListCacheService;
      listTestCasesUncached: (projectId: string, filters: unknown, limit: number, offset: number) => Promise<ListResult>;
    };
    internals.testcasesListCache = cache;
    let first = true;
    const uncached = jest.spyOn(internals, "listTestCasesUncached").mockImplementation(async () => {
      const selected = authoritative;
      if (first) {
        first = false;
        readCaptured();
        await released;
      }
      return selected;
    });

    const oldRead = svc.listTestCases(PROJECT, { limit: 25, offset: 0 });
    try {
      await captured;
      // Simulate the durable-write boundary, then use the real invalidation method. The older
      // read has selected its rows but cannot populate Redis until the barrier is released.
      authoritative = after;
      await cache.invalidate(PROJECT);
      expect(await cache.get(PROJECT, 25, 0)).toBeUndefined();
      releaseRead();
      await oldRead;

      const laterRead = await svc.listTestCases(PROJECT, { limit: 25, offset: 0 });
      expect(laterRead).toEqual(after);
      expect(uncached).toHaveBeenCalledTimes(2);
      // A cache that always misses would satisfy the original race assertion accidentally.
      // Require the later result to be stored and served without another authoritative load.
      expect(await cache.get(PROJECT, 25, 0)).toEqual(after);
      expect(await svc.listTestCases(PROJECT, { limit: 25, offset: 0 })).toEqual(after);
      expect(uncached).toHaveBeenCalledTimes(2);
      expect(redis.values.has(pageKey(PROJECT))).toBe(true);
      expect(query).not.toHaveBeenCalled();
    } finally {
      releaseRead();
      await oldRead;
    }
  });

  it("preserves a fresh result filled by another worker when an older read finishes last", async () => {
    const redis = memoryRedis();
    const oldWorker = legacyWith(cacheWith(redis));
    const currentCache = cacheWith(redis);
    const currentWorker = legacyWith(currentCache);
    const captured = barrier();
    const release = barrier();
    const before = result("before");
    const after = result("after");
    oldWorker.load.mockImplementation(async () => { captured.resolve(); await release.promise; return before; });
    currentWorker.load.mockResolvedValue(after);
    const oldRead = oldWorker.svc.listTestCases(PROJECT, { limit: 25, offset: 0 });
    try {
      await captured.promise;
      await currentCache.invalidate(PROJECT);
      expect(await currentWorker.svc.listTestCases(PROJECT, { limit: 25, offset: 0 })).toEqual(after);
      const currentEnvelope = redis.values.get(pageKey(PROJECT));
      release.resolve();
      await oldRead;
      expect(redis.values.get(pageKey(PROJECT))).toBe(currentEnvelope);
      expect(await oldWorker.svc.listTestCases(PROJECT, { limit: 25, offset: 0 })).toEqual(after);
      expect(oldWorker.load).toHaveBeenCalledTimes(1);
      expect(currentWorker.load).toHaveBeenCalledTimes(1);
      expect(oldWorker.query).not.toHaveBeenCalled();
      expect(currentWorker.query).not.toHaveBeenCalled();
    } finally { release.resolve(); await oldRead; }
  });

  it("does not acquire a replacement token after a failed pre-load read", async () => {
    const redis = memoryRedis();
    redis.eval.mockRejectedValueOnce(new Error("read unavailable"));
    const cache = cacheWith(redis);
    const worker = legacyWith(cache);
    const captured = barrier();
    const release = barrier();
    const before = result("before");
    const after = result("after");
    worker.load.mockImplementationOnce(async () => { captured.resolve(); await release.promise; return before; })
      .mockResolvedValue(after);
    const oldRead = worker.svc.listTestCases(PROJECT, { limit: 25, offset: 0 });
    try {
      await captured.promise;
      await cache.invalidate(PROJECT);
      release.resolve();
      expect(await oldRead).toEqual(before);
      expect(redis.eval).toHaveBeenCalledTimes(1);
      expect(redis.values.has(pageKey(PROJECT))).toBe(false);
      expect(await worker.svc.listTestCases(PROJECT, { limit: 25, offset: 0 })).toEqual(after);
      expect(await worker.svc.listTestCases(PROJECT, { limit: 25, offset: 0 })).toEqual(after);
      expect(worker.load).toHaveBeenCalledTimes(2);
      expect(Logger.prototype.warn).toHaveBeenCalled();
    } finally { release.resolve(); await oldRead; }
  });

  it("propagates the authoritative loader rejection without publishing or swallowing it", async () => {
    const redis = memoryRedis();
    const worker = legacyWith(cacheWith(redis));
    const failure = new Error("authoritative query failed");
    worker.load.mockRejectedValueOnce(failure).mockResolvedValue(result("recovered"));
    await expect(worker.svc.listTestCases(PROJECT, { limit: 25, offset: 0 })).rejects.toBe(failure);
    expect(worker.load).toHaveBeenCalledTimes(1);
    expect(redis.eval).toHaveBeenCalledTimes(1);
    expect(redis.values.has(pageKey(PROJECT))).toBe(false);
    expect(await worker.svc.listTestCases(PROJECT, { limit: 25, offset: 0 })).toEqual(result("recovered"));
    expect(await worker.svc.listTestCases(PROJECT, { limit: 25, offset: 0 })).toEqual(result("recovered"));
    expect(worker.load).toHaveBeenCalledTimes(2);
  });

  it("serves authoritative results with caching disabled and performs no Redis operations", async () => {
    const redis = memoryRedis();
    const cache = cacheWith(redis, false);
    const worker = legacyWith(cache);
    worker.load.mockResolvedValueOnce(result("first")).mockResolvedValueOnce(result("second"));
    expect(await worker.svc.listTestCases(PROJECT, { limit: 25, offset: 0 })).toEqual(result("first"));
    expect(await worker.svc.listTestCases(PROJECT, { limit: 25, offset: 0 })).toEqual(result("second"));
    await cache.invalidate(PROJECT);
    expect(worker.load).toHaveBeenCalledTimes(2);
    expect(redis.eval).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
  });

  it("returns a successful authoritative load even if publishing fails, then resumes healthy hits", async () => {
    const redis = memoryRedis();
    const implementation = redis.eval.getMockImplementation()!;
    redis.eval.mockImplementationOnce(implementation).mockRejectedValueOnce(new Error("publish unavailable"));
    const worker = legacyWith(cacheWith(redis));
    worker.load.mockResolvedValueOnce(result("first")).mockResolvedValue(result("second"));
    expect(await worker.svc.listTestCases(PROJECT, { limit: 25, offset: 0 })).toEqual(result("first"));
    expect(redis.values.has(pageKey(PROJECT))).toBe(false);
    expect(await worker.svc.listTestCases(PROJECT, { limit: 25, offset: 0 })).toEqual(result("second"));
    expect(await worker.svc.listTestCases(PROJECT, { limit: 25, offset: 0 })).toEqual(result("second"));
    expect(worker.load).toHaveBeenCalledTimes(2);
    expect(Logger.prototype.warn).toHaveBeenCalled();
  });

  it.each<[string, Record<string, unknown>]>([
    ["suite", { suiteId: OTHER_PROJECT }], ["descendants", { includeDescendants: true }],
    ["status", { status: "Draft" }], ["priority", { priority: "P1" }], ["type", { type: "Functional" }],
    ["automation", { automationStatus: "Manual" }], ["Jira", { jiraIssueKey: "QA-1" }],
    ["Linear", { linearIssueKey: "QA-1" }], ["Notion", { notionPageId: OTHER_PROJECT }],
    ["technique", { technique: "boundary_value_analysis" }], ["view", { view: "negative" }],
    ["search", { search: "needle" }], ["custom fields", { customFieldFilters: { state: "ready" } }],
    ["sort", { sortBy: "title", sortDir: "asc" }], ["tags", { customTagIds: OTHER_PROJECT }],
    ["IDs", { ids: OTHER_PROJECT }], ["archived rows", { includeArchived: "true" }],
  ])("bypasses a warm plain-page cache for %s and never overwrites that page", async (_name, filter) => {
    const redis = memoryRedis();
    const cache = cacheWith(redis);
    const token = await cache.read(PROJECT, 25, 0);
    await cache.set(PROJECT, 25, 0, result("plain"), token.generation);
    const worker = legacyWith(cache);
    worker.load.mockResolvedValue(result("filtered"));
    redis.eval.mockClear();
    expect(await worker.svc.listTestCases(PROJECT, { limit: 25, offset: 0, ...filter })).toEqual(result("filtered"));
    expect(worker.load).toHaveBeenCalledTimes(1);
    expect(redis.eval).not.toHaveBeenCalled();
    expect(await cache.get(PROJECT, 25, 0)).toEqual(result("plain"));
  });
});

describe("testcase list cache — generation and fallback contracts", () => {
  it("keeps page sizes, offsets and projects distinct, and invalidates every page only in its project", async () => {
    const redis = memoryRedis();
    const cache = cacheWith(redis);
    const slots = [[PROJECT, 25, 0], [PROJECT, 25, 25], [PROJECT, 50, 0], [OTHER_PROJECT, 25, 0]] as const;
    const snapshots = await Promise.all(slots.map(([project, limit, offset]) => cache.read(project, limit, offset)));
    await Promise.all(slots.map(([project, limit, offset], index) => cache.set(project, limit, offset, result(`page-${index}`), snapshots[index].generation)));
    for (const [index, [project, limit, offset]] of slots.entries()) {
      expect(await cache.get(project, limit, offset)).toEqual(result(`page-${index}`));
    }
    expect(snapshots[0].generation).toBe(snapshots[1].generation);
    expect(snapshots[0].generation).toBe(snapshots[2].generation);
    expect(snapshots[3].generation).not.toBe(snapshots[0].generation);
    await cache.invalidate(PROJECT);
    for (const [project, limit, offset] of slots.slice(0, 3)) {
      expect(await cache.get(project, limit, offset)).toBeUndefined();
      expect(redis.values.has(pageKey(project, limit, offset))).toBe(true); // stale envelopes are harmless until TTL expiry
    }
    expect(await cache.get(OTHER_PROJECT, 25, 0)).toEqual(result("page-3"));
  });

  it.each(["upper read", "lower read"])("uses one generation for equivalent UUID casing: %s", async direction => {
    const redis = memoryRedis();
    const cache = cacheWith(redis);
    const readId = direction === "upper read" ? MIXED_CASE_PROJECT.toUpperCase() : MIXED_CASE_PROJECT;
    const writeId = direction === "upper read" ? MIXED_CASE_PROJECT : MIXED_CASE_PROJECT.toUpperCase();
    const before = await cache.read(readId, 25, 0);
    await cache.set(readId, 25, 0, result("old"), before.generation);
    expect(await cache.get(writeId, 25, 0)).toEqual(result("old"));
    await cache.invalidate(writeId);
    const after = await cache.read(readId, 25, 0);
    expect(after.value).toBeUndefined();
    expect(after.generation).not.toBe(before.generation);
    await cache.set(readId, 25, 0, result("old late write"), before.generation);
    expect(await cache.get(writeId, 25, 0)).toBeUndefined();
    await cache.set(writeId, 25, 0, result("current"), after.generation);
    expect(await cache.get(readId, 25, 0)).toEqual(result("current"));
    expect([...redis.values.keys()].every(key => key.includes(MIXED_CASE_PROJECT))).toBe(true);
  });

  it("rejects an old token when the generation disappears, including after reinitialization", async () => {
    const redis = memoryRedis();
    const cache = cacheWith(redis);
    const before = await cache.read(PROJECT, 25, 0);
    await cache.set(PROJECT, 25, 0, result("old"), before.generation);
    const oldEnvelope = redis.values.get(pageKey(PROJECT));
    redis.values.delete(generationKey(PROJECT)); // explicit lost/expired/evicted key state; no fake wall clock
    await cache.set(PROJECT, 25, 0, result("old while absent"), before.generation);
    expect(redis.values.has(generationKey(PROJECT))).toBe(false);
    expect(redis.values.get(pageKey(PROJECT))).toBe(oldEnvelope);
    const fresh = await cache.read(PROJECT, 25, 0);
    expect(fresh.value).toBeUndefined();
    expect(fresh.generation).toBeTruthy();
    expect(fresh.generation).not.toBe(before.generation);
    await cache.set(PROJECT, 25, 0, result("current"), fresh.generation);
    await cache.set(PROJECT, 25, 0, result("old after reinitialization"), before.generation);
    expect(await cache.get(PROJECT, 25, 0)).toEqual(result("current"));
  });

  it("does not initialize or publish when no pre-load generation was captured", async () => {
    const redis = memoryRedis();
    const cache = cacheWith(redis);
    await cache.set(PROJECT, 25, 0, result("unfenced"), undefined);
    expect(redis.values.size).toBe(0);
    expect(redis.eval).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
  });

  it.each<[string, unknown]>([
    ["null", null], ["array", []], ["string", "unwrapped"], ["unwrapped result", { rows: [], total: 0 }],
    ["different generation", { generation: "wrong", value: result("stale") }],
  ])("treats an incompatible %s envelope as a miss without losing the captured generation", async (_name, payload) => {
      const redis = memoryRedis();
      const cache = cacheWith(redis);
      const before = await cache.read(PROJECT, 25, 0);
      redis.values.set(pageKey(PROJECT), JSON.stringify(payload));
      expect(await cache.read(PROJECT, 25, 0)).toEqual({ generation: before.generation });
    });

  it("discards the token after a corrupt JSON read, so a later load cannot publish using it", async () => {
    const redis = memoryRedis();
    const cache = cacheWith(redis);
    await cache.read(PROJECT, 25, 0);
    redis.values.set(pageKey(PROJECT), "{broken");
    const snapshot = await cache.read(PROJECT, 25, 0);
    expect(snapshot).toEqual({});
    redis.eval.mockClear();
    await cache.set(PROJECT, 25, 0, result("after corrupt read"), snapshot.generation);
    expect(redis.eval).not.toHaveBeenCalled();
    expect(Logger.prototype.warn).toHaveBeenCalled();
  });

  it("ignores pre-upgrade unversioned data and starts an independent fenced namespace", async () => {
    const redis = memoryRedis();
    redis.values.set(`testcases-nofilter:${PROJECT}:25:0`, JSON.stringify(result("legacy")));
    const cache = cacheWith(redis);
    const snapshot = await cache.read(PROJECT, 25, 0);
    expect(snapshot.value).toBeUndefined();
    expect(snapshot.generation).toBeTruthy();
    await cache.set(PROJECT, 25, 0, result("current"), snapshot.generation);
    expect(await cache.get(PROJECT, 25, 0)).toEqual(result("current"));
  });

  it("bounds the complete UTF-8 envelope and retains the 10-second page / 20-second generation expiry", async () => {
    const redis = memoryRedis();
    const cache = cacheWith(redis);
    const snapshot = await cache.read(PROJECT, 25, 0);
    const overhead = Buffer.byteLength(JSON.stringify({ generation: snapshot.generation, value: "" }), "utf8");
    const maximum = "x".repeat(200 * 1024 - overhead);
    await cache.set(PROJECT, 25, 0, maximum, snapshot.generation);
    expect(Buffer.byteLength(redis.values.get(pageKey(PROJECT))!, "utf8")).toBe(200 * 1024);
    expect(await cache.get(PROJECT, 25, 0)).toBe(maximum);
    expect(redis.expirySeconds.get(pageKey(PROJECT))).toBe(10);
    expect(redis.expirySeconds.get(generationKey(PROJECT))).toBe(20);
    const stored = redis.values.get(pageKey(PROJECT));
    await cache.set(PROJECT, 25, 0, `${maximum}é`, snapshot.generation);
    expect(redis.values.get(pageKey(PROJECT))).toBe(stored);
  });

  it("keeps invalidation failure best-effort without claiming the previous page was cleared", async () => {
    const redis = memoryRedis();
    const cache = cacheWith(redis);
    const snapshot = await cache.read(PROJECT, 25, 0);
    await cache.set(PROJECT, 25, 0, result("before failed invalidation"), snapshot.generation);
    redis.set.mockRejectedValueOnce(new Error("invalidation unavailable"));
    await expect(cache.invalidate(PROJECT)).resolves.toBeUndefined();
    expect(await cache.get(PROJECT, 25, 0)).toEqual(result("before failed invalidation"));
    expect(redis.expirySeconds.get(pageKey(PROJECT))).toBe(10);
    expect(Logger.prototype.warn).toHaveBeenCalled();
  });
});

describe("testcase list cache — standalone custom field writes", () => {
  const testcaseId = "33333333-3333-4333-8333-333333333333";
  const fieldId = "44444444-4444-4444-8444-444444444444";
  const actorId = "55555555-5555-4555-8555-555555555555";
  const organizationId = "66666666-6666-4666-8666-666666666666";

  function fixture(auditFailure?: Error, initiallyApproved = false) {
    const redis = memoryRedis();
    const cache = cacheWith(redis);
    const committed = new Map<string, unknown>([[fieldId, "before"]]);
    const staged = new Map(committed);
    const testcaseState = { status: initiallyApproved ? "Approved" : "Draft", approvalCurrent: initiallyApproved };
    const audits: Array<{ actor: unknown; project: unknown; diff: unknown }> = [];
    const definition = { id: fieldId, key: "cache-field", name: "Cache field", field_type: "text", status: "active", required: false, config: {} };
    const queryFor = (values: Map<string, unknown>) => jest.fn(async (sql: string, params: unknown[] = []) => {
      if (sql.startsWith("SELECT 1 FROM testcases")) {
        expect(params).toEqual([testcaseId, PROJECT]);
        return { rows: [{ exists: 1 }], rowCount: 1 };
      }
      if (sql.startsWith("SELECT * FROM custom_field_definitions")) {
        expect(params).toEqual([PROJECT]);
        return { rows: [definition], rowCount: 1 };
      }
      if (sql.includes("SELECT d.*, EXISTS")) {
        expect(params).toEqual([fieldId, PROJECT]);
        return { rows: [{ ...definition, project_id: PROJECT, is_used: true }], rowCount: 1 };
      }
      if (sql.startsWith("UPDATE custom_field_definitions SET status")) {
        expect([params[0], params[1], params[3]]).toEqual([fieldId, PROJECT, actorId]);
        definition.status = String(params[2]);
        // Model the V155 definition-trigger projection. The native API case executes that
        // actual PostgreSQL trigger; this isolated test proves the public owner/cache wiring.
        testcaseState.status = "In Review";
        testcaseState.approvalCurrent = false;
        return { rows: [{ ...definition, project_id: PROJECT, is_used: true }], rowCount: 1 };
      }
      if (sql.startsWith("SELECT definition_id, value FROM custom_field_values")) {
        expect(params).toEqual([testcaseId]);
        return { rows: [...values].map(([definition_id, value]) => ({ definition_id, value })), rowCount: values.size };
      }
      if (sql.includes("INSERT INTO custom_field_values")) {
        expect([params[0], params[1], params[3]]).toEqual([fieldId, testcaseId, actorId]);
        values.set(String(params[0]), JSON.parse(String(params[2])));
        return { rows: [], rowCount: 1 };
      }
      if (sql.startsWith("SELECT external_id, title FROM testcases")) {
        expect(params).toEqual([testcaseId]);
        return { rows: [{ external_id: "CACHE-TC-1", title: "Cache field case" }], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO audit_logs")) {
        if (auditFailure) throw auditFailure;
        expect(params[2]).toBe(testcaseId);
        audits.push({ project: params[0], actor: params[1], diff: JSON.parse(String(params[4])) });
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`Unexpected custom-field unit query: ${sql}`);
    });
    const db = { query: queryFor(committed) } as unknown as DatabaseService;
    const transaction = { query: queryFor(staged) } as unknown as QueryRunner;
    const reader = legacyWith(cache);
    const access = jest.spyOn(reader.svc, "requireProjectAccess").mockResolvedValue({ organization_id: organizationId, caller_role: "owner" });
    jest.spyOn(reader.svc, "logProjectActivity").mockResolvedValue(undefined);
    const plan = { assertCustomFieldsEnabled: jest.fn(async () => undefined) };
    const lookup = { getProjectBasics: jest.fn(async () => ({ organizationId })) };
    const fields = new CustomFieldsService(db, plan as unknown as PlanLimitsService,
      lookup as unknown as ProjectLookupService, reader.svc, cache);
    const authoritative = (): ListResult => ({
      rows: [{ id: testcaseId, title: "Cache field case", ...testcaseState, customFieldValues: Object.fromEntries(committed) }], total: 1,
    });
    reader.load.mockImplementation(async () => authoritative());
    return { redis, cache, committed, staged, transaction, reader, fields, authoritative, audits, access, plan };
  }

  it("refreshes a warm list after the standalone public custom-field write", async () => {
    const f = fixture();
    expect(await f.reader.svc.listTestCases(PROJECT, { limit: 25, offset: 0 })).toEqual(f.authoritative());
    expect(await f.reader.svc.listTestCases(PROJECT, { limit: 25, offset: 0 })).toEqual(f.authoritative());
    expect(f.reader.load).toHaveBeenCalledTimes(1);

    await f.fields.setValuesForTestCase(actorId, PROJECT, testcaseId, { [fieldId]: "after" });
    expect(f.committed.get(fieldId)).toBe("after");
    expect(f.audits).toEqual([{ project: PROJECT, actor: actorId, diff: {
      fieldId, fieldKey: "cache-field", fieldName: "Cache field", before: "before", after: "after",
    } }]);
    expect(await f.reader.svc.listTestCases(PROJECT, { limit: 25, offset: 0 })).toEqual(f.authoritative());
    expect(await f.reader.svc.listTestCases(PROJECT, { limit: 25, offset: 0 })).toEqual(f.authoritative());
    expect(f.reader.load).toHaveBeenCalledTimes(2);
    expect(f.access).toHaveBeenCalledWith(actorId, PROJECT);
    expect(f.plan.assertCustomFieldsEnabled).toHaveBeenCalledWith(organizationId);
  });

  it("preserves a later audit error while retiring a page made stale by an already-autocommitted value write", async () => {
    const failure = new Error("audit insert failed after value autocommit");
    const f = fixture(failure);
    await f.reader.svc.listTestCases(PROJECT, { limit: 25, offset: 0 });
    await expect(f.fields.setValuesForTestCase(actorId, PROJECT, testcaseId, { [fieldId]: "committed before audit failed" })).rejects.toBe(failure);
    expect(f.committed.get(fieldId)).toBe("committed before audit failed");
    expect(f.audits).toEqual([]);
    expect(await f.reader.svc.listTestCases(PROJECT, { limit: 25, offset: 0 })).toEqual(f.authoritative());
    expect(f.reader.load).toHaveBeenCalledTimes(2);
  });

  it("leaves an explicit transaction runner's cache generation intact until its outer commit owner invalidates", async () => {
    const f = fixture();
    const before = f.authoritative();
    await f.reader.svc.listTestCases(PROJECT, { limit: 25, offset: 0 });
    const generation = f.redis.values.get(generationKey(PROJECT));
    await f.fields.setValuesForTestCase(actorId, PROJECT, testcaseId, { [fieldId]: "staged" }, f.transaction);
    expect(f.staged.get(fieldId)).toBe("staged");
    expect(f.committed.get(fieldId)).toBe("before");
    expect(f.redis.values.get(generationKey(PROJECT))).toBe(generation);
    expect(await f.reader.svc.listTestCases(PROJECT, { limit: 25, offset: 0 })).toEqual(before);
    expect(f.reader.load).toHaveBeenCalledTimes(1);
    // Model the caller's durable boundary explicitly; this is not a database transaction test.
    f.committed.set(fieldId, f.staged.get(fieldId));
    await f.cache.invalidate(PROJECT);
    expect(await f.reader.svc.listTestCases(PROJECT, { limit: 25, offset: 0 })).toEqual(f.authoritative());
    expect(f.reader.load).toHaveBeenCalledTimes(2);
  });

  it.each(["access", "plan"])("does not rotate a warm page on a %s refusal before writing", async boundary => {
    const f = fixture();
    const before = f.authoritative();
    await f.reader.svc.listTestCases(PROJECT, { limit: 25, offset: 0 });
    const generation = f.redis.values.get(generationKey(PROJECT));
    const failure = new Error(`${boundary} refused`);
    if (boundary === "access") f.access.mockRejectedValueOnce(failure);
    else f.plan.assertCustomFieldsEnabled.mockRejectedValueOnce(failure);
    await expect(f.fields.setValuesForTestCase(actorId, PROJECT, testcaseId, { [fieldId]: "refused" })).rejects.toBe(failure);
    expect(f.committed.get(fieldId)).toBe("before");
    expect(f.audits).toEqual([]);
    expect(f.redis.values.get(generationKey(PROJECT))).toBe(generation);
    expect(await f.reader.svc.listTestCases(PROJECT, { limit: 25, offset: 0 })).toEqual(before);
    expect(f.reader.load).toHaveBeenCalledTimes(1);
  });

  it("refreshes an approved warm list after the public definition status change invalidates its review", async () => {
    const f = fixture(undefined, true);
    expect(await f.reader.svc.listTestCases(PROJECT, { limit: 25, offset: 0 })).toMatchObject({ rows: [{ status: "Approved", approvalCurrent: true }] });
    await f.reader.svc.listTestCases(PROJECT, { limit: 25, offset: 0 });
    expect(f.reader.load).toHaveBeenCalledTimes(1);
    const changed = await f.fields.setStatus(actorId, PROJECT, fieldId, "inactive");
    expect(changed.status).toBe("inactive");
    expect(f.authoritative()).toMatchObject({ rows: [{ status: "In Review", approvalCurrent: false }] });
    expect(await f.reader.svc.listTestCases(PROJECT, { limit: 25, offset: 0 })).toEqual(f.authoritative());
    expect(await f.reader.svc.listTestCases(PROJECT, { limit: 25, offset: 0 })).toEqual(f.authoritative());
    expect(f.reader.load).toHaveBeenCalledTimes(2);
  });
});
