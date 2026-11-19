import { randomUUID } from "node:crypto";
import { expect, type APIRequestContext } from "@playwright/test";
import type { FakeAiServer } from "./fake-ai-server";
import { seedMoveRepository, type MoveFixture, type MoveRepositoryState } from "./zyra-move-feedback";
import { SUITE_OPERATION_ERROR } from "./zyra-suite-feedback";
import { assertMoveAudit, assertMovesStillUnpublished, governingMoveRepositoryState, readReviewedMoves, saveReviewedMoves, unchangedMoveContent, type MoveReviewPreview } from "./zyra-reviewed-moves";

export const MISSING_SUITE_MODES = ["missing", "deleted", "partial", "moved"] as const;
export type MissingSuiteMode = typeof MISSING_SUITE_MODES[number] | "foreign";
export type MissingSuiteFixture = MoveFixture & { blockedId: string };

/** Reuse the existing fixture writers; a third case must stay untouched beside two valid moves. */
export async function seedMissingSuiteRepository(request: APIRequestContext, base: string, label: string): Promise<MissingSuiteFixture> {
  const fixture = await seedMoveRepository(request, base, label);
  const created = await request.post(`${base}/testcases`, { data: {
    title: `E2E unavailable destination ${label} preserved case`, suiteId: fixture.sourceId,
    description: "Existing case with an unavailable requested destination", status: "Draft", priority: "P2",
    steps: [{ stepNumber: 1, action: "Read the existing case", expectedResult: "Identity and content are preserved" }],
  } });
  expect(created.status(), await created.text()).toBe(201);
  return { ...fixture, blockedId: (await created.json()).id };
}

type MissingSuiteEvidence = {
  sessionId: string; language: "en" | "ru"; mode: MissingSuiteMode; reply: string; refused: boolean;
  movedIds: string[]; requestedSuiteId: string; fixture: MissingSuiteFixture; session: Record<string, unknown>;
  before: MoveRepositoryState; after: MoveRepositoryState;
};

