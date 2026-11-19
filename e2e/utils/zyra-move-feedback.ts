import { randomUUID } from "node:crypto";
import { expect, type APIRequestContext } from "@playwright/test";
import type { FakeAiServer } from "./fake-ai-server";
import type { AnswerRepositoryState } from "./zyra-answer-feedback";
import { assertMoveAudit, assertMovesStillUnpublished, governingMoveRepositoryState, readReviewedMoves, saveReviewedMoves, unchangedMoveContent, type MoveReviewPreview } from "./zyra-reviewed-moves";

export const MOVE_MODES = ["failed", "partial", "moved", "no-match"] as const;
export type MoveMode = typeof MOVE_MODES[number];
export type MoveRepositoryState = AnswerRepositoryState;
export type MoveFixture = { sourceId: string; destinationId: string; destinationName: string; firstId: string; secondId: string; keptSuiteName: string };

/** Existing API writers, before allocating a fake key; no asynchronous embedding changes in snapshots. */
export async function seedMoveRepository(request: APIRequestContext, base: string, label: string): Promise<MoveFixture> {
  const ids: string[] = [], destinationName = `E2E move destination ${label} ${randomUUID()}`;
  for (const name of [`E2E move source ${label} ${randomUUID()}`, destinationName]) {
    const created = await request.post(`${base}/suites`, { data: { name } });
    expect(created.status(), await created.text()).toBe(201); ids.push((await created.json()).id);
  }
  for (const suffix of ["first", "second"]) {
    const created = await request.post(`${base}/testcases`, { data: {
      title: `E2E preserved move ${label} ${suffix}`, suiteId: ids[0], description: "Existing move fixture",
      preconditions: "Saved before the chat turn", status: "Draft", priority: "P2",
      steps: [{ stepNumber: 1, action: "Open the existing case", expectedResult: "Its content and identity are preserved" }],
    } });
    expect(created.status(), await created.text()).toBe(201); ids.push((await created.json()).id);
  }
  return { sourceId: ids[0], destinationId: ids[1], destinationName, firstId: ids[2], secondId: ids[3], keptSuiteName: `E2E kept suite ${label} ${randomUUID()}` };
}

export async function settleMoveFixtures(fixtures: MoveFixture[], state: () => Promise<MoveRepositoryState>) {
  await expect.poll(async () => {
    const snapshot = await state();
    return fixtures.flatMap((fixture) => [fixture.firstId, fixture.secondId]).every((id) =>
      snapshot.cases.some((row) => row.id === id && row.embedding_status === "pending" && row.embedding_queued_at != null));
  }, { message: "keyless move fixtures must settle before immutable baselines and fake-key allocation" }).toBe(true);
}

