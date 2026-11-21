"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Field,
  FieldError,
  FieldLabel,
  Input,
  Modal
} from "@/components/ui";
import { listTestCases, type TestCaseListItem } from "@/lib/api";

/** The persisted draft shape (`tesbo-fsm-draft/1`). Kept local to authoring, not a second authority. */
export type ModelDefinition = {
  schemaVersion: "tesbo-fsm-draft/1";
  semantics: "SEQUENTIAL_FSM";
  initialStateId: string;
  states: Array<{ id: string; label: string }>;
  transitions: Array<{
    id: string;
    from: string;
    to: string;
    action: string;
    expectedObservation: string;
  }>;
};

export const EMPTY_MODEL: ModelDefinition = {
  schemaVersion: "tesbo-fsm-draft/1",
  semantics: "SEQUENTIAL_FSM",
  initialStateId: "start",
  states: [
    { id: "start", label: "Start" },
    { id: "done", label: "Done" }
  ],
  transitions: [
    { id: "finish", from: "start", to: "done", action: "Finish", expectedObservation: "The flow is complete" }
  ]
};

/** Normalize a persisted revision's content into the editable shape, tolerating a missing preview. */
export function toModelDefinition(content: unknown): ModelDefinition {
  const source = (content ?? {}) as Partial<ModelDefinition>;
  const states = Array.isArray(source.states)
    ? source.states.map((state) => ({ id: String(state?.id ?? ""), label: String(state?.label ?? "") }))
    : [];
  const transitions = Array.isArray(source.transitions)
    ? source.transitions.map((transition) => ({
        id: String(transition?.id ?? ""),
        from: String(transition?.from ?? ""),
        to: String(transition?.to ?? ""),
        action: String(transition?.action ?? ""),
        expectedObservation: String(transition?.expectedObservation ?? "")
      }))
    : [];
  return {
    schemaVersion: "tesbo-fsm-draft/1",
    semantics: "SEQUENTIAL_FSM",
    initialStateId: String(source.initialStateId ?? states[0]?.id ?? ""),
    states,
    transitions
  };
}

export function modelElements(definition: ModelDefinition): Array<{ id: string; kind: "state" | "transition" }> {
  return [
    ...definition.states.map((state) => ({ id: state.id, kind: "state" as const })),
    ...definition.transitions.map((transition) => ({ id: transition.id, kind: "transition" as const }))
  ];
}

/** Client-side mirror of the server's structural rules; the server still validates and rejects. */
export function validateModelDefinition(definition: ModelDefinition): string | null {
  const stateIds = definition.states.map((state) => state.id.trim());
  if (!stateIds.length) return "Add at least one state.";
  if (stateIds.some((id) => !id)) return "Every state needs an id.";
  if (new Set(stateIds).size !== stateIds.length) return "State ids must be unique.";
  if (!stateIds.includes(definition.initialStateId)) return "The initial state must be one of the states.";
  const transitionIds = definition.transitions.map((transition) => transition.id.trim());
  if (transitionIds.some((id) => !id)) return "Every transition needs an id.";
  if (new Set(transitionIds).size !== transitionIds.length) return "Transition ids must be unique.";
  for (const transition of definition.transitions) {
    if (!stateIds.includes(transition.from) || !stateIds.includes(transition.to)) {
      return `Transition "${transition.id}" must move between known states.`;
    }
    if (!transition.action.trim()) return `Transition "${transition.id}" needs an action.`;
    if (!transition.expectedObservation.trim()) {
      return `Transition "${transition.id}" needs an expected observation.`;
    }
  }
  return null;
}

type DefinitionModalProps = {
  mode: "create" | "revision";
  initialName?: string;
  initial: ModelDefinition;
  baseRevisionNumber?: number;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (value: { name: string; definition: ModelDefinition }) => void;
};

/**
 * Create a model, or save the next immutable revision. A revision always starts from the current
 * head — the server refuses a stale base rather than merging changes.
 */
