/** A wire-format fence, not a second model validator or source of approval. */
export type ModelPreviewAvailability = {
  schemaVersion: "tesbo-fsm-preview-availability/1";
  enabled: boolean; semantics: "SEQUENTIAL_FSM"; maxStates: 32; maxTransitions: 64;
};
export type ModelDraftPreview = {
  schemaVersion: "tesbo-fsm-preview/1"; status: "DRAFT_PREVIEW"; validation: "STRUCTURALLY_VALID";
  approval: "NOT_APPROVED"; sourceAuthority: "UNVERIFIED"; runtimeEvidence: "NONE";
  modelId: null; modelRevisionId: null; candidateDigest: string;
  definition: { initialStateId: string };
  states: Array<{ id: string; label: string; reachable: boolean }>;
  transitions: Array<{ id: string; from: string; to: string; action: string; expectedObservation: string; reachable: boolean }>;
  diagnostics: Array<{ code: "UNREACHABLE_STATE" | "UNREACHABLE_TRANSITION" | "TERMINAL_STATE"; elementId: string }>;
};
function row(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function requireModelPreviewAvailability(value: unknown): ModelPreviewAvailability {
  const data = row(value);
  if (data.schemaVersion !== "tesbo-fsm-preview-availability/1" || typeof data.enabled !== "boolean" ||
      data.semantics !== "SEQUENTIAL_FSM" || data.maxStates !== 32 || data.maxTransitions !== 64) {
    throw new Error("Preview availability could not be verified. Check again before submitting a draft.");
  }
  return data as ModelPreviewAvailability;
}
export function requireModelDraftPreview(value: unknown): ModelDraftPreview {
  const data = row(value), capabilities = row(data.capabilities), definition = row(data.definition);
  const states = data.states, transitions = data.transitions, diagnostics = data.diagnostics;
  const strings = (value: unknown, keys: string[]) => keys.every(key => typeof row(value)[key] === "string");
  if (data.schemaVersion !== "tesbo-fsm-preview/1" || data.status !== "DRAFT_PREVIEW" ||
      data.validation !== "STRUCTURALLY_VALID" || data.approval !== "NOT_APPROVED" ||
      data.sourceAuthority !== "UNVERIFIED" || data.runtimeEvidence !== "NONE" ||
      data.modelId !== null || data.modelRevisionId !== null || "coverage" in data || "paths" in data ||
      !["persistence", "publication", "activation", "pathGeneration", "targetExecution"].every(key => capabilities[key] === false) ||
      typeof data.candidateDigest !== "string" || !/^[a-f0-9]{64}$/.test(data.candidateDigest) ||
      typeof definition.initialStateId !== "string" ||
      !Array.isArray(states) || states.length < 1 || states.length > 32 ||
      !states.every(item => strings(item, ["id", "label"]) && typeof row(item).reachable === "boolean") ||
      !states.some(item => row(item).id === definition.initialStateId) ||
      !Array.isArray(transitions) || transitions.length > 64 ||
      !transitions.every(item => strings(item, ["id", "from", "to", "action", "expectedObservation"]) && typeof row(item).reachable === "boolean") ||
      !Array.isArray(diagnostics) || diagnostics.length > 96 || !diagnostics.every(item =>
        typeof row(item).elementId === "string" && ["UNREACHABLE_STATE", "UNREACHABLE_TRANSITION", "TERMINAL_STATE"].includes(String(row(item).code)))) {
    throw new Error("The server did not return a supported unapproved draft preview. No result is shown.");
  }
  return data as ModelDraftPreview;
}