/** Private, project+case scoped PostgreSQL failure; never available on a live/shared target. */
export async function withMoveUpdateFailure<T>(projectId: string, testcaseId: string, execute: (sql: string) => Promise<void>, run: () => Promise<T>): Promise<T> {
  for (const id of [projectId, testcaseId]) expect(id).toMatch(/^[a-f0-9-]{36}$/i);
  const name = `e2e_zyra_move_${projectId.replace(/-/g, "")}_${randomUUID().slice(0, 8)}`;
  try {
    await execute(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      RAISE EXCEPTION 'E2E private injected move failure'; RETURN NEW; END $$`);
    await execute(`CREATE TRIGGER ${name} BEFORE UPDATE OF suite_id ON testcases FOR EACH ROW
      WHEN (NEW.project_id='${projectId}'::uuid AND NEW.id='${testcaseId}'::uuid AND NEW.suite_id IS DISTINCT FROM OLD.suite_id)
      EXECUTE FUNCTION ${name}()`);
    return await run();
  } finally {
    try { await execute(`DROP TRIGGER IF EXISTS ${name} ON testcases`); }
    finally { await execute(`DROP FUNCTION IF EXISTS ${name}()`); }
  }
}

/** Only routing is scripted; exact review, transactional rollback and selected apply are real. */
export async function verifyZyraMoveTurn(input: {
  request: APIRequestContext; ai: FakeAiServer; base: string; ownerId: string; language: "en" | "ru";
  mode: MoveMode; fixture: MoveFixture; state: () => Promise<MoveRepositoryState>;
  beforeApply?: (preview: MoveReviewPreview) => Promise<void>;
  afterReply?: (evidence: { sessionId: string; language: "en" | "ru"; mode: MoveMode; reply: string; warning: string | null;
    session: Record<string, unknown>; fixture: MoveFixture; before: MoveRepositoryState; staged: MoveRepositoryState;
    failedApply: { status: number; response: string } | null; after: MoveRepositoryState }) => Promise<void>;
}) {
  const { request, ai, base, ownerId, language, mode, fixture, state: rawState, afterReply } = input;
  const state = async () => governingMoveRepositoryState(await rawState());
  const failed = mode === "failed" || mode === "partial", moved = mode === "partial" || mode === "moved";
  const before = await state(), calls = ai.requests.length;
  const reply = language === "en" ? "Moved the requested test cases." : "Запрошенные тест-кейсы перемещены.";
  const operations: Array<Record<string, unknown>> = [];
  if (mode === "partial") operations.push({ type: "create_suite", suiteName: fixture.keptSuiteName });
  if (moved) operations.push({ type: "move_to_suite", suiteId: fixture.destinationId, testcaseIds: [fixture.firstId] });
  if (failed || mode === "no-match") operations.push({ type: "move_to_suite", suiteId: fixture.destinationId, testcaseIds: [failed ? fixture.secondId : randomUUID()] });
  const proposedIds = [...(moved ? [fixture.firstId] : []), ...(failed ? [fixture.secondId] : [])];
  let sessionId = "";
  try {
    const created = await request.post(`${base}/agents/zyra/chat/sessions`, { data: { title: `E2E move ${language} ${mode} ${randomUUID()}` } });
    expect(created.status(), await created.text()).toBe(201); sessionId = (await created.json()).id;
    ai.queueReply({ reply, reasoningSummary: "Scripted suite assignment decision", action: "move_to_suite", actionType: "suite", operations, testcases: [] });
    const sent = await request.post(`${base}/agents/zyra/chat/sessions/${sessionId}/messages`, { data: {
      message: language === "en" ? `Move the requested test cases to suite \`${fixture.destinationName}\`.`
        : `Перемести указанные тест-кейсы в набор \`${fixture.destinationName}\`.`,
    } });
    expect(sent.ok(), await sent.text()).toBeTruthy();
    const response = await sent.json();
    expect(ai.requests.length, "one router call; never retry an ambiguous mutation").toBe(calls + 1);
    const read = await request.get(`${base}/agents/zyra/chat/sessions/${sessionId}`);
    expect(read.ok(), await read.text()).toBeTruthy();
    const session = await read.json();
    expect(session.language).toBe(language);
    const assistants = session.messages.filter((message: Record<string, unknown>) => message.role === "assistant");
    expect(assistants).toHaveLength(1);
    const message = assistants[0];
    expect(message.content).toBe(response.message.content);
    expect(message.actionType).toBe("suite");
    expect(message.testcases.map((row: Record<string, unknown>) => row.id)).toEqual(proposedIds);
    expect(message.testcases.every((row: Record<string, unknown>) => row.action === "proposed-update")).toBe(true);
    // The injected writer failure is not reached while staging proposals.
    expect(message.activity.filter((entry: Record<string, unknown>) => entry.title === "An operation failed unexpectedly")).toHaveLength(0);
    const staged = await state();
    assertMovesStillUnpublished(before, staged);
    expect(staged.reviews.length - before.reviews.length).toBe(proposedIds.length ? 1 : 0);
    expect(staged.reviews.filter((row) => before.reviews.some((old) => (old as { id: string }).id === (row as { id: string }).id))).toEqual(before.reviews);
    const reviewed = proposedIds.length ? await readReviewedMoves(request, base, message.reviewRequestId,
      proposedIds.map((testcaseId) => ({ testcaseId, suiteId: fixture.destinationId }))) : null;
    if (!reviewed) expect(message.reviewRequestId ?? null).toBeNull();
    await input.beforeApply?.({ sessionId, language, reply, before, reviewed, proposedCount: proposedIds.length, traceOutcome: "completed", stagingStatus: "ok" });
    let failedApply: { status: number; response: string } | null = null;
    let selected: number[] = [];
    if (reviewed && failed) {
      const failedSave = await request.post(`${base}/agents/zyra/tasks/${reviewed.id}/save`, {
        data: { expectedProposalRevision: reviewed.revision, selectedDraftIndexes: reviewed.snapshot.operations.map((_, index) => index) }, failOnStatusCode: false,
      });
      failedApply = { status: failedSave.status(), response: await failedSave.text() };
      expect(failedApply.status).toBe(500);
      expect(failedApply.response).not.toContain("E2E private injected move failure");
      expect(await state(), "failed selected batch rolls back cases, versions, review and audit").toEqual(staged);
    }
    if (reviewed && moved) {
      // The failing trigger stays installed. The human fixture explicitly selects only the valid
      // operation after the failed whole-batch attempt; this must not retry the rejected operation.
      selected = reviewed.snapshot.operations.flatMap((operation, index) => operation.testcaseId === fixture.firstId ? [index] : []);
      expect(selected).toHaveLength(1);
      await saveReviewedMoves(request, base, reviewed, ownerId, selected);
    }
    const after = await state();
    expect(after.cases).toHaveLength(before.cases.length);
    for (const old of before.cases) {
      const current = after.cases.find((row) => row.id === old.id)!;
      if (moved && old.id === fixture.firstId) {
        expect(current.suite_id).toBe(fixture.destinationId); expect(current.updated_by).toBe(ownerId);
        expect(unchangedMoveContent(current), "a suite move preserves testcase content and provenance").toEqual(unchangedMoveContent(old));
        expect(Number(current.review_dependency_revision)).toBe(Number(old.review_dependency_revision) + 1);
      } else expect(current).toEqual(old);
    }
    for (const old of before.history) expect(after.history.find((row) => row.testcase_id === old.testcase_id && row.version === old.version)).toEqual(old);
    const addedHistory = after.history.filter((row) => !before.history.some((old) => old.testcase_id === row.testcase_id && old.version === row.version));
    expect(addedHistory).toHaveLength(moved ? 1 : 0);
    if (moved) expect(addedHistory[0]).toMatchObject({ testcase_id: fixture.firstId, changed_by: ownerId, change_type: "update", snapshot: before.cases.find((row) => row.id === fixture.firstId) });
    expect(after.suites).toEqual(staged.suites);
    expect(after.suites.filter((row) => before.suites.some((old) => (old as Record<string, unknown>).id === (row as Record<string, unknown>).id))).toEqual(before.suites);
    const newSuites = after.suites.filter((row) => !before.suites.some((old) => (old as Record<string, unknown>).id === (row as Record<string, unknown>).id)) as Array<Record<string, unknown>>;
    expect(newSuites.map((row) => row.name)).toEqual(mode === "partial" ? [fixture.keptSuiteName] : []);
    const stageAudit = (staged.audit as Array<Record<string, unknown>>).filter((row) => !(before.audit as Array<Record<string, unknown>>).some((old) => old.id === row.id));
    expect(stageAudit.map((row) => row.action)).toEqual(mode === "partial" ? ["zyra_suite_created"] : []);
    if (mode === "partial") expect(stageAudit[0]).toMatchObject({ actor_id: ownerId, entity_id: newSuites[0].id });
    if (reviewed && moved) assertMoveAudit(staged, after, reviewed, ownerId, selected);
    else expect(after).toEqual(staged);
    const users = session.messages.filter((entry: Record<string, unknown>) => entry.role === "user");
    expect(users).toHaveLength(1);
    const trace = users[0].trace;
    expect(trace.version).toBe(1);
    expect(trace.steps.filter((step: Record<string, unknown>) => step.stage === "staging")).toHaveLength(1);
    expect(trace.steps.find((step: Record<string, unknown>) => step.stage === "finalizing").meta).toMatchObject({ savedCount: 0, proposedCount: proposedIds.length });
    expect(message.content + JSON.stringify(trace)).not.toContain("E2E private injected move failure");
    expect(trace.outcome).toBe("completed");
    expect(trace.steps.find((step: Record<string, unknown>) => step.stage === "staging").status).toBe("ok");
    if (mode === "no-match") expect(message.content).toContain(language === "en" ? "Nothing was saved" : "Ничего не сохранено");
    else expect(message.content).toMatch(language === "en" ? /staged for your review/ : /Ожидают вашей проверки/);
    await afterReply?.({ sessionId, language, mode, reply, warning: null, session, fixture, before, staged, failedApply, after });
  } finally {
    if (sessionId) {
      const deleted = await request.delete(`${base}/agents/zyra/chat/sessions/${sessionId}`);
      expect(deleted.ok(), await deleted.text()).toBeTruthy();
    }
  }
}
