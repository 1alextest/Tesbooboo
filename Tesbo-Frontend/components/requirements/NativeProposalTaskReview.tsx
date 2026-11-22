"use client";

import Link from "next/link";
import type { ZyraTask } from "@/lib/api";
import { nativeStagedOperations, type NativeStagedOperation } from "@/lib/nativeRequirements";
import { Card } from "@/components/ui";
import { formatDateTime } from "@/lib/date";

const linkClass = "font-medium text-[var(--accent-light)] underline underline-offset-2";
const string = (value: unknown) => typeof value === "string" ? value : "";
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const rows = (value: unknown): Record<string, unknown>[] => Array.isArray(value) ? value.map(object) : [];
function stepRows(value: unknown): Record<string, unknown>[] | null {
  if (value === undefined) return [];
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed.map(object) : null;
  } catch { return null; }
}
const labels: Record<string, string> = {
  requirement_revision: "Requirement candidate revision",
  requirement_case_link: "Proposed case association",
  testcase_revision: "Case candidate revision",
  withdraw_requirement: "Requirement proposal withdrawn",
  withdraw_link: "Proposed association withdrawn",
};

function OperationContent({ operation, projectId }: { operation: NativeStagedOperation; projectId: string }) {
  const payload = operation.payload;
  if (operation.operationKind === "requirement_revision") return <div className="space-y-2">
    <h4 className="font-semibold">{string(payload.title) || "Untitled requirement candidate"}</h4>
    {string(payload.description) && <p className="whitespace-pre-wrap text-sm">{string(payload.description)}</p>}
    <ul className="space-y-1 text-sm">{rows(payload.criteria).map((criterion, index) => <li key={`${string(criterion.key)}-${index}`}><strong>{string(criterion.key)}:</strong> {string(criterion.text)}</li>)}</ul>
    {string(payload.rationale) && <p className="whitespace-pre-wrap text-sm"><strong>Rationale: </strong>{string(payload.rationale)}</p>}
    {rows(payload.sourceRefs).length > 0 && <ul className="space-y-1 text-sm">{rows(payload.sourceRefs).map((source, index) => <li key={index}>{/^https?:\/\//i.test(string(source.url))
      ? <a href={string(source.url)} target="_blank" rel="noopener noreferrer" className={linkClass}>{string(source.label) || string(source.url)}</a>
      : <span>{string(source.label)} {string(source.url)}</span>}</li>)}</ul>}
  </div>;
  if (operation.operationKind === "requirement_case_link") {
    const snapshot = object(payload.caseSnapshot);
    return <div className="space-y-2 text-sm">
      <Link href={`/projects/${projectId}/testcases/${encodeURIComponent(string(payload.testcaseId))}`} className={linkClass}>{string(snapshot.externalId) || string(payload.testcaseId)}: {string(snapshot.title) || "Inspect saved testcase"}</Link>
      <p>Criteria: {Array.isArray(payload.criterionKeys) ? payload.criterionKeys.map(string).join(", ") : "Unavailable"}</p>
      <p className="break-all text-xs">Requirement proposal operation: {string(payload.requirementVersionId) || "Unavailable"}</p>
      <p className="break-all text-xs">Exact testcase revision: {string(payload.testcaseRevision) || "Unavailable"}</p>
      <p className="break-all text-xs">Exact testcase approval revision: {string(payload.testcaseApprovalRevision) || "No approval was bound"}</p>
      <p className="text-[var(--muted)]">This is an inert link intent. It has not created an active requirement relation or coverage.</p>
    </div>;
  }
  if (operation.operationKind === "testcase_revision") return <ul className="space-y-3 text-sm">{rows(payload.operations).map((candidate, index) => {
    const fields = object(candidate.draft || candidate.fields);
    const steps = stepRows(fields.steps ?? fields.stepsJson);
    const basis = object(candidate.requirementBasis);
    return <li key={index} className="space-y-1 border-l-2 border-[var(--border)] pl-3">
      <p><strong>{string(candidate.opType) || "Case change"}: </strong>{string(fields.title) || string(candidate.testcaseId) || "Untitled case candidate"}</p>
      {string(basis.versionId) && <p className="break-all text-xs">Requirement proposal operation: {string(basis.versionId)} · Criteria: {Array.isArray(basis.criterionKeys) ? basis.criterionKeys.map(string).join(", ") : "Unavailable"}</p>}
      {string(fields.description) && <p className="whitespace-pre-wrap">{string(fields.description)}</p>}
      {([["preconditions", "Preconditions"], ["testData", "Test data"], ["postconditions", "Postconditions and cleanup"]] as const).map(([field, label]) => string(fields[field]) && <p key={field} className="whitespace-pre-wrap"><strong>{label}: </strong>{string(fields[field])}</p>)}
      {steps === null ? <p className="text-[var(--error-foreground)]">The saved step content could not be read. Inspect the exact operation details.</p> : steps.length > 0 && <ol className="list-decimal space-y-2 pl-5">{steps.map((step, stepIndex) => <li key={stepIndex}><p className="whitespace-pre-wrap">{string(step.action)}</p><p className="whitespace-pre-wrap text-[var(--muted)]"><strong>Expected: </strong>{string(step.expectedResult)}</p></li>)}</ol>}
      {string(candidate.reason) && <p><strong>Reason: </strong>{string(candidate.reason)}</p>}
      {string(candidate.targetEditRevision) && <p className="break-all text-xs">Testcase revision used when staging: {string(candidate.targetEditRevision)}</p>}
    </li>;
  })}</ul>;
  if (operation.operationKind === "withdraw_requirement" || operation.operationKind === "withdraw_link") return <p className="text-sm">Withdrawal is recorded separately. The original staged content and its authoring history remain available below.</p>;
  return <p className="text-sm">Inspect the saved operation details below. This operation is part of the exact proposal revision.</p>;
}

/** One review surface for the shared task, including requirement-only and link-only stages. */
export default function NativeProposalTaskReview({ task, projectId }: { task: ZyraTask; projectId: string }) {
  const operations = nativeStagedOperations(task);
  return <Card className="space-y-4 p-4" data-testid="native-shared-proposal-review">
    <div><h2 className="font-semibold">Shared proposal review</h2><p className="mt-1 text-sm text-[var(--muted)]">Review requirement candidates, case changes and proposed associations together. These saved operations have not published a Knowledge Base requirement, an official case change or an active requirement link.</p></div>
    <p className="break-all text-xs">Exact proposal revision: {task.proposalRevision || "Unavailable"}</p>
    <h3 className="text-sm font-semibold">Immutable proposal history</h3>
    {operations === null ? <p role="alert" className="text-sm text-[var(--error-foreground)]">The saved operation history could not be verified. Reload this task before reviewing its content.</p>
      : operations.length === 0 ? <p className="text-sm text-[var(--muted)]">This proposal contains no saved operations.</p>
      : <ol className="space-y-4">{operations.map(operation => <li key={operation.id} id={`proposal-operation-${operation.id}`} data-testid={`native-staged-operation-${operation.id}`} className="space-y-3 scroll-mt-24 rounded-lg border border-[var(--border)] p-3">
        <div><h3 className="text-sm font-semibold">{labels[operation.operationKind] || "Saved proposal operation"}</h3><p className="mt-1 text-xs text-[var(--muted)]">Saved {formatDateTime(operation.createdAt)} · operation {operation.sequence}</p></div>
        <OperationContent operation={operation} projectId={projectId} />
        <details className="text-sm"><summary className="cursor-pointer font-medium">Exact operation and authoring details</summary><pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(operation, null, 2)}</pre></details>
      </li>)}</ol>}
  </Card>;
}
