/*
 * Executes the production Lua scripts against real Redis through two independent ioredis clients.
 * The ordinary backend unit job has no Redis dependency. This suite runs only when the existing
 * disposable smoke job explicitly supplies TESTCASES_CACHE_TEST_REDIS_URL; it never reads REDIS_URL.
 * Only loopback Redis on the smoke service's port 6379 is accepted. Every key belongs to a random
 * test project and is deleted explicitly; there is no FLUSHDB, SCAN, shared project or database.
 */
import { randomUUID } from "node:crypto";
import Redis from "ioredis";
import type { AppConfigService } from "../config/app-config.service";
import type { DatabaseService } from "../database/database.service";
import { makeLegacy } from "../legacy/test-helpers/legacy-service.fixture";
import { TestcasesListCacheService } from "./testcases-list-cache.service";

const redisUrl = process.env.TESTCASES_CACHE_TEST_REDIS_URL;
const suite = redisUrl ? describe : describe.skip;
type ListResult = { rows: Array<{ id: string; title: string; status: string }>; total: number };
const result = (id: string): ListResult => ({ rows: [{ id, title: id, status: "Draft" }], total: 1 });
const generationKey = (projectId: string) => `testcases-nofilter:v2:{${projectId.toLowerCase()}}:generation`;
const pageKey = (projectId: string, limit = 25, offset = 0) =>
  `testcases-nofilter:v2:{${projectId.toLowerCase()}}:page:${limit}:${offset}`;

function worker(cache: TestcasesListCacheService) {
  const query = jest.fn(async () => { throw new Error("The Redis protocol integration test must not connect to a database"); });
  const svc = makeLegacy({ query } as unknown as DatabaseService);
  const internals = svc as unknown as {
    testcasesListCache: TestcasesListCacheService;
    listTestCasesUncached: () => Promise<ListResult>;
  };
  internals.testcasesListCache = cache;
  return { svc, query, load: jest.spyOn(internals, "listTestCasesUncached") };
}

function barrier() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

