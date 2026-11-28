/**
 * Read-only literal nomination baseline. These suggestions do not establish
 * semantic equivalence, applicable authority, path feasibility or coverage.
 * The caller supplies the exact case read, current model definition and
 * observed native mapping inventory; no fetching or mutation belongs here.
 */
export type LinkSuggestion = {
  elementId: string;
  action: string;
  expectedObservation: string;
  stepIndex: number;
};
export type LinkSuggestionReview = {
  testcaseRevision: string;
  title: string;
  candidates: LinkSuggestion[];
  ambiguousElementIds: string[];
  existingElementIds: string[];
};

const text = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** Compare the complete supported selected-case step inventory. No title/fuzzy matching. */
export function suggestModelCaseLinks(input: {
  projectId: string;
  testcaseId: string;
  testcase: unknown;
  transitions: readonly { id: string; action: string; expectedObservation: string }[];
  mappedElementIds: readonly string[];
}): LinkSuggestionReview | null {
  const { testcase, transitions, mappedElementIds } = input;
  if (!object(testcase) || testcase.id !== input.testcaseId ||
      testcase.projectId !== input.projectId ||
      !text(testcase.title, 1024) ||
      typeof testcase.editRevision !== "string" || !/^[a-f0-9]{64}$/.test(testcase.editRevision) ||
      !Array.isArray(testcase.steps) || testcase.steps.length > 200 ||
      transitions.length > 64 || !Array.isArray(mappedElementIds) ||
      mappedElementIds.some(id => !text(id, 64))) return null;
  const steps: Array<{action: string; expectedResult: string}> = [];
  for (const step of testcase.steps) {
    if (!object(step) || typeof step.action !== "string" || typeof step.expectedResult !== "string" ||
        step.action.length > 4000 || step.expectedResult.length > 4000) return null;
    steps.push({action: step.action, expectedResult: step.expectedResult});
  }
  const ids = new Set<string>();
  const byPair = new Map<string, string[]>();
  const key = (action: string, expected: string) => JSON.stringify([action, expected]);
  for (const transition of transitions) {
    if (!text(transition.id, 64) || ids.has(transition.id) ||
        !text(transition.action, 500) || !text(transition.expectedObservation, 1000)) return null;
    ids.add(transition.id);
    const pair = key(transition.action, transition.expectedObservation);
    byPair.set(pair, [...(byPair.get(pair) ?? []), transition.id]);
  }
  const stepsByPair = new Map<string, number[]>();
  for (const [index, step] of steps.entries()) {
    if (!step.action.trim() || !step.expectedResult.trim()) continue;
    const pair = key(step.action, step.expectedResult);
    stepsByPair.set(pair, [...(stepsByPair.get(pair) ?? []), index]);
  }
  const mapped = new Set(mappedElementIds);
  const candidates: LinkSuggestion[] = [], ambiguousElementIds: string[] = [], existingElementIds: string[] = [];
  for (const transition of transitions) {
    const pair = key(transition.action, transition.expectedObservation);
    const matches = stepsByPair.get(pair);
    if (!matches) continue;
    if (mapped.has(transition.id)) { existingElementIds.push(transition.id); continue; }
    if (matches.length !== 1 || byPair.get(pair)!.length !== 1) {
      ambiguousElementIds.push(transition.id);
      continue;
    }
    candidates.push({elementId: transition.id, action: transition.action,
      expectedObservation: transition.expectedObservation, stepIndex: matches[0]});
  }
  return {testcaseRevision: testcase.editRevision, title: testcase.title,
    candidates: candidates.sort((a,b)=>a.elementId.localeCompare(b.elementId)),
    ambiguousElementIds: ambiguousElementIds.sort(), existingElementIds: existingElementIds.sort()};
}
