import { expect, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";
import type { MoveRepositoryState } from "./zyra-move-feedback";

export type ExpectedMove = { testcaseId: string; suiteId: string };
type MoveOperation = { opType: string; testcaseId: string; fields: { suiteId: string }; [key: string]: unknown };
export type ReviewedMoves = {
  id: string;
  revision: string;
  snapshot: { operations: MoveOperation[]; targets: Array<{ testcaseId: string; editRevision: string; approvalRevision: string }>; [key: string]: unknown };
};
export type MoveReviewPreview = {
  sessionId: string;
  language: "en" | "ru";
  reply: string;
  before: MoveRepositoryState;
  reviewed: ReviewedMoves | null;
  proposedCount: number;
  traceOutcome: "completed" | "completed_with_errors";
  stagingStatus: "ok" | "failed";
};

/** Save enqueues indexing asynchronously; worker status is not a testcase content mutation. */
export function governingMoveRepositoryState(state: MoveRepositoryState): MoveRepositoryState {
  const governing = (row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).filter(([key]) => ![
    "embedding_status", "embedding_content_hash", "embedding_queued_at", "search_vector",
  ].includes(key)));
  return { ...state, cases: state.cases.map(governing), history: state.history.map((row) => ({
    ...row, snapshot: governing(row.snapshot as Record<string, unknown>),
  })) };
}

