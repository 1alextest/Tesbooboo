import { LegacyService } from "../legacy.service";
import type { DatabaseService } from "../../database/database.service";
import type { EmailService } from "../../auth/email.service";
import type { PasswordService } from "../../auth/password.service";
import type { AppConfigService } from "../../config/app-config.service";
import type { StorageService } from "../../storage/storage.service";
import type { RagIngestionService } from "../../rag/rag-ingestion.service";
import type { RagRetrievalService } from "../../rag/rag-retrieval.service";
import type { IntegrationSyncService } from "../../integration-sync/integration-sync.service";
import type { ApiTokenService } from "../../auth/api-token.service";
import type { PlanLimitsService } from "../../plan-limits/plan-limits.service";
import type { CustomFieldsService } from "../../custom-fields/custom-fields.service";
import type { CustomTagsService } from "../../custom-tags/custom-tags.service";
import { RequestCacheService } from "../../request-cache/request-cache.service";
import { ProjectLookupService } from "../../request-cache/project-lookup.service";
import type { KbExtractionRunnerService } from "../kb-extraction-runner.service";
import { SuitesCacheService } from "../../cache/suites-cache.service";
import { TestcasesListCacheService } from "../../cache/testcases-list-cache.service";
import { ProjectOverviewCacheService } from "../../cache/project-overview-cache.service";
import type Redis from "ioredis";


export function makeLegacy(db: DatabaseService): LegacyService {
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
