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
import { ZyraTurnTraceRecorder } from "./zyra-turn-trace";

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

  it.each(["failed", "partial", "created", "reused"] as const)("suite trace: %s reflects actual operation errors, not zero testcase counts", async (mode) => {
    const svc = makeLegacy(); mockCapabilitiesAndActor(svc);
    const operations = [{ type: "create_suite", suiteName: "First Suite" }];
    if (mode === "partial") operations.push({ type: "create_suite", suiteName: "Second Suite" });
    const resolve = jest.spyOn(svc as unknown as { resolveOrCreateSuiteByName: (...a: unknown[]) => Promise<unknown> }, "resolveOrCreateSuiteByName");
    if (mode === "failed") resolve.mockRejectedValue(new Error("private suite failure"));
    else {
      resolve.mockResolvedValueOnce({ id: "suite-1", name: "First Suite", created: mode !== "reused" });
      if (mode === "partial") resolve.mockRejectedValueOnce(new Error("private suite failure"));
    }
    // Script the decision and message/session I/O; compose the real pipeline, operation application
    // and recorder. This is service-collaborator evidence, not HTTP/PostgreSQL/stream delivery proof.
    jest.spyOn(svc as unknown as { buildZyraChatDecision: (...a: unknown[]) => Promise<unknown> }, "buildZyraChatDecision")
      .mockResolvedValue({ reply: "Suite routing fixture", actionType: "suite", operations, testcases: [] });
    jest.spyOn(svc as unknown as { insertZyraAssistantMessage: (...a: unknown[]) => Promise<unknown> }, "insertZyraAssistantMessage")
      .mockResolvedValue({ id: "assistant-1", status: "completed" });
    jest.spyOn(svc, "zyraChatSession").mockResolvedValue({ messages: [] });
    const recorder = new ZyraTurnTraceRecorder();
    await (svc as unknown as { executeZyraChatTurn: (...a: unknown[]) => Promise<unknown> }).executeZyraChatTurn({
      projectId: "project-1", userId: "user-1", uid: "user-1", sessionId: "session-1",
      message: "Create the requested suites", userMessageId: "turn-1", sessionRow: {}
    }, recorder.onStage);
    const trace = recorder.finish(), failed = mode === "failed" || mode === "partial";
    expect(trace.steps.find((step) => step.stage === "finalizing")?.meta).toEqual({ savedCount: 0, proposedCount: 0 });
    expect(JSON.stringify(trace)).not.toContain("private suite failure");
    expect({ stagingStatus: trace.steps.find((step) => step.stage === "staging")?.status, outcome: trace.outcome })
      .toEqual({ stagingStatus: failed ? "failed" : "ok", outcome: failed ? "completed_with_errors" : "completed" });
  });

  for (const language of ["en", "ru"] as const) {
    it.each(["failed", "partial", "moved", "no-match"] as const)(`${language}: move feedback and trace reflect %s without inferring missing rows or rollback`, async (mode) => {
      const svc = makeLegacy(); mockCapabilitiesAndActor(svc);
      const failed = mode === "failed" || mode === "partial";
      const moved = mode === "partial" || mode === "moved";
      const operations: Body[] = [];
      if (mode === "partial") operations.push({ type: "create_suite", suiteName: "Kept Suite" });
      if (moved) operations.push({ type: "move_to_suite", suiteId: "suite-1", testcaseIds: ["case-1"] });
      if (failed || mode === "no-match") operations.push({ type: "move_to_suite", suiteId: "suite-1", testcaseIds: ["case-2"] });
      jest.spyOn(svc as unknown as { getProjectSuite: (...a: unknown[]) => Promise<unknown> }, "getProjectSuite")
        .mockResolvedValue({ id: "suite-1", name: "Destination" });
      jest.spyOn(svc as unknown as { resolveOrCreateSuiteByName: (...a: unknown[]) => Promise<unknown> }, "resolveOrCreateSuiteByName")
        .mockResolvedValue({ id: "suite-kept", name: "Kept Suite", created: true });
      jest.spyOn(svc as unknown as { resolveZyraMoveTargets: (...a: unknown[]) => Promise<unknown> }, "resolveZyraMoveTargets")
        .mockImplementation(async (_project, _session, op) => ({ targets: mode === "no-match" ? [] : [{ id: (op as Body).testcaseIds[0] }], requestedCount: 1 }));
      const transaction = jest.fn();
      if (moved) transaction.mockResolvedValueOnce(undefined);
      if (failed) transaction.mockRejectedValueOnce(new Error("private move failure"));
      (svc as unknown as { db: { transaction: jest.Mock } }).db.transaction = transaction;
      (svc as unknown as { suitesCache: { invalidate: jest.Mock } }).suitesCache.invalidate = jest.fn().mockResolvedValue(undefined);
      (svc as unknown as { testcasesListCache: { invalidate: jest.Mock } }).testcasesListCache.invalidate = jest.fn().mockResolvedValue(undefined);
      jest.spyOn(svc, "getTestCase").mockResolvedValue({ id: "case-1", externalId: "PRO-TC-1", title: "Existing case", suiteId: "suite-1" });
      jest.spyOn(svc as unknown as { zyraMoveBreakdown: (...a: unknown[]) => Promise<unknown> }, "zyraMoveBreakdown")
        .mockResolvedValue(moved || mode === "no-match" ? [{ suiteId: "suite-1", suiteName: "Destination", created: false, count: moved ? 1 : 0 }] : []);
      const reply = language === "en" ? "Moved the requested test cases." : "Запрошенные тест-кейсы перемещены.";
      jest.spyOn(svc as unknown as { buildZyraChatDecision: (...a: unknown[]) => Promise<unknown> }, "buildZyraChatDecision")
        .mockResolvedValue({ reply, actionType: "suite", operations, testcases: [] });
      let content = "", applied: AppliedShape | undefined;
      jest.spyOn(svc as unknown as { insertZyraAssistantMessage: (...a: unknown[]) => Promise<unknown> }, "insertZyraAssistantMessage")
        .mockImplementation(async (input) => {
          applied = (input as Body).applied;
          content = finalReply(svc, operations, applied!, reply);
          return { id: "assistant-1", status: "completed", content };
        });
      jest.spyOn(svc, "zyraChatSession").mockResolvedValue({ messages: [] });
      const recorder = new ZyraTurnTraceRecorder();
      await runInZyraLanguage(language, () => (svc as unknown as { executeZyraChatTurn: (...a: unknown[]) => Promise<unknown> }).executeZyraChatTurn({
        projectId: "project-1", userId: "user-1", uid: "user-1", sessionId: "session-1",
        message: "Move the requested test cases", userMessageId: "turn-1", sessionRow: {}
      }, recorder.onStage));
      const trace = recorder.finish();
      expect(transaction).toHaveBeenCalledTimes(mode === "partial" ? 2 : mode === "no-match" ? 0 : 1);
      expect(applied!.testcases).toHaveLength(moved ? 1 : 0);
      expect(applied!.activity.filter((entry) => entry.title === "An operation failed unexpectedly")).toHaveLength(failed ? 1 : 0);
      if (mode === "partial") expect(applied!.activity.some((entry) => entry.title === "Created suite")).toBe(true);
      if (moved) expect(content).toContain(language === "en" ? "1 test case(s) total" : "всего тест-кейсов: 1");
      if (mode === "no-match") expect(content).toContain(language === "en" ? "Nothing was saved" : "Ничего не сохранено");
      expect(content + JSON.stringify(trace)).not.toContain("private move failure");
      expect({
        warning: content.startsWith(SUITE_ERROR[language]),
        falselySaysMissing: failed && /do not exist in this project|в этом проекте нет/.test(content),
        outcome: trace.outcome, stagingStatus: trace.steps.find((step) => step.stage === "staging")?.status
      }).toEqual({ warning: failed, falselySaysMissing: false,
        outcome: failed ? "completed_with_errors" : "completed", stagingStatus: failed ? "failed" : "ok" });
    });

    it(`${language}: retains pending-draft review guidance beside a move error`, () => {
      const svc = makeLegacy();
      const operations = [{ type: "move_to_suite", suiteId: "suite-1", fromLastPlan: true }];
      const applied = { testcases: [{ action: "proposed-create", draftIndex: 0, reviewRequestId: "review-1" }],
        activity: [{ title: "An operation failed unexpectedly" }], reviewRequestId: null };
      const reply = language === "en" ? "Assigning the requested drafts." : "Назначаю набор для указанных черновиков.";
      const out = runInZyraLanguage(language, () => finalReply(svc, operations, applied, reply));
      expect(out).toContain(language === "en" ? "staged for your review" : "Ожидают вашей проверки");
      expect(out.startsWith(SUITE_ERROR[language])).toBe(true);
    });
  }

  for (const language of ["en", "ru"] as const) {
    it.each(["unavailable", "partial", "moved"] as const)(`${language}: reports an unavailable destination even when two prior moved rows mask the operation shortfall (%s)`, async (mode) => {
      const svc = makeLegacy(); mockCapabilitiesAndActor(svc);
      const moved = mode !== "unavailable", refused = mode !== "moved";
      const operations: Body[] = [];
      if (moved) operations.push({ type: "move_to_suite", suiteId: "suite-own", testcaseIds: ["case-1", "case-2"] });
      if (refused) operations.push({ type: "move_to_suite", suiteId: "suite-unavailable", testcaseIds: ["case-3"] });
      const lookup = jest.spyOn(svc as unknown as { getProjectSuite: (...a: unknown[]) => Promise<unknown> }, "getProjectSuite")
        .mockImplementation(async (_project, id) => id === "suite-own" ? { id, name: "Own destination" } : null);
      const targets = jest.spyOn(svc as unknown as { resolveZyraMoveTargets: (...a: unknown[]) => Promise<unknown> }, "resolveZyraMoveTargets")
        .mockResolvedValue({ targets: [{ id: "case-1" }, { id: "case-2" }], requestedCount: 2 });
      const transaction = jest.fn().mockResolvedValue(undefined);
      (svc as unknown as { db: { transaction: jest.Mock } }).db.transaction = transaction;
      (svc as unknown as { suitesCache: { invalidate: jest.Mock } }).suitesCache.invalidate = jest.fn().mockResolvedValue(undefined);
      (svc as unknown as { testcasesListCache: { invalidate: jest.Mock } }).testcasesListCache.invalidate = jest.fn().mockResolvedValue(undefined);
      jest.spyOn(svc, "getTestCase").mockImplementation(async (id) => ({ id, externalId: id, title: "Existing case", suiteId: "suite-own" }));
      jest.spyOn(svc as unknown as { zyraMoveBreakdown: (...a: unknown[]) => Promise<unknown> }, "zyraMoveBreakdown")
        .mockResolvedValue(moved ? [{ suiteId: "suite-own", suiteName: "Own destination", created: false, count: 2 }] : []);
      const reply = language === "en" ? "Moved the requested test cases." : "Запрошенные тест-кейсы перемещены.";
      jest.spyOn(svc as unknown as { buildZyraChatDecision: (...a: unknown[]) => Promise<unknown> }, "buildZyraChatDecision")
        .mockResolvedValue({ reply, actionType: "suite", operations, testcases: [] });
      let content = "", applied: AppliedShape | undefined;
      jest.spyOn(svc as unknown as { insertZyraAssistantMessage: (...a: unknown[]) => Promise<unknown> }, "insertZyraAssistantMessage")
        .mockImplementation(async (input) => {
          applied = (input as Body).applied; content = finalReply(svc, operations, applied!, reply);
          return { id: "assistant-1", status: "completed", content };
        });
      jest.spyOn(svc, "zyraChatSession").mockResolvedValue({ messages: [] });
      const recorder = new ZyraTurnTraceRecorder();
      await runInZyraLanguage(language, () => (svc as unknown as { executeZyraChatTurn: (...a: unknown[]) => Promise<unknown> }).executeZyraChatTurn({
        projectId: "project-1", userId: "user-1", uid: "user-1", sessionId: "session-1",
        message: "Move the requested test cases", userMessageId: "turn-1", sessionRow: {}
      }, recorder.onStage));
      const trace = recorder.finish();
      expect(lookup).toHaveBeenCalledTimes(operations.length);
      expect(transaction).toHaveBeenCalledTimes(moved ? 1 : 0);
      expect(targets).toHaveBeenCalledTimes(moved ? 1 : 0);
      expect(applied!.testcases).toHaveLength(moved ? 2 : 0);
      expect(applied!.reviewRequestId).toBeNull();
      expect(trace.steps.find((step) => step.stage === "finalizing")?.meta).toEqual({ savedCount: moved ? 2 : 0, proposedCount: 0 });
      if (moved) expect(content).toContain(language === "en" ? "2 test case(s) total" : "всего тест-кейсов: 2");
      expect(applied!.activity.filter((entry) => entry.title === "An operation failed unexpectedly")).toHaveLength(0);
      expect(applied!.activity.filter((entry) => entry.title === "Could not move testcases")).toHaveLength(refused ? 1 : 0);
      expect(content.startsWith(SUITE_ERROR[language])).toBe(refused);
      expect(content).not.toMatch(/The test cases it referred to do not exist|Тест-кейсов, о которых шла речь/);
      expect({ outcome: trace.outcome, staging: trace.steps.find((step) => step.stage === "staging")?.status })
        .toEqual({ outcome: refused ? "completed_with_errors" : "completed", staging: refused ? "failed" : "ok" });
    });
  }

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