/** Inspect persisted chat and every exact proposed operation before the human fixture applies it. */
export async function verifyMoveReviewPreview(page: Page, web: string, projectId: string, preview: MoveReviewPreview, testInfo: TestInfo, label: string, warning?: string) {
  const trace = page.locator("[data-zyra-trace]"), summary = trace.locator("summary");
  const expectedCount = preview.proposedCount
    ? preview.language === "en" ? `${preview.proposedCount} proposed for review` : `на проверку: ${preview.proposedCount}`
    : preview.language === "en" ? "no test case changes" : "нет изменений тест-кейсов";
  const inspect = async () => {
    await expect(page.getByText(preview.reply, { exact: true })).toBeVisible();
    await expect(trace).toHaveAttribute("data-zyra-trace", preview.traceOutcome);
    await expect(summary).toContainText(expectedCount);
    if (warning) await expect(page.getByText(warning, { exact: false })).toHaveCount(1);
    if (preview.reviewed) {
      const operations = preview.reviewed.snapshot.operations;
      await expect(page.getByTestId("zyra-review-number")).toHaveCount(operations.length);
      for (const id of new Set(operations.map((operation) => operation.testcaseId))) {
        const original = preview.before.cases.find((row) => row.id === id)!;
        expect(original).toBeTruthy();
        await expect(page.getByText(String(original.external_id), { exact: true }))
          .toHaveCount(operations.filter((operation) => operation.testcaseId === id).length);
      }
      const inspector = page.locator("details").filter({ has: page.locator("summary", { hasText: "Inspect the saved proposal and target content" }) });
      await inspector.locator("summary").click();
      const content = inspector.locator("pre");
      await expect(content).toBeVisible();
      expect(JSON.parse(await content.innerText())).toEqual(preview.reviewed.snapshot);
    } else {
      await expect(page.getByTestId("zyra-review-number")).toHaveCount(0);
    }
  };
  await page.goto(`${web}/projects/${projectId}/agents/zyra`); await inspect();
  await page.reload(); await inspect();
  await testInfo.attach(`${label}-review`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  await summary.click();
  await expect(trace.locator('[data-zyra-step="staging"]')).toHaveAttribute("data-zyra-step-status", preview.stagingStatus);
  const finalizing = trace.locator('[data-zyra-step="finalizing"]');
  await expect(finalizing).toHaveAttribute("data-zyra-step-status", "ok");
  await expect(finalizing).toContainText(expectedCount);
  await testInfo.attach(`${label}-review-expanded`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
}

/** Read the exact native review payload through the authenticated human fixture, before Save. */
export async function readReviewedMoves(request: APIRequestContext, base: string, reviewId: unknown, expected: ExpectedMove[]): Promise<ReviewedMoves> {
  expect(reviewId).toMatch(/^[a-f0-9-]{36}$/i);
  const read = await request.get(`${base}/agents/zyra/tasks/${reviewId}`);
  expect(read.ok(), await read.text()).toBeTruthy();
  const task = await read.json();
  expect(task.proposalRevision).toMatch(/^[a-f0-9]{64}$/);
  expect(task.proposalSnapshot).toMatchObject({ taskId: reviewId, targetBinding: "coherent_review_read" });
  const snapshot = task.proposalSnapshot as ReviewedMoves["snapshot"];
  expect(snapshot.operations).toHaveLength(expected.length);
  expect(task.drafts).toHaveLength(expected.length); // A bounded chat preview must not truncate review.
  for (const operation of snapshot.operations) expect(operation).toMatchObject({ opType: "update", fields: { suiteId: expect.any(String) } });
  const ids = [...new Set(expected.map((move) => move.testcaseId))].sort();
  expect([...new Set(snapshot.operations.map((operation) => operation.testcaseId))].sort()).toEqual(ids);
  for (const id of ids) {
    // Preserve ordered moves on the same case; database order within disjoint targets is immaterial.
    expect(snapshot.operations.filter((operation) => operation.testcaseId === id).map((operation) => operation.fields.suiteId))
      .toEqual(expected.filter((move) => move.testcaseId === id).map((move) => move.suiteId));
    const target = snapshot.targets.find((row) => row.testcaseId === id);
    expect(target?.editRevision).toMatch(/^[a-f0-9]{64}$/);
    expect(target?.approvalRevision).toMatch(/^[a-f0-9]{64}$/);
  }
  return { id: String(reviewId), revision: task.proposalRevision, snapshot };
}

export async function saveReviewedMoves(request: APIRequestContext, base: string, reviewed: ReviewedMoves, ownerId: string, selected = reviewed.snapshot.operations.map((_, index) => index)) {
  const response = await request.post(`${base}/agents/zyra/tasks/${reviewed.id}/save`, {
    data: { expectedProposalRevision: reviewed.revision, selectedDraftIndexes: selected }, failOnStatusCode: false,
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const applied = await response.json();
  expect(applied.savedCount).toBe(selected.length);
  expect(applied.remaining).toBe(reviewed.snapshot.operations.length - selected.length);
  expect(applied.replayed).toBe(false);
  expect(applied.saveReceipt).toMatchObject({ proposalRevision: reviewed.revision, reviewerId: ownerId, principalKind: "human_session", selectedDraftIndexes: selected, reviewedSnapshot: reviewed.snapshot });
  expect(applied.saveReceipt.selectedOperations).toEqual(selected.map((index) => ({ index, ...reviewed.snapshot.operations[index] })));
  expect(applied.saveReceipt.testcaseIds).toEqual(selected.map((index) => reviewed.snapshot.operations[index].testcaseId));
  return applied;
}

/** Staging can persist a review record and an explicitly requested suite, never publish case changes. */
export function assertMovesStillUnpublished(before: MoveRepositoryState, staged: MoveRepositoryState) {
  expect(staged.cases, "chat proposals must leave native cases untouched before human Save").toEqual(before.cases);
  expect(staged.history, "chat staging must not create official case versions").toEqual(before.history);
  const oldAudit = before.audit as Array<Record<string, unknown>>;
  const newAudit = (staged.audit as Array<Record<string, unknown>>).filter((row) => !oldAudit.some((old) => old.id === row.id));
  expect(newAudit.filter((row) => row.entity_type === "testcase" || row.action === "testcase_proposals_applied")).toEqual([]);
}

/** Index bookkeeping is derived; the suite and revision change are asserted separately. */
export function unchangedMoveContent(row: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(row).filter(([key]) => ![
    "suite_id", "updated_by", "updated_at", "review_dependency_revision",
    "embedding_status", "embedding_content_hash", "embedding_queued_at", "search_vector",
  ].includes(key)));
}

export function assertMoveAudit(staged: MoveRepositoryState, applied: MoveRepositoryState, reviewed: ReviewedMoves, ownerId: string, selected = reviewed.snapshot.operations.map((_, index) => index)) {
  const previous = staged.audit as Array<Record<string, unknown>>, current = applied.audit as Array<Record<string, unknown>>;
  expect(current.filter((row) => previous.some((old) => old.id === row.id))).toEqual(previous);
  const added = current.filter((row) => !previous.some((old) => old.id === row.id));
  const updates = added.filter((row) => row.action === "zyra_updated");
  expect(updates).toHaveLength(selected.length);
  for (const index of selected) {
    const operation = reviewed.snapshot.operations[index];
    expect(updates.find((row) => (row.diff as Record<string, unknown>)?.selectedIndex === index)).toMatchObject({
      actor_id: ownerId, entity_type: "testcase", entity_id: operation.testcaseId,
      diff: { source: "testcase_proposal_review", taskId: reviewed.id, proposalRevision: reviewed.revision, selectedIndex: index, operation },
    });
  }
  expect(added.filter((row) => row.action === "testcase_proposals_applied")).toHaveLength(1);
  expect(added.find((row) => row.action === "testcase_proposals_applied")).toMatchObject({
    actor_id: ownerId, entity_id: reviewed.id, diff: { proposalRevision: reviewed.revision, selectedDraftIndexes: selected, principalKind: "human_session" },
  });
  expect(added).toHaveLength(selected.length + 1);
}
