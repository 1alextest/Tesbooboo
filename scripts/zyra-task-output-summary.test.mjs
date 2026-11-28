import assert from "node:assert/strict";
import test from "node:test";
import { summarizeZyraTaskOutput } from "../Tesbo-Frontend/lib/zyra-task-output-summary.ts";

const requirement = { opType: "requirement_revision", title: "Requirement adjustment" };
const candidate = { opType: "testcase_create", draft: { title: "Case candidate" } };
const link = { opType: "requirement_case_link", criterionKeys: ["AC-1"] };
const bundle = {
  provider: "external_requirement_proposal", generatedCount: 3, savedCount: 0,
  requirementBundle: [requirement, candidate, link], requirementApplyReceipt: null
};

test("WPB-04: three staged operations are not three generated test cases", () => {
  const actual = summarizeZyraTaskOutput(bundle);
  assert.equal(actual.isRequirementBundle, true);
  assert.equal(actual.operationCount, 3);
  assert.equal(actual.caseCandidates, 1);
  assert.equal(actual.createdDraftCases, 0);
  assert.equal(actual.primary, "3 proposal operations");
  assert.equal(actual.secondary, "1 case candidate · 0 Draft cases created");
  assert.doesNotMatch(actual.primary, /test cases/);
});

test("a native apply receipt, not done or saved_count, proves that a Draft case was created", () => {
  const completedWithoutReceipt = summarizeZyraTaskOutput({ ...bundle, savedCount: 3 });
  assert.equal(completedWithoutReceipt.createdDraftCases, 0);
  const completedWithReceipt = summarizeZyraTaskOutput({
    ...bundle, requirementApplyReceipt: { testcase: { id: "case-001" } }
  });
  assert.equal(completedWithReceipt.createdDraftCases, 1);
  assert.equal(completedWithReceipt.secondary, "1 case candidate · 1 Draft case created");
});

test("ordinary generation retains ordinary case counts", () => {
  const actual = summarizeZyraTaskOutput({
    provider: "openai", generatedCount: 3, requirementBundle: undefined,
    requirementApplyReceipt: null
  });
  assert.equal(actual.isRequirementBundle, false);
  assert.equal(actual.primary, "3 test cases");
  assert.equal(actual.secondary, "");
});

test("a malformed requirement bundle must not invent an operation or case count", () => {
  const actual = summarizeZyraTaskOutput({
    provider: "external_requirement_proposal", generatedCount: 3,
    requirementBundle: undefined, requirementApplyReceipt: null
  });
  assert.equal(actual.isRequirementBundle, true);
  assert.equal(actual.statValue, "—");
  assert.equal(actual.primary, "Proposal details unavailable");
  assert.equal(actual.caseCandidates, null);
});

test("typed requirement operations are recognized even for an unusual provider", () => {
  const actual = summarizeZyraTaskOutput({
    provider: "legacy", generatedCount: 2,
    requirementBundle: [requirement, candidate], requirementApplyReceipt: null
  });
  assert.equal(actual.operationCount, 2);
  assert.equal(actual.caseCandidates, 1);
});


test("manual/policy proposals are not test cases and require actual native apply receipts", () => {
  const manual = {
    provider: "external_document_proposal", generatedCount: 1, savedCount: 1,
    taskStatus: "done", requirementBundle: undefined, requirementApplyReceipt: null,
    managedDocumentProposal: { operation: "update", documentType: "user_manual", applyReceipt: null }
  };
  const before = summarizeZyraTaskOutput(manual);
  assert.equal(before.isManagedDocumentProposal, true);
  assert.equal(before.isRequirementBundle, false);
  assert.equal(before.caseCandidates, 0);
  assert.equal(before.createdDraftCases, 0);
  assert.equal(before.nativeDocumentApplyReceipt, false);
  assert.equal(before.primary, "1 user manual update proposal");
  assert.equal(before.secondary, "No native document apply receipt");
  assert.doesNotMatch(before.primary, /test case/);
  const after = summarizeZyraTaskOutput({ ...manual, managedDocumentProposal: {
    ...manual.managedDocumentProposal, applyReceipt: { document: { documentId: "doc-1", operation: "update" } }
  } });
  assert.equal(after.nativeDocumentApplyReceipt, true);
  assert.equal(after.secondary, "Native document apply receipt recorded");
});

test("policy create, missing document data and conflicting type fail closed", () => {
  const policy = summarizeZyraTaskOutput({
    provider: "external_document_proposal", generatedCount: 1,
    managedDocumentProposal: { operation: "create", documentType: "policy", applyReceipt: null }
  });
  assert.equal(policy.primary, "1 policy create proposal");
  assert.equal(policy.operationCount, 1);
  const missing = summarizeZyraTaskOutput({
    provider: "external_document_proposal", generatedCount: 1, managedDocumentProposal: undefined
  });
  assert.equal(missing.statValue, "—");
  assert.equal(missing.caseCandidates, null);
  assert.equal(missing.nativeDocumentApplyReceipt, null);
  const conflicting = summarizeZyraTaskOutput({
    provider: "external_document_proposal", generatedCount: 3,
    requirementBundle: [requirement], managedDocumentProposal: { operation: "create", documentType: "policy" }
  });
  assert.equal(conflicting.primary, "Conflicting proposal types");
  assert.equal(conflicting.statValue, "—");
  assert.equal(conflicting.isManagedDocumentProposal, true);
});
