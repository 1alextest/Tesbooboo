import { expect, type APIRequestContext } from "@playwright/test";

/** Explicit human review fixture; never intercepts or rewrites a product request. */
export async function approveTestcase(
  human: APIRequestContext,
  projectId: string,
  testcaseId: string,
  apiOrigin = "",
): Promise<Record<string, any>> {
  const endpoint = `${apiOrigin}/api/projects/${projectId}/testcases/${testcaseId}`;
  const read = await human.get(endpoint);
  expect(read.status(), await read.text()).toBe(200);
  const reviewed = await read.json();
  expect(reviewed.editRevision).toMatch(/^[a-f0-9]{64}$/);
  expect(reviewed.approvalRevision).toMatch(/^[a-f0-9]{64}$/);
  expect(reviewed.approvalSnapshot).toBeTruthy();
  const approval = await human.post(`${endpoint}/approve`, {
    data: {
      expectedRevision: reviewed.editRevision,
      expectedApprovalRevision: reviewed.approvalRevision,
    },
    failOnStatusCode: false,
  });
  expect(approval.ok(), await approval.text()).toBe(true);
  const current = await human.get(endpoint);
  expect(current.status(), await current.text()).toBe(200);
  const saved = await current.json();
  expect(saved.status).toBe("Approved");
  return saved;
}

/** Existing success scenarios that need an eligible case use the real draft → review route. */
export async function createApprovedTestcase(
  human: APIRequestContext,
  projectId: string,
  data: Record<string, unknown>,
): Promise<Record<string, any>> {
  const created = await human.post(`/api/projects/${projectId}/testcases`, {
    data: { ...data, status: "Draft" },
  });
  expect(created.status(), await created.text()).toBe(201);
  const testcase = await created.json();
  return approveTestcase(human, projectId, testcase.id);
}

/** Fixture setup only: keep the create response while explicitly reviewing requested Approved fixtures. */
export async function createTestcaseFixtureResponse(
  human: APIRequestContext,
  endpoint: string,
  options: Parameters<APIRequestContext["post"]>[1],
) {
  const parsed = new URL(endpoint, "http://fixture.invalid");
  const match = /^\/api\/projects\/([^/]+)\/testcases$/.exec(parsed.pathname);
  if (!match || !options || typeof options.data !== "object" || options.data === null) {
    throw new Error("Testcase fixture needs a project testcase endpoint and object data");
  }
  const data = options.data as Record<string, unknown>;
  const wantsApproval = data.status === "Approved";
  const response = await human.post(endpoint, {
    ...options, data: wantsApproval ? { ...data, status: "Draft" } : data,
  });
  if (wantsApproval && response.ok()) {
    await approveTestcase(human, match[1], (await response.json()).id,
      /^https?:\/\//.test(endpoint) ? parsed.origin : "");
  }
  return response;
}
