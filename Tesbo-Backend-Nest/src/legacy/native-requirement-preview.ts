import { createHash } from "node:crypto";

/**
 * WP-A read-only preview of a prospective native KB-backed requirement.
 *
 * This is not a new requirement store, a persisted proposal, or an approved
 * expected-behavior oracle. Publication is deliberately impossible until the
 * existing governed Skills resolver and selected apply path exist.
 */
export const NATIVE_REQUIREMENT_SCHEMA = "tesbo-requirement/1" as const;
export const NATIVE_REQUIREMENT_PREVIEW_CONTRACT = "tesbo-native-requirement-preview/1" as const;

export interface NativeRequirementCriterion {
  key: string;
  text: string;
  normative: boolean;
}

export interface NativeRequirementContent {
  schemaVersion: typeof NATIVE_REQUIREMENT_SCHEMA;
  description: string;
  criteria: NativeRequirementCriterion[];
}

export interface NativeRequirementPreview {
  contract: typeof NATIVE_REQUIREMENT_PREVIEW_CONTRACT;
  documentType: "requirement_note";
  title: string;
  contentJson: NativeRequirementContent;
  candidateDigest: string;
  skillContext: { status: "unavailable" };
  disposition: "preview_only";
  canPublish: false;
  publicationBlocker: "SKILL_CONTEXT_UNAVAILABLE";
  authoritativeRequirementId: null;
  coverageAssertion: "none";
  executionAssertion: "none";
  note: string;
}

export class NativeRequirementPreviewError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "NativeRequirementPreviewError";
  }
}

function object(value: unknown, allowed: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    throw new NativeRequirementPreviewError(`${label.toUpperCase()}_OBJECT_REQUIRED`);
  }
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some((key) => !allowed.includes(key))) {
    throw new NativeRequirementPreviewError(`${label.toUpperCase()}_UNRECOGNIZED_FIELD`);
  }
  return row;
}

function requiredText(value: unknown, min: number, max: number, label: string): string {
  if (typeof value !== "string" || value.trim().length < min || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)) {
    throw new NativeRequirementPreviewError(`${label.toUpperCase()}_INVALID`);
  }
  return value.trim();
}

/** Only the supplied candidate is normalized; no database, provider or AI call occurs. */
export function previewNativeRequirement(raw: unknown): NativeRequirementPreview {
  const input = object(raw, ["documentType", "title", "contentJson"], "request");
  if (input.documentType !== "requirement_note") {
    throw new NativeRequirementPreviewError("DOCUMENT_TYPE_UNSUPPORTED");
  }
  const title = requiredText(input.title, 1, 512, "title");
  const contents = object(input.contentJson, ["schemaVersion", "description", "criteria"], "content");
  if (contents.schemaVersion !== NATIVE_REQUIREMENT_SCHEMA) {
    throw new NativeRequirementPreviewError("REQUIREMENT_SCHEMA_UNSUPPORTED");
  }
  const description = requiredText(contents.description, 1, 20000, "description");
  if (!Array.isArray(contents.criteria) || contents.criteria.length < 1 || contents.criteria.length > 50) {
    throw new NativeRequirementPreviewError("CRITERIA_COUNT_INVALID");
  }
  const keys = new Set<string>();
  const criteria: NativeRequirementCriterion[] = contents.criteria.map((candidate) => {
    const criterion = object(candidate, ["key", "text", "normative"], "criterion");
    const key = criterion.key;
    if (typeof key !== "string" || !/^AC-[1-9][0-9]{0,3}$/u.test(key)) {
      throw new NativeRequirementPreviewError("CRITERION_KEY_INVALID");
    }
    if (keys.has(key)) throw new NativeRequirementPreviewError("CRITERION_KEY_DUPLICATED");
    keys.add(key);
    if (typeof criterion.normative !== "boolean") {
      throw new NativeRequirementPreviewError("CRITERION_NORMATIVE_INVALID");
    }
    return { key, text: requiredText(criterion.text, 1, 4000, "criterion_text"), normative: criterion.normative };
  });
  const contentJson: NativeRequirementContent = { schemaVersion: NATIVE_REQUIREMENT_SCHEMA, description, criteria };
  const candidateDigest = createHash("sha256").update(JSON.stringify([
    NATIVE_REQUIREMENT_PREVIEW_CONTRACT, "requirement_note", title, contentJson
  ]), "utf8").digest("hex");
  return {
    contract: NATIVE_REQUIREMENT_PREVIEW_CONTRACT,
    documentType: "requirement_note",
    title,
    contentJson,
    candidateDigest,
    skillContext: { status: "unavailable" },
    disposition: "preview_only",
    canPublish: false,
    publicationBlocker: "SKILL_CONTEXT_UNAVAILABLE",
    authoritativeRequirementId: null,
    coverageAssertion: "none",
    executionAssertion: "none",
    note: "Candidate inspection only. No KB document, native testcase, link, approval, execution or evidence is created."
  };
}
