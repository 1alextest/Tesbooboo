/**
 * Read-only, source-neutral change detection for a project-scoped graph snapshot.
 *
 * This deliberately does not decide authorization, persistence, graph edge semantics,
 * or QA acceptance. The caller must supply snapshots from an authoritative, scoped
 * source and must not interpret a reported change as proof that target behavior works.
 */
export interface GraphNode {
  id: string;
  type: string;
  /** Fingerprint of canonical versioned content, not display text or an AI guess. */
  version: string;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  type: string;
  /** Fingerprint/version of the relation itself. */
  version: string;
}

export interface GraphSnapshot {
  projectId: string;
  revision: string;
  nodes: readonly GraphNode[];
  edges: readonly GraphEdge[];
}

export interface GraphChangeImpact {
  projectId: string;
  fromRevision: string;
  toRevision: string;
  addedNodes: string[];
  removedNodes: string[];
  modifiedNodes: string[];
  addedEdges: string[];
  removedEdges: string[];
  modifiedEdges: string[];
  /** Directly changed nodes or endpoints of changed relations; no inferred transitive coverage. */
  directlyAffectedNodeIds: string[];
}

function requireNonempty(value: string, label: string): void {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid graph snapshot: ${label} must be a non-empty string`);
  }
}

function indexById<T extends { id: string }>(items: readonly T[], label: string): Map<string, T> {
  const index = new Map<string, T>();
  for (const item of items) {
    requireNonempty(item.id, `${label}.id`);
    if (index.has(item.id)) throw new Error(`Invalid graph snapshot: duplicate ${label} id ${item.id}`);
    index.set(item.id, item);
  }
  return index;
}

function validate(snapshot: GraphSnapshot): {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
} {
  requireNonempty(snapshot.projectId, "projectId");
  requireNonempty(snapshot.revision, "revision");
  if (!Array.isArray(snapshot.nodes) || !Array.isArray(snapshot.edges)) {
    throw new Error("Invalid graph snapshot: nodes and edges must be arrays");
  }
  const nodes = indexById(snapshot.nodes, "node");
  const edges = indexById(snapshot.edges, "edge");
  for (const node of nodes.values()) {
    requireNonempty(node.type, "node.type");
    requireNonempty(node.version, "node.version");
  }
  for (const edge of edges.values()) {
    requireNonempty(edge.type, "edge.type");
    requireNonempty(edge.version, "edge.version");
    requireNonempty(edge.from, "edge.from");
    requireNonempty(edge.to, "edge.to");
    if (!nodes.has(edge.from) || !nodes.has(edge.to)) {
      throw new Error(`Invalid graph snapshot: edge ${edge.id} references a missing endpoint`);
    }
  }
  return { nodes, edges };
}

function changes<T extends { id: string }>(
  before: Map<string, T>,
  after: Map<string, T>,
  same: (a: T, b: T) => boolean
): { added: string[]; removed: string[]; modified: string[] } {
  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];
  for (const [id, next] of after) {
    const prev = before.get(id);
    if (!prev) added.push(id);
    else if (!same(prev, next)) modified.push(id);
  }
  for (const id of before.keys()) if (!after.has(id)) removed.push(id);
  return { added: added.sort(), removed: removed.sort(), modified: modified.sort() };
}

/**
 * Deterministic direct-impact computation. Same project is mandatory; graph source,
 * revision ordering and semantic dependency traversal belong to subsequent layers.
 */
export function diffGraphSnapshots(before: GraphSnapshot, after: GraphSnapshot): GraphChangeImpact {
  const old = validate(before);
  const next = validate(after);
  if (before.projectId !== after.projectId) {
    throw new Error("Cannot compare graph snapshots from different projects");
  }
  const nodeDiff = changes(old.nodes, next.nodes, (a, b) => a.type === b.type && a.version === b.version);
  const edgeDiff = changes(
    old.edges,
    next.edges,
    (a, b) => a.type === b.type && a.version === b.version && a.from === b.from && a.to === b.to
  );
  const impacted = new Set([...nodeDiff.added, ...nodeDiff.removed, ...nodeDiff.modified]);
  for (const id of [...edgeDiff.added, ...edgeDiff.removed, ...edgeDiff.modified]) {
    for (const edge of [old.edges.get(id), next.edges.get(id)]) {
      if (edge) {
        impacted.add(edge.from);
        impacted.add(edge.to);
      }
    }
  }
  return {
    projectId: before.projectId,
    fromRevision: before.revision,
    toRevision: after.revision,
    addedNodes: nodeDiff.added,
    removedNodes: nodeDiff.removed,
    modifiedNodes: nodeDiff.modified,
    addedEdges: edgeDiff.added,
    removedEdges: edgeDiff.removed,
    modifiedEdges: edgeDiff.modified,
    directlyAffectedNodeIds: [...impacted].sort()
  };
}
