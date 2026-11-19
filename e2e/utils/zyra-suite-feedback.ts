import { randomUUID } from "node:crypto";
import { expect, type APIRequestContext } from "@playwright/test";
import type { FakeAiServer } from "./fake-ai-server";

export const SUITE_OPERATION_ERROR = {
  en: "⚠️ Suite operations reported an error. Do not treat the response below as confirmation that every operation completed. Any changes already applied were kept; check the activity log before retrying.",
  ru: "⚠️ При выполнении операций с наборами возникла ошибка. Ответ ниже не подтверждает, что все операции завершились. Уже применённые изменения сохранены; перед повтором проверьте журнал действий.",
};

/** Test-only PostgreSQL error, scoped to exactly one fixture project/name, removed even on failure. */
export async function withSuiteInsertFailure<T>(projectId: string, suiteName: string, execute: (sql: string) => Promise<void>, run: () => Promise<T>): Promise<T> {
  expect(projectId).toMatch(/^[a-f0-9-]{36}$/i);
  const name = `e2e_zyra_suite_${projectId.replace(/-/g, "")}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const quotedSuite = `'${suiteName.replace(/'/g, "''")}'`;
  try {
    await execute(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      RAISE EXCEPTION 'E2E private injected suite failure'; RETURN NEW; END $$`);
    await execute(`CREATE TRIGGER ${name} BEFORE INSERT ON suites FOR EACH ROW
      WHEN (NEW.project_id='${projectId}'::uuid AND NEW.name=${quotedSuite}) EXECUTE FUNCTION ${name}()`);
    return await run();
  } finally {
    try { await execute(`DROP TRIGGER IF EXISTS ${name} ON suites`); }
    finally { await execute(`DROP FUNCTION IF EXISTS ${name}()`); }
  }
}

export type SuiteFeedbackState = {
  suites: Array<{ id: string; name: string }>;
  cases: unknown[]; reviews: unknown[];
  audit: Array<{ entity_id: string; entity_name: string; actor_id: string }>;
};

/** Script only the provider decision; exercise the real chat router, writer, reconciler and readback. */
export async function verifyZyraSuiteTurn(input: {
  request: APIRequestContext; ai: FakeAiServer; base: string; language: "en" | "ru"; ownerId: string;
  mode: "failed" | "partial" | "created" | "reused"; names: string[];
  state: () => Promise<SuiteFeedbackState>;
  afterReply?: (sessionId: string, reply: string, warning: string | null) => Promise<void>;
}) {
  const { request, ai, base, language, mode, names, state, afterReply, ownerId } = input;
  let sessionId = "";
  const before = await state();
  const calls = ai.requests.length;
  const failed = mode === "failed" || mode === "partial";
  const reply = mode === "reused"
    ? language === "en" ? "The requested suite already exists." : "Запрошенный набор уже существует."
    : language === "en" ? "Created the requested suites." : "Запрошенные наборы созданы.";
  try {
    const created = await request.post(`${base}/agents/zyra/chat/sessions`, { data: { title: `E2E suite feedback ${language} ${mode} ${randomUUID()}` } });
    expect(created.status(), await created.text()).toBe(201);
    sessionId = (await created.json()).id;
    ai.queueReply({ reply, reasoningSummary: "Scripted suite routing decision", action: "create_suite", actionType: "suite",
      operations: names.map((suiteName) => ({ type: "create_suite", suiteName })), testcases: [] });
    const sent = await request.post(`${base}/agents/zyra/chat/sessions/${sessionId}/messages`, { data: {
      // Literal identifiers are code, not the user's prose; otherwise long Latin fixture names can
      // outvote the Russian instruction in script-language.ts and silently exercise English instead.
      message: language === "en" ? `Create the following suites: ${names.map((name) => `\`${name}\``).join(", ")}` : `Создай следующие наборы: ${names.map((name) => `\`${name}\``).join(", ")}`,
    } });
    expect(sent.ok(), await sent.text()).toBeTruthy();
    const response = await sent.json();
    expect(ai.requests.length, "one router call, no generation or automatic mutation retry").toBe(calls + 1);
    const read = await request.get(`${base}/agents/zyra/chat/sessions/${sessionId}`);
    expect(read.ok(), await read.text()).toBeTruthy();
    const session = await read.json();
    expect(session.language, "native coverage must use the intended session language").toBe(language);
    const messages = session.messages as Array<Record<string, unknown>>;
    const assistant = messages.filter((message) => message.role === "assistant");
    expect(assistant).toHaveLength(1);
    const message = assistant[0];
    expect(message.content).toBe(response.message.content);
    expect(message.testcases).toEqual([]);
    expect(message.reviewRequestId ?? null).toBeNull();
    const activity = message.activity as Array<{ title: string; detail?: string }>;
    expect(activity.filter((entry) => entry.title === "An operation failed unexpectedly")).toHaveLength(failed ? 1 : 0);
    const after = await state();
    expect(after.cases).toEqual(before.cases);
    expect(after.reviews, "an empty suite creates no testcase proposal or selected-apply receipt").toEqual(before.reviews);
    const newlyCreated = after.suites.filter((suite) => !before.suites.some((old) => old.id === suite.id));
    expect(after.suites.filter((suite) => before.suites.some((old) => old.id === suite.id))).toEqual(before.suites);
    expect(newlyCreated.map((suite) => suite.name)).toEqual(mode === "partial" || mode === "created" ? [names[0]] : []);
    if (mode === "reused") expect(after.suites).toEqual(before.suites);
    expect(after.audit.slice(0, before.audit.length)).toEqual(before.audit);
    const addedAudit = after.audit.slice(before.audit.length);
    expect(addedAudit.map((entry) => entry.entity_name)).toEqual(newlyCreated.map((suite) => suite.name));
    expect(addedAudit.map((entry) => entry.entity_id).sort()).toEqual(newlyCreated.map((suite) => suite.id).sort());
    for (const entry of addedAudit) expect(entry.actor_id).toBe(ownerId);
    expect(String(message.content)).not.toContain("E2E private injected suite failure");
    const expected = failed ? `${SUITE_OPERATION_ERROR[language]}\n\n${reply}` : reply;
    // Soft only to finish the independent SQL/browser controls on the red baseline; still fails CI.
    expect.soft(message.content).toBe(expected);
    const users = messages.filter((entry) => entry.role === "user");
    expect(users).toHaveLength(1);
    const trace = users[0].trace as { version: number; outcome: string; steps: Array<{ stage: string; status: string; meta?: Record<string, unknown> }> };
    expect(trace.version).toBe(1);
    expect(trace.steps.filter((step) => step.stage === "staging")).toHaveLength(1);
    expect(trace.steps.find((step) => step.stage === "finalizing")?.meta).toMatchObject({ savedCount: 0, proposedCount: 0 });
    expect(JSON.stringify(trace)).not.toContain("E2E private injected suite failure");
    // Keep persistence and browser controls running on the failing-first baseline; these still fail CI.
    expect.soft(trace.outcome).toBe(failed ? "completed_with_errors" : "completed");
    expect.soft(trace.steps.find((step) => step.stage === "staging")?.status).toBe(failed ? "failed" : "ok");
    await afterReply?.(sessionId, reply, failed ? SUITE_OPERATION_ERROR[language] : null);
  } finally {
    if (sessionId) {
      const deleted = await request.delete(`${base}/agents/zyra/chat/sessions/${sessionId}`);
      expect(deleted.ok(), await deleted.text()).toBeTruthy();
    }
  }
}
