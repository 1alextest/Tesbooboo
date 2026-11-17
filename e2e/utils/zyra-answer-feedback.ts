import { randomUUID } from "node:crypto";
import { expect, type APIRequestContext } from "@playwright/test";
import type { FakeAiServer } from "./fake-ai-server";

export const ANSWER_MODES = ["navigation", "lookup", "false-claim", "mixed"] as const;
export type AnswerMode = typeof ANSWER_MODES[number];
export type AnswerRepositoryState = {
  cases: Array<Record<string, unknown>>; history: Array<Record<string, unknown>>;
  suites: unknown[]; reviews: unknown[]; audit: unknown[];
};

export const answerRepositorySnapshotSql = `SELECT
  COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) FROM testcases t WHERE t.project_id=$1),'[]'::jsonb) AS cases,
  COALESCE((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.testcase_id,v.version) FROM testcase_versions v
    JOIN testcases t ON t.id=v.testcase_id WHERE t.project_id=$1),'[]'::jsonb) AS history,
  COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) FROM suites s WHERE s.project_id=$1),'[]'::jsonb) AS suites,
  COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM ai_generation_requests r WHERE r.project_id=$1),'[]'::jsonb) AS reviews,
  COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at,a.id) FROM audit_logs a WHERE a.project_id=$1),'[]'::jsonb) AS audit`;

// Independent expected strings: do not import the guard/catalog whose behavior is under test.
const FALSE_COMPLETION = {
  en: "⚠️ **Sorry! Nothing was saved.** Anything described below as created, saved or archived was not carried out — I only described it.\n\nAsk me to go ahead and I'll make the change and show you the affected test cases.",
  ru: "⚠️ **Извините! Ничего не сохранено.** Всё, что ниже описано как созданное, сохранённое или архивированное, не было выполнено — я это только описал(а).\n\nПопросите меня продолжить, и я внесу изменение и покажу затронутые тест-кейсы.",
};

function answerReply(language: "en" | "ru", mode: AnswerMode): string {
  if (language === "ru") return {
    navigation: "Чтобы посмотреть сохранённые тест-кейсы, откройте раздел «Тест-кейсы».",
    lookup: "Сохранённые тест-кейсы можно найти в репозитории.",
    "false-claim": "Сохранены 3 тест-кейса в репозитории.",
    mixed: "Чтобы посмотреть сохранённые тест-кейсы, откройте раздел «Тест-кейсы»; я также создал 3 тест-кейса.",
  }[mode];
  return {
    navigation: "To view saved test cases, open Test cases.",
    lookup: "You can find saved test cases in the repository.",
    "false-claim": "Saved 3 test cases to the repository.",
    mixed: "To view saved test cases, open Test cases; I also created 3 test cases.",
  }[mode];
}

/** Seed through existing writers before allocating the fake key; settle keyless embedding bookkeeping. */
export async function seedAnswerRepository(request: APIRequestContext, base: string, state: () => Promise<AnswerRepositoryState>) {
  const suite = await request.post(`${base}/suites`, { data: { name: `E2E informational reference ${randomUUID()}` } });
  expect(suite.status(), await suite.text()).toBe(201);
  const suiteId = (await suite.json()).id;
  const created = await request.post(`${base}/testcases`, { data: {
    title: "E2E preserved informational reference", suiteId, description: "An existing case, not output of this answer",
    preconditions: "The case was saved before the chat turn", status: "Draft", priority: "P2",
    steps: [{ stepNumber: 1, action: "Open Test cases", expectedResult: "The existing case remains unchanged" }],
  } });
  expect(created.status(), await created.text()).toBe(201);
  const caseId = (await created.json()).id;
  // A baseline with real history. Before V150 the embedding-status transitions created a version
  // row here; that bookkeeping is now excluded, so seed one genuine authored revision and keep the
  // assertion below meaningful: the answer turn must preserve existing history, not pass on an
  // empty snapshot.
  const edited = await request.put(`${base}/testcases/${caseId}`, {
    data: { description: "An existing case, not output of this answer (authored baseline)" }
  });
  expect(edited.ok(), await edited.text()).toBeTruthy();
  // Same queued->pending boundary established by the review-close smoke. V150 no longer records
  // the transient queued state in testcase_versions, so embedding_queued_at is the durable signal.
  await expect.poll(async () => {
    const snapshot = await state();
    return snapshot.cases.some((row) => row.id === caseId && row.embedding_status === "pending" && row.embedding_queued_at != null);
  }, { message: "keyless fixture embedding bookkeeping must finish before the immutable baseline" }).toBe(true);
}

