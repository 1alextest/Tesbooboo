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




function makeRowLockedDb(initialActivePlan: Record<string, unknown> | null): { db: DatabaseService; getActivePlan: () => Record<string, unknown> | null } {
  let activePlan = initialActivePlan;
  let chain: Promise<void> = Promise.resolve();

  const db = {
    query: jest.fn(() => Promise.resolve({ rows: [] })),
    transaction: jest.fn((fn: (client: { query: jest.Mock }) => Promise<unknown>) => {
      const prev = chain;
      let release: () => void = () => undefined;
      chain = new Promise((resolve) => {
        release = resolve;
      });
      return prev.then(async () => {
        const client = {
          query: jest.fn((sql: string, params: unknown[] = []) => {
            if (sql.includes("SELECT active_plan") && sql.includes("FOR UPDATE")) {
              return Promise.resolve({ rows: [{ active_plan: activePlan }] });
            }
            if (sql.includes("UPDATE zyra_chat_sessions SET active_plan = NULL")) {
              activePlan = null;
              return Promise.resolve({ rows: [] });
            }
            if (sql.includes("UPDATE zyra_chat_sessions SET active_plan")) {
              activePlan = JSON.parse(String(params[1]));
              return Promise.resolve({ rows: [] });
            }
            // INSERT INTO zyra_chat_messages / plain UPDATE updated_at from postZyraPlanMessage —
            // not relevant to the lock itself, just needs to resolve.
            return Promise.resolve({ rows: [] });
          })
        };
        try {
          return await fn(client);
        } finally {
          release();
        }
      });
    })
  } as unknown as DatabaseService;

  return { db, getActivePlan: () => activePlan };
}

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

describe("execution attribution", () => {
  const actor = "11a6df91-7f69-4aa1-b999-568091409401";
  const project = "96b4c52b-66cb-4c41-bf57-86c1e5550888";
  const execution = "b528478c-c26a-4a4c-af3b-13cb10e4f1f0";
  const original = "f899e70f-58c6-4c11-819b-c76590126ae1";

  function setup() {
    const query = jest.fn(async (sql: string, params: unknown[] = []) => {
      if (sql.includes("FROM executions e") && sql.includes("WHERE e.id = $1"))
        return { rows: [{ id: execution, project_id: project, status: "Passed", executed_by: original, assignee_id: null, testcase_title: "Search results" }] };
      if (sql.includes("UPDATE executions SET")) return { rows: [{ id: execution, status: params[1] ?? "Passed", executed_by: params[1] ? actor : original, assignee_id: null }] };
      return { rows: [] };
    });
    const svc = makeLegacy({ query } as unknown as DatabaseService);
    jest.spyOn(svc as unknown as { requireProjectAccess: (...args: unknown[]) => Promise<unknown> }, "requireProjectAccess").mockResolvedValue(undefined);
    jest.spyOn(svc as unknown as { logProjectActivity: (...args: unknown[]) => Promise<unknown> }, "logProjectActivity").mockResolvedValue(undefined);
    jest.spyOn(svc as unknown as { notifyExecutionChange: (...args: unknown[]) => Promise<unknown> }, "notifyExecutionChange").mockResolvedValue(undefined);
    return { svc, query };
  }

  it("keeps the original executor when changing only actual result", async () => {
    const { svc, query } = setup();
    await svc.updateExecution(execution, actor, { actualResult: "Added clarification" });
    const update = query.mock.calls.find(([sql]) => sql.includes("UPDATE executions SET"));
    expect(update).toBeDefined();
    expect(update![0]).toContain("executed_by=CASE WHEN $2 IS NULL THEN executed_by ELSE $7 END");
    expect(update![1][1]).toBeNull();
    expect(update![1][6]).toBe(actor);
  });

  it("attributes an explicit execution status write to the acting user", async () => {
    const { svc, query } = setup();
    await svc.updateExecution(execution, actor, { status: "Failed" });
    const update = query.mock.calls.find(([sql]) => sql.includes("UPDATE executions SET"));
    expect(update![1][1]).toBe("Failed");
    expect(update![1][6]).toBe(actor);
  });
});
