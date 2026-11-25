import type { ZyraTask } from "./api";

/**
 * Task-board counts must describe the kind of artifact represented by the
 * persisted payload. The legacy generated_count is a count of operations for
 * external requirement bundles, not a count of generated test cases.
 *
 * An apply receipt, not saved_count or a task's "done" status, establishes
 * whether a case candidate reached the native repository as a Draft.
 */
export function summarizeZyraTaskOutput(task: Pick<ZyraTask,
  "provider" | "requirementBundle" | "requirementApplyReceipt" | "generatedCount">) {
  const entries = Array.isArray(task.requirementBundle) ? task.requirementBundle : [];
  const isRequirementBundle = task.provider === "external_requirement_proposal" ||
    entries.some(entry => ["requirement_revision", "testcase_create", "requirement_case_link"].includes(String(entry?.opType || "")));
  if (!isRequirementBundle) {
    const count = task.generatedCount;
    return {
      isRequirementBundle: false as const,
      operationCount: 0,
      caseCandidates: count,
      createdDraftCases: null,
      primary: `${count} test case${count === 1 ? "" : "s"}`,
      secondary: "",
      statValue: String(count)
    };
  }
  if (entries.length === 0) {
    // A damaged/legacy payload cannot be converted from generated_count into
    // testcase or operation certainty merely because the provider is known.
    return {
      isRequirementBundle: true as const,
      operationCount: null,
      caseCandidates: null,
      createdDraftCases: task.requirementApplyReceipt?.testcase?.id ? 1 : 0,
      primary: "Proposal details unavailable",
      secondary: "Counts cannot be verified",
      statValue: "—"
    };
  }
  const count = entries.length;
  const candidateCount = entries.filter(entry => entry?.opType === "testcase_create").length;
  const created = task.requirementApplyReceipt?.testcase?.id ? 1 : 0;
  return {
    isRequirementBundle: true as const,
    operationCount: count,
    caseCandidates: candidateCount,
    createdDraftCases: created,
    primary: `${count} proposal operation${count === 1 ? "" : "s"}`,
    secondary: `${candidateCount} case candidate${candidateCount === 1 ? "" : "s"} · ${created} Draft case${created === 1 ? "" : "s"} created`,
    statValue: String(count)
  };
}
