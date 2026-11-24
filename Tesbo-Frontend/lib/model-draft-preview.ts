/** Presentation-only wire integrity fence. The backend owns ALL model semantics. */
export type ModelPreviewAvailability = {
  schemaVersion: "tesbo-fsm-preview-availability/1";
  enabled: boolean; semantics: "SEQUENTIAL_FSM"; maxStates: 32; maxTransitions: 64;
};
export type ModelDraftPreview = {
  schemaVersion: "tesbo-fsm-preview/1"; status: "DRAFT_PREVIEW"; validation: "STRUCTURALLY_VALID";
  approval: "NOT_APPROVED"; sourceAuthority: "UNVERIFIED"; runtimeEvidence: "NONE";
  modelId: null; modelRevisionId: null; candidateDigest: string;
  definition: {
    schemaVersion: "tesbo-fsm-draft/1"; semantics: "SEQUENTIAL_FSM"; initialStateId: string;
    states: Array<{ id: string; label: string }>;
    transitions: Array<{ id: string; from: string; to: string; action: string; expectedObservation: string }>;
  };
  states: Array<{ id: string; label: string; reachable: boolean }>;
  transitions: Array<{ id: string; from: string; to: string; action: string; expectedObservation: string; reachable: boolean }>;
  diagnostics: Array<{ code: "UNREACHABLE_STATE" | "UNREACHABLE_TRANSITION" | "TERMINAL_STATE"; elementId: string }>;
  limits: { maxStates: 32; maxTransitions: 64 };
  capabilities: { persistence: false; publication: false; activation: false; pathGeneration: false; targetExecution: false };
};
function row(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function exactFields(value: unknown, fields: readonly string[]): boolean {
  const data = row(value);
  return Object.keys(data).length === fields.length &&
    fields.every(field => Object.prototype.hasOwnProperty.call(data, field));
}
function sameFields(a: unknown, b: unknown, fields: readonly string[]): boolean {
  return fields.every(field => row(a)[field] === row(b)[field]);
}
const STATE_FIELDS = ["id", "label"] as const;
const TRANSITION_FIELDS = ["id", "from", "to", "action", "expectedObservation"] as const;
const CAPABILITIES = ["persistence", "publication", "activation", "pathGeneration", "targetExecution"] as const;

export function requireModelPreviewAvailability(value: unknown): ModelPreviewAvailability {
  const data = row(value);
  if (!exactFields(value, ["schemaVersion", "enabled", "semantics", "maxStates", "maxTransitions"]) ||
      data.schemaVersion !== "tesbo-fsm-preview-availability/1" || typeof data.enabled !== "boolean" ||
      data.semantics !== "SEQUENTIAL_FSM" || data.maxStates !== 32 || data.maxTransitions !== 64) {
    throw new Error("Preview availability could not be verified. Check again before submitting a draft.");
  }
  return data as ModelPreviewAvailability;
}

export function requireModelDraftPreview(value: unknown): ModelDraftPreview {
  const data = row(value), definition = row(data.definition), limits = row(data.limits);
  const capabilities = row(data.capabilities);
  const states = data.states, transitions = data.transitions, diagnostics = data.diagnostics;
  const originalStates = definition.states, originalTransitions = definition.transitions;
  const displayState = (item: unknown) => exactFields(item, [...STATE_FIELDS, "reachable"]) &&
    STATE_FIELDS.every(key => typeof row(item)[key] === "string") && typeof row(item).reachable === "boolean";
  const displayTransition = (item: unknown) => exactFields(item, [...TRANSITION_FIELDS, "reachable"]) &&
    TRANSITION_FIELDS.every(key => typeof row(item)[key] === "string") && typeof row(item).reachable === "boolean";
  const defState = (item: unknown) => exactFields(item, STATE_FIELDS) &&
    STATE_FIELDS.every(key => typeof row(item)[key] === "string");
  const defTransition = (item: unknown) => exactFields(item, TRANSITION_FIELDS) &&
    TRANSITION_FIELDS.every(key => typeof row(item)[key] === "string");

  // Check wire coherence only: no reimplementation of graph reachability,
  // model validation, digest computation, approval or source authorization.
  const orderedRowsAgree = Array.isArray(states) && Array.isArray(transitions) &&
    Array.isArray(originalStates) && Array.isArray(originalTransitions) &&
    states.length === originalStates.length && transitions.length === originalTransitions.length &&
    states.every((item, i) => displayState(item) && defState(originalStates[i]) &&
      sameFields(item, originalStates[i], STATE_FIELDS)) &&
    transitions.every((item, i) => displayTransition(item) && defTransition(originalTransitions[i]) &&
      sameFields(item, originalTransitions[i], TRANSITION_FIELDS));
  const stateIds = new Set(Array.isArray(states) ? states.map(item => row(item).id) : []);
  const transitionIds = new Set(Array.isArray(transitions) ? transitions.map(item => row(item).id) : []);
  const idsCoherent = orderedRowsAgree && stateIds.size === (states as unknown[]).length &&
    transitionIds.size === (transitions as unknown[]).length &&
    [...stateIds].every(id => !transitionIds.has(id)) &&
    stateIds.has(definition.initialStateId) &&
    (transitions as unknown[]).every(item => stateIds.has(row(item).from) && stateIds.has(row(item).to));
  const diagnosticsCoherent = Array.isArray(diagnostics) && diagnostics.length <= 96 &&
    diagnostics.every(item => exactFields(item, ["code", "elementId"]) &&
      (row(item).code === "UNREACHABLE_TRANSITION" ? transitionIds.has(row(item).elementId) :
      (row(item).code === "UNREACHABLE_STATE" || row(item).code === "TERMINAL_STATE") &&
        stateIds.has(row(item).elementId)));

  if (!exactFields(value, ["schemaVersion", "status", "validation", "approval", "sourceAuthority",
        "runtimeEvidence", "modelId", "modelRevisionId", "candidateDigest", "definition",
        "states", "transitions", "diagnostics", "limits", "capabilities"]) ||
      data.schemaVersion !== "tesbo-fsm-preview/1" || data.status !== "DRAFT_PREVIEW" ||
      data.validation !== "STRUCTURALLY_VALID" || data.approval !== "NOT_APPROVED" ||
      data.sourceAuthority !== "UNVERIFIED" || data.runtimeEvidence !== "NONE" ||
      data.modelId !== null || data.modelRevisionId !== null ||
      typeof data.candidateDigest !== "string" || !/^[a-f0-9]{64}$/.test(data.candidateDigest) ||
      !exactFields(data.definition, ["schemaVersion", "semantics", "initialStateId", "states", "transitions"]) ||
      definition.schemaVersion !== "tesbo-fsm-draft/1" || definition.semantics !== "SEQUENTIAL_FSM" ||
      typeof definition.initialStateId !== "string" ||
      !Array.isArray(states) || states.length < 1 || states.length > 32 ||
      !Array.isArray(transitions) || transitions.length > 64 ||
      !idsCoherent || !diagnosticsCoherent ||
      !exactFields(data.limits, ["maxStates", "maxTransitions"]) ||
      limits.maxStates !== 32 || limits.maxTransitions !== 64 ||
      !exactFields(data.capabilities, CAPABILITIES) ||
      !CAPABILITIES.every(key => capabilities[key] === false)) {
    throw new Error("The server did not return a supported unapproved draft preview. No result is shown.");
  }
  return data as ModelDraftPreview;
}
