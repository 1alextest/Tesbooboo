import { createHash } from "node:crypto";

/**
 * Internal, pure resolution mechanism for the existing KB / T-422 Skills owner.
 * Inputs MUST be built by a trusted permission-filtered, coherent native source
 * reader. This module is NOT an import API or a public attestation service.
 * No record writer or Skill activation path exists in this module.
 *
 * R-ASE-25/26/27: context-specific, approved versions only; explicit human
 * composition; exact pinned digest; no implicit latest, self-assignment or
 * promotion from a draft; evidence remains reviewable on failures.
 */
export const SKILL_RESOLUTION_CONTRACT = "tesbo-governed-effective-skills/1" as const;

export type SkillModule =
  | "requirements" | "test_cases" | "user_manuals" | "policies"
  | "tasks_issues" | "files_evidence" | "skills";

export type EffectiveSkillContext = {
  workspaceId: string;
  projectId: string;
  principalId: string;
  module: SkillModule;
  subtype: string;
  audience: string;
  operation: string;
  phase: string;
  /** Provided by the authorized server, never a client-supplied clock. */
  asOf: string;
};

export type GovernedSkillVersion = {
  skillId: string;
  versionId: string;
  /** Immutable approved KB-version digest; instructions are not in this projection. */
  contentSha256: string;
  state: "candidate" | "approved" | "revoked" | "rejected";
  approvedBy: string | null;
  approvedReceiptSha256: string | null;
  dependencies: ReadonlyArray<{ skillId: string; versionId: string }>;
};

export type GovernedSkillAssignment = {
  assignmentId: string;
  skillId: string;
  versionId: string;
  workspaceId: string;
  /** null = workspace assignment; never a wildcard across unrelated workspaces. */
  projectId: string | null;
  module: SkillModule;
  subtype: string;
  audience: string;
  operation: string;
  phase: string;
  state: "active" | "inactive";
  effectiveFrom: string;
  effectiveUntil: string | null;
  kind: "core" | "adapter" | "specialist";
  precedence: number;
  /** Several active skills require the SAME explicitly approved composition. */
  compositionId: string | null;
  compositionReceiptSha256: string | null;
  humanActivatedBy: string | null;
  assignmentApprovalSha256: string | null;
  /** Mechanically declared dependency semantics, not an AI-derived guess. */
  weakensMandatoryRoot: boolean;
};

export type GovernedSkillInventory = {
  workspaceId: string;
  projectId: string;
  /** The upstream reader must establish complete accessible assignment inventory. */
  status: "complete" | "partial" | "unknown";
  /** Changes with any approved version/assignment/revocation decision. */
  authorityRevision: string;
  versions: ReadonlyArray<GovernedSkillVersion>;
  assignments: ReadonlyArray<GovernedSkillAssignment>;
};

export type ResolvedSkill = {
  assignmentId: string;
  skillId: string;
  versionId: string;
  contentSha256: string;
  kind: GovernedSkillAssignment["kind"];
  precedence: number;
};

export type SkillResolution =
  | { status: "resolved"; contract: typeof SKILL_RESOLUTION_CONTRACT;
      digest: string; authorityRevision: string; skills: ResolvedSkill[];
      context: EffectiveSkillContext; publicationAuthority: "none" }
  | { status: "blocked"; contract: typeof SKILL_RESOLUTION_CONTRACT;
      code: "SKILL_CONTEXT_UNAVAILABLE" | "UNASSIGNED" |
        "SKILL_ASSIGNMENT_CONFLICT" | "SKILL_CONTEXT_STALE";
      detail: string; skills: []; publicationAuthority: "none" };

const DIGEST = /^[a-f0-9]{64}$/;
const TEXT = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 256 &&
  value === value.trim() && !/[\u0000-\u001f]/.test(value);
const MODULES: readonly string[] = [
  "requirements", "test_cases", "user_manuals", "policies",
  "tasks_issues", "files_evidence", "skills"
];
const fail = (code: Extract<SkillResolution, { status: "blocked" }>["code"], detail: string): SkillResolution =>
  ({ status: "blocked", contract: SKILL_RESOLUTION_CONTRACT, code,
    detail, skills: [], publicationAuthority: "none" });

function isoTime(value: string): number | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString().startsWith(value.slice(0, 19)) ? time : null;
}

function validContext(value: EffectiveSkillContext): boolean {
  return !!value && TEXT(value.workspaceId) && TEXT(value.projectId) && TEXT(value.principalId) &&
    MODULES.includes(value.module) && TEXT(value.subtype) && TEXT(value.audience) &&
    TEXT(value.operation) && TEXT(value.phase) && isoTime(value.asOf) !== null;
}

