import { BadRequestException } from "@nestjs/common";
import { createHash } from "node:crypto";

export const MAX_RETEST_EXECUTIONS = 100;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A selection is a set of exact occurrences, never silently repaired or partially applied. */
export function retestExecutionIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_RETEST_EXECUTIONS ||
      value.some((id) => typeof id !== "string" || !UUID.test(id))) {
    throw new BadRequestException({ error: `Select between 1 and ${MAX_RETEST_EXECUTIONS} valid execution IDs` });
  }
  const ids = value.map((id: string) => id.toLowerCase());
  if (new Set(ids).size !== ids.length) throw new BadRequestException({ error: "Execution IDs must be unique" });
  return ids.sort();
}

export function retestRequestKey(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new BadRequestException({ error: "requestKey must be a UUID retained for this retest request" });
  }
  return value.toLowerCase();
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, item]) => [key, canonical(item)]));
  }
  return value;
}

export function retestDigest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonical(value)), "utf8").digest("hex");
}

function text(value: unknown, label: string, max: number, required = false): string | null {
  if (value === undefined || value === null) {
    if (required) throw new BadRequestException({ error: `${label} is required` });
    return null;
  }
  if (typeof value !== "string" || value.includes("\0") || value.length > max || (required && !value.trim())) {
    throw new BadRequestException({ error: `${label} must be ${required ? "nonempty text" : "text"} of at most ${max} characters` });
  }
  return value.trim() || null;
}

export function retestCreateInput(value: unknown) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException({ error: "A retest request must be an object" });
  }
  const body = value as Record<string, unknown>;
  const requestKey = retestRequestKey(body.requestKey);
  if (typeof body.expectedPreviewDigest !== "string" || !/^[a-f0-9]{64}$/.test(body.expectedPreviewDigest)) {
    throw new BadRequestException({ error: "expectedPreviewDigest must be the digest from the reviewed retest preview" });
  }
  return {
    requestKey,
    executionIds: retestExecutionIds(body.executionIds),
    expectedPreviewDigest: body.expectedPreviewDigest,
    name: text(body.name, "Test run name", 255, true)!,
    environment: text(body.environment, "Environment", 128),
    buildVersion: text(body.buildVersion, "Build version", 128),
    description: text(body.description, "Description", 10000)
  };
}
