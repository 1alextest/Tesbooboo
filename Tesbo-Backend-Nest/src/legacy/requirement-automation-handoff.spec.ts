import { randomUUID } from "node:crypto";
import type { DatabaseService } from "../database/database.service";
import { makeLegacy } from "./test-helpers/legacy-service.fixture";

const project = randomUUID(), task = randomUUID(), reviewer = randomUUID(), operationId = randomUUID();
const requirementOperationId = randomUUID(), submitted = randomUUID();
const selection = {
  receiptId: randomUUID(), proposalRevision: "a".repeat(64), selectedIndex: 1,
  requirementId: randomUUID(), requirementVersionId: randomUUID(), linkId: randomUUID(),
  testcaseId: randomUUID(), testcaseRevision: "b".repeat(64), testcaseApprovalRevision: "c".repeat(64), criterionKeys: ["AC-1"]
};
const human = { kind: "human_session" } as const;

function fixture(appliedSemanticRevision = selection.testcaseApprovalRevision, member = true,
  steps: unknown = JSON.stringify([{ step: "Call the booking", expected: "Exactly one notice" }]), framework = " PlayWright ") {
  const receipt = {
    reviewerId: reviewer, proposalRevision: selection.proposalRevision,
    proposalSnapshot: { operations: [
      { opType: "requirement_revision", operationId: requirementOperationId },
      { opType: "testcase_create", operationId },
      { opType: "requirement_case_link", requirementOperationId, testcaseOperationId: operationId, criterionKeys: ["AC-1"] }
    ] },
    testcase: { id: selection.testcaseId, approvalRevision: appliedSemanticRevision },
    requirement: { documentId: selection.requirementId, versionId: submitted },
    link: { testcaseId: selection.testcaseId, requirementVersionId: submitted, criterionKeys: ["AC-1"] }
  };
  const row = {
    id: selection.testcaseId, receipt, reviewed_version_id: selection.requirementVersionId,
    version_metadata: { sourceVersionId: submitted, criteria: [{ key: "AC-1", text: "Exactly one notice" }] },
    criterion_keys: ["AC-1"], requirement_version_id: selection.requirementVersionId, testcase_revision: selection.testcaseRevision,
    testcase_approval_revision: selection.testcaseApprovalRevision, current_edit_revision: selection.testcaseRevision,
    current_approval_revision: selection.testcaseApprovalRevision, approval_current: true,
    title: "Check a repeated request", steps, automation_framework: framework, automation_repo: "acme/app", automation_path: "e2e/case.spec.ts",
    proposal_provenance: { kind: "api_token", issuerId: reviewer, tokenId: randomUUID(), actorId: null, futurePrivateField: "never export" }
  };
  const query = jest.fn(async (sql: string) => {
    if (sql.includes("FROM projects p JOIN project_members")) return { rows: member ? [{ caller_role: "qa_engineer" }] : [] };
    if (sql.includes("FROM ai_generation_requests")) return { rows: [row] };
    throw new Error("Unexpected database action");
  });
  const transaction = jest.fn(async (work: (client: { query: typeof query }) => Promise<unknown>) => work({ query }));
  const service = makeLegacy({ transaction } as unknown as DatabaseService);
  return { query, service, transaction };
}

