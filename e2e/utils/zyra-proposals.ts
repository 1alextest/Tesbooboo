import { expect, type APIRequestContext } from "@playwright/test";

/** A successful fixture explicitly reads the exact native proposal before its human Save. */
export async function readZyraProposal(human: APIRequestContext, saveUrl: string) {
  const taskUrl = saveUrl.replace(/\/ai\/generation-history\/([^/]+)\/save$/, "/agents/zyra/tasks/$1")
    .replace(/\/save$/, "");
  const response = await human.get(taskUrl);
  expect(response.ok(), `Reading the proposal selected for review: ${await response.text()}`).toBe(true);
  const reviewed = await response.json();
  expect(reviewed.proposalRevision).toMatch(/^[a-f0-9]{64}$/);
  expect(Array.isArray(reviewed.proposalSnapshot?.operations)).toBe(true);
  return reviewed;
}

export async function saveReviewedZyraTask(
  human: APIRequestContext,
  saveUrl: string,
  options: Parameters<APIRequestContext["post"]>[1] = {},
) {
  const reviewed = await readZyraProposal(human, saveUrl);
  const data = (options.data ?? {}) as Record<string, unknown>;
  const selectedDraftIndexes = Object.hasOwn(data, "selectedDraftIndexes")
    ? data.selectedDraftIndexes
    : reviewed.proposalSnapshot.operations.map((_: unknown, index: number) => index);
  return human.post(saveUrl, {
    ...options,
    data: { ...data, expectedProposalRevision: reviewed.proposalRevision, selectedDraftIndexes },
  });
}