export function ModelDefinitionModal({
  mode,
  initialName,
  initial,
  baseRevisionNumber,
  busy,
  error,
  onClose,
  onSave
}: DefinitionModalProps) {
  const [name, setName] = useState(initialName ?? "");
  const [states, setStates] = useState(initial.states);
  const [transitions, setTransitions] = useState(initial.transitions);
  const [initialStateId, setInitialStateId] = useState(initial.initialStateId);
  const [localError, setLocalError] = useState<string | null>(null);

  function submit() {
    const definition: ModelDefinition = {
      schemaVersion: "tesbo-fsm-draft/1",
      semantics: "SEQUENTIAL_FSM",
      initialStateId,
      states: states.map((state) => ({ id: state.id.trim(), label: state.label.trim() })),
      transitions: transitions.map((transition) => ({
        id: transition.id.trim(),
        from: transition.from,
        to: transition.to,
        action: transition.action.trim(),
        expectedObservation: transition.expectedObservation.trim()
      }))
    };
    if (mode === "create" && !name.trim()) {
      setLocalError("Give the model a name.");
      return;
    }
    const invalid = validateModelDefinition(definition);
    if (invalid) {
      setLocalError(invalid);
      return;
    }
    setLocalError(null);
    onSave({ name: name.trim(), definition });
  }

  return (
    <Modal open onClose={onClose} title={mode === "create" ? "New expected-behavior model" : `New revision ${(baseRevisionNumber ?? 1) + 1}`}>
      <div className="space-y-4">
        <p className="text-[12px] text-[var(--muted)]">
          {mode === "create"
            ? "Expected behavior, saved as draft revision 1. It is not approved, coverage or runtime evidence."
            : "Saving appends an immutable revision from the current head. Earlier revisions and their mappings are kept."}
        </p>
        {mode === "create" && (
          <Field>
            <FieldLabel>Model name</FieldLabel>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Checkout flow" />
          </Field>
        )}

        <section aria-label="States" className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-semibold">States</h3>
            <button
              type="button"
              className="rounded border border-[var(--border)] px-2 py-1 text-[12px]"
              onClick={() => setStates([...states, { id: "", label: "" }])}
            >
              Add state
            </button>
          </div>
          {states.map((state, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                aria-label={`State ${index + 1} id`}
                value={state.id}
                placeholder="id"
                onChange={(event) => setStates(states.map((row, i) => (i === index ? { ...row, id: event.target.value } : row)))}
              />
              <Input
                aria-label={`State ${index + 1} label`}
                value={state.label}
                placeholder="label"
                onChange={(event) => setStates(states.map((row, i) => (i === index ? { ...row, label: event.target.value } : row)))}
              />
              <button
                type="button"
                aria-label={`Remove state ${index + 1}`}
                className="text-[12px] text-[var(--error-foreground)]"
                onClick={() => setStates(states.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            </div>
          ))}
          <Field>
            <FieldLabel>Initial state</FieldLabel>
            <select
              value={initialStateId}
              onChange={(event) => setInitialStateId(event.target.value)}
              className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-[13px]"
            >
              <option value="">Select a state</option>
              {states.map((state, index) => (
                <option key={index} value={state.id}>
                  {state.id || `state ${index + 1}`}
                </option>
              ))}
            </select>
          </Field>
        </section>

        <section aria-label="Transitions" className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-semibold">Transitions</h3>
            <button
              type="button"
              className="rounded border border-[var(--border)] px-2 py-1 text-[12px]"
              onClick={() =>
                setTransitions([
                  ...transitions,
                  { id: "", from: states[0]?.id ?? "", to: states[1]?.id ?? states[0]?.id ?? "", action: "", expectedObservation: "" }
                ])
              }
            >
              Add transition
            </button>
          </div>
          {transitions.map((transition, index) => (
            <div key={index} className="space-y-2 rounded border border-[var(--border)] p-2">
              <div className="flex items-center gap-2">
                <Input
                  aria-label={`Transition ${index + 1} id`}
                  value={transition.id}
                  placeholder="id"
                  onChange={(event) =>
                    setTransitions(transitions.map((row, i) => (i === index ? { ...row, id: event.target.value } : row)))
                  }
                />
                <select
                  aria-label={`Transition ${index + 1} from`}
                  value={transition.from}
                  onChange={(event) =>
                    setTransitions(transitions.map((row, i) => (i === index ? { ...row, from: event.target.value } : row)))
                  }
                  className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-[13px]"
                >
                  {states.map((state, stateIndex) => (
                    <option key={stateIndex} value={state.id}>
                      {state.id || `state ${stateIndex + 1}`}
                    </option>
                  ))}
                </select>
                <span aria-hidden="true">→</span>
                <select
                  aria-label={`Transition ${index + 1} to`}
                  value={transition.to}
                  onChange={(event) =>
                    setTransitions(transitions.map((row, i) => (i === index ? { ...row, to: event.target.value } : row)))
                  }
                  className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-[13px]"
                >
                  {states.map((state, stateIndex) => (
                    <option key={stateIndex} value={state.id}>
                      {state.id || `state ${stateIndex + 1}`}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  aria-label={`Remove transition ${index + 1}`}
                  className="text-[12px] text-[var(--error-foreground)]"
                  onClick={() => setTransitions(transitions.filter((_, i) => i !== index))}
                >
                  Remove
                </button>
              </div>
              <Input
                aria-label={`Transition ${index + 1} action`}
                value={transition.action}
                placeholder="action"
                onChange={(event) =>
                  setTransitions(transitions.map((row, i) => (i === index ? { ...row, action: event.target.value } : row)))
                }
              />
              <Input
                aria-label={`Transition ${index + 1} expected observation`}
                value={transition.expectedObservation}
                placeholder="expected observation"
                onChange={(event) =>
                  setTransitions(
                    transitions.map((row, i) => (i === index ? { ...row, expectedObservation: event.target.value } : row))
                  )
                }
              />
            </div>
          ))}
        </section>

        {(localError || error) && <FieldError>{localError ?? error}</FieldError>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={busy}>
            {busy ? "Saving…" : mode === "create" ? "Create model" : "Save revision"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

type LinkCaseModalProps = {
  projectId: string;
  elements: Array<{ id: string; kind: "state" | "transition" }>;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onLink: (value: { testcaseId: string; elementIds: string[] }) => void;
};

/** Link a project test case to model elements on the latest revision. */
export function LinkCaseModal({ projectId, elements, busy, error, onClose, onLink }: LinkCaseModalProps) {
  const [search, setSearch] = useState("");
  const [cases, setCases] = useState<TestCaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [selectedElements, setSelectedElements] = useState<string[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  const loadCases = useCallback(
    async (term: string) => {
      setLoading(true);
      try {
        const result = await listTestCases(projectId, { limit: 50, search: term.trim() || undefined });
        setCases(result.list);
      } catch {
        setCases([]);
      } finally {
        setLoading(false);
      }
    },
    [projectId]
  );

  useEffect(() => {
    void loadCases("");
  }, [loadCases]);

  return (
    <Modal open onClose={onClose} title="Link a test case">
      <div className="space-y-4">
        <p className="text-[12px] text-[var(--muted)]">
          A mapping records which case exercises these elements. It is a review relationship, not coverage or execution evidence.
        </p>
        <Field>
          <FieldLabel>Test case</FieldLabel>
          <div className="flex gap-2">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search cases" />
            <Button type="button" variant="secondary" onClick={() => void loadCases(search)} disabled={loading}>
              Search
            </Button>
          </div>
          <select
            aria-label="Test case"
            value={selectedCaseId}
            onChange={(event) => setSelectedCaseId(event.target.value)}
            className="mt-2 w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-[13px]"
          >
            <option value="">{loading ? "Loading…" : "Select a case"}</option>
            {cases.map((testcase) => (
              <option key={testcase.id} value={testcase.id}>
                {testcase.title}
              </option>
            ))}
          </select>
        </Field>

        <section aria-label="Model elements" className="space-y-1">
          <h3 className="text-[13px] font-semibold">Model elements</h3>
          {elements.map((element) => (
            <label key={`${element.kind}:${element.id}`} className="flex items-center gap-2 text-[12.5px]">
              <input
                type="checkbox"
                checked={selectedElements.includes(element.id)}
                onChange={(event) =>
                  setSelectedElements((current) =>
                    event.target.checked ? [...new Set([...current, element.id])] : current.filter((id) => id !== element.id)
                  )
                }
              />
              <span className="font-mono">{element.id}</span>
              <span className="text-[var(--muted)]">{element.kind}</span>
            </label>
          ))}
        </section>

        {(localError || error) && <FieldError>{localError ?? error}</FieldError>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={() => {
              if (!selectedCaseId) {
                setLocalError("Choose a test case.");
                return;
              }
              if (!selectedElements.length) {
                setLocalError("Choose at least one model element.");
                return;
              }
              setLocalError(null);
              onLink({ testcaseId: selectedCaseId, elementIds: selectedElements });
            }}
          >
            {busy ? "Linking…" : "Link selected case"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