/** Only routing is scripted. The refusal, writes, history, audit and persisted response are real. */
export async function verifyZyraMissingSuite(input: {
  request: APIRequestContext; ai: FakeAiServer; base: string; ownerId: string; language: "en" | "ru";
  mode: MissingSuiteMode; fixture: MissingSuiteFixture; foreignSuiteId?: string; state: () => Promise<MoveRepositoryState>;
  beforeApply?: (preview: MoveReviewPreview) => Promise<void>;
  afterReply?: (evidence: MissingSuiteEvidence) => Promise<void>;
}) {
  const { request, ai, base, ownerId, language, mode, fixture, foreignSuiteId, state: rawState, afterReply } = input;
  const state = async () => governingMoveRepositoryState(await rawState());
  const refused = mode !== "moved", movedIds = mode === "partial" || mode === "moved" ? [fixture.firstId, fixture.secondId] : [];
  const requestedSuiteId = mode === "foreign" ? foreignSuiteId! : mode === "deleted" || mode === "moved" ? fixture.destinationId : randomUUID();
  expect(requestedSuiteId).toMatch(/^[a-f0-9-]{36}$/i);
  const before = await state(), calls = ai.requests.length;
  expect(before.cases.find((row) => row.id === fixture.blockedId)?.deleted_at).toBeNull();
  const operations: Array<Record<string, unknown>> = [];
  if (movedIds.length) operations.push({ type: "move_to_suite", suiteId: fixture.destinationId, testcaseIds: movedIds });
  if (refused) operations.push({ type: "move_to_suite", suiteId: requestedSuiteId, testcaseId: fixture.blockedId });
  const reply = language === "en" ? "Moved the requested test cases." : "Запрошенные тест-кейсы перемещены.";
  let sessionId = "";
  try {
    const created = await request.post(`${base}/agents/zyra/chat/sessions`, { data: { title: `E2E destination ${language} ${mode} ${randomUUID()}` } });
    expect(created.status(), await created.text()).toBe(201); sessionId = (await created.json()).id;
    ai.queueReply({ reply, reasoningSummary: "Scripted unavailable-destination decision", action: "move_to_suite", actionType: "suite", operations, testcases: [] });
    const sent = await request.post(`${base}/agents/zyra/chat/sessions/${sessionId}/messages`, { data: {
      message: language === "en" ? "Move the requested existing test cases to their specified suites."
        : "Перемести указанные существующие тест-кейсы в заданные наборы.",
    } });
    expect(sent.ok(), await sent.text()).toBeTruthy(); const response = await sent.json();
    expect(ai.requests.length, "one router call, never an automatic mutation replay").toBe(calls + 1);
    const read = await request.get(`${base}/agents/zyra/chat/sessions/${sessionId}`);
    expect(read.ok(), await read.text()).toBeTruthy(); const session = await read.json();
    expect(session.language).toBe(language);
    const assistants = session.messages.filter((entry: Record<string, unknown>) => entry.role === "assistant");
    expect(assistants).toHaveLength(1); const assistant = assistants[0];
    expect(assistant.content).toBe(response.message.content); expect(assistant.actionType).toBe("suite");
    expect(assistant.testcases.map((row: Record<string, unknown>) => row.id).sort()).toEqual([...movedIds].sort());
    expect(assistant.testcases.every((row: Record<string, unknown>) => row.action === "proposed-update")).toBe(true);
    expect(assistant.activity.filter((entry: Record<string, unknown>) => entry.title === "An operation failed unexpectedly")).toHaveLength(0);
    const staged = await state();
    assertMovesStillUnpublished(before, staged);
    const reviewed = movedIds.length ? await readReviewedMoves(request, base, assistant.reviewRequestId,
      movedIds.map((testcaseId) => ({ testcaseId, suiteId: fixture.destinationId }))) : null;
    await input.beforeApply?.({ sessionId, language, reply, before, reviewed, proposedCount: movedIds.length,
      traceOutcome: refused ? "completed_with_errors" : "completed", stagingStatus: refused ? "failed" : "ok" });
    if (reviewed) await saveReviewedMoves(request, base, reviewed, ownerId);
    else expect(assistant.reviewRequestId ?? null).toBeNull();
    const after = await state();
    expect(after.cases).toHaveLength(before.cases.length); expect(after.suites).toEqual(before.suites);
    expect(after.reviews.length - before.reviews.length).toBe(movedIds.length ? 1 : 0);
    expect(after.reviews.filter((row) => before.reviews.some((old) => (old as { id: string }).id === (row as { id: string }).id))).toEqual(before.reviews);
    for (const old of before.cases) {
      const current = after.cases.find((row) => row.id === old.id)!;
      if (movedIds.includes(String(old.id))) {
        expect(current).toMatchObject({ suite_id: fixture.destinationId, updated_by: ownerId });
        expect(unchangedMoveContent(current)).toEqual(unchangedMoveContent(old));
        expect(Number(current.review_dependency_revision)).toBe(Number(old.review_dependency_revision) + 1);
      } else expect(current).toEqual(old);
    }
    for (const old of before.history) expect(after.history.find((row) => row.id === old.id)).toEqual(old);
    const history = after.history.filter((row) => !before.history.some((old) => old.id === row.id));
    expect(history).toHaveLength(movedIds.length);
    for (const id of movedIds) expect(history.find((row) => row.testcase_id === id)).toMatchObject({
      changed_by: ownerId, change_type: "update", snapshot: before.cases.find((row) => row.id === id),
    });
    if (reviewed) assertMoveAudit(staged, after, reviewed, ownerId);
    else expect(after).toEqual(before);
    const users = session.messages.filter((entry: Record<string, unknown>) => entry.role === "user");
    expect(users).toHaveLength(1); const trace = users[0].trace;
    expect(trace.version).toBe(1); expect(trace.steps.filter((step: Record<string, unknown>) => step.stage === "staging")).toHaveLength(1);
    expect(trace.steps.find((step: Record<string, unknown>) => step.stage === "finalizing").meta).toMatchObject({ savedCount: 0, proposedCount: movedIds.length });
    if (movedIds.length) expect(assistant.content).toMatch(language === "en" ? /staged for your review/ : /Ожидают вашей проверки/);
    // Keep known red assertions soft so all persistence, controls and browser readbacks execute.
    expect.soft(assistant.activity.filter((entry: Record<string, unknown>) => entry.title === "Could not move testcases")).toHaveLength(refused ? 1 : 0);
    expect.soft(String(assistant.content).startsWith(SUITE_OPERATION_ERROR[language])).toBe(refused);
    expect.soft(assistant.content).not.toMatch(/The test cases it referred to do not exist|Тест-кейсов, о которых шла речь/);
    expect.soft(trace.outcome).toBe(refused ? "completed_with_errors" : "completed");
    expect.soft(trace.steps.find((step: Record<string, unknown>) => step.stage === "staging").status).toBe(refused ? "failed" : "ok");
    await afterReply?.({ sessionId, language, mode, reply, refused, movedIds, requestedSuiteId, fixture, session, before, after });
  } finally {
    if (sessionId) { const deleted = await request.delete(`${base}/agents/zyra/chat/sessions/${sessionId}`); expect(deleted.ok(), await deleted.text()).toBeTruthy(); }
  }
}