function sortedJson(value: unknown): string {
  const normalize = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(normalize);
    if (input !== null && typeof input === "object") {
      const item = input as Record<string, unknown>;
      return Object.fromEntries(Object.keys(item).sort().map(key => [key, normalize(item[key])]));
    }
    return input;
  };
  return JSON.stringify(normalize(value));
}

function validVersion(row: GovernedSkillVersion): boolean {
  return !!row && TEXT(row.skillId) && TEXT(row.versionId) &&
    DIGEST.test(row.contentSha256) &&
    ["candidate", "approved", "revoked", "rejected"].includes(row.state) &&
    (row.approvedBy === null || TEXT(row.approvedBy)) &&
    (row.approvedReceiptSha256 === null || DIGEST.test(row.approvedReceiptSha256)) &&
    Array.isArray(row.dependencies) && row.dependencies.length <= 25 &&
    row.dependencies.every(d => d && TEXT(d.skillId) && TEXT(d.versionId));
}

function validAssignment(row: GovernedSkillAssignment): boolean {
  const from = row && isoTime(row.effectiveFrom);
  const to = row && row.effectiveUntil !== null ? isoTime(row.effectiveUntil) : null;
  return !!row && TEXT(row.assignmentId) && TEXT(row.skillId) && TEXT(row.versionId) &&
    TEXT(row.workspaceId) && (row.projectId === null || TEXT(row.projectId)) &&
    MODULES.includes(row.module) && TEXT(row.subtype) && TEXT(row.audience) &&
    TEXT(row.operation) && TEXT(row.phase) && ["active", "inactive"].includes(row.state) &&
    from !== null && (row.effectiveUntil === null || to !== null && to > from) &&
    ["core", "adapter", "specialist"].includes(row.kind) &&
    Number.isSafeInteger(row.precedence) && row.precedence >= 0 && row.precedence <= 10000 &&
    (row.compositionId === null || TEXT(row.compositionId)) &&
    (row.compositionReceiptSha256 === null || DIGEST.test(row.compositionReceiptSha256)) &&
    (row.humanActivatedBy === null || TEXT(row.humanActivatedBy)) &&
    (row.assignmentApprovalSha256 === null || DIGEST.test(row.assignmentApprovalSha256)) &&
    typeof row.weakensMandatoryRoot === "boolean";
}

function matches(a: GovernedSkillAssignment, c: EffectiveSkillContext): boolean {
  return a.workspaceId === c.workspaceId &&
    (a.projectId === null || a.projectId === c.projectId) &&
    a.module === c.module && a.subtype === c.subtype && a.audience === c.audience &&
    a.operation === c.operation && a.phase === c.phase;
}

/**
 * Validates only the already trusted, versioned source projection. Refuses
 * incomplete/ambiguous data instead of selecting a plausible "latest" Skill.
 */
