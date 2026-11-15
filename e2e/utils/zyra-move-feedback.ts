import { randomUUID } from "node:crypto";
import { expect, type APIRequestContext } from "@playwright/test";
import type { FakeAiServer } from "./fake-ai-server";
import type { AnswerRepositoryState } from "./zyra-answer-feedback";
import { SUITE_OPERATION_ERROR } from "./zyra-suite-feedback";

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
      snapshot.cases.some((row) => row.id === id && row.embedding_status === "pending") &&
      snapshot.history.some((version) => version.testcase_id === id && (version.snapshot as Record<string, unknown>)?.embedding_status === "queued"));
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

/** Only provider routing is scripted; application, shared writers, finalization and readback are real. */
export async function verifyZyraMoveTurn(input: {
  request: APIRequestContext; ai: FakeAiServer; base: string; ownerId: string; language: "en" | "ru";
  mode: MoveMode; fixture: MoveFixture; state: () => Promise<MoveRepositoryState>;
  afterReply?: (evidence: { sessionId: string; language: "en" | "ru"; mode: MoveMode; reply: string; warning: string | null;
    session: Record<string, unknown>; fixture: MoveFixture; before: MoveRepositoryState; after: MoveRepositoryState }) => Promise<void>;
}) {
  const { request, ai, base, ownerId, language, mode, fixture, state, afterReply } = input;
  const failed = mode === "failed" || mode === "partial", moved = mode === "partial" || mode === "moved";
  const before = await state(), calls = ai.requests.length;
  const reply = language === "en" ? "Moved the requested test cases." : "Запрошенные тест-кейсы перемещены.";
  const operations: Array<Record<string, unknown>> = [];
  if (mode === "partial") operations.push({ type: "create_suite", suiteName: fixture.keptSuiteName });
  if (moved) operations.push({ type: "move_to_suite", suiteId: fixture.destinationId, testcaseIds: [fixture.firstId] });
  if (failed || mode === "no-match") operations.push({ type: "move_to_suite", suiteId: fixture.destinationId, testcaseIds: [failed ? fixture.secondId : randomUUID()] });
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
    expect(message.reviewRequestId ?? null).toBeNull();
    expect(message.testcases.map((row: Record<string, unknown>) => row.id)).toEqual(moved ? [fixture.firstId] : []);
    expect(message.testcases.every((row: Record<string, unknown>) => row.action === "moved")).toBe(true);
    expect(message.activity.filter((entry: Record<string, unknown>) => entry.title === "An operation failed unexpectedly")).toHaveLength(failed ? 1 : 0);
    const after = await state();
    expect(after.reviews).toEqual(before.reviews);
    expect(after.cases).toHaveLength(before.cases.length);
    for (const old of before.cases) {
      const current = after.cases.find((row) => row.id === old.id)!;
      if (moved && old.id === fixture.firstId) {
        expect(current.suite_id).toBe(fixture.destinationId); expect(current.updated_by).toBe(ownerId);
        const content = (row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).filter(([key]) => !["suite_id", "updated_by", "updated_at"].includes(key)));
        expect(content(current), "a suite move must not rewrite testcase content or provenance").toEqual(content(old));
      } else expect(current).toEqual(old);
    }
    for (const old of before.history) expect(after.history.find((row) => row.testcase_id === old.testcase_id && row.version === old.version)).toEqual(old);
    const addedHistory = after.history.filter((row) => !before.history.some((old) => old.testcase_id === row.testcase_id && old.version === row.version));
    expect(addedHistory).toHaveLength(moved ? 1 : 0);
    if (moved) expect(addedHistory[0]).toMatchObject({ testcase_id: fixture.firstId, changed_by: ownerId, change_type: "update", snapshot: before.cases.find((row) => row.id === fixture.firstId) });
    expect(after.suites.filter((row) => before.suites.some((old) => (old as Record<string, unknown>).id === (row as Record<string, unknown>).id))).toEqual(before.suites);
    const newSuites = after.suites.filter((row) => !before.suites.some((old) => (old as Record<string, unknown>).id === (row as Record<string, unknown>).id)) as Array<Record<string, unknown>>;
    expect(newSuites.map((row) => row.name)).toEqual(mode === "partial" ? [fixture.keptSuiteName] : []);
    const oldAudit = before.audit as Array<Record<string, unknown>>, currentAudit = after.audit as Array<Record<string, unknown>>;
    expect(currentAudit.filter((row) => oldAudit.some((old) => old.id === row.id))).toEqual(oldAudit);
    const addedAudit = currentAudit.filter((row) => !oldAudit.some((old) => old.id === row.id));
    expect(addedAudit.map((row) => row.action).sort()).toEqual(mode === "partial" ? ["zyra_moved_to_suite", "zyra_suite_created"] : moved ? ["zyra_moved_to_suite"] : []);
    for (const entry of addedAudit) {
      expect(entry.actor_id).toBe(ownerId);
      expect(entry.entity_id).toBe(entry.action === "zyra_moved_to_suite" ? fixture.destinationId : newSuites[0].id);
    }
    const users = session.messages.filter((entry: Record<string, unknown>) => entry.role === "user");
    expect(users).toHaveLength(1);
    const trace = users[0].trace;
    expect(trace.version).toBe(1);
    expect(trace.steps.filter((step: Record<string, unknown>) => step.stage === "staging")).toHaveLength(1);
    expect(trace.steps.find((step: Record<string, unknown>) => step.stage === "finalizing").meta).toMatchObject({ savedCount: moved ? 1 : 0, proposedCount: 0 });
    expect(message.content + JSON.stringify(trace)).not.toContain("E2E private injected move failure");
    // Soft only on known red assertions, so independent persistence/browser controls still execute.
    expect.soft(String(message.content).startsWith(SUITE_OPERATION_ERROR[language])).toBe(failed);
    if (failed) expect.soft(message.content).not.toMatch(/do not exist in this project|в этом проекте нет/);
    expect.soft(trace.outcome).toBe(failed ? "completed_with_errors" : "completed");
    expect.soft(trace.steps.find((step: Record<string, unknown>) => step.stage === "staging").status).toBe(failed ? "failed" : "ok");
    if (mode === "no-match") expect(message.content).toContain(language === "en" ? "Nothing was saved" : "Ничего не сохранено");
    await afterReply?.({ sessionId, language, mode, reply, warning: failed ? SUITE_OPERATION_ERROR[language] : null, session, fixture, before, after });
  } finally {
    if (sessionId) {
      const deleted = await request.delete(`${base}/agents/zyra/chat/sessions/${sessionId}`);
      expect(deleted.ok(), await deleted.text()).toBeTruthy();
    }
  }
}
