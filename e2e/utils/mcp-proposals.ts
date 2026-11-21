import { randomUUID } from "node:crypto";
import { expect, type APIRequestContext } from "@playwright/test";

export type TestcaseProposalOperation = {
  opType: "create"; draft: Record<string, unknown>; reason?: string;
} | {
  opType: "update" | "archive"; testcaseId: string; expectedRevision: string; fields: Record<string, unknown>; reason?: string;
};

/** Explicit preview fixture: real MCP staging, unchanged official records, then real human review/Save. */
export async function stageAndApplyMcpTestcases(
  human: APIRequestContext, machine: APIRequestContext, token: string, projectId: string,
  operations: TestcaseProposalOperation[], apiOrigin = "",
) {
  const base = `${apiOrigin}/api/projects/${projectId}`;
  async function officialState(operation: TestcaseProposalOperation) {
    if (operation.opType === "create") {
      const response = await human.get(`${base}/testcases`, { params: { search: String(operation.draft.title), limit: 500, includeArchived: true } });
      expect(response.ok(), await response.text()).toBe(true);
      return (await response.json()).filter((row: { title: string }) => row.title === operation.draft.title)
        .map((row: { id: string }) => row.id).sort();
    }
    const response = await human.get(`${base}/testcases/${operation.testcaseId}`);
    expect(response.ok(), await response.text()).toBe(true);
    return (await response.json()).editRevision;
  }
  async function stageAndSave(current: TestcaseProposalOperation[]) {
    const before = await Promise.all(current.map(officialState));
    const response = await machine.post(`${base}/mcp`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { jsonrpc: "2.0", id: 1, method: "tools/call", params: {
        name: "stage_testcase_changes", arguments: { requestKey: randomUUID(), operations: current }
      } },
    });
    expect(response.ok(), await response.text()).toBe(true);
    const rpc = await response.json();
    expect(rpc.error, JSON.stringify(rpc.error)).toBeUndefined();
    expect(rpc.result.isError).toBe(false);
    const staged = JSON.parse(rpc.result.content[0].text);
    expect(staged.publication).toBe("unpublished");
    expect(staged.taskId).toBe(staged.task.id);
    expect(staged).not.toHaveProperty("testcaseId");
    expect(await Promise.all(current.map(officialState))).toEqual(before);
    const taskEndpoint = `${base}/agents/zyra/tasks/${staged.taskId}`;
    const read = await human.get(taskEndpoint);
    expect(read.ok(), await read.text()).toBe(true);
    const reviewed = await read.json();
    expect(reviewed.proposalRevision).toBe(staged.task.proposalRevision);
    expect(reviewed.proposalSnapshot).toBeTruthy();
    const saved = await human.post(`${taskEndpoint}/save`, {
      data: { expectedProposalRevision: reviewed.proposalRevision, selectedDraftIndexes: current.map((_, index) => index) },
    });
    return { before, staged, reviewed, saved };
  }

  let attempt = await stageAndSave(operations);
  if (attempt.saved.status() === 409) {
    /*
     * A concurrent bookkeeping write can move the review basis between staging and Save (the
     * product then correctly refuses the stale review). Re-stage once, exactly as a reviewer would
     * after clicking reload — but only when the official records are provably untouched, so a real
     * concurrent content edit still surfaces as the conflict instead of being retried away.
     */
    const refusal = await attempt.saved.json().catch(() => null);
    const current = await Promise.all(operations.map(officialState));
    if (refusal?.code === "PROPOSAL_REVIEW_CONFLICT" && JSON.stringify(current) === JSON.stringify(attempt.before)) {
      const refreshed = await Promise.all(operations.map((operation) => operation.opType === "create"
        ? operation
        : testcaseUpdateProposal(human, projectId, operation.testcaseId, operation.fields, operation.opType)));
      attempt = await stageAndSave(refreshed);
    }
  }
  expect(attempt.saved.ok(), await attempt.saved.text()).toBe(true);
  const published = await attempt.saved.json();
  expect(published.saveReceipt).toMatchObject({ principalKind: "human_session", reviewerId: expect.any(String) });
  expect(published.savedCount).toBe(operations.length);
  return { staged: attempt.staged, reviewed: attempt.reviewed, published };
}

/** Fetch the exact target revision for an explicitly requested successful proposal fixture. */
export async function testcaseUpdateProposal(
  human: APIRequestContext, projectId: string, testcaseId: string,
  fields: Record<string, unknown>, opType: "update" | "archive" = "update",
): Promise<TestcaseProposalOperation> {
  const response = await human.get(`/api/projects/${projectId}/testcases/${testcaseId}`);
  expect(response.ok(), await response.text()).toBe(true);
  const current = await response.json();
  expect(current.editRevision).toMatch(/^[a-f0-9]{64}$/);
  return { opType, testcaseId, expectedRevision: current.editRevision, fields };
}
