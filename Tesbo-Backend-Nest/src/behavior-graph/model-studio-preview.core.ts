import { createHash } from "crypto";

/** Discovery metadata only; previewDraftModel remains the runtime validator. */
export const DRAFT_MODEL_PREVIEW_INPUT_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["schemaVersion", "semantics", "initialStateId", "states", "transitions"],
  properties: {
    schemaVersion: { type: "string", const: "tesbo-fsm-draft/1" },
    semantics: { type: "string", const: "SEQUENTIAL_FSM" },
    initialStateId: { type: "string", pattern: "^[A-Za-z][A-Za-z0-9_-]{0,63}$" },
    states: { type: "array", minItems: 1, maxItems: 32, items: {
      type: "object", additionalProperties: false, required: ["id", "label"],
      properties: { id: { type: "string", pattern: "^[A-Za-z][A-Za-z0-9_-]{0,63}$" },
        label: { type: "string", minLength: 1, maxLength: 120 } }
    } },
    transitions: { type: "array", maxItems: 64, items: {
      type: "object", additionalProperties: false,
      required: ["id", "from", "to", "action", "expectedObservation"],
      properties: {
        id: { type: "string", pattern: "^[A-Za-z][A-Za-z0-9_-]{0,63}$" },
        from: { type: "string", pattern: "^[A-Za-z][A-Za-z0-9_-]{0,63}$" },
        to: { type: "string", pattern: "^[A-Za-z][A-Za-z0-9_-]{0,63}$" },
        action: { type: "string", minLength: 1, maxLength: 500 },
        expectedObservation: { type: "string", minLength: 1, maxLength: 1000 }
      }
    } }
  }
};

export class DraftPreviewError extends Error {
  readonly code: "INVALID_MODEL" | "UNSUPPORTED_SEMANTICS";
  constructor(code: "INVALID_MODEL" | "UNSUPPORTED_SEMANTICS", message: string) {
    super(message);
    this.code = code;
  }
}

export interface PreviewState { id: string; label: string }
export interface PreviewTransition { id: string; from: string; to: string; action: string; expectedObservation: string }
export interface PreviewDefinition {
  schemaVersion: "tesbo-fsm-draft/1";
  semantics: "SEQUENTIAL_FSM";
  initialStateId: string;
  states: PreviewState[];
  transitions: PreviewTransition[];
}

function invalid(message: string): never { throw new DraftPreviewError("INVALID_MODEL", message); }
function record(raw: unknown, keys: string[]): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) invalid("Expected a model object");
  const row = raw as Record<string, unknown>;
  if (Object.keys(row).some(key => !keys.includes(key))) invalid("Unknown model field");
  return row;
}
function identifier(raw: unknown): string {
  if (typeof raw !== "string" || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(raw)) invalid("Invalid model element ID");
  return raw;
}
function text(raw: unknown, max: number): string {
  if (typeof raw !== "string" || !raw.trim() || raw.length > max || raw.includes("\0")) invalid("Missing or oversized model text");
  return raw;
}
function unique(ids: string[]): void {
  if (new Set(ids).size !== ids.length) invalid("Duplicate model element ID");
}
const compareId = (a: { id: string }, b: { id: string }): number => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/**
 * M1 structural preview only. No variable interpreter, path generator, authority
 * resolver, provider, queue, publication, database or target action belongs here.
 * Fixed 32-state/64-edge intake bounds are parser safeguards, not M2 job quotas.
 */
export function previewDraftModel(raw: unknown) {
  const input = record(raw, ["schemaVersion", "semantics", "initialStateId", "states", "transitions"]);
  if (input.schemaVersion !== "tesbo-fsm-draft/1") invalid("Unsupported draft preview schema");
  if (typeof input.semantics !== "string") invalid("Missing model semantics");
  if (input.semantics !== "SEQUENTIAL_FSM") {
    throw new DraftPreviewError("UNSUPPORTED_SEMANTICS", "Preview supports sequential finite state machines only");
  }
  if (!Array.isArray(input.states) || input.states.length < 1 || input.states.length > 32) invalid("Select 1–32 states");
  if (!Array.isArray(input.transitions) || input.transitions.length > 64) invalid("Select at most 64 transitions");
  const states: PreviewState[] = input.states.map(value => {
    const row = record(value, ["id", "label"]);
    return { id: identifier(row.id), label: text(row.label, 120) };
  }).sort(compareId);
  const transitions: PreviewTransition[] = input.transitions.map(value => {
    const row = record(value, ["id", "from", "to", "action", "expectedObservation"]);
    return { id: identifier(row.id), from: identifier(row.from), to: identifier(row.to),
      action: text(row.action, 500), expectedObservation: text(row.expectedObservation, 1000) };
  }).sort(compareId);
  unique(states.map(state => state.id));
  unique(transitions.map(edge => edge.id));
  unique([...states.map(state => state.id), ...transitions.map(edge => edge.id)]);
  const stateIds = new Set(states.map(state => state.id));
  const initialStateId = identifier(input.initialStateId);
  if (!stateIds.has(initialStateId)) invalid("Initial state does not exist");
  if (transitions.some(edge => !stateIds.has(edge.from) || !stateIds.has(edge.to))) invalid("Transition endpoint does not exist");

  // Every state is visited once and each outgoing edge examined once. Cycles
  // cannot expand this into path enumeration or an unbounded traversal job.
  const outgoing = new Map(states.map(state => [state.id, [] as PreviewTransition[]]));
  for (const edge of transitions) outgoing.get(edge.from)!.push(edge);
  const reachable = new Set([initialStateId]);
  const queue = [initialStateId];
  for (let index = 0; index < 32; index++) {
    const stateId = queue[index];
    if (stateId === undefined) break;
    for (const edge of outgoing.get(stateId)!) {
      if (!reachable.has(edge.to)) { reachable.add(edge.to); queue.push(edge.to); }
    }
  }
  const diagnostics: Array<{ code: "UNREACHABLE_STATE" | "UNREACHABLE_TRANSITION" | "TERMINAL_STATE"; elementId: string }> = [];
  for (const state of states) {
    if (!reachable.has(state.id)) diagnostics.push({ code: "UNREACHABLE_STATE", elementId: state.id });
    else if (outgoing.get(state.id)!.length === 0) diagnostics.push({ code: "TERMINAL_STATE", elementId: state.id });
  }
  for (const edge of transitions) if (!reachable.has(edge.from)) diagnostics.push({ code: "UNREACHABLE_TRANSITION", elementId: edge.id });
  const definition: PreviewDefinition = { schemaVersion: "tesbo-fsm-draft/1", semantics: "SEQUENTIAL_FSM", initialStateId, states, transitions };
  return {
    schemaVersion: "tesbo-fsm-preview/1" as const,
    status: "DRAFT_PREVIEW" as const,
    validation: "STRUCTURALLY_VALID" as const,
    approval: "NOT_APPROVED" as const,
    sourceAuthority: "UNVERIFIED" as const,
    runtimeEvidence: "NONE" as const,
    modelId: null,
    modelRevisionId: null,
    // Hash of normalized caller data, NEVER a canonical/approved model version.
    candidateDigest: createHash("sha256").update(JSON.stringify(definition)).digest("hex"),
    definition,
    states: states.map(state => ({ ...state, reachable: reachable.has(state.id) })),
    transitions: transitions.map(edge => ({ ...edge, reachable: reachable.has(edge.from) })),
    diagnostics,
    limits: { maxStates: 32, maxTransitions: 64 },
    capabilities: { persistence: false, publication: false, activation: false, pathGeneration: false, targetExecution: false }
  };
}
