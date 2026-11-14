import { expect, type APIRequestContext, type Page } from "@playwright/test";

// Independent expected copy, not imported from the production dictionary under test.
const COPY = {
  en: {
    selectSecond: "Select proposed test case 2", saveOne: "Save 1 to repository", discard: "Discard all",
    saved: "1 test case saved to the repository.",
    closed: "Batch closed — no additional test cases were saved to the repository.",
    resolved: "This batch was already saved or closed — nothing left here to review.",
  },
  ru: {
    selectSecond: "Выбрать предложенный тест-кейс 2", saveOne: "Сохранить 1 в репозиторий", discard: "Отклонить все",
    saved: "Сохранено в репозиторий: 1 тест-кейс.",
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
    expect(response.request().postDataJSON()).toEqual({ selectedDraftIndexes: [0] });
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
  const refuse = async (route: import("@playwright/test").Route) => {
    await route.fulfill({ status: 503, json: { error: "E2E close refused" } });
  };
  // Explicit failure injection, not a simulated success: the request never reaches Nest.
  await page.route(closeUrl, refuse);
  try {
    await page.getByRole("button", { name: copy.discard, exact: true }).click();
    await expect(page.getByText("E2E close refused", { exact: true })).toBeVisible();
    await expect(page.getByText(copy.closed, { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: copy.discard, exact: true })).toBeEnabled();
    expect(await task()).toEqual(before);
    expect(await repositorySnapshot()).toEqual(stored);
    await capture?.("refused");
  } finally {
    await page.unroute(closeUrl, refuse);
  }

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
