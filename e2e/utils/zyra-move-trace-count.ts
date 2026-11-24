import { randomUUID } from "node:crypto";
import { expect, type APIRequestContext } from "@playwright/test";
import type { FakeAiServer } from "./fake-ai-server";
import { seedMoveRepository, type MoveFixture, type MoveRepositoryState } from "./zyra-move-feedback";
import { assertMoveAudit, assertMovesStillUnpublished, governingMoveRepositoryState, readReviewedMoves, saveReviewedMoves, unchangedMoveContent, type MoveReviewPreview } from "./zyra-reviewed-moves";

export const MOVE_TRACE_COUNTS = [0, 1, 25, 26] as const;
export type MoveTraceCount = typeof MOVE_TRACE_COUNTS[number];
export type MoveTraceFixture = MoveFixture & { targetIds: string[]; allIds: string[] };

/** Existing API writers, before fake-key allocation; always retain an untouched own-case control. */
export async function seedMoveTraceRepository(request: APIRequestContext, base: string, label: string, count: MoveTraceCount): Promise<MoveTraceFixture> {
  const fixture = await seedMoveRepository(request, base, label), allIds = [fixture.firstId, fixture.secondId];
  for (let index = allIds.length; index < count + 1; index++) {
    const created = await request.post(`${base}/testcases`, { data: {
      title: `E2E trace count ${label} ${index} ${randomUUID()}`, suiteId: fixture.sourceId,
      description: "Saved trace-count fixture", preconditions: "Content and provenance must survive a suite move",
      status: "Draft", priority: "P2", steps: [{ stepNumber: 1, action: "Read the existing case", expectedResult: "Original identity and content remain" }],
    } });
    expect(created.status(), await created.text()).toBe(201); allIds.push((await created.json()).id);
  }
  return { ...fixture, targetIds: allIds.slice(0, count), allIds };
}

export type MoveTraceEvidence = {
  sessionId: string; language: "en" | "ru"; count: MoveTraceCount; reply: string; fixture: MoveTraceFixture;
  session: Record<string, unknown>; before: MoveRepositoryState; after: MoveRepositoryState; previewIds: string[];
};

