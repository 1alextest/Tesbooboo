import { randomUUID } from "node:crypto";
import { expect, type APIRequestContext } from "@playwright/test";
import type { FakeAiServer } from "./fake-ai-server";
import type { MoveRepositoryState } from "./zyra-move-feedback";
import { seedMoveTraceRepository, type MoveTraceFixture } from "./zyra-move-trace-count";

export const OVERLAPPING_MOVE_MODES = ["overlap", "disjoint"] as const;
export type OverlappingMoveMode = typeof OVERLAPPING_MOVE_MODES[number];
export type OverlappingMoveFixture = { first: MoveTraceFixture; last: MoveTraceFixture };

/** Reuse the existing API fixture writer and retain untouched cases beside both write sets. */
export async function seedOverlappingMoveRepository(request: APIRequestContext, base: string, label: string, mode: OverlappingMoveMode): Promise<OverlappingMoveFixture> {
  const first = await seedMoveTraceRepository(request, base, `${label}-first`, 26);
  if (mode === "disjoint") return { first, last: await seedMoveTraceRepository(request, base, `${label}-last`, 26) };
  const destinationName = `E2E overlap final destination ${label} ${randomUUID()}`;
  const created = await request.post(`${base}/suites`, { data: { name: destinationName } });
  expect(created.status(), await created.text()).toBe(201);
  return { first, last: { ...first, destinationId: (await created.json()).id, destinationName } };
}

export type OverlappingMoveEvidence = {
  sessionId: string; language: "en" | "ru"; mode: OverlappingMoveMode; reply: string; expectedSaved: number;
  fixture: OverlappingMoveFixture; session: Record<string, unknown>; before: MoveRepositoryState; after: MoveRepositoryState; previewIds: string[];
};

