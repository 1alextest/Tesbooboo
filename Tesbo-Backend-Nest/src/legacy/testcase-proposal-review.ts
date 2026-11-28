import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { createHash } from "crypto";
import type { ReviewPrincipal } from "../common/human-review-principal";

export type TestcaseProposalPrincipal = ReviewPrincipal & { tokenId?: string; actorId?: string; transport?: "mcp" | "rest" };
export const MAX_TESTCASE_PROPOSAL_OPERATIONS = 100;

/** Stable digest of the exact JSON returned for review, never of a separately reconstructed UI. */
export function proposalDigest(value: unknown): string {
  const stable = (item: unknown): unknown => Array.isArray(item) ? item.map(stable)
    : item && typeof item === "object" ? Object.fromEntries(Object.keys(item).sort().map(key => [key, stable((item as Record<string, unknown>)[key])]))
      : item;
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

export function expectedProposalRevision(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    throw new BadRequestException({ code: "PROPOSAL_REVIEW_REQUIRED", error: "expectedProposalRevision must be the revision returned with the proposal snapshot you reviewed" });
  }
  return value;
}

export function selectedProposalIndexes(value: unknown): number[] {
  if (!Array.isArray(value) || value.length > MAX_TESTCASE_PROPOSAL_OPERATIONS ||
      value.some(index => !Number.isInteger(index) || Number(index) < 0) || new Set(value).size !== value.length) {
    throw new BadRequestException({ code: "PROPOSAL_SELECTION_REQUIRED", error: "selectedDraftIndexes must be an explicit array of unique nonnegative integer indexes" });
  }
  return value as number[];
}

export const TESTCASE_PROPOSAL_FIELDS = new Set([
  "title", "description", "preconditions", "postconditions", "steps", "stepsJson", "testData", "attachments",
  "priority", "severity", "type", "automationStatus", "automationRepo", "automationPath", "automationTestName",
  "automationFramework", "automationTags", "ownerId", "component", "status", "estimatedDuration", "sourceRefs",
  "customFieldValues", "customTagIds", "suiteId", "externalId", "jiraIssueKey", "jiraUrl", "linearIssueKey",
  "linearUrl", "notionPageId", "notionUrl", "technique", "reviewViews"
]);

/**
 * Authoritative native proposal producer identity shared by testcase and requirement
 * staging. Keep the principal key and receipt byte-compatible with existing rows:
 * both are used for deduplication, auditing, human review, and historical replay.
 *
 * This is NOT an OAuth credential authenticator. The enclosing staging transaction
 * still checks current membership, credential existence/scopes, project MCP consent
 * and the required tool. An OAuth producer must only be added after those checks
 * and its own persisted identity/replay contract are independently verified.
 */
export function nativeProposalProducerIdentity(principal: TestcaseProposalPrincipal, issuerId: string) {
  if (principal.kind !== "human_session" && principal.kind !== "api_token") {
    throw new ForbiddenException({ error: "A trusted proposal producer identity is required" });
  }
  // Match the existing native staging UUID guard, even if a future caller bypasses it.
  if (principal.kind === "api_token" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(principal.tokenId ?? "")) {
    throw new ForbiddenException({ error: "A trusted proposal producer identity is required" });
  }
  const principalKey = principal.kind === "api_token" ? `api_token:${principal.tokenId}` : `human_session:${issuerId}`;
  const producerActorId = principal.kind === "human_session" ? issuerId : principal.actorId ?? null;
  const provenance = {
    kind: principal.kind,
    principalKey,
    issuerId,
    tokenId: principal.tokenId ?? null,
    actorId: producerActorId
  };
  return { principalKey, producerActorId, provenance, activityActor: principal.kind === "api_token" ? "agent" as const : "user" as const };
}
