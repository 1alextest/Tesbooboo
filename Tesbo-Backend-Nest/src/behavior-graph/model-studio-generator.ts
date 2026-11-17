import { createHash } from "node:crypto";
import type { PreviewDefinition, PreviewTransition } from "./model-studio-preview.core";

/**
 * Bounded, deterministic path proposals over a persisted finite-state model.
 *
 * This is a proposal generator, not a test-case writer or an executor. It never creates cases,
 * runs or evidence, and it never claims that its output covers the product: a forecast counts the
 * transitions it selected within the stated bounds, not verified behavior.
 *
 * The traversal is deliberately a small, replaceable BFS rather than an embedded graph library:
 * the persisted model is capped at 32 states / 64 transitions, the algorithm is deterministic,
 * and a future adapter can replace this module without changing the model/revision owners.
 */
export const MODEL_GENERATOR = { id: "tesbo-fsm-bfs", version: "1" } as const;

export type GenerationStrategy = "edge_coverage" | "shortest_paths";

export interface GenerationOptions {
  strategy: GenerationStrategy;
  maxPaths: number;
  maxDepth: number;
  seed: string;
}

export interface GeneratedPath {
  id: string;
  transitionIds: string[];
  stateIds: string[];
  digest: string;
}

export interface GenerationResult {
  status: "PROPOSAL_ONLY";
  generator: typeof MODEL_GENERATOR;
  strategy: GenerationStrategy;
  seed: string;
  paths: GeneratedPath[];
  forecast: {
    coveredTransitions: number;
    totalTransitions: number;
    reachableTransitions: number;
    uncoveredTransitionIds: string[];
    boundsExcludedTransitionIds: string[];
  };
  unknown: {
    unreachableStateIds: string[];
    unreachableTransitionIds: string[];
  };
  bounds: { maxPaths: number; maxDepth: number; maxStates: number; maxTransitions: number };
  coverageAssertion: "none";
  executionAssertion: "none";
}

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function outgoingByState(definition: PreviewDefinition): Map<string, PreviewTransition[]> {
  const outgoing = new Map<string, PreviewTransition[]>(definition.states.map((state) => [state.id, []]));
  for (const transition of [...definition.transitions].sort(byId)) {
    outgoing.get(transition.from)?.push(transition);
  }
  return outgoing;
}

/** States reachable from the initial state, without a depth bound (bounded by the state count). */
function reachableStates(definition: PreviewDefinition): Set<string> {
  const outgoing = outgoingByState(definition);
  const seen = new Set([definition.initialStateId]);
  const queue = [definition.initialStateId];
  for (let index = 0; index < queue.length; index++) {
    for (const transition of outgoing.get(queue[index]) ?? []) {
      if (!seen.has(transition.to)) {
        seen.add(transition.to);
        queue.push(transition.to);
      }
    }
  }
  return seen;
}

/** Shortest transition sequence from the initial state to `target`, or null when outside bounds. */
function shortestTo(
  outgoing: Map<string, PreviewTransition[]>,
  initialStateId: string,
  target: string,
  maxDepth: number
): PreviewTransition[] | null {
  if (target === initialStateId) return [];
  const queue: Array<{ state: string; path: PreviewTransition[] }> = [{ state: initialStateId, path: [] }];
  const visited = new Set([initialStateId]);
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    if (current.path.length >= maxDepth) continue;
    for (const transition of outgoing.get(current.state) ?? []) {
      if (visited.has(transition.to)) continue;
      const path = [...current.path, transition];
      if (transition.to === target) return path;
      visited.add(transition.to);
      queue.push({ state: transition.to, path });
    }
  }
  return null;
}

function pathView(
  transitions: PreviewTransition[],
  context: { revisionId: string; contentHash: string; seed: string; strategy: GenerationStrategy; maxPaths: number; maxDepth: number }
): GeneratedPath {
  const transitionIds = transitions.map((transition) => transition.id);
  const stateIds = [transitions[0]?.from, ...transitions.map((transition) => transition.to)].filter(Boolean) as string[];
  const digest = createHash("sha256")
    .update(
      JSON.stringify({
        revisionId: context.revisionId,
        contentHash: context.contentHash,
        seed: context.seed,
        // MBT-C-04: strategy parameters and logical limits are part of the input digest. A digest
        // that named only the seed could not distinguish the same sequence generated under a
        // different strategy or bound.
        strategy: context.strategy,
        maxPaths: context.maxPaths,
        maxDepth: context.maxDepth,
        transitionIds
      })
    )
    .digest("hex");
  return { id: `path-${digest.slice(0, 16)}`, transitionIds, stateIds, digest };
}

export function generateModelPaths(input: {
  definition: PreviewDefinition;
  revisionId: string;
  contentHash: string;
  options: GenerationOptions;
}): GenerationResult {
  const { definition, revisionId, contentHash, options } = input;
  const outgoing = outgoingByState(definition);
  const reachable = reachableStates(definition);
  const transitions = [...definition.transitions].sort(byId);
  const reachableTransitions = transitions.filter((transition) => reachable.has(transition.from));
  const context = {
    revisionId,
    contentHash,
    seed: options.seed,
    strategy: options.strategy,
    maxPaths: options.maxPaths,
    maxDepth: options.maxDepth
  };
  const paths: GeneratedPath[] = [];
  const seen = new Set<string>();
  const add = (sequence: PreviewTransition[]) => {
    if (!sequence.length || paths.length >= options.maxPaths) return;
    const key = sequence.map((transition) => transition.id).join(">");
    if (seen.has(key)) return;
    seen.add(key);
    paths.push(pathView(sequence, context));
  };

  if (options.strategy === "edge_coverage") {
    for (const transition of reachableTransitions) {
      if (paths.length >= options.maxPaths) break;
      const prefix = shortestTo(outgoing, definition.initialStateId, transition.from, options.maxDepth - 1);
      if (prefix === null) continue;
      add([...prefix, transition]);
    }
  } else {
    for (const state of [...definition.states].sort(byId)) {
      if (paths.length >= options.maxPaths) break;
      if (!reachable.has(state.id) || state.id === definition.initialStateId) continue;
      const path = shortestTo(outgoing, definition.initialStateId, state.id, options.maxDepth);
      if (path) add(path);
    }
  }

  const covered = new Set(paths.flatMap((path) => path.transitionIds));
  const uncovered = reachableTransitions.filter((transition) => !covered.has(transition.id)).map((transition) => transition.id);
  return {
    status: "PROPOSAL_ONLY",
    generator: MODEL_GENERATOR,
    strategy: options.strategy,
    seed: options.seed,
    paths,
    forecast: {
      coveredTransitions: covered.size,
      totalTransitions: transitions.length,
      reachableTransitions: reachableTransitions.length,
      uncoveredTransitionIds: uncovered,
      boundsExcludedTransitionIds: uncovered
    },
    unknown: {
      unreachableStateIds: definition.states.filter((state) => !reachable.has(state.id)).map((state) => state.id),
      unreachableTransitionIds: transitions.filter((transition) => !reachable.has(transition.from)).map((transition) => transition.id)
    },
    bounds: {
      maxPaths: options.maxPaths,
      maxDepth: options.maxDepth,
      maxStates: 32,
      maxTransitions: 64
    },
    coverageAssertion: "none",
    executionAssertion: "none"
  };
}