/** Two real writes remain two writes; the final trace counts the same distinct cases as the footer. */
export async function verifyZyraOverlappingMoveTrace(input: {
  request: APIRequestContext; ai: FakeAiServer; base: string; ownerId: string; language: "en" | "ru";
  mode: OverlappingMoveMode; fixture: OverlappingMoveFixture; state: () => Promise<MoveRepositoryState>;
  afterReply?: (evidence: OverlappingMoveEvidence) => Promise<void>;
}) {
  const { request, ai, base, ownerId, language, mode, fixture, state, afterReply } = input;
  const before = await state(), calls = ai.requests.length;
  const groups = [fixture.first, fixture.last], targetIds = [...new Set(groups.flatMap((group) => group.targetIds))];
  const expectedSaved = mode === "overlap" ? 26 : 52;
  expect(targetIds).toHaveLength(expectedSaved);
  const reply = language === "en" ? "Applied the requested suite moves." : "Выполнены указанные перемещения по наборам.";
  let sessionId = "";
  try {
    const created = await request.post(`${base}/agents/zyra/chat/sessions`, { data: { title: `E2E overlapping moves ${language} ${mode} ${randomUUID()}` } });
    expect(created.status(), await created.text()).toBe(201); sessionId = (await created.json()).id;
    ai.queueReply({ reply, reasoningSummary: "Scripted ordered suite moves", action: "move_to_suite", actionType: "suite", testcases: [],
      operations: groups.map((group) => ({ type: "move_to_suite", suiteId: group.destinationId, testcaseIds: group.targetIds })) });
    const sent = await request.post(`${base}/agents/zyra/chat/sessions/${sessionId}/messages`, { data: {
      message: language === "en" ? "Apply the requested moves in their specified order." : "Выполни указанные перемещения в заданном порядке.",
    } });
    expect(sent.ok(), await sent.text()).toBeTruthy(); const response = await sent.json();
    expect(ai.requests.length, "one router call; neither mutation is automatically replayed").toBe(calls + 1);
    const read = await request.get(`${base}/agents/zyra/chat/sessions/${sessionId}`);
    expect(read.ok(), await read.text()).toBeTruthy(); const session = await read.json();
    expect(session.language).toBe(language);
    const assistants = session.messages.filter((row: Record<string, unknown>) => row.role === "assistant");
    expect(assistants).toHaveLength(1); const assistant = assistants[0];
    expect(assistant.content).toBe(response.message.content); expect(assistant.actionType).toBe("suite");
    expect(assistant.reviewRequestId ?? null).toBeNull();
    const previewIds = assistant.testcases.map((row: Record<string, unknown>) => String(row.id)) as string[];
    expect(previewIds).toHaveLength(50); // Original per-operation 25-card bound, not a global cap or deduped UI.
    expect(previewIds.every((id) => targetIds.includes(id))).toBe(true);
    for (const [index, group] of groups.entries()) {
      const preview = previewIds.slice(index * 25, (index + 1) * 25);
      expect(new Set(preview).size).toBe(25);
      expect(preview.every((id) => group.targetIds.includes(id))).toBe(true);
    }
    // SQL row order has no contract; overlapping previews may omit the same case in both operations.
    if (mode === "overlap") expect(new Set(previewIds).size).toBeGreaterThanOrEqual(25);
    else expect(new Set(previewIds).size).toBe(50);
    expect(assistant.testcases.every((row: Record<string, unknown>) => row.action === "moved")).toBe(true);
    expect(assistant.activity.filter((row: Record<string, unknown>) => row.title === "An operation failed unexpectedly")).toHaveLength(0);
    expect(assistant.content).toContain(language === "en" ? `${expectedSaved} test case(s) total` : `всего тест-кейсов: ${expectedSaved}`);
    const after = await state();
    expect(after.cases).toHaveLength(before.cases.length); expect(after.suites).toEqual(before.suites); expect(after.reviews).toEqual(before.reviews);
    const changed = after.cases.filter((row) => JSON.stringify(row) !== JSON.stringify(before.cases.find((old) => old.id === row.id)));
    expect(changed.map((row) => String(row.id)).sort()).toEqual([...targetIds].sort());
    const content = (row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).filter(([key]) => !["suite_id", "updated_by", "updated_at"].includes(key)));
    for (const old of before.cases) {
      const current = after.cases.find((row) => row.id === old.id)!;
      if (targetIds.includes(String(old.id))) {
        const lastGroup = [...groups].reverse().find((group) => group.targetIds.includes(String(old.id)))!;
        expect(current).toMatchObject({ suite_id: lastGroup.destinationId, updated_by: ownerId });
        expect(content(current)).toEqual(content(old));
      } else expect(current).toEqual(old);
    }
    for (const old of before.history) expect(after.history.find((row) => row.id === old.id)).toEqual(old);
    const history = after.history.filter((row) => !before.history.some((old) => old.id === row.id));
    expect(history).toHaveLength(52); // Both 26-case writes still occur, including the overwritten first destination.
    for (const id of targetIds) {
      const versions = history.filter((row) => row.testcase_id === id).sort((a, b) => Number(a.version) - Number(b.version));
      expect(versions).toHaveLength(mode === "overlap" ? 2 : 1);
      expect(versions.every((row) => row.changed_by === ownerId && row.change_type === "update")).toBe(true);
      const original = before.cases.find((row) => row.id === id)!;
      expect(versions[0].snapshot).toEqual(original);
      if (mode === "overlap") {
        expect(Number(versions[1].version)).toBe(Number(versions[0].version) + 1);
        expect(versions[1].snapshot).toMatchObject({ suite_id: fixture.first.destinationId, updated_by: ownerId });
        expect(content(versions[1].snapshot as Record<string, unknown>)).toEqual(content(original));
      }
    }
    const oldAudit = before.audit as Array<Record<string, unknown>>, audit = after.audit as Array<Record<string, unknown>>;
    expect(audit.filter((row) => oldAudit.some((old) => old.id === row.id))).toEqual(oldAudit);
    const addedAudit = audit.filter((row) => !oldAudit.some((old) => old.id === row.id));
    expect(addedAudit).toHaveLength(2);
    for (const group of groups) {
      const entry = addedAudit.find((row) => row.entity_id === group.destinationId)!;
      expect(entry).toMatchObject({ action: "zyra_moved_to_suite", actor_id: ownerId, diff: { movedCount: 26 } });
      expect([...(entry.diff as { testcaseIds: string[] }).testcaseIds].sort()).toEqual([...group.targetIds].sort());
    }
    const users = session.messages.filter((row: Record<string, unknown>) => row.role === "user");
    expect(users).toHaveLength(1); const trace = users[0].trace;
    expect(trace.version).toBe(1); expect(trace.outcome).toBe("completed");
    expect(trace.steps.find((step: Record<string, unknown>) => step.stage === "staging").status).toBe("ok");
    expect.soft(trace.steps.find((step: Record<string, unknown>) => step.stage === "finalizing").meta).toMatchObject({ savedCount: expectedSaved, proposedCount: 0 });
    await afterReply?.({ sessionId, language, mode, reply, expectedSaved, fixture, session, before, after, previewIds });
  } finally {
    if (sessionId) { const deleted = await request.delete(`${base}/agents/zyra/chat/sessions/${sessionId}`, { failOnStatusCode: false }); expect(deleted.ok(), await deleted.text()).toBeTruthy(); }
  }
}