suite("testcase list cache (real Redis, independent clients)", () => {
  let first: Redis;
  let second: Redis;
  let cacheA: TestcasesListCacheService;
  let cacheB: TestcasesListCacheService;
  const ownedKeys = new Set<string>();

  const project = () => {
    // Force an alphabetic UUID digit so both casing directions are meaningful in every run.
    const id = `a${randomUUID().slice(1)}`;
    for (const spelling of [id, id.toUpperCase()]) {
      const prefix = `testcases-nofilter:v2:{${spelling}}`;
      ownedKeys.add(`${prefix}:generation`);
      for (const [limit, offset] of [[25, 0], [25, 25], [50, 0]]) ownedKeys.add(`${prefix}:page:${limit}:${offset}`);
    }
    return id;
  };

  beforeAll(async () => {
    const parsed = new URL(redisUrl!);
    if (parsed.protocol !== "redis:" || !["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsed.hostname) ||
        (parsed.port || "6379") !== "6379" || !["", "/", "/0"].includes(parsed.pathname) || parsed.search) {
      throw new Error("Refusing testcase cache integration: the explicit disposable loopback Redis on port 6379 is required");
    }
    const options = { lazyConnect: true, maxRetriesPerRequest: 0, enableOfflineQueue: false, retryStrategy: () => null };
    first = new Redis(redisUrl!, options);
    second = new Redis(redisUrl!, options);
    // Connection failures still reject connect()/commands, without logging credentials from a URL.
    first.on("error", () => undefined);
    second.on("error", () => undefined);
    await Promise.all([first.connect(), second.connect()]);
    expect(await first.ping()).toBe("PONG");
    expect(await second.ping()).toBe("PONG");
    expect(await first.call("CLIENT", "ID")).not.toBe(await second.call("CLIENT", "ID"));
    const config = { testcasesListCacheEnabled: true } as unknown as AppConfigService;
    cacheA = new TestcasesListCacheService(first, config);
    cacheB = new TestcasesListCacheService(second, config);
  });

  afterEach(async () => {
    try {
      if (ownedKeys.size) await first.del(...ownedKeys);
    } finally {
      ownedKeys.clear();
      jest.restoreAllMocks();
    }
  });

  afterAll(async () => {
    for (const client of [first, second]) {
      if (!client) continue;
      if (client.status === "ready") await client.quit();
      else client.disconnect();
    }
  });

  it("keeps another client's fresh fill when an older authoritative read completes last, with genuine subsequent hits", async () => {
    const id = project();
    const oldWorker = worker(cacheA);
    const currentWorker = worker(cacheB);
    const captured = barrier();
    const release = barrier();
    oldWorker.load.mockImplementation(async () => { captured.resolve(); await release.promise; return result("old"); });
    currentWorker.load.mockResolvedValue(result("current"));
    const oldRead = oldWorker.svc.listTestCases(id, { limit: 25, offset: 0 });
    try {
      await captured.promise;
      await cacheB.invalidate(id);
      expect(await currentWorker.svc.listTestCases(id, { limit: 25, offset: 0 })).toEqual(result("current"));
      const currentEnvelope = await second.get(pageKey(id));
      expect(currentEnvelope).not.toBeNull();
      release.resolve();
      await oldRead;
      expect(await second.get(pageKey(id))).toBe(currentEnvelope);
      expect(await oldWorker.svc.listTestCases(id, { limit: 25, offset: 0 })).toEqual(result("current"));
      expect(await currentWorker.svc.listTestCases(id, { limit: 25, offset: 0 })).toEqual(result("current"));
      expect(oldWorker.load).toHaveBeenCalledTimes(1);
      expect(currentWorker.load).toHaveBeenCalledTimes(1);
      expect(oldWorker.query).not.toHaveBeenCalled();
      expect(currentWorker.query).not.toHaveBeenCalled();
      expect(JSON.parse(currentEnvelope!)).toEqual({ generation: await second.get(generationKey(id)), value: result("current") });
    } finally { release.resolve(); await oldRead; }
  });

  it("atomically retires every page in one project while another project's real cache entries still hit", async () => {
    const id = project();
    const otherId = project();
    const slots = [[id, 25, 0], [id, 25, 25], [id, 50, 0], [otherId, 25, 0]] as const;
    const snapshots = await Promise.all(slots.map(([projectId, limit, offset]) => cacheA.read(projectId, limit, offset)));
    expect(snapshots[0].generation).toBeTruthy();
    expect(snapshots[1].generation).toBe(snapshots[0].generation);
    expect(snapshots[2].generation).toBe(snapshots[0].generation);
    expect(snapshots[3].generation).not.toBe(snapshots[0].generation);
    await Promise.all(slots.map(([projectId, limit, offset], index) => cacheA.set(projectId, limit, offset, result(`page-${index}`), snapshots[index].generation)));
    for (const [index, [projectId, limit, offset]] of slots.entries()) {
      expect(await cacheB.get(projectId, limit, offset)).toEqual(result(`page-${index}`));
    }
    await cacheB.invalidate(id);
    for (const [projectId, limit, offset] of slots.slice(0, 3)) {
      expect(await first.get(pageKey(projectId, limit, offset))).not.toBeNull();
      expect(await cacheA.get(projectId, limit, offset)).toBeUndefined();
      await cacheA.set(projectId, limit, offset, result("late obsolete fill"), snapshots[0].generation);
      expect(await cacheB.get(projectId, limit, offset)).toBeUndefined();
    }
    expect(await cacheA.get(otherId, 25, 0)).toEqual(result("page-3"));
  });

  it.each(["delete", "expire"])("cannot revive a surviving page after generation %s, before or after reinitialization", async loss => {
    const id = project();
    const before = await cacheA.read(id, 25, 0);
    await cacheA.set(id, 25, 0, result("old"), before.generation);
    const oldEnvelope = await first.get(pageKey(id));
    expect(oldEnvelope).not.toBeNull();
    if (loss === "delete") expect(await second.del(generationKey(id))).toBe(1);
    else expect(await second.pexpire(generationKey(id), 0)).toBe(1); // Redis expires it now; no sleep or clock guessing
    expect(await second.get(generationKey(id))).toBeNull();
    await cacheA.set(id, 25, 0, result("late while absent"), before.generation);
    expect(await first.get(generationKey(id))).toBeNull();
    expect(await first.get(pageKey(id))).toBe(oldEnvelope);
    const current = await cacheB.read(id, 25, 0);
    expect(current.value).toBeUndefined();
    expect(current.generation).toBeTruthy();
    expect(current.generation).not.toBe(before.generation);
    await cacheB.set(id, 25, 0, result("current"), current.generation);
    await cacheA.set(id, 25, 0, result("late after reinitialization"), before.generation);
    expect(await cacheA.get(id, 25, 0)).toEqual(result("current"));
  });

  it.each(["upper read", "lower read"])("shares the same Redis generation across UUID spelling: %s", async direction => {
    const id = project();
    const readId = direction === "upper read" ? id.toUpperCase() : id;
    const writeId = direction === "upper read" ? id : id.toUpperCase();
    const before = await cacheA.read(readId, 25, 0);
    await cacheA.set(readId, 25, 0, result("old"), before.generation);
    expect(await cacheB.get(writeId, 25, 0)).toEqual(result("old"));
    await cacheB.invalidate(writeId);
    const current = await cacheA.read(readId, 25, 0);
    expect(current.value).toBeUndefined();
    expect(current.generation).not.toBe(before.generation);
    await cacheB.set(writeId, 25, 0, result("current"), current.generation);
    await cacheA.set(readId, 25, 0, result("obsolete"), before.generation);
    expect(await cacheA.get(readId, 25, 0)).toEqual(result("current"));
    expect(await cacheB.get(writeId, 25, 0)).toEqual(result("current"));
    expect(await first.get(`testcases-nofilter:v2:{${id.toUpperCase()}}:generation`)).toBeNull();
  });

  it("sets bounded native expirations and performs no unfenced population", async () => {
    const id = project();
    await cacheA.set(id, 25, 0, result("without token"), undefined);
    expect(await second.get(generationKey(id))).toBeNull();
    expect(await second.get(pageKey(id))).toBeNull();
    const snapshot = await cacheA.read(id, 25, 0);
    await cacheA.set(id, 25, 0, result("current"), snapshot.generation);
    expect(await cacheB.get(id, 25, 0)).toEqual(result("current"));
    const pageExpiry = await second.pttl(pageKey(id));
    const generationExpiry = await second.pttl(generationKey(id));
    expect(pageExpiry).toBeGreaterThan(0);
    expect(pageExpiry).toBeLessThanOrEqual(10_000);
    expect(generationExpiry).toBeGreaterThan(pageExpiry);
    expect(generationExpiry).toBeLessThanOrEqual(20_000);
  });
});
