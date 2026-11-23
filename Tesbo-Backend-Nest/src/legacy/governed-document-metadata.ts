import { BadRequestException } from "@nestjs/common";

/**
 * Typed governance metadata for the first Work Package B slice. The fields intentionally stay
 * independent: audience, distribution, confidentiality, source authority, effectivity, approval
 * and enforcement are different facts. Approval/review state lives on the document/version owner,
 * not in this object.
 */
export type GovernedDocumentType = "user_manual" | "policy";

export const GOVERNED_DOCUMENT_TYPES: ReadonlySet<string> = new Set(["user_manual", "policy"]);

const MANUAL_SUBTYPES = new Set(["manual", "quick_start", "reference", "runbook"]);
const POLICY_SUBTYPES = new Set(["policy", "standard", "procedure", "guideline"]);
const AUDIENCES = new Set(["internal", "external"]);
const CONFIDENTIALITIES = new Set(["public", "internal", "confidential", "restricted"]);
const DISTRIBUTIONS = new Set(["internal", "external", "withheld"]);
const AUTHORITY_KINDS = new Set(["internal", "external", "regulatory", "contractual", "other"]);

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ENFORCEMENT_REFS = 20;

export function isGovernedDocumentType(value: unknown): value is GovernedDocumentType {
  return typeof value === "string" && GOVERNED_DOCUMENT_TYPES.has(value);
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException({ error: `${label} must be an object` });
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new BadRequestException({ error: `${label} must be a non-empty string of at most ${max} characters` });
  }
  return value.trim();
}

function enumValue(value: unknown, allowed: Set<string>, label: string): string {
  if (typeof value !== "string" || !allowed.has(value)) {
    throw new BadRequestException({ error: `${label} must be one of: ${[...allowed].join(", ")}` });
  }
  return value;
}

function optionalDate(value: unknown, label: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = typeof value === "string" && DATE.test(value) ? new Date(`${value}T00:00:00Z`) : null;
  // Date.parse rolls 2026-02-31 forward to March rather than rejecting it, so compare the
  // round-tripped value. Effectivity dates decide which policy applies, so an impossible date
  // must fail instead of silently becoming a different one.
  if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException({ error: `${label} must be a real YYYY-MM-DD date or null` });
  }
  return value;
}

function rejectUnknownKeys(value: Record<string, unknown>, allowed: string[], label: string): void {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new BadRequestException({ error: `${label} has unknown field(s): ${unknown.join(", ")}` });
}

/**
 * Validates and normalises the metadata for a governed document. Non-governed document types keep
 * the empty object; legacy rows are therefore untouched. The returned object is the exact value
 * stored on the current document and copied into every governed version snapshot.
 */
export function normalizeGovernedMetadata(raw: unknown, documentType: string): Record<string, unknown> {
  if (!isGovernedDocumentType(documentType)) {
    if (raw !== undefined && raw !== null) {
      const value = object(raw, "governedMetadata");
      if (Object.keys(value).length) {
        throw new BadRequestException({ error: "governedMetadata is only supported for user_manual and policy documents" });
      }
    }
    return {};
  }
  const value = object(raw, "governedMetadata");
  rejectUnknownKeys(value, ["schemaVersion", "audience", "subtype", "confidentiality", "distribution", "sourceAuthority", "effectivity", "enforcementRefs"], "governedMetadata");
  if (value.schemaVersion !== "tesbo-governed-document/1") {
    throw new BadRequestException({ error: 'governedMetadata.schemaVersion must be "tesbo-governed-document/1"' });
  }
  const audience = enumValue(value.audience, AUDIENCES, "governedMetadata.audience");
  const confidentiality = enumValue(value.confidentiality, CONFIDENTIALITIES, "governedMetadata.confidentiality");
  const distribution = enumValue(value.distribution, DISTRIBUTIONS, "governedMetadata.distribution");
  const subtype = requiredString(value.subtype, "governedMetadata.subtype", 80);
  const allowedSubtypes = documentType === "user_manual" ? MANUAL_SUBTYPES : POLICY_SUBTYPES;
  if (!allowedSubtypes.has(subtype)) {
    throw new BadRequestException({ error: `governedMetadata.subtype for ${documentType} must be one of: ${[...allowedSubtypes].join(", ")}` });
  }

  const authority = object(value.sourceAuthority, "governedMetadata.sourceAuthority");
  rejectUnknownKeys(authority, ["kind", "label", "reference"], "governedMetadata.sourceAuthority");
  const reference = authority.reference === undefined || authority.reference === null || authority.reference === ""
    ? null
    : requiredString(authority.reference, "governedMetadata.sourceAuthority.reference", 500);

  const effectivity = object(value.effectivity, "governedMetadata.effectivity");
  rejectUnknownKeys(effectivity, ["from", "to"], "governedMetadata.effectivity");
  const from = optionalDate(effectivity.from, "governedMetadata.effectivity.from");
  const to = optionalDate(effectivity.to, "governedMetadata.effectivity.to");
  if (from && to && from > to) {
    throw new BadRequestException({ error: "governedMetadata.effectivity.from must not be after effectivity.to" });
  }

  const rawRefs = value.enforcementRefs === undefined ? [] : value.enforcementRefs;
  if (!Array.isArray(rawRefs) || rawRefs.length > MAX_ENFORCEMENT_REFS) {
    throw new BadRequestException({ error: `governedMetadata.enforcementRefs must be an array of at most ${MAX_ENFORCEMENT_REFS} references` });
  }
  if (documentType !== "policy" && rawRefs.length) {
    throw new BadRequestException({ error: "governedMetadata.enforcementRefs is only supported for policy documents" });
  }
  const enforcementRefs = rawRefs.map((entry, index) => requiredString(entry, `governedMetadata.enforcementRefs[${index}]`, 500));

  return {
    schemaVersion: "tesbo-governed-document/1",
    audience,
    subtype,
    confidentiality,
    distribution,
    sourceAuthority: {
      kind: enumValue(authority.kind, AUTHORITY_KINDS, "governedMetadata.sourceAuthority.kind"),
      label: requiredString(authority.label, "governedMetadata.sourceAuthority.label", 200),
      reference
    },
    effectivity: { from, to },
    enforcementRefs
  };
}

/** Snapshot-safe projection: empty for legacy/non-governed documents, exact otherwise. */
export function governedMetadataSnapshot(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return Object.keys(value as Record<string, unknown>).length ? value as Record<string, unknown> : null;
}