describe("automation handoff from a human-applied requirement bundle", () => {
  it("projects the requirement receipt without its raw historical sibling and preserves generic task behavior", async () => {
    const events = [{ action: "requirement_bundle_apply", id: selection.receiptId, decisionKey: "SENTINEL",
      requirement: { documentId: selection.requirementId, versionId: submitted } }];
    const readRow = (provider: string) => ({ id: task, provider, save_events: events, proposal_snapshot: {},
      generated_payload: provider === "external_requirement_proposal" ? [{ opType: "requirement_revision", operationId: requirementOperationId }] : [] });
    const query = jest.fn().mockResolvedValueOnce({ rows: [readRow("external_requirement_proposal")] })
      .mockResolvedValueOnce({ rows: [readRow("external_testcase_proposal")] })
      .mockResolvedValueOnce({ rows: [readRow("external_requirement_proposal"), readRow("external_testcase_proposal")] });
    const service = makeLegacy({ query } as unknown as DatabaseService);
    jest.spyOn(service, "requireProjectAccess").mockResolvedValue({ id: project } as never);
    const bundle = await service.requirementProposalTask(project, reviewer, task);
    expect(bundle.requirementApplyReceipt.requirement.versionId).toBe(submitted);
    expect(bundle.proposalSnapshot.operations[0].operationId).toBe(requirementOperationId);
    expect(bundle).not.toHaveProperty("saveEvents");
    expect(JSON.stringify(bundle)).not.toContain("SENTINEL");
    const generic = await service.zyraTask(project, reviewer, task);
    expect(generic.saveEvents).toEqual(events);
    const { list } = await service.aiHistory(project, reviewer, {});
    expect(list[0].requirementApplyReceipt).toEqual(bundle.requirementApplyReceipt);
    expect(list[0]).not.toHaveProperty("saveEvents");
    expect(JSON.stringify(list[0])).not.toContain("SENTINEL");
    expect(list[1].saveEvents).toEqual(events);
  });

  it("exports only the current case selected by the receipt with attributable producer fields", async () => {
    const { service } = fixture();
    const result = await service.requirementAutomationHandoff(project, reviewer, task, selection, human);
    expect(result).toMatchObject({ ...selection, criteria: [{ key: "AC-1", text: "Exactly one notice" }],
      provenance: { reviewerId: reviewer, operationId, submittedVersionId: submitted, producer: { kind: "api_token" } } });
    expect(result.provenance.producer).not.toHaveProperty("futurePrivateField");
    expect(result.testcase.steps).toEqual([{ stepNumber: 1, action: "Call the booking", expectedResult: "Exactly one notice" }]);
  });

  it.each([
    { step: { stepNumber: 1, action: "Call", expectedResult: "One notice", extension: { privateValue: "SENTINEL" } } },
    { step: { kind: "sharedSteps", sharedStepId: "SENTINEL", action: "Call", expectedResult: "One notice" } },
    { step: { action: { privateValue: "SENTINEL" }, expectedResult: "One notice" } },
    { step: { action: "Call", expected: "Two notices", expectedResult: "One notice" } },
    { step: "legacy step without an independent expected result" }
  ])("withholds an unsupported step without exporting extended data", async ({ step }) => {
    const { service } = fixture(undefined, true, [step]);
    await expect(service.requirementAutomationHandoff(project, reviewer, task, selection, human))
      .rejects.toMatchObject({ status: 409, response: { code: "AUTOMATION_HANDOFF_UNAVAILABLE" } });
  });

  it("withholds a target reviewed for Cypress from this Playwright handoff", async () => {
    const { service } = fixture(undefined, true, undefined, "Cypress");
    await expect(service.requirementAutomationHandoff(project, reviewer, task, selection, human))
      .rejects.toMatchObject({ status: 409, response: { code: "AUTOMATION_HANDOFF_UNAVAILABLE" } });
  });

  it("refuses an edited and reapproved case even when its current requirement and link are fully approved", async () => {
    const { service } = fixture("d".repeat(64));
    await expect(service.requirementAutomationHandoff(project, reviewer, task, selection, human))
      .rejects.toMatchObject({ status: 409, response: { code: "AUTOMATION_HANDOFF_UNAVAILABLE" } });
  });

  it("rejects a different project member context before loading the receipt or case", async () => {
    const { service, query } = fixture(undefined, false);
    await expect(service.requirementAutomationHandoff(project, reviewer, task, selection, human)).rejects.toMatchObject({ status: 403 });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("requires a human session before reading the database", async () => {
    const { service, transaction } = fixture();
    await expect(service.requirementAutomationHandoff(project, reviewer, task, selection, { kind: "api_token" }))
      .rejects.toMatchObject({ status: 403 });
    expect(transaction).not.toHaveBeenCalled();
  });
});