export function resolveGovernedSkills(
  context: EffectiveSkillContext, inventory: GovernedSkillInventory
): SkillResolution {
  if (!validContext(context) || !inventory || inventory.status !== "complete" ||
      inventory.workspaceId !== context.workspaceId || inventory.projectId !== context.projectId ||
      !TEXT(inventory.authorityRevision) || !Array.isArray(inventory.versions) ||
      !Array.isArray(inventory.assignments)) {
    return fail("SKILL_CONTEXT_UNAVAILABLE", "Trusted complete Skill authority or context is unavailable");
  }
  if (inventory.versions.length > 1000 || inventory.assignments.length > 2000 ||
      !inventory.versions.every(validVersion) || !inventory.assignments.every(validAssignment)) {
    return fail("SKILL_ASSIGNMENT_CONFLICT", "Skill authority contains malformed or excessive records");
  }
  const versionById = new Map<string, GovernedSkillVersion>();
  const seenAssignments = new Set<string>();
  for (const v of inventory.versions) {
    if (versionById.has(v.versionId)) return fail("SKILL_ASSIGNMENT_CONFLICT", "Duplicate immutable Skill version identity");
    versionById.set(v.versionId, v);
  }
  for (const a of inventory.assignments) {
    if (seenAssignments.has(a.assignmentId) || a.workspaceId !== context.workspaceId ||
        a.projectId !== null && a.projectId !== context.projectId) {
      return fail("SKILL_ASSIGNMENT_CONFLICT", "Duplicate or cross-scope Skill assignment");
    }
    seenAssignments.add(a.assignmentId);
  }
  const now = isoTime(context.asOf)!;
  const applicable = inventory.assignments.filter(a => a.state === "active" &&
    matches(a, context) && now >= isoTime(a.effectiveFrom)! &&
    (a.effectiveUntil === null || now < isoTime(a.effectiveUntil)!));
  if (!applicable.length) return fail("UNASSIGNED", "No approved applicable Skill assignment");
  const skills = new Map<string, { assignment: GovernedSkillAssignment; version: GovernedSkillVersion }>();
  for (const a of applicable) {
    const v = versionById.get(a.versionId);
    if (!v || v.skillId !== a.skillId || v.state !== "approved" ||
        !v.approvedBy || !v.approvedReceiptSha256 ||
        !a.humanActivatedBy || !a.assignmentApprovalSha256) {
      return fail("SKILL_CONTEXT_STALE", "Assigned Skill is not currently approved and human-activated");
    }
    if (a.weakensMandatoryRoot) {
      return fail("SKILL_ASSIGNMENT_CONFLICT", "An assignment attempts to weaken mandatory root requirements");
    }
    if (skills.has(a.skillId)) {
      return fail("SKILL_ASSIGNMENT_CONFLICT", "Duplicate effective assignment for one Skill identity");
    }
    skills.set(a.skillId, { assignment: a, version: v });
  }
  const all = [...skills.values()];
  if (all.some(x => x.assignment.kind === "adapter") &&
      !all.some(x => x.assignment.kind === "core")) {
    return fail("SKILL_ASSIGNMENT_CONFLICT", "A project adapter cannot replace a mandatory core Skill");
  }
  if (all.length > 1) {
    const composition = all[0].assignment.compositionId;
    const signature = all[0].assignment.compositionReceiptSha256;
    const priorities = new Set(all.map(x => x.assignment.precedence));
    if (!composition || !signature ||
        all.some(x => x.assignment.compositionId !== composition || x.assignment.compositionReceiptSha256 !== signature) ||
        priorities.size !== all.length) {
      return fail("SKILL_ASSIGNMENT_CONFLICT", "Overlapping assignments lack an approved deterministic composition");
    }
    if (all.some(x => x.assignment.kind === "adapter") &&
        !all.some(x => x.assignment.kind === "core")) {
      return fail("SKILL_ASSIGNMENT_CONFLICT", "A project adapter cannot replace a mandatory core Skill");
    }
  }
  for (const { version } of all) {
    for (const dependency of version.dependencies) {
      if (dependency.skillId === version.skillId) return fail("SKILL_ASSIGNMENT_CONFLICT", "Skill self-dependency");
      if (skills.get(dependency.skillId)?.version.versionId !== dependency.versionId) {
        return fail("SKILL_ASSIGNMENT_CONFLICT", "Required Skill dependency is missing or wrong version");
      }
    }
  }
  // Cycle check must run even when individual dependency versions match.
  const visited = new Set<string>(), visiting = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return false;
    if (visited.has(id)) return true;
    visiting.add(id);
    for (const dependency of skills.get(id)?.version.dependencies ?? []) {
      if (!visit(dependency.skillId)) return false;
    }
    visiting.delete(id);
    visited.add(id);
    return true;
  };
  if (!all.every(x => visit(x.version.skillId))) {
    return fail("SKILL_ASSIGNMENT_CONFLICT", "Skill dependency cycle");
  }
  const resolved = all.map(({ assignment: a, version: v }) => ({
    assignmentId: a.assignmentId, skillId: a.skillId, versionId: v.versionId,
    contentSha256: v.contentSha256, kind: a.kind, precedence: a.precedence
  })).sort((a, b) => a.precedence - b.precedence || a.assignmentId.localeCompare(b.assignmentId));
  const digest = createHash("sha256").update(sortedJson([
    SKILL_RESOLUTION_CONTRACT, context, inventory.authorityRevision,
    resolved.map(s => [s.assignmentId, s.skillId, s.versionId, s.contentSha256, s.precedence]),
    applicable.map(a => [a.assignmentId, a.assignmentApprovalSha256, a.compositionId, a.compositionReceiptSha256]).sort()
  ])).digest("hex");
  return { status: "resolved", contract: SKILL_RESOLUTION_CONTRACT,
    digest, authorityRevision: inventory.authorityRevision,
    skills: resolved, context: { ...context }, publicationAuthority: "none" };
}

/** Re-resolve at selected apply/approval; a previously valid pin never grants publication. */
export function comparePinnedSkillResolution(
  priorDigest: string | null | undefined, current: SkillResolution
): "current" | "SKILL_CONTEXT_STALE" | "SKILL_CONTEXT_UNAVAILABLE" {
  if (current.status !== "resolved") return "SKILL_CONTEXT_UNAVAILABLE";
  return priorDigest === current.digest ? "current" : "SKILL_CONTEXT_STALE";
}
