import { randomUUID } from "node:crypto";
import { expect, type APIRequestContext } from "@playwright/test";
import type { FakeAiServer } from "./fake-ai-server";
import type { MoveFixture, MoveRepositoryState } from "./zyra-move-feedback";
import { assertMoveAudit, assertMovesStillUnpublished, governingMoveRepositoryState, readReviewedMoves, saveReviewedMoves, unchangedMoveContent, type MoveReviewPreview } from "./zyra-reviewed-moves";

export const SINGLE_MOVE_SELECTORS = ["testcaseId", "externalId", "testcaseIds", "externalIds"] as const;
export type SingleMoveSelector = typeof SINGLE_MOVE_SELECTORS[number] | "foreign-id" | "missing-id" | "invalid-id";

/** Same existing writer for scalar/list selectors; only the provider routing decision is scripted. */
export async function verifyZyraSingleMove(input: {
  request: APIRequestContext; ai: FakeAiServer; base: string; ownerId: string; language: "en" | "ru";
  selector: SingleMoveSelector; fixture: MoveFixture; foreignId?: string; state: () => Promise<MoveRepositoryState>;
  targetSelectors?: { testcaseId?: string; externalId?: string; testcaseIds?: string[]; externalIds?: string[] };
  beforeApply?: (preview: MoveReviewPreview) => Promise<void>;
  afterReply?: (evidence: { sessionId: string; language: "en" | "ru"; selector: SingleMoveSelector; expectedMove: boolean;
    reply: string; externalId: string; session: Record<string, unknown>; fixture: MoveFixture; before: MoveRepositoryState; after: MoveRepositoryState }) => Promise<void>;
}) {
  const { request, ai, base, ownerId, language, selector, fixture, foreignId, state: rawState, afterReply } = input;
  const state = async () => governingMoveRepositoryState(await rawState());
  const before = await state(), calls = ai.requests.length;
  const original = before.cases.find((row) => row.id === fixture.firstId)!;
  expect(original).toBeTruthy();
  const externalId = String(original.external_id), expectedMove = (SINGLE_MOVE_SELECTORS as readonly string[]).includes(selector);
  const target = input.targetSelectors ?? (selector === "testcaseId" ? { testcaseId: fixture.firstId }
    : selector === "externalId" ? { externalId }
    : selector === "testcaseIds" ? { testcaseIds: [fixture.firstId] }
    : selector === "externalIds" ? { externalIds: [externalId] }
    : { testcaseId: selector === "foreign-id" ? foreignId : selector === "missing-id" ? randomUUID() : "not-a-uuid" });
  if (selector === "foreign-id") expect(foreignId).toMatch(/^[a-f0-9-]{36}$/i);
  const reply = language === "en" ? "Moved the requested test case." : "Запрошенный тест-кейс перемещён.";
  let sessionId = "";
  try {
    const created = await request.post(`${base}/agents/zyra/chat/sessions`, { data: { title: `E2E single move ${language} ${selector} ${randomUUID()}` } });
    expect(created.status(), await created.text()).toBe(201); sessionId = (await created.json()).id;
    ai.queueReply({ reply, reasoningSummary: "Scripted single-case suite assignment", action: "move_to_suite", actionType: "suite",
      operations: [{ type: "move_to_suite", suiteId: fixture.destinationId, ...target }], testcases: [] });
    const sent = await request.post(`${base}/agents/zyra/chat/sessions/${sessionId}/messages`, { data: {
      message: language === "en" ? `Move the requested test case to suite \`${fixture.destinationName}\`.` : `Перемести указанный тест-кейс в набор \`${fixture.destinationName}\`.`,
    } });
    expect(sent.ok(), await sent.text()).toBeTruthy();
    const response = await sent.json();
    expect(ai.requests.length, "one router call; no automatic mutation replay").toBe(calls + 1);
    const read = await request.get(`${base}/agents/zyra/chat/sessions/${sessionId}`);
    expect(read.ok(), await read.text()).toBeTruthy(); const session = await read.json();
    expect(session.language).toBe(language);
    const assistants = session.messages.filter((row: Record<string, unknown>) => row.role === "assistant");
    expect(assistants).toHaveLength(1); const message = assistants[0];
    expect(message.content).toBe(response.message.content);
    expect(message.actionType).toBe("suite");
    const staged = await state();
    assertMovesStillUnpublished(before, staged);
    const reviewed = expectedMove ? await readReviewedMoves(request, base, message.reviewRequestId, [{ testcaseId: fixture.firstId, suiteId: fixture.destinationId }]) : null;
    await input.beforeApply?.({ sessionId, language, reply, before, reviewed, proposedCount: expectedMove ? 1 : 0, traceOutcome: "completed", stagingStatus: "ok" });
    if (reviewed) await saveReviewedMoves(request, base, reviewed, ownerId);
    else expect(message.reviewRequestId ?? null).toBeNull();
    const after = await state();
    expect(after.cases).toHaveLength(before.cases.length); expect(after.suites).toEqual(before.suites);
    expect(after.reviews.filter((row) => before.reviews.some((old) => (old as { id: string }).id === (row as { id: string }).id))).toEqual(before.reviews);
    expect(after.reviews.length - before.reviews.length).toBe(expectedMove ? 1 : 0);
    const changed = after.cases.filter((row) => JSON.stringify(row) !== JSON.stringify(before.cases.find((old) => old.id === row.id)));
    expect(changed.length).toBeLessThanOrEqual(1);
    const actuallyMoved = changed.length === 1;
    if (actuallyMoved) {
      expect(expectedMove, "negative selectors must never reach a writer").toBe(true);
      expect(changed[0]).toMatchObject({ id: fixture.firstId, suite_id: fixture.destinationId, updated_by: ownerId });
      expect(unchangedMoveContent(changed[0])).toEqual(unchangedMoveContent(original));
      expect(Number(changed[0].review_dependency_revision)).toBe(Number(original.review_dependency_revision) + 1);
    }
    for (const old of before.cases.filter((row) => !changed.some((current) => current.id === row.id))) expect(after.cases.find((row) => row.id === old.id)).toEqual(old);
    for (const old of before.history) expect(after.history.find((row) => row.testcase_id === old.testcase_id && row.version === old.version)).toEqual(old);
    const newHistory = after.history.filter((row) => !before.history.some((old) => old.testcase_id === row.testcase_id && old.version === row.version));
    expect(newHistory).toHaveLength(actuallyMoved ? 1 : 0);
    if (actuallyMoved) expect(newHistory[0]).toMatchObject({ testcase_id: fixture.firstId, changed_by: ownerId, change_type: "update", snapshot: original });
    if (reviewed) assertMoveAudit(staged, after, reviewed, ownerId);
    if (!expectedMove) expect(after).toEqual(before);
    expect(message.testcases.map((row: Record<string, unknown>) => row.id)).toEqual(actuallyMoved ? [fixture.firstId] : []);
    expect(message.testcases.every((row: Record<string, unknown>) => row.action === "proposed-update")).toBe(true);
    const users = session.messages.filter((row: Record<string, unknown>) => row.role === "user");
    expect(users).toHaveLength(1); const trace = users[0].trace;
    expect(trace.version).toBe(1); expect(trace.outcome).toBe("completed");
    expect(trace.steps.find((step: Record<string, unknown>) => step.stage === "finalizing").meta).toMatchObject({ savedCount: 0, proposedCount: expectedMove ? 1 : 0 });
    // Failing-first assertions stay soft so every snapshot, control and browser check still runs.
    expect.soft(actuallyMoved, `${selector}: a valid scalar must behave like its one-element list`).toBe(expectedMove);
    if (expectedMove) {
      expect(message.content).toMatch(language === "en" ? /staged for your review/ : /Ожидают вашей проверки/);
      expect.soft(trace.steps.filter((step: Record<string, unknown>) => step.stage === "staging")).toHaveLength(1);
    }
    await afterReply?.({ sessionId, language, selector, expectedMove, reply, externalId, session, fixture, before, after });
  } finally {
    if (sessionId) { const deleted = await request.delete(`${base}/agents/zyra/chat/sessions/${sessionId}`); expect(deleted.ok(), await deleted.text()).toBeTruthy(); }
  }
}
