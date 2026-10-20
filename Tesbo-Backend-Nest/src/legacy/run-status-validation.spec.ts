import { LegacyService } from "./legacy.service";
import type { DatabaseService } from "../database/database.service";
import type { EmailService } from "../auth/email.service";
import type { PasswordService } from "../auth/password.service";
import type { AppConfigService } from "../config/app-config.service";
import type { StorageService } from "../storage/storage.service";
import type { RagIngestionService } from "../rag/rag-ingestion.service";
import type { RagRetrievalService } from "../rag/rag-retrieval.service";
import type { IntegrationSyncService } from "../integration-sync/integration-sync.service";
import type { ApiTokenService } from "../auth/api-token.service";
import type { PlanLimitsService } from "../plan-limits/plan-limits.service";
import type { CustomFieldsService } from "../custom-fields/custom-fields.service";
import type { CustomTagsService } from "../custom-tags/custom-tags.service";
import { RequestCacheService } from "../request-cache/request-cache.service";
import { ProjectLookupService } from "../request-cache/project-lookup.service";
import type { KbExtractionRunnerService } from "./kb-extraction-runner.service";
import { SuitesCacheService } from "../cache/suites-cache.service";
import { TestcasesListCacheService } from "../cache/testcases-list-cache.service";
import { ProjectOverviewCacheService } from "../cache/project-overview-cache.service";
import type Redis from "ioredis";

process.env.SECRETS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");




function makeLegacy(db: DatabaseService): LegacyService {
  const requestCache = new RequestCacheService({} as unknown as AppConfigService);
  const suitesCache = new SuitesCacheService({} as unknown as Redis, {} as unknown as AppConfigService);
  const testcasesListCache = new TestcasesListCacheService({} as unknown as Redis, {} as unknown as AppConfigService);
  const projectOverviewCache = new ProjectOverviewCacheService({} as unknown as Redis, {} as unknown as AppConfigService);
  return new LegacyService(
    db,
    {} as unknown as EmailService,
    {} as unknown as PasswordService,
    {} as unknown as AppConfigService,
    {} as unknown as StorageService,
    {} as unknown as RagIngestionService,
    {} as unknown as RagRetrievalService,
    {} as unknown as IntegrationSyncService,
    {} as unknown as ApiTokenService,
    {} as unknown as PlanLimitsService,
    requestCache,
    new ProjectLookupService(db, requestCache),
    {} as unknown as KbExtractionRunnerService,
    suitesCache,
    testcasesListCache,
    projectOverviewCache,
    {} as unknown as CustomFieldsService,
    {} as unknown as CustomTagsService
  );
}

describe("Run lifecycle status validation", () => {
  const cycleId = "b528478c-c26a-4a4c-af3b-13cb10e4f1f0";
  const actorId = "11a6df91-7f69-4aa1-b999-568091409401";

  function setup() {
    const query = jest.fn(async () => ({ rows: [] }));
    const svc = makeLegacy({ query } as unknown as DatabaseService);
    jest.spyOn(svc as unknown as { requireCycleAccess: (...args: unknown[]) => Promise<string> }, "requireCycleAccess")
      .mockResolvedValue("96b4c52b-66cb-4c41-bf57-86c1e5550888");
    return { svc, query };
  }

  it.each(["invalid", "passed", "Completed ", "", 27, false, {}])("rejects unsupported status %p without writing", async (status) => {
    const { svc, query } = setup();
    await expect(svc.updateCycle(cycleId, actorId, { status })).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });

  it("allows a metadata-only update with no status", async () => {
    const { svc, query } = setup();
    await svc.updateCycle(cycleId, actorId, { description: "Release notes" });
    expect(query).toHaveBeenCalledWith(expect.stringContaining("UPDATE cycles SET"), expect.any(Array));
    const params = query.mock.calls.find(([sql]) => sql.includes("UPDATE cycles SET"));
    expect(params?.[1]?.[8]).toBeNull();
  });
});
