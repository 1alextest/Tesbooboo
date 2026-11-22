import { api, type ZyraTask } from "@/lib/api";

/** Staged task/operation projections. No ID below is an official KB document/version identity. */
export interface NativeRequirementCriterion {
  key: string;
  text: string;
}

export interface NativeRequirementContent {
  title: string;
  description: string;
  criteria: NativeRequirementCriterion[];
  rationale: string;
  sourceRefs: Array<{ label: string; url: string }>;
}

export interface NativeRequirementProvenance {
  kind: "human_session" | "api_token";
  issuerId: string;
  tokenId: string | null;
  transport: "rest" | "mcp" | null;
  actorId: string | null;
  principalKey: string;
}

export interface NativeRequirementVersion extends NativeRequirementContent {
  id: string;
  identityKind: "proposal_operation";
  operationId: string;
  nativeVersionId: null;
  requirementId: string;
  versionNumber: number;
  parentVersionId: string | null;
  contentDigest: string;
  governance: {
    policy: "unpublished_proposals_only";
    skillContext: { status: "unavailable"; resolvedAt: null };
  };
  provenance: NativeRequirementProvenance;
  createdBy: string | null;
  createdAt: string;
}

export interface NativeRequirementCapability {
  mode: "unpublished_proposals_only";
  enabled: boolean;
  skillResolution: "unavailable";
  canApprove: false;
  canPublishCases: false;
  canStageCaseProposals: boolean;
}

export interface NativeRequirementProposal {
  id: string;
  identityKind: "proposal_task";
  taskId: string;
  nativeDocumentId: null;
  key: string;
  projectId: string;
  state: "draft" | "retired";
  publication: "unpublished";
  currentVersion: NativeRequirementVersion;
  createdAt: string;
  updatedAt: string;
  retirementProvenance: NativeRequirementProvenance | null;
}

export interface NativeRequirementLink {
  id: string;
  identityKind: "proposal_operation";
  state: "proposed";
  submissionKey: string;
  requirementId: string;
  requirementVersionId: string;
  requirementContentDigest: string;
  criterionKeys: string[];
  testcaseId: string;
  testcaseRevision: string;
  testcaseApprovalRevision: string | null;
  createdAt: string;
  provenance: NativeRequirementProvenance;
  createdBy: string | null;
  retiredAt: string | null;
  retiredBy: string | null;
  retirementProvenance: NativeRequirementProvenance | null;
  caseSnapshot: Record<string, unknown>;
  staleReasons: string[];
  current: boolean;
  case: {
    id: string;
    externalId: string;
    title: string;
    status: string;
    editRevision: string;
    approvalRevision: string | null;
    approvalCurrent: boolean;
  } | null;
}

export interface NativeRequirementCoverage {
  requirementId: string;
  requirementVersionId: string;
  proposedLinkCount: number;
  currentProposedLinkCount: number;
  staleProposedLinkCount: number;
  staleReasons: string[];
  approval: { status: "blocked"; eligibleCount: 0; reason: "SKILL_CONTEXT_UNAVAILABLE" };
  execution: { status: "unavailable"; eligibleCount: null; reason: "REQUIREMENT_EXECUTION_APPLICABILITY_UNAVAILABLE" };
  passing: { status: "unavailable"; eligibleCount: null; reason: "REQUIREMENT_EXECUTION_APPLICABILITY_UNAVAILABLE" };
}

export interface NativeCaseProposalSummary {
  id: string;
  taskStatus: string;
  title: string;
  requirementVersionId: string;
  criterionKeys: string[];
  createdAt: string;
  reviewPath: string;
}

export interface NativeRequirementDetail {
  requirement: NativeRequirementProposal;
  versions: NativeRequirementVersion[];
  links: NativeRequirementLink[];
  caseProposals: NativeCaseProposalSummary[];
  coverage: NativeRequirementCoverage;
  capability: NativeRequirementCapability;
}

export type NativeRequirementSubmission = NativeRequirementDetail & { submission: { versionId: string; replayed: boolean } };

export interface NativeRequirementTaskGovernance {
  schemaVersion: 1;
  policy: "unpublished_proposals_only";
  requirement: {
    id: string;
    key: string;
    versionId: string;
    contentDigest: string;
    criterionKeys: string[];
    criteria: NativeRequirementCriterion[];
  };
  skillContext: { status: "unavailable"; resolvedAt: null };
  publication: { status: "blocked"; reason: "SKILL_CONTEXT_UNAVAILABLE" };
}

export type NativeRequirementTask = ZyraTask & {
  proposalGovernance?: NativeRequirementTaskGovernance;
  publicationBlocked?: { code: string; reason: string; error: string };
  proposalSubmission?: { operationId: string; replayed: boolean };
};

