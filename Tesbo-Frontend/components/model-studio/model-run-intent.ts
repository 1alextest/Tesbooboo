/** Browser recovery context only. This is neither a native run nor a server idempotency receipt. */
export type ModelRunIntent = {
  version: 1;
  id: string;
  projectId: string;
  modelId: string;
  principalId: string;
  modelName: string;
  revisionId: string;
  revisionNumber: number;
  contentHash: string;
  requestedAt: string;
  outcome: "OUTCOME_UNKNOWN";
  request: { caseIds: string[]; name?: string; environment?: string };
};

export type ModelRunIntentScope = Pick<ModelRunIntent, "projectId" | "modelId" | "principalId">;
type IntentStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function modelRunIntentKey(scope: ModelRunIntentScope): string {
  return "tesbo:model-run-intent:v1:" + [scope.principalId, scope.projectId, scope.modelId].map(encodeURIComponent).join(":");
}

export function readModelRunIntent(storage: IntentStorage, scope: ModelRunIntentScope): ModelRunIntent | null {
  const raw = storage.getItem(modelRunIntentKey(scope));
  if (raw === null) return null;
  const value = JSON.parse(raw) as Partial<ModelRunIntent> | null;
  if (!value || value.version !== 1 || value.outcome !== "OUTCOME_UNKNOWN" ||
      value.projectId !== scope.projectId || value.modelId !== scope.modelId || value.principalId !== scope.principalId ||
      typeof value.id !== "string" || !value.id || typeof value.revisionId !== "string" || !value.revisionId ||
      typeof value.contentHash !== "string" || !value.contentHash || typeof value.modelName !== "string" ||
      !Number.isInteger(value.revisionNumber) || Number(value.revisionNumber) < 1 ||
      typeof value.requestedAt !== "string" || !Number.isFinite(Date.parse(value.requestedAt)) ||
      !Array.isArray(value.request?.caseIds) || !value.request.caseIds.length ||
      !value.request.caseIds.every((id) => typeof id === "string" && id.length > 0) ||
      (value.request.name !== undefined && typeof value.request.name !== "string") ||
      (value.request.environment !== undefined && typeof value.request.environment !== "string")) {
    throw new Error("Saved run request could not be read. Inspect native Test Runs before starting another request.");
  }
  return value as ModelRunIntent;
}

export function writeModelRunIntent(storage: IntentStorage, intent: ModelRunIntent): void {
  storage.setItem(modelRunIntentKey(intent), JSON.stringify(intent));
}

/** A late response may clear only its own request, never a subsequent distinct human intent. */
export function clearModelRunIntent(storage: IntentStorage, scope: ModelRunIntentScope, intentId: string): void {
  const current = readModelRunIntent(storage, scope);
  if (current?.id === intentId) storage.removeItem(modelRunIntentKey(scope));
}
