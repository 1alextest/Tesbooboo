import { createHash } from "crypto";

/**
 * Minimum governed Skills resolver for Work Package A Slice 2.
 *
 * Skills reuse the Knowledge Base identity and governed version owner. This module only resolves
 * the human-assigned, approved immutable versions for one server-verified project/context. It does
 * not approve, assign or cache; callers re-run it inside the protected transaction that relies on
 * it, and pin its basis in the reviewed proposal.
 */
export type SkillTarget = { module: string; subtype: string; operation: string };

export type EffectiveSkill = {
  assignmentId: string;
  target: SkillTarget;
  skillDocumentId: string;
  skillKey: string;
  skillTitle: string;
  skillVersionId: string;
  versionNumber: number;
  contentDigest: string;
};

export type SkillResolution = {
  status: "resolved" | "unassigned" | "conflict";
  assignments: EffectiveSkill[];
  missing: SkillTarget[];
  conflicts: Array<SkillTarget & { matches: number }>;
  digest: string | null;
  resolvedAt: string;
};

type Queryable = { query(sql: string, params?: unknown[]): Promise<{ rows: Array<Record<string, any>> }> };
type SkillBasis = Pick<EffectiveSkill, "assignmentId" | "target" | "skillDocumentId" | "skillVersionId" | "contentDigest">;
export type SkillResolutionClassification = "current" | "stale" | "unavailable" | "conflict";

export const REQUIREMENT_SKILL_TARGETS = {
  requirement_revision: { module: "requirements", subtype: "functional", operation: "requirement_revision" },
  requirement_case_link: { module: "requirements", subtype: "functional", operation: "requirement_case_link" },
  testcase_create: { module: "test_cases", subtype: "manual", operation: "testcase_create" }
} as const satisfies Record<string, SkillTarget>;

const targetKey = (target: SkillTarget) => `${target.module}\u0000${target.subtype}\u0000${target.operation}`;
const compareText = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

function compareSkillBasis(a: SkillBasis, b: SkillBasis): number {
  const left = [a.assignmentId, a.target.module, a.target.subtype, a.target.operation, a.skillDocumentId, a.skillVersionId, a.contentDigest];
  const right = [b.assignmentId, b.target.module, b.target.subtype, b.target.operation, b.skillDocumentId, b.skillVersionId, b.contentDigest];
  for (let index = 0; index < left.length; index++) {
    const order = compareText(left[index], right[index]);
    if (order) return order;
  }
  return 0;
}

/** The deduplicated effective targets a typed bundle actually needs. */
export function requirementBundleTargets(operations: Array<Record<string, any>>): SkillTarget[] {
  const targets = new Map<string, SkillTarget>();
  for (const operation of operations) {
    const target = REQUIREMENT_SKILL_TARGETS[String(operation?.opType || "") as keyof typeof REQUIREMENT_SKILL_TARGETS];
    if (target) targets.set(targetKey(target), target);
    // A selected existing link is a separate reviewed obligation even when no new case is created.
    if (operation?.opType === "requirement_revision" && Array.isArray(operation.carryForwardLinks) && operation.carryForwardLinks.length > 0) {
      const link = REQUIREMENT_SKILL_TARGETS.requirement_case_link;
      targets.set(targetKey(link), link);
    }
  }
  return [...targets.values()].sort((a, b) => compareText(targetKey(a), targetKey(b)));
}

function orderedSkillBasisDigest(assignments: readonly SkillBasis[]): string {
  const basis = assignments.map(skill => ({
    assignmentId: skill.assignmentId, module: skill.target.module, subtype: skill.target.subtype,
    operation: skill.target.operation, skillDocumentId: skill.skillDocumentId,
    skillVersionId: skill.skillVersionId, contentDigest: skill.contentDigest
  }));
  return createHash("sha256").update(JSON.stringify(basis)).digest("hex");
}

/** Canonical full assignment/target basis; observation time and display metadata are excluded. */
export function skillResolutionDigest(assignments: readonly SkillBasis[]): string {
  return orderedSkillBasisDigest([...assignments].sort(compareSkillBasis));
}

/** One eligibility owner for concrete reads and symmetric assignment-scope overlap checks. */
async function eligibleSkillAssignments(db: Queryable, projectId: string, target: SkillTarget, overlap: boolean) {
  return db.query(
    `SELECT a.id AS assignment_id, a.module, a.subtype, a.operation,
            a.skill_document_id, a.skill_version_id, d.title AS skill_title, sp.skill_key,
            v.version_number, v.snapshot_metadata->>'contentDigest' AS content_digest
       FROM skill_assignments a
       JOIN knowledge_documents d ON d.id=a.skill_document_id AND d.project_id=a.project_id
       JOIN skill_profiles sp ON sp.document_id=a.skill_document_id
       JOIN knowledge_document_versions v ON v.id=a.skill_version_id AND v.document_id=a.skill_document_id
      WHERE a.project_id=$1 AND a.status='active' AND d.is_deleted=false
        AND d.document_type='skill' AND v.snapshot_kind='approved'
        AND COALESCE(v.snapshot_metadata->>'contentDigest','') <> ''
        AND (a.module='*' OR a.module=$2 OR ($5::boolean AND $2='*'))
        AND (a.subtype='*' OR a.subtype=$3 OR ($5::boolean AND $3='*'))
        AND (a.operation='*' OR a.operation=$4 OR ($5::boolean AND $4='*'))
      ORDER BY a.precedence DESC, a.id`,
    [projectId, target.module, target.subtype, target.operation, overlap]
  );
}

