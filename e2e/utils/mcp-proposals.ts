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
  const before = await Promise.all(operations.map(officialState));
  const response = await machine.post(`${base}/mcp`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { jsonrpc: "2.0", id: 1, method: "tools/call", params: {
      name: "stage_testcase_changes", arguments: { requestKey: randomUUID(), operations }
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
  expect(await Promise.all(operations.map(officialState))).toEqual(before);
  const taskEndpoint = `${base}/agents/zyra/tasks/${staged.taskId}`;
  const read = await human.get(taskEndpoint);
  expect(read.ok(), await read.text()).toBe(true);
  const reviewed = await read.json();
  expect(reviewed.proposalRevision).toBe(staged.task.proposalRevision);
  expect(reviewed.proposalSnapshot).toBeTruthy();
  const saved = await human.post(`${taskEndpoint}/save`, {
    data: { expectedProposalRevision: reviewed.proposalRevision, selectedDraftIndexes: operations.map((_, index) => index) },
  });
  expect(saved.ok(), await saved.text()).toBe(true);
  const published = await saved.json();
  expect(published.saveReceipt).toMatchObject({ principalKind: "human_session", reviewerId: expect.any(String) });
  expect(published.savedCount).toBe(operations.length);
  return { staged, reviewed, published };
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
