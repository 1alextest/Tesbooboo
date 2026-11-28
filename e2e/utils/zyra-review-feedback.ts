import { expect, type APIRequestContext, type Page } from "@playwright/test";

// Independent expected copy, not imported from the production dictionary under test.
const COPY = {
  en: {
    selectSecond: "Select proposed test case 2", saveOne: "Save 1 to repository", discard: "Discard all",
    saved: "1 test case saved to the repository.",
    unconfirmed: "The draft change was not confirmed. It may have been saved. Reload the proposal and review the remaining rows before continuing.",
    reload: "Reload proposal", refresh: "Reload the proposal and review the remaining rows before continuing.",
    saveButton: /^Save(?: \d+)? to repository$/,
    closed: "Batch closed — no additional test cases were saved to the repository.",
    resolved: "This batch was already saved or closed — nothing left here to review.",
  },
  ru: {
    selectSecond: "Выбрать предложенный тест-кейс 2", saveOne: "Сохранить 1 в репозиторий", discard: "Отклонить все",
    saved: "Сохранено в репозиторий: 1 тест-кейс.",
    unconfirmed: "Изменение черновика не подтверждено. Возможно, оно уже сохранено. Обновите предложение и проверьте оставшиеся строки, прежде чем продолжить.",
    reload: "Обновить предложение", refresh: "Обновите предложение и проверьте оставшиеся строки, прежде чем продолжить.",
    saveButton: /^Сохранить(?: \d+)? в репозиторий$/,
    closed: "Пакет закрыт — дополнительные тест-кейсы в репозиторий не сохранены.",
    resolved: "Этот пакет уже сохранён или закрыт — проверять здесь больше нечего.",
  },
};

/** Real review UI/HTTP actions on an already-staged fixture; never calls an AI provider. */
export async function verifyZyraReviewCloseFeedback(input: {
  page: Page; request: APIRequestContext; taskUrl: string; language: "en" | "ru"; saveFirst: boolean;
  settleSavedCases: (ids: string[]) => Promise<void>;
  repositorySnapshot: () => Promise<unknown>;
  capture?: (stage: string) => Promise<void>;
}) {
  const { page, request, taskUrl, language, saveFirst, settleSavedCases, repositorySnapshot, capture } = input;
  const copy = COPY[language];
  const task = async () => {
    const response = await request.get(taskUrl);
    expect(response.ok(), await response.text()).toBeTruthy();
    return await response.json();
  };
  const initial = await task();
  expect(initial).toMatchObject({ taskStatus: "in_review", savedCount: 0 });
  expect(initial.drafts).toHaveLength(2);
  if (saveFirst) {
    await page.getByRole("checkbox", { name: copy.selectSecond, exact: true }).uncheck();
    const pending = page.waitForResponse((response) => response.url() === `${taskUrl}/save` && response.request().method() === "POST");
    await page.getByRole("button", { name: copy.saveOne, exact: true }).click();
    const response = await pending;
    expect(response.ok(), await response.text()).toBeTruthy();
    // Publication is bound to the exact proposal rendered by this review, not a later payload.
    expect(initial.proposalRevision).toMatch(/^[a-f0-9]{64}$/);
    expect(response.request().postDataJSON()).toEqual({ expectedProposalRevision: initial.proposalRevision, selectedDraftIndexes: [0] });
    const result = await response.json();
    expect(result).toMatchObject({ savedCount: 1, remaining: 1 });
    expect(result.testcases).toHaveLength(1);
    await expect(page.getByText(copy.saved, { exact: true })).toBeVisible();
    // Save's post-COMMIT embedding enqueue is fire-and-forget. Wait for this keyless fixture's
    // queued -> pending worker transition BEFORE the strict close-no-write baseline, not by
    // dropping timestamps/history from the comparison or sleeping after close.
    await settleSavedCases(result.testcases.map((row: { id: string }) => row.id));
  }
  const before = await task();
  expect(before).toMatchObject({ taskStatus: "in_review", savedCount: saveFirst ? 1 : 0 });
  expect(before.drafts).toHaveLength(saveFirst ? 1 : 2);
  const stored = await repositorySnapshot();
  const closeUrl = `${taskUrl}/close`;
  let refusedRequests = 0;
  const refuse = async (route: import("@playwright/test").Route) => {
    refusedRequests++;
    await route.fulfill({ status: 503, json: { error: "E2E close refused" } });
  };
  // Explicit failure injection, not a simulated success: the request never reaches Nest.
  await page.route(closeUrl, refuse);
  try {
    await page.getByRole("button", { name: copy.discard, exact: true }).click();
    await expect(page.getByText(copy.unconfirmed, { exact: true })).toBeVisible();
    await expect(page.getByText(copy.refresh, { exact: true })).toBeVisible();
    await expect(page.getByText("E2E close refused", { exact: true })).toHaveCount(0);
    await expect(page.getByText(copy.closed, { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: copy.discard, exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: copy.saveButton })).toBeDisabled();
    expect(refusedRequests).toBe(1);
    expect(await task()).toEqual(before);
    expect(await repositorySnapshot()).toEqual(stored);
    await capture?.("refused");
  } finally {
    await page.unroute(closeUrl, refuse);
  }

  // A transport error does not establish whether the close committed. Reconcile the same
  // native task first; in this deliberate pre-server refusal the current revision is unchanged.
  expect(before.proposalRevision).toMatch(/^[a-f0-9]{64}$/);
  const fresh = page.waitForResponse((response) => response.url() === taskUrl && response.request().method() === "GET");
  await page.getByRole("button", { name: copy.reload, exact: true }).click();
  const freshResponse = await fresh;
  expect(freshResponse.ok(), await freshResponse.text()).toBeTruthy();
  expect(await freshResponse.json()).toMatchObject({ taskStatus: "in_review", proposalRevision: before.proposalRevision, savedCount: before.savedCount });
  await expect(page.getByText(copy.unconfirmed, { exact: true })).toHaveCount(0);
  await expect(page.getByText(copy.refresh, { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: copy.discard, exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: copy.saveButton })).toBeDisabled();
  expect(await task()).toEqual(before);
  expect(await repositorySnapshot()).toEqual(stored);
  await capture?.("reconciled");

  const pending = page.waitForResponse((response) => response.url() === closeUrl && response.request().method() === "POST");
  await page.getByRole("button", { name: copy.discard, exact: true }).click();
  const response = await pending;
  expect(response.ok(), await response.text()).toBeTruthy();
  const closed = await task();
  expect(closed).toMatchObject({ taskStatus: "done", savedCount: before.savedCount });
  expect(closed.saveEvents).toEqual(before.saveEvents);
  expect(closed.drafts).toEqual(before.drafts); // close locks the unsaved payload; it does not delete history
  expect(closed.activities).toHaveLength(before.activities.length + 1);
  expect(await repositorySnapshot()).toEqual(stored);
  await expect(page.getByRole("button", { name: copy.discard, exact: true })).toHaveCount(0);
  // Soft only so the red baseline also reaches SQL/idempotency/reload controls and captures.
  // Playwright still fails the test when this assertion fails.
  await expect.soft(page.getByText(copy.closed, { exact: true })).toBeVisible();
  await capture?.("closed");
  const repeated = await request.post(closeUrl);
  expect(repeated.ok(), await repeated.text()).toBeTruthy();
  expect(await task()).toEqual(closed);
  expect(await repositorySnapshot()).toEqual(stored);
  await page.reload();
  await expect(page.getByText(copy.resolved, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: copy.discard, exact: true })).toHaveCount(0);
  expect(await repositorySnapshot()).toEqual(stored);
}