/** Script only provider routing; use actual Nest application/finalization and persisted readback. */
export async function verifyZyraAnswerTurn(input: {
  request: APIRequestContext; ai: FakeAiServer; base: string; language: "en" | "ru"; mode: AnswerMode;
  state: () => Promise<AnswerRepositoryState>;
  afterReply?: (evidence: { sessionId: string; reply: string; warning: boolean; content: string;
    language: "en" | "ru"; before: AnswerRepositoryState; after: AnswerRepositoryState }) => Promise<void>;
}) {
  const { request, ai, base, language, mode, state, afterReply } = input;
  const before = await state(), calls = ai.requests.length;
  expect(before.cases.some((row) => row.title === "E2E preserved informational reference")).toBe(true);
  expect(before.history.length).toBeGreaterThan(0);
  expect(before.suites.length).toBeGreaterThan(0);
  expect(before.audit.length).toBeGreaterThan(0);
  let sessionId = "";
  const reply = answerReply(language, mode), warning = mode === "false-claim" || mode === "mixed";
  try {
    const created = await request.post(`${base}/agents/zyra/chat/sessions`, { data: { title: `E2E answer ${language} ${mode} ${randomUUID()}` } });
    expect(created.status(), await created.text()).toBe(201); sessionId = (await created.json()).id;
    ai.queueReply({ reply, reasoningSummary: "Scripted read-only answer decision", action: "answer", actionType: "answer", operations: [], testcases: [] });
    const sent = await request.post(`${base}/agents/zyra/chat/sessions/${sessionId}/messages`, { data: {
      message: language === "en" ? "Where can I find saved test cases? Please explain." : "Где можно найти сохранённые тест-кейсы? Объясни, пожалуйста.",
    } });
    expect(sent.ok(), await sent.text()).toBeTruthy();
    const response = await sent.json();
    expect(ai.requests.length, "one router call, no generation or confirmation retry").toBe(calls + 1);
    const read = await request.get(`${base}/agents/zyra/chat/sessions/${sessionId}`);
    expect(read.ok(), await read.text()).toBeTruthy();
    const session = await read.json();
    expect(session.language).toBe(language);
    const assistants = session.messages.filter((message: Record<string, unknown>) => message.role === "assistant");
    expect(assistants).toHaveLength(1);
    const message = assistants[0];
    expect(message.actionType).toBe("answer");
    expect(message.content).toBe(response.message.content);
    expect(message.testcases).toEqual([]);
    expect(message.reviewRequestId ?? null).toBeNull();
    const after = await state();
    expect(after, "read-only turns must preserve full snapshots, including existing cases, history, suites and audit").toEqual(before);
    // Soft to preserve independent persistence/browser controls on the failing-first baseline.
    expect.soft(message.content).toBe(warning ? `${FALSE_COMPLETION[language]}\n\n${reply}` : reply);
    await afterReply?.({ sessionId, reply, warning, content: message.content, language, before, after });
  } finally {
    if (sessionId) {
      const deleted = await request.delete(`${base}/agents/zyra/chat/sessions/${sessionId}`, { failOnStatusCode: false });
      expect(deleted.ok(), await deleted.text()).toBeTruthy();
    }
  }
}
