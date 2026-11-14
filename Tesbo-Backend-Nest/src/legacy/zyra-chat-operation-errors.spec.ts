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
import type { RequestCacheService } from "../request-cache/request-cache.service";
import type { ProjectLookupService } from "../request-cache/project-lookup.service";
import type { KbExtractionRunnerService } from "./kb-extraction-runner.service";
import type { SuitesCacheService } from "../cache/suites-cache.service";
import type { TestcasesListCacheService } from "../cache/testcases-list-cache.service";
import type { ProjectOverviewCacheService } from "../cache/project-overview-cache.service";
import { runInZyraLanguage } from "./zyra-language-context";
import * as aiTrace from "../observability/ai-trace";

process.env.SECRETS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

/*
 * F5 (found auditing the same "success reported as failure, or vice versa" class of bug as
 * ZYRA_ALREADY_DISCLOSED's fixes in zyra-chat-intent.spec.ts): applyZyraChatOperations' per-turn
 * loop is not one transaction — each operation issues its own independent DB statement(s) (see the
 * method's own comment on moveTargetIds for why move counts are read back after the loop rather
 * than accumulated live). Before this fix, an exception partway through operation N propagated out
 * of the whole method uncaught: whatever operations 1..N-1 already committed stayed committed, but
 * the turn produced no reply at all — no assistant message, no activity entry, nothing — so ground
 * truth was partial success while the user saw (at best) a generic transport error. This file drives
 * applyZyraChatOperations directly (same boundary choice as zyra-save-integration-sync.spec.ts:
 * mock what this fix isn't changing — capability resolution, actor resolution, suite creation —
 * and test the one thing it is: does one operation's own hard failure still let the rest of the
 * turn's real result come back).
 */

type Body = Record<string, any>;

function makeLegacy(): LegacyService {
  const db = { query: jest.fn().mockResolvedValue({ rows: [] }) } as unknown as DatabaseService;
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
    {} as unknown as RequestCacheService,
    {} as unknown as ProjectLookupService,
    {} as unknown as KbExtractionRunnerService,
    {} as unknown as SuitesCacheService,
    {} as unknown as TestcasesListCacheService,
    {} as unknown as ProjectOverviewCacheService,
    {} as unknown as CustomFieldsService,
    {} as unknown as CustomTagsService
  );
}

function mockCapabilitiesAndActor(svc: LegacyService): void {
  jest.spyOn(svc as unknown as { zyraProjectCapabilities: (...a: unknown[]) => Promise<unknown> }, "zyraProjectCapabilities")
    .mockResolvedValue({ generation: true, knowledgeBase: true, testcaseStorage: true, suiteOperations: true });
  jest.spyOn(svc as unknown as { resolveZyraActor: (...a: unknown[]) => Promise<unknown> }, "resolveZyraActor").mockResolvedValue("actor-1");
}

type AppliedShape = { testcases: Body[]; activity: Array<{ title?: string; detail?: string }>; reviewRequestId: string | null };

function applyOps(svc: LegacyService, operations: Body[]): Promise<AppliedShape> {
  return (svc as unknown as { applyZyraChatOperations: (...a: unknown[]) => Promise<AppliedShape> }).applyZyraChatOperations(
    "project-1",
    "user-1",
    "session-1",
    operations
  );
}

const SUITE_ERROR = {
  en: "⚠️ Suite operations reported an error. Do not treat the response below as confirmation that every operation completed. Any changes already applied were kept; check the activity log before retrying.",
  ru: "⚠️ При выполнении операций с наборами возникла ошибка. Ответ ниже не подтверждает, что все операции завершились. Уже применённые изменения сохранены; перед повтором проверьте журнал действий."
};

function finalReply(svc: LegacyService, operations: Body[], applied: AppliedShape, reply: string): string {
  return (svc as unknown as { finalizeZyraChatReply: (...args: unknown[]) => string }).finalizeZyraChatReply(
    { reply, actionType: "suite", operations }, applied, applied.testcases
  );
}