/** Other eligible assignments whose scope overlaps an inserted or replacement assignment. */
export async function findSkillAssignmentConflicts(
  db: Queryable, projectId: string, target: SkillTarget, assignmentId: string
): Promise<Array<{ assignmentId: string; target: SkillTarget }>> {
  const result = await eligibleSkillAssignments(db, projectId, target, true);
  return result.rows.filter(row => String(row.assignment_id) !== assignmentId).map(row => ({
    assignmentId: String(row.assignment_id),
    target: { module: String(row.module), subtype: String(row.subtype), operation: String(row.operation) }
  }));
}

export async function resolveEffectiveSkills(
  db: Queryable, projectId: string, targets: SkillTarget[], now = new Date().toISOString()
): Promise<SkillResolution> {
  const assignments: EffectiveSkill[] = [];
  const missing: SkillTarget[] = [];
  const conflicts: Array<SkillTarget & { matches: number }> = [];
  for (const target of targets) {
    const result = await eligibleSkillAssignments(db, projectId, target, false);
    if (result.rows.length === 0) missing.push(target);
    else if (result.rows.length > 1) conflicts.push({ ...target, matches: result.rows.length });
    else {
      const row = result.rows[0];
      assignments.push({
        assignmentId: String(row.assignment_id), target,
        skillDocumentId: String(row.skill_document_id), skillKey: String(row.skill_key),
        skillTitle: String(row.skill_title), skillVersionId: String(row.skill_version_id),
        versionNumber: Number(row.version_number), contentDigest: String(row.content_digest)
      });
    }
  }
  const basis = [...assignments].sort(compareSkillBasis);
  const status = conflicts.length ? "conflict" : missing.length ? "unassigned" : "resolved";
  return { status, assignments: basis, missing, conflicts, digest: status === "resolved" ? skillResolutionDigest(basis) : null, resolvedAt: now };
}

function isSkillBasis(value: unknown): value is SkillBasis {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const skill = value as Record<string, unknown>;
  if (!skill.target || typeof skill.target !== "object" || Array.isArray(skill.target)) return false;
  const target = skill.target as Record<string, unknown>;
  return [skill.assignmentId, target.module, target.subtype, target.operation, skill.skillDocumentId, skill.skillVersionId, skill.contentDigest]
    .every(field => typeof field === "string" && field.length > 0);
}

function verifiedPinnedBasisDigest(pinned: unknown): string | null {
  if (!pinned || typeof pinned !== "object" || Array.isArray(pinned)) return null;
  const value = pinned as Record<string, unknown>;
  if (value.status !== "resolved" || !Array.isArray(value.assignments)) return null;
  const assignments = Array.from(value.assignments);
  if (!assignments.every(isSkillBasis)) return null;
  const digest = skillResolutionDigest(assignments);
  // Earlier pins hashed their stored ordering. Verify that body too before canonical comparison.
  if (value.digest != null && value.digest !== digest && value.digest !== orderedSkillBasisDigest(assignments)) return null;
  return digest;
}

/** Inspect a historical reviewed pin without treating present-day assignments as its authority. */
export function reviewedSkillTarget(pinned: unknown, target: SkillTarget): SkillBasis | null {
  if (!verifiedPinnedBasisDigest(pinned)) return null;
  const value = pinned as { assignments: SkillBasis[]; missing?: unknown[]; conflicts?: unknown[] };
  if ((value.missing && (!Array.isArray(value.missing) || value.missing.length))
    || (value.conflicts && (!Array.isArray(value.conflicts) || value.conflicts.length))) return null;
  const keys = value.assignments.map(assignment => targetKey(assignment.target));
  if (new Set(keys).size !== keys.length) return null;
  const found = value.assignments.find(assignment => targetKey(assignment.target) === targetKey(target));
  if (!found) return null;
  return { assignmentId: found.assignmentId, target: { ...found.target }, skillDocumentId: found.skillDocumentId,
    skillVersionId: found.skillVersionId, contentDigest: found.contentDigest };
}

/** Preserve a previously resolved pin as stale when its effective basis disappears. */
export function classifySkillResolution(pinned: unknown, current: SkillResolution): SkillResolutionClassification {
  if (current.status === "conflict" || current.conflicts.length > 0) return "conflict";
  const pinnedDigest = verifiedPinnedBasisDigest(pinned);
  if (current.status !== "resolved" || !current.digest || current.missing.length > 0) {
    return pinnedDigest ? "stale" : "unavailable";
  }
  return pinnedDigest === current.digest ? "current" : "stale";
}

/** True when the current resolution is the exact basis the human reviewed and applied. */
export function skillResolutionMatches(pinned: unknown, current: SkillResolution): boolean {
  return classifySkillResolution(pinned, current) === "current";
}
