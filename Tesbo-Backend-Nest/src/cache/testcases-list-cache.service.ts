import { Inject, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type Redis from "ioredis";
import { AppConfigService } from "../config/app-config.service";
import { REDIS_CACHE_CLIENT } from "./redis-cache.tokens";

// Invalidation is the primary correctness mechanism; TTL bounds missed hooks/Redis failures.
const TTL_SECONDS = 10;
const MAX_VALUE_BYTES = 200 * 1024;
// A generation outlives every page populated under it, but abandoned projects leave no permanent key.
const GENERATION_TTL_SECONDS = 20;

function projectKey(projectId: string): string {
  // PostgreSQL UUID identity is case-insensitive. URL reads and DB-derived invalidations must agree.
  // v2 never interprets an older worker's unversioned page as a generation-bound value.
  return `testcases-nofilter:v2:{${projectId.toLowerCase()}}`;
}

function generationKey(projectId: string): string {
  return `${projectKey(projectId)}:generation`;
}

function listKey(projectId: string, limit: number, offset: number): string {
  return `${projectKey(projectId)}:page:${limit}:${offset}`;
}

// Capture the generation and page in one Redis observation, before the authoritative query starts.
// A missing/expired/evicted generation gets a new token, never a resettable default epoch.
const READ_SCRIPT = `-- testcase-list-read-v2
local generation = redis.call('GET', KEYS[1])
if not generation then
  generation = ARGV[1]
  redis.call('SET', KEYS[1], generation, 'EX', ARGV[2])
end
return {generation, redis.call('GET', KEYS[2]) or false}
`;

// A read crossing invalidation may finish its old snapshot, but cannot seed later readers with it.
// Never recreate a missing generation from the captured token: that would revive an obsolete read.
const PUBLISH_SCRIPT = `-- testcase-list-publish-v2
if redis.call('GET', KEYS[1]) ~= ARGV[1] then
  return 0
end
redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3])
redis.call('EXPIRE', KEYS[1], ARGV[4])
return 1
`;

export interface TestcasesListCacheRead<T> {
  value?: T;
  generation?: string;
}

/**
 * Cache for the unfiltered LegacyService testcase list, keyed by project and pagination only.
 * Filters, sorting and search continue to use the authoritative query directly.
 *
 * Every page carries the generation captured before its query. Atomic generation rotation makes
 * all project pages unreadable at once, without a secondary key index or enumeration/deletion race.
 * Old page bytes expire under the existing ten-second bound. Each serving worker must use this
 * protocol; a mixed fleet with older unfenced workers is not a consistency guarantee.
 *
 * Redis remains optional: failed/disabled reads have no population token and fall back to Postgres.
 * Failed invalidation remains best-effort with the TTL backstop; this is not a durable DB/Redis
 * transaction or a guarantee against Redis restoring older state during failover.
 */
@Injectable()
export class TestcasesListCacheService {
  private readonly logger = new Logger(TestcasesListCacheService.name);

  constructor(
    @Inject(REDIS_CACHE_CLIENT) private readonly redis: Redis,
    private readonly config: AppConfigService
  ) {}

  async read<T>(projectId: string, limit: number, offset: number): Promise<TestcasesListCacheRead<T>> {
    if (!this.config.testcasesListCacheEnabled) return {};
    try {
      const response = await this.redis.eval(
        READ_SCRIPT, 2, generationKey(projectId), listKey(projectId, limit, offset),
        randomUUID(), GENERATION_TTL_SECONDS
      );
      if (!Array.isArray(response) || response.length !== 2 || typeof response[0] !== "string" ||
          (response[1] !== null && typeof response[1] !== "string")) {
        throw new Error("Unexpected testcase cache read response");
      }
      const [generation, raw] = response as [string, string | null];
      if (raw === null) return { generation };
      const envelope: unknown = JSON.parse(raw);
      if (typeof envelope !== "object" || envelope === null ||
          !("generation" in envelope) || envelope.generation !== generation || !("value" in envelope)) {
        return { generation };
      }
      return { generation, value: envelope.value as T };
    } catch (error) {
      this.logger.warn(`testcases-list cache read failed, falling back to Postgres: ${(error as Error).message}`);
      return {};
    }
  }

  async get<T>(projectId: string, limit: number, offset: number): Promise<T | undefined> {
    return (await this.read<T>(projectId, limit, offset)).value;
  }

  async set<T>(projectId: string, limit: number, offset: number, value: T, generation: string | undefined): Promise<void> {
    if (!this.config.testcasesListCacheEnabled || !generation) return;
    try {
      const serialized = JSON.stringify({ generation, value });
      // Bound the actual stored envelope; oversized results still return intact from Postgres.
      if (Buffer.byteLength(serialized, "utf8") > MAX_VALUE_BYTES) return;
      await this.redis.eval(
        PUBLISH_SCRIPT, 2, generationKey(projectId), listKey(projectId, limit, offset),
        generation, serialized, TTL_SECONDS, GENERATION_TTL_SECONDS
      );
    } catch (error) {
      this.logger.warn(`testcases-list cache write failed (non-fatal): ${(error as Error).message}`);
    }
  }

  /** Called after a testcase write commits. One atomic rotation invalidates every pagination variant. */
  async invalidate(projectId: string): Promise<void> {
    if (!this.config.testcasesListCacheEnabled) return;
    try {
      await this.redis.set(generationKey(projectId), randomUUID(), "EX", GENERATION_TTL_SECONDS);
    } catch (error) {
      this.logger.warn(`testcases-list cache invalidation failed (non-fatal): ${(error as Error).message}`);
    }
  }
}