describe("applyZyraChatOperations — one operation's failure does not lose the rest of the turn", () => {
  afterEach(() => jest.restoreAllMocks());

  it("keeps an earlier operation's real result and reports a later one as failed, instead of throwing out of the whole turn", async () => {
    const svc = makeLegacy();
    mockCapabilitiesAndActor(svc);
    jest.spyOn(svc as unknown as { resolveOrCreateSuiteByName: (...a: unknown[]) => Promise<unknown> }, "resolveOrCreateSuiteByName")
      .mockResolvedValueOnce({ id: "suite-1", name: "First Suite", created: true })
      .mockRejectedValueOnce(new Error("connection reset"));

    const applied = await applyOps(svc, [
      { type: "create_suite", suiteName: "First Suite" },
      { type: "create_suite", suiteName: "Second Suite" }
    ]);

    // The first, genuinely successful operation must not be discarded just because the second one
    // blew up — before this fix, the thrown error propagated out of applyZyraChatOperations
    // entirely and NEITHER operation's outcome (successful or failed) ever reached the caller.
    expect(applied.activity.some((entry) => entry.title === "Created suite" && entry.detail === "First Suite")).toBe(true);
    expect(applied.activity.some((entry) => entry.title === "An operation failed unexpectedly")).toBe(true);
  });

  it("never throws out of the method itself, even when every operation in the turn fails", async () => {
    const svc = makeLegacy();
    mockCapabilitiesAndActor(svc);
    jest.spyOn(svc as unknown as { resolveOrCreateSuiteByName: (...a: unknown[]) => Promise<unknown> }, "resolveOrCreateSuiteByName")
      .mockRejectedValue(new Error("db unavailable"));

    await expect(applyOps(svc, [{ type: "create_suite", suiteName: "Only Suite" }])).resolves.toMatchObject({
      testcases: [],
      activity: [{ title: "An operation failed unexpectedly" }]
    });
  });

  it("a failed operation's activity detail names the operation type without leaking a raw stack trace", async () => {
    const svc = makeLegacy();
    mockCapabilitiesAndActor(svc);
    jest.spyOn(svc as unknown as { resolveOrCreateSuiteByName: (...a: unknown[]) => Promise<unknown> }, "resolveOrCreateSuiteByName")
      .mockRejectedValue(new Error("connection reset"));

    const applied = await applyOps(svc, [{ type: "create_suite", suiteName: "Only Suite" }]);
    const failure = applied.activity.find((entry) => entry.title === "An operation failed unexpectedly");
    expect(failure?.detail).toContain("create suite");
    expect(failure?.detail).not.toContain("connection reset");
  });

  for (const language of ["en", "ru"] as const) {
    const reply = language === "en" ? "Created the requested suites." : "Запрошенные наборы созданы.";

    it(`${language}: corrects the final reply when every create-suite operation fails`, async () => {
      const svc = makeLegacy(); mockCapabilitiesAndActor(svc);
      const operations = [{ type: "create_suite", suiteName: "Only Suite" }];
      jest.spyOn(svc as unknown as { resolveOrCreateSuiteByName: (...a: unknown[]) => Promise<unknown> }, "resolveOrCreateSuiteByName")
        .mockRejectedValue(new Error("private database detail"));
      const applied = await applyOps(svc, operations);
      const out = runInZyraLanguage(language, () => finalReply(svc, operations, applied, reply));
      expect(out).toBe(`${SUITE_ERROR[language]}\n\n${reply}`);
      expect(out).not.toContain("private database detail");
    });

    it(`${language}: corrects partial suite success without denying the earlier write`, async () => {
      const svc = makeLegacy(); mockCapabilitiesAndActor(svc);
      const operations = [{ type: "create_suite", suiteName: "First Suite" }, { type: "create_suite", suiteName: "Second Suite" }];
      jest.spyOn(svc as unknown as { resolveOrCreateSuiteByName: (...a: unknown[]) => Promise<unknown> }, "resolveOrCreateSuiteByName")
        .mockResolvedValueOnce({ id: "suite-1", name: "First Suite", created: true })
        .mockRejectedValueOnce(new Error("private database detail"));
      const applied = await applyOps(svc, operations);
      expect(applied.activity.filter((entry) => entry.title === "Created suite")).toHaveLength(1);
      const out = runInZyraLanguage(language, () => finalReply(svc, operations, applied, reply));
      expect(out).toBe(`${SUITE_ERROR[language]}\n\n${reply}`);
      expect(out).not.toContain("Nothing was saved");
      expect(out).not.toContain("Ничего не сохранено");
    });

    it(`${language}: keeps feedback conservative after an injected post-write collaborator exception`, async () => {
      const svc = makeLegacy(); mockCapabilitiesAndActor(svc);
      const operations = [{ type: "create_suite", suiteName: "Written Suite" }];
      jest.spyOn(svc as unknown as { resolveOrCreateSuiteByName: (...a: unknown[]) => Promise<unknown> }, "resolveOrCreateSuiteByName")
        .mockResolvedValue({ id: "suite-1", name: "Written Suite", created: true });
      // A synthetic boundary shape, not native audit-delivery evidence: logProjectActivity normally
      // swallows DB errors. The formatter must not infer rollback from a failure after a success event.
      jest.spyOn(svc as unknown as { logProjectActivity: (...a: unknown[]) => Promise<unknown> }, "logProjectActivity")
        .mockRejectedValue(new Error("private audit detail"));
      const applied = await applyOps(svc, operations);
      expect(applied.activity.map((entry) => entry.title)).toEqual(["Created suite", "An operation failed unexpectedly"]);
      const out = runInZyraLanguage(language, () => finalReply(svc, operations, applied, reply));
      expect(out).toBe(`${SUITE_ERROR[language]}\n\n${reply}`);
      expect(out).not.toContain("private audit detail");
    });

    it.each([true, false])(`${language}: leaves a successful create/reuse alone (created=%s)`, async (created) => {
      const svc = makeLegacy(); mockCapabilitiesAndActor(svc);
      const operations = [{ type: "create_suite", suiteName: "Existing Suite" }];
      jest.spyOn(svc as unknown as { resolveOrCreateSuiteByName: (...a: unknown[]) => Promise<unknown> }, "resolveOrCreateSuiteByName")
        .mockResolvedValue({ id: "suite-1", name: "Existing Suite", created });
      const applied = await applyOps(svc, operations);
      const successfulReply = created ? reply : language === "en" ? "The requested suite already exists." : "Запрошенный набор уже существует.";
      expect(runInZyraLanguage(language, () => finalReply(svc, operations, applied, successfulReply))).toBe(successfulReply);
    });

    it(`${language}: still corrects an invented testcase mutation beside a genuine suite success`, async () => {
      const svc = makeLegacy(); mockCapabilitiesAndActor(svc);
      const operations = [{ type: "create_suite", suiteName: "Regression" }];
      jest.spyOn(svc as unknown as { resolveOrCreateSuiteByName: (...a: unknown[]) => Promise<unknown> }, "resolveOrCreateSuiteByName")
        .mockResolvedValue({ id: "suite-1", name: "Regression", created: true });
      const applied = await applyOps(svc, operations);
      const falseClaim = language === "en"
        ? "Created the Regression suite and added 5 test cases to it."
        : "Создан набор Regression. Добавлены 5 тест-кейсов.";
      const out = runInZyraLanguage(language, () => finalReply(svc, operations, applied, falseClaim));
      expect(out).toContain(language === "en" ? "Sorry! Nothing was saved" : "Извините! Ничего не сохранено");
      expect(out).toContain(falseClaim);
    });

    it(`${language}: records the new warning in the existing reconciliation diagnostic`, async () => {
      const svc = makeLegacy();
      const record = jest.spyOn(aiTrace, "recordReconciliation").mockResolvedValue(undefined);
      (svc as unknown as { db: { query: jest.Mock } }).db.query.mockResolvedValue({ rows: [{ id: "assistant-1", testcases: [], activity: [] }] });
      const operations = [{ type: "create_suite", suiteName: "Only Suite" }];
      const applied = { testcases: [], activity: [{ title: "An operation failed unexpectedly" }], reviewRequestId: null };
      await runInZyraLanguage(language, () => (svc as unknown as { insertZyraAssistantMessage: (...args: unknown[]) => Promise<unknown> }).insertZyraAssistantMessage({
        projectId: "project-1", sessionId: "session-1", uid: "user-1", traceMessageId: "turn-1",
        decision: { reply, actionType: "suite", operations }, applied, testcases: [], activity: applied.activity
      }));
      expect(record).toHaveBeenCalledWith(expect.objectContaining({ messageId: "turn-1" }), expect.objectContaining({
        bannerFired: "suite-operation-error",
        reply: `${SUITE_ERROR[language]}\n\n${reply}`,
        reason: "suite-operation-error — an operation reported an error; any completed changes were kept"
      }));
    });
  }
});