/** Keep the bounded chat preview separate from the complete proposal and selected native writes. */
export async function verifyZyraMoveTraceCount(input: {
  request: APIRequestContext; ai: FakeAiServer; base: string; ownerId: string; language: "en" | "ru";
  count: MoveTraceCount; fixture: MoveTraceFixture; state: () => Promise<MoveRepositoryState>;
  beforeApply?: (preview: MoveReviewPreview) => Promise<void>;
  afterReply?: (evidence: MoveTraceEvidence) => Promise<void>;
}) {
  const { request, ai, base, ownerId, language, count, fixture, state: rawState, afterReply } = input;
  const state = async () => governingMoveRepositoryState(await rawState());
  const before = await state(), calls = ai.requests.length, targetIds = [...fixture.targetIds];
  expect(targetIds).toHaveLength(count); expect(new Set(targetIds).size).toBe(count);
  const reply = language === "en" ? "Moved the requested test cases." : "Запрошенные тест-кейсы перемещены.";
  let sessionId = "";
  try {
    const created = await request.post(`${base}/agents/zyra/chat/sessions`, { data: { title: `E2E move trace ${language} ${count} ${randomUUID()}` } });
    expect(created.status(), await created.text()).toBe(201); sessionId = (await created.json()).id;
    ai.queueReply({ reply, reasoningSummary: "Scripted card-boundary suite move", action: "move_to_suite", actionType: "suite", testcases: [],
      operations: [{ type: "move_to_suite", suiteId: fixture.destinationId, testcaseIds: count ? targetIds : [randomUUID()] }] });
    const sent = await request.post(`${base}/agents/zyra/chat/sessions/${sessionId}/messages`, { data: {
      message: language === "en" ? `Move the requested existing test cases to suite \`${fixture.destinationName}\`.`
        : `Перемести указанные существующие тест-кейсы в набор \`${fixture.destinationName}\`.`,
    } });
    expect(sent.ok(), await sent.text()).toBeTruthy(); const response = await sent.json();
    expect(ai.requests.length, "one routing call; no automatic mutation replay").toBe(calls + 1);
    const read = await request.get(`${base}/agents/zyra/chat/sessions/${sessionId}`);
    expect(read.ok(), await read.text()).toBeTruthy(); const session = await read.json();
    expect(session.language).toBe(language);
    const assistants = session.messages.filter((row: Record<string, unknown>) => row.role === "assistant");
    expect(assistants).toHaveLength(1); const assistant = assistants[0];
    expect(assistant.content).toBe(response.message.content); expect(assistant.actionType).toBe("suite");
    const previewIds = assistant.testcases.map((row: Record<string, unknown>) => String(row.id)) as string[];
    expect(previewIds).toHaveLength(Math.min(count, 25)); expect(new Set(previewIds).size).toBe(previewIds.length);
    expect(previewIds.every((id) => targetIds.includes(id))).toBe(true);
    expect(assistant.testcases.every((row: Record<string, unknown>) => row.action === "proposed-update")).toBe(true);
    expect(assistant.activity.filter((row: Record<string, unknown>) => row.title === "An operation failed unexpectedly")).toHaveLength(0);
    if (count) expect(assistant.content).toMatch(language === "en" ? /staged for your review/ : /Ожидают вашей проверки/);
    else expect(assistant.content).toContain(language === "en" ? "Nothing was saved" : "Ничего не сохранено");
    const staged = await state();
    assertMovesStillUnpublished(before, staged);
    const reviewed = count ? await readReviewedMoves(request, base, assistant.reviewRequestId, targetIds.map((testcaseId) => ({ testcaseId, suiteId: fixture.destinationId }))) : null;
    await input.beforeApply?.({ sessionId, language, reply, before, reviewed, proposedCount: count, traceOutcome: "completed", stagingStatus: "ok" });
    if (reviewed) await saveReviewedMoves(request, base, reviewed, ownerId);
    else expect(assistant.reviewRequestId ?? null).toBeNull();
    const after = await state();
    expect(after.cases).toHaveLength(before.cases.length); expect(after.suites).toEqual(before.suites);
    expect(after.reviews.length - before.reviews.length).toBe(count ? 1 : 0);
    expect(after.reviews.filter((row) => before.reviews.some((old) => (old as { id: string }).id === (row as { id: string }).id))).toEqual(before.reviews);
    const changed = after.cases.filter((row) => JSON.stringify(row) !== JSON.stringify(before.cases.find((old) => old.id === row.id)));
    expect(changed.map((row) => String(row.id)).sort()).toEqual([...targetIds].sort());
    for (const old of before.cases) {
      const current = after.cases.find((row) => row.id === old.id)!;
      if (targetIds.includes(String(old.id))) {
        expect(current).toMatchObject({ suite_id: fixture.destinationId, updated_by: ownerId });
        expect(unchangedMoveContent(current)).toEqual(unchangedMoveContent(old));
        expect(Number(current.review_dependency_revision)).toBe(Number(old.review_dependency_revision) + 1);
      } else expect(current).toEqual(old);
    }
    for (const old of before.history) expect(after.history.find((row) => row.id === old.id)).toEqual(old);
    const history = after.history.filter((row) => !before.history.some((old) => old.id === row.id));
    expect(history).toHaveLength(count);
    for (const id of targetIds) expect(history.find((row) => row.testcase_id === id)).toMatchObject({
      changed_by: ownerId, change_type: "update", snapshot: before.cases.find((row) => row.id === id),
    });
    if (reviewed) assertMoveAudit(staged, after, reviewed, ownerId);
    else expect(after).toEqual(before);
    const users = session.messages.filter((row: Record<string, unknown>) => row.role === "user");
    expect(users).toHaveLength(1); const trace = users[0].trace;
    expect(trace.version).toBe(1); expect(trace.outcome).toBe("completed");
    expect(trace.steps.filter((step: Record<string, unknown>) => step.stage === "staging")).toHaveLength(1);
    expect(trace.steps.find((step: Record<string, unknown>) => step.stage === "staging").status).toBe("ok");
    expect(trace.steps.find((step: Record<string, unknown>) => step.stage === "finalizing").meta).toMatchObject({ savedCount: 0, proposedCount: count });
    await afterReply?.({ sessionId, language, count, reply, fixture, session, before, after, previewIds });
  } finally {
    if (sessionId) { const deleted = await request.delete(`${base}/agents/zyra/chat/sessions/${sessionId}`); expect(deleted.ok(), await deleted.text()).toBeTruthy(); }
  }
}