export interface NativeStagedOperation {
  id: string;
  operationId: string;
  identityKind: "proposal_operation";
  operationKind: string;
  sequence: number;
  payload: Record<string, unknown>;
  contentDigest: string;
  provenance: NativeRequirementProvenance;
  createdAt: string;
}

/** A partial/malformed read is unavailable evidence, not an empty proposal history. */
export function nativeStagedOperations(task: ZyraTask): NativeStagedOperation[] | null {
  const operations = task.proposalSnapshot?.stagedOperations;
  if (!Array.isArray(operations) || operations.some(operation => !operation || typeof operation !== "object" ||
    operation.identityKind !== "proposal_operation" || typeof operation.id !== "string" ||
    typeof operation.operationKind !== "string" || !operation.payload || typeof operation.payload !== "object" ||
    Array.isArray(operation.payload))) return null;
  return operations as NativeStagedOperation[];
}

/** Runtime checks keep an older task without this new metadata on its existing workflow. */
export function nativeRequirementTaskGovernance(task: ZyraTask | null): NativeRequirementTaskGovernance | null {
  const governance = (task as NativeRequirementTask | null)?.proposalGovernance;
  return governance?.schemaVersion === 1 && governance.policy === "unpublished_proposals_only" &&
    governance.requirement && typeof governance.requirement.id === "string" &&
    Array.isArray(governance.requirement.criteria)
    ? governance : null;
}

export interface NativeCaseFields {
  title: string;
  description: string;
  preconditions: string;
  postconditions: string;
  testData: string;
  steps: Array<{ action: string; expectedResult: string }>;
}

export type NativeCaseProposalOperation =
  | { opType: "create"; draft: NativeCaseFields; reason: string }
  | { opType: "update"; testcaseId: string; expectedRevision: string; fields: NativeCaseFields; reason: string }
  | { opType: "archive"; testcaseId: string; expectedRevision: string; reason: string };

export function nativeRequirementPath(projectId: string, requirementId: string, versionId?: string): string {
  const query = new URLSearchParams({ view: "native", requirement: requirementId });
  if (versionId) query.set("version", versionId);
  return `/projects/${projectId}/requirements?${query}`;
}

const base = (projectId: string) => `/api/projects/${projectId}/requirements`;

export function listNativeRequirements(projectId: string, offset = 0, signal?: AbortSignal) {
  return api<{ list: NativeRequirementProposal[]; total: number; capability: NativeRequirementCapability }>(
    `${base(projectId)}?limit=25&offset=${offset}`, { signal },
  );
}

export function getNativeRequirement(projectId: string, requirementId: string, signal?: AbortSignal) {
  return api<NativeRequirementDetail>(`${base(projectId)}/${encodeURIComponent(requirementId)}`, { signal });
}

export function createNativeRequirement(projectId: string, content: NativeRequirementContent & { submissionKey: string }) {
  return api<NativeRequirementSubmission>(base(projectId), { method: "POST", body: content });
}

export function reviseNativeRequirement(
  projectId: string,
  requirementId: string,
  content: NativeRequirementContent & { submissionKey: string; expectedVersionId: string; expectedContentDigest: string },
) {
  return api<NativeRequirementSubmission>(`${base(projectId)}/${encodeURIComponent(requirementId)}/revisions`, { method: "POST", body: content });
}

export interface NativeRequirementAssociationInput {
  submissionKey: string;
  requirementVersionId: string;
  requirementContentDigest: string;
  criterionKeys: string[];
  testcaseId: string;
  testcaseRevision: string;
  testcaseApprovalRevision: string | null;
}

export function linkNativeRequirement(projectId: string, requirementId: string, body: NativeRequirementAssociationInput) {
  return api<{ link: NativeRequirementLink; coverage: NativeRequirementCoverage; submission: { linkId: string; replayed: boolean } }>(
    `${base(projectId)}/${encodeURIComponent(requirementId)}/links`, { method: "POST", body },
  );
}

export function retireNativeRequirementLink(projectId: string, requirementId: string, linkId: string) {
  return api<{ link: NativeRequirementLink; coverage: NativeRequirementCoverage }>(
    `${base(projectId)}/${encodeURIComponent(requirementId)}/links/${encodeURIComponent(linkId)}/retire`,
    { method: "POST", body: {} },
  );
}

export function stageNativeRequirementCases(
  projectId: string,
  requirementId: string,
  body: {
    requirementVersionId: string;
    requirementContentDigest: string;
    criterionKeys: string[];
    requestKey: string;
    title: string;
    operations: NativeCaseProposalOperation[];
  },
) {
  return api<{ publication: "unpublished"; taskId: string; task: NativeRequirementTask; reviewPath: string }>(
    `${base(projectId)}/${encodeURIComponent(requirementId)}/case-proposals`, { method: "POST", body },
  );
}
