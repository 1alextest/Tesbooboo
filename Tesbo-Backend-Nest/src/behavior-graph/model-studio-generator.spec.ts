import type { PreviewDefinition } from "./model-studio-preview.core";
import { generateModelPaths } from "./model-studio-generator";

const definition: PreviewDefinition = {
  schemaVersion: "tesbo-fsm-draft/1",
  semantics: "SEQUENTIAL_FSM",
  initialStateId: "start",
  states: [
    { id: "start", label: "Start" },
    { id: "a", label: "A" },
    { id: "b", label: "B" },
    { id: "c", label: "C" },
    { id: "d", label: "Unreachable" }
  ],
  transitions: [
    { id: "start_a", from: "start", to: "a", action: "Open", expectedObservation: "Opened" },
    { id: "a_b", from: "a", to: "b", action: "Submit", expectedObservation: "Submitted" },
    { id: "a_c", from: "a", to: "c", action: "Cancel", expectedObservation: "Cancelled" },
    { id: "b_a", from: "b", to: "a", action: "Retry", expectedObservation: "Restarted" },
    { id: "d_start", from: "d", to: "start", action: "Impossible", expectedObservation: "Never reached" }
  ]
};

const base = { definition, revisionId: "rev-1", contentHash: "a".repeat(64) };
const options = { strategy: "edge_coverage" as const, maxPaths: 20, maxDepth: 12, seed: "seed-1" };

describe("generateModelPaths", () => {
  it("is deterministic for equal model, seed and bounds", () => {
    expect(generateModelPaths({ ...base, options })).toEqual(generateModelPaths({ ...base, options }));
  });

  it("covers every reachable transition and reports unreachable elements without claiming coverage", () => {
    const result = generateModelPaths({ ...base, options });
    expect(result.status).toBe("PROPOSAL_ONLY");
    expect(result.coverageAssertion).toBe("none");
    expect(result.executionAssertion).toBe("none");
    expect(new Set(result.paths.flatMap((path) => path.transitionIds))).toEqual(new Set(["start_a", "a_b", "a_c", "b_a"]));
    expect(result.forecast).toMatchObject({ coveredTransitions: 4, reachableTransitions: 4, totalTransitions: 5, uncoveredTransitionIds: [] });
    expect(result.unknown).toEqual({ unreachableStateIds: ["d"], unreachableTransitionIds: ["d_start"] });
    // The cycle b -> a is traversed once inside a bounded path, not expanded forever.
    expect(result.paths.every((path) => path.transitionIds.length <= options.maxDepth)).toBe(true);
  });

  it("respects maxPaths and maxDepth as hard output bounds", () => {
    const capped = generateModelPaths({ ...base, options: { ...options, maxPaths: 2 } });
    expect(capped.paths).toHaveLength(2);
    expect(capped.forecast.uncoveredTransitionIds.length).toBeGreaterThan(0);

    const shallow = generateModelPaths({ ...base, options: { ...options, maxDepth: 1 } });
    expect(shallow.paths.map((path) => path.transitionIds)).toEqual([["start_a"]]);
    expect(shallow.forecast.uncoveredTransitionIds.length).toBeGreaterThan(0);
  });

  it("supports shortest-path proposals and keeps the seed in the replay digest", () => {
    const shortest = generateModelPaths({ ...base, options: { ...options, strategy: "shortest_paths" } });
    expect(shortest.paths.map((path) => path.transitionIds)).toEqual([["start_a"], ["start_a", "a_b"], ["start_a", "a_c"]]);
    const other = generateModelPaths({ ...base, options: { ...options, seed: "seed-2" } });
    expect(other.paths.map((path) => path.transitionIds)).toEqual(generateModelPaths({ ...base, options }).paths.map((path) => path.transitionIds));
    expect(other.paths.map((path) => path.digest)).not.toEqual(generateModelPaths({ ...base, options }).paths.map((path) => path.digest));
  });
});
