import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, NotImplementedException } from "@nestjs/common";
import type { PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import { type TestcaseProposalPrincipal } from "../legacy/testcase-proposal-review";

type Body = Record<string, any>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIGEST = /^[a-f0-9]{64}$/;
const CRITERION_KEY = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;
export const REQUIREMENT_CONTENT_FIELDS = ["title", "description", "criteria", "rationale", "sourceRefs"] as const;

export function nativeRequirementsPreviewEnabled(): boolean {
  return process.env.TESBO_NATIVE_REQUIREMENTS_PREVIEW_ENABLED === "1";
}

export function nativeRequirementsCapability() {
  return {
    mode: "unpublished_proposals_only" as const,
    enabled: nativeRequirementsPreviewEnabled(),
    skillResolution: "unavailable" as const,
    canApprove: false,
    canPublishCases: false,
    canStageCaseProposals: nativeRequirementsPreviewEnabled() && process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED === "1"
  };
}

export function requireNativeRequirementsPreview(): void {
  if (!nativeRequirementsPreviewEnabled()) throw new NotImplementedException({
    code: "capability_unavailable", reason: "not_implemented",
    error: "Native requirement proposals are unavailable on this deployment."
  });
}

export function nativeRequirementGovernance() {
  return { policy: "unpublished_proposals_only" as const, skillContext: { status: "unavailable" as const, resolvedAt: null } };
}

export function nativeRequirementPublicationBlock() {
  return {
    code: "SKILL_CONTEXT_UNAVAILABLE", reason: "EFFECTIVE_SKILL_AUTHORITY_UNAVAILABLE",
    error: "This requirement-linked proposal is unpublished. Effective skill authority is unavailable; publication and approval are blocked."
  };
}

/** Every existing apply alias reaches this guard. Neither a preview flag nor a human role is authority. */
export function assertNativeRequirementPublicationAllowed(task: Body): void {
  if (task.proposal_governance != null || task.proposal_current_requirement_operation_id != null || Number(task.proposal_operation_sequence || 0) > 0) {
    throw new ForbiddenException(nativeRequirementPublicationBlock());
  }
}

export function closedObject(value: unknown, allowed: readonly string[], name = "body"): Body {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BadRequestException({ error: `${name} must be an object` });
  const object = value as Body;
  if (Object.keys(object).some(key => !allowed.includes(key))) throw new BadRequestException({ error: `${name} contains an unsupported field` });
  return object;
}

function text(value: unknown, name: string, max: number, required = false): string {
  if (value === undefined && !required) return "";
  if (typeof value !== "string") throw new BadRequestException({ error: `${name} must be a string` });
  const result = value.trim();
  if ((required && !result) || result.length > max) throw new BadRequestException({ error: `${name} must contain ${required ? "1" : "0"}–${max} characters` });
  return result;
}

export function requirementUuid(value: unknown, name: string): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new BadRequestException({ error: `${name} must be a UUID` });
  return value.toLowerCase();
}

export function requirementDigest(value: unknown, name: string): string {
  if (typeof value !== "string" || !DIGEST.test(value)) throw new BadRequestException({ error: `${name} must be an exact content digest` });
  return value;
}

export function requirementObjectId(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new NotFoundException({ error: "Requirement proposal not found" });
  return value.toLowerCase();
}

export function normalizeRequirementContent(body: Body) {
  const title = text(body.title, "title", 512, true);
  const description = text(body.description, "description", 20_000);
  const rationale = text(body.rationale, "rationale", 4_000);
  if (!Array.isArray(body.criteria) || body.criteria.length < 1 || body.criteria.length > 100) throw new BadRequestException({ error: "criteria must contain 1–100 criteria" });
  const keys = new Set<string>();
  const criteria = body.criteria.map((value: unknown) => {
    const criterion = closedObject(value, ["key", "text"], "criterion");
    if (typeof criterion.key !== "string" || !CRITERION_KEY.test(criterion.key) || keys.has(criterion.key)) {
      throw new BadRequestException({ error: "Each criterion needs a unique stable key of 1–64 letters, digits, dots, underscores or hyphens, starting with a letter" });
    }
    keys.add(criterion.key);
    return { key: criterion.key as string, text: text(criterion.text, "criterion text", 4_000, true) };
  });
  const rawSources = body.sourceRefs === undefined ? [] : body.sourceRefs;
  if (!Array.isArray(rawSources) || rawSources.length > 50) throw new BadRequestException({ error: "sourceRefs must contain at most 50 sources" });
  const sourceRefs = rawSources.map((value: unknown) => {
    const source = closedObject(value, ["label", "url"], "source reference");
    const label = text(source.label, "source label", 200, true), url = text(source.url, "source url", 2_048, true);
    // WHATWG URL parsing accepts shorthand and backslashes for special schemes. Require an
    // explicit authority here, then persist the same canonical representation the database accepts.
    if (!/^https?:\/\/[^/?#\s]+/i.test(url) || url.includes("\\")) throw new BadRequestException({ error: "source url must be an absolute HTTP or HTTPS URL without backslashes" });
    let parsed: URL;
    try { parsed = new URL(url); } catch { throw new BadRequestException({ error: "source url must be an absolute HTTP or HTTPS URL" }); }
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new BadRequestException({ error: "source url must use HTTP or HTTPS without embedded credentials" });
    if (parsed.href.length > 2_048) throw new BadRequestException({ error: "source url must contain at most 2048 characters after normalization" });
    return { label, url: parsed.href };
  });
  return { title, description, criteria, rationale, sourceRefs };
}

export function nativeRequirementBasis(body: Body) {
  const requirementVersionId = requirementUuid(body.requirementVersionId, "requirementVersionId");
  const requirementContentDigest = requirementDigest(body.requirementContentDigest, "requirementContentDigest");
  if (!Array.isArray(body.criterionKeys) || body.criterionKeys.length < 1 || body.criterionKeys.length > 100 ||
      body.criterionKeys.some((key: unknown) => typeof key !== "string" || !CRITERION_KEY.test(key)) || new Set(body.criterionKeys).size !== body.criterionKeys.length) {
    throw new BadRequestException({ error: "criterionKeys must contain 1–100 unique criterion keys" });
  }
  return { requirementVersionId, requirementContentDigest, criterionKeys: [...body.criterionKeys as string[]].sort() };
}

export function expectedRequirementHead(body: Body) {
  return { expectedVersionId: requirementUuid(body.expectedVersionId, "expectedVersionId"), expectedContentDigest: requirementDigest(body.expectedContentDigest, "expectedContentDigest") };
}

export function assertRequirementHead(requirement: Body, head: ReturnType<typeof expectedRequirementHead>) {
  if (requirement.current_version_id !== head.expectedVersionId || requirement.content_digest !== head.expectedContentDigest) {
    throw new ConflictException({ code: "REQUIREMENT_STALE_REVISION", error: "This requirement proposal changed. Reload and reconcile the current version before saving." });
  }
}

/** Uses the caller's transaction and project mutex; no client-supplied governance claims enter storage. */
export async function lockNativeRequirementBasis(client: PoolClient, projectId: string, requirementId: string, basis: ReturnType<typeof nativeRequirementBasis>) {
  const result = await client.query(`SELECT r.id,r.proposal_current_requirement_operation_id AS current_version_id,
    CASE WHEN r.task_status='done' THEN 'retired' ELSE 'draft' END AS state,
    v.id AS version_id,v.content_digest,v.payload->'criteria' AS criteria
    FROM ai_generation_requests r JOIN proposal_operations v ON v.task_id=r.id AND v.project_id=r.project_id
    WHERE r.id=$1 AND r.project_id=$2 AND v.id=$3 AND r.proposal_governance IS NOT NULL
      AND v.operation_kind='requirement_revision' FOR UPDATE OF r`, [requirementId, projectId, basis.requirementVersionId]);
  const row = result.rows[0];
  if (!row) {
    // A same-project operation from another proposal is a lineage conflict; foreign identifiers
    // remain opaque and receive the same not-found response as a missing identifier.
    const sibling = await client.query("SELECT 1 FROM proposal_operations WHERE id=$1 AND project_id=$2 AND operation_kind='requirement_revision'", [basis.requirementVersionId, projectId]);
    if (sibling.rows[0]) throw new ConflictException({ code: "REQUIREMENT_LINEAGE_MISMATCH", error: "This iteration belongs to a different requirement proposal task" });
    throw new NotFoundException({ error: "Requirement proposal version not found" });
  }
  if (row.state !== "draft") throw new ConflictException({ code: "REQUIREMENT_RETIRED", error: "This requirement proposal is retired" });
  if (row.current_version_id !== basis.requirementVersionId || row.content_digest !== basis.requirementContentDigest) {
    throw new ConflictException({ code: "REQUIREMENT_STALE_REVISION", error: "The exact current requirement proposal version is required" });
  }
  if (basis.criterionKeys.some(key => !row.criteria.some((criterion: Body) => criterion.key === key))) throw new BadRequestException({ error: "Every criterion key must belong to the selected requirement version" });
  return {
    schemaVersion: 1,
    ...nativeRequirementGovernance(),
    requirement: { id: row.id, taskId: row.id, identityKind: "proposal_task", nativeDocumentId: null,
      key: `REQ-PROP-${String(row.id).slice(0, 8)}`, versionId: row.version_id, operationId: row.version_id, nativeVersionId: null, contentDigest: row.content_digest,
      criterionKeys: basis.criterionKeys, criteria: row.criteria.filter((criterion: Body) => basis.criterionKeys.includes(criterion.key)) },
    publication: { status: "blocked", reason: "SKILL_CONTEXT_UNAVAILABLE" }
  };
}

export function nativeProposalProvenance(uid: string, principal: TestcaseProposalPrincipal) {
  return { kind: principal.kind, issuerId: uid, tokenId: principal.tokenId ?? null, transport: principal.transport ?? null,
    actorId: principal.kind === "human_session" ? uid : principal.actorId ?? null,
    principalKey: principal.kind === "api_token" ? `api_token:${principal.tokenId}` : `human_session:${uid}`,
    sourceContext: { status: "unavailable", reason: "TARGET_SOURCE_COMMIT_NOT_SUPPLIED" } };
}

/** The task row is locked by the caller; the database derives the sequence, digest and projection. */
export async function appendNativeProposalOperation(client: PoolClient, projectId: string, taskId: string,
  operationKind: "requirement_revision" | "testcase_revision" | "requirement_case_link" | "withdraw_requirement" | "withdraw_link",
  payload: Body, provenance: Body, submissionKey: string, requestDigest: string,
  refs: { parentOperationId?: string | null; requirementOperationId?: string | null; targetOperationId?: string | null } = {}) {
  const result = await client.query(`INSERT INTO proposal_operations
    (id,task_id,project_id,operation_sequence,operation_kind,payload,content_digest,submission_key,request_digest,provenance,created_by,
     parent_operation_id,requirement_operation_id,target_operation_id)
    SELECT $1,r.id,r.project_id,r.proposal_operation_sequence+1,$4,$5::JSONB,$6,$7,$8,$9::JSONB,$10,$11,$12,$13
    FROM ai_generation_requests r WHERE r.id=$2 AND r.project_id=$3 AND r.proposal_governance IS NOT NULL RETURNING *`,
    [randomUUID(), taskId, projectId, operationKind, JSON.stringify(payload), "0".repeat(64), submissionKey, requestDigest,
      JSON.stringify(provenance), provenance.actorId, refs.parentOperationId ?? null, refs.requirementOperationId ?? null, refs.targetOperationId ?? null]);
  if (!result.rows[0]) throw new NotFoundException({ error: "Requirement proposal task not found" });
  return result.rows[0] as Body;
}
