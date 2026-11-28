import type { GraphChangeImpact, GraphSnapshot } from "./graph-change-impact";
import type { ImplementationConceptKind } from "./implementation-observation-graph";

const kinds = ["route", "state", "behavior", "journey"] as const;
const changes = ["added", "modified", "removed", "related_source_change"] as const;
const MAX_VISIBLE = 50;
type Change = typeof changes[number];
type Declaration = { id: string; repository: string; kind: ImplementationConceptKind; key: string };
type File = { id: string; repository: string; path: string };
type Lead = { nodeId: string; change: Change; beforeFileId: string | null; afterFileId: string | null };
export interface SourceDeclarationReview {
  version: 1;
  changedFileCount: number;
  declarationLeadCount: number;
  filesWithoutDeclarationCount: number;
  leads: Lead[];
  filesWithoutDeclaration: string[];
}
const filled = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.trim() === v;
function parts(id: unknown, projectId: string): unknown[] | null {
  if (typeof id !== "string") return null;
  try {
    const v: unknown = JSON.parse(id);
    return Array.isArray(v) && JSON.stringify(v) === id && v[1] === projectId ? v : null;
  } catch { return null; }
}
function file(id: unknown, projectId: string): File | null {
  const p = parts(id, projectId);
  if (!p || p.length !== 4 || p[0] !== "implementation_file" || !filled(p[2]) || !filled(p[3])) return null;
  const path = p[3];
  if (path.includes("\\") || path.split("/").some(s => !s || s === "." || s === "..") ||
      /[\u0000-\u001f]/.test(path)) return null;
  return { id: id as string, repository: p[2], path };
}
function declaration(id: unknown, projectId: string): Declaration | null {
  const p = parts(id, projectId);
  if (!p || p.length !== 5 || p[0] !== "source_declaration" || !filled(p[2]) ||
      !kinds.includes(p[3] as ImplementationConceptKind) || !filled(p[4])) return null;
  return { id: id as string, repository: p[2], kind: p[3] as ImplementationConceptKind, key: p[4] };
}
function associations(snapshot: GraphSnapshot) {
  const files = new Map<string, File>(), declarations = new Map<string, Declaration>();
  for (const node of snapshot.nodes) {
    if (node.type === "implementation_file") {
      const value = file(node.id, snapshot.projectId);
      if (!value) return null;
      files.set(node.id, value);
    } else if (node.type.startsWith("source_declared_")) {
      const value = declaration(node.id, snapshot.projectId);
      if (!value || node.type !== "source_declared_" + value.kind) return null;
      declarations.set(node.id, value);
    }
  }
  const byDeclaration = new Map<string, string>();
  for (const edge of snapshot.edges) {
    if (edge.type !== "declared_in_source") continue;
    const d = declarations.get(edge.from), f = files.get(edge.to);
    if (!d || !f || d.repository !== f.repository || byDeclaration.has(d.id) ||
        edge.id !== JSON.stringify(["declared_in_source", d.id, f.id])) return null;
    byDeclaration.set(d.id, f.id);
  }
  if (byDeclaration.size !== declarations.size) return null;
  return { files, declarations, byDeclaration };
}

/**
 * A bounded receipt-time view over the existing comparable graph pair.
 * Changed supporting bytes do not establish changed declared semantics.
 * Never infer runtime dependencies, case coverage, severity or normative intent.
 */
export function deriveSourceDeclarationReview(before: GraphSnapshot, after: GraphSnapshot,
  delta: GraphChangeImpact): SourceDeclarationReview | null {
  if (before.projectId !== after.projectId || before.projectId !== delta.projectId ||
      before.revision !== delta.fromRevision || after.revision !== delta.toRevision) return null;
  const a = associations(before), b = associations(after);
  if (!a || !b) return null;
  const nodeChanges = new Map<string, Change>();
  for (const [change, ids] of [["added", delta.addedNodes], ["modified", delta.modifiedNodes],
    ["removed", delta.removedNodes]] as const) for (const id of ids) nodeChanges.set(id, change);
  const changedFiles = [...nodeChanges.keys()].filter(id => a.files.has(id) || b.files.has(id)).sort();
  const changedSet = new Set(changedFiles), declaredFiles = new Set<string>();
  const changedEdges = new Set([...delta.addedEdges, ...delta.modifiedEdges, ...delta.removedEdges]);
  const leads: Lead[] = [];
  for (const id of new Set([...a.declarations.keys(), ...b.declarations.keys()])) {
    const beforeFileId = a.byDeclaration.get(id) ?? null, afterFileId = b.byDeclaration.get(id) ?? null;
    for (const f of [beforeFileId, afterFileId]) if (f) declaredFiles.add(f);
    const change = nodeChanges.get(id);
    if (change || beforeFileId !== afterFileId ||
        [beforeFileId, afterFileId].some(f => f !== null && changedSet.has(f)) ||
        [beforeFileId, afterFileId].some(f => f !== null && changedEdges.has(JSON.stringify(["declared_in_source", id, f])))) {
      leads.push({ nodeId: id, change: change ?? "related_source_change", beforeFileId, afterFileId });
    }
  }
  // Direct declaration deltas first, then related-file leads; this is evidence
  // ordering, not a severity ranking. Unknown files remain visible separately.
  leads.sort((x, y) => Number(x.change === "related_source_change") - Number(y.change === "related_source_change") ||
    x.nodeId.localeCompare(y.nodeId));
  const without = changedFiles.filter(id => !declaredFiles.has(id));
  return { version: 1, changedFileCount: changedFiles.length, declarationLeadCount: leads.length,
    filesWithoutDeclarationCount: without.length, leads: leads.slice(0, MAX_VISIBLE),
    filesWithoutDeclaration: without.slice(0, MAX_VISIBLE) };
}

/** Only render bounded, same-project exact IDs from supported persisted receipts.
 * Old/malformed receipts are unavailable, never a fabricated zero inventory.
 */
export function readSourceDeclarationReview(value: unknown, projectId: string,
  changed: { addedNodeIds: string[]; modifiedNodeIds: string[]; removedNodeIds: string[];
    addedEdgeIds: string[]; modifiedEdgeIds: string[]; removedEdgeIds: string[] }): SourceDeclarationReview | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const r = value as Partial<SourceDeclarationReview>;
  const direct = new Map<string, Change>();
  for (const [change, ids] of [["added", changed.addedNodeIds], ["modified", changed.modifiedNodeIds],
    ["removed", changed.removedNodeIds]] as const) for (const id of ids) {
    if (direct.has(id)) return null;
    direct.set(id, change);
  }
  const changedEdges = new Set([...changed.addedEdgeIds, ...changed.modifiedEdgeIds, ...changed.removedEdgeIds]);
  // Reject recognizable but invalid source identities rather than counting them as zero.
  for (const id of direct.keys()) {
    try {
      const p: unknown = JSON.parse(id);
      if (Array.isArray(p) && ((p[0] === "implementation_file" && !file(id, projectId)) ||
          (p[0] === "source_declaration" && !declaration(id, projectId)))) return null;
    } catch { /* non-source graph identities belong to their existing projection */ }
  }
  const fileCount = [...direct.keys()].filter(id => file(id, projectId)).length;
  const directDeclarations = [...direct.keys()].filter(id => declaration(id, projectId));
  const count = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
  if (r.version !== 1 || !count(r.changedFileCount) || r.changedFileCount !== fileCount ||
      !count(r.declarationLeadCount) || r.declarationLeadCount < directDeclarations.length || !count(r.filesWithoutDeclarationCount) ||
      r.filesWithoutDeclarationCount > fileCount ||
      !Array.isArray(r.leads) || r.leads.length !== Math.min(MAX_VISIBLE, r.declarationLeadCount) ||
      !Array.isArray(r.filesWithoutDeclaration) ||
      r.filesWithoutDeclaration.length !== Math.min(MAX_VISIBLE, r.filesWithoutDeclarationCount)) return null;
  const ids = new Set<string>();
  const leads: Lead[] = [];
  for (const lead of r.leads) {
    if (!lead || typeof lead !== "object" || !changes.includes(lead.change)) return null;
    const d = declaration(lead.nodeId, projectId);
    if (!d || ids.has(d.id)) return null;
    ids.add(d.id);
    if (lead.change !== (direct.get(d.id) ?? "related_source_change")) return null;
    const a = lead.beforeFileId === null ? null : file(lead.beforeFileId, projectId);
    const b = lead.afterFileId === null ? null : file(lead.afterFileId, projectId);
    if ((lead.beforeFileId !== null && (!a || a.repository !== d.repository)) ||
        (lead.afterFileId !== null && (!b || b.repository !== d.repository)) ||
        (lead.change === "added" ? a !== null || !b : lead.change === "removed" ? !a || b !== null : !a || !b)) return null;
    if (lead.change === "related_source_change" &&
        ![a, b].some(f => f && (direct.has(f.id) || changedEdges.has(JSON.stringify(["declared_in_source", d.id, f.id]))))) return null;
    leads.push({ nodeId: d.id, change: lead.change, beforeFileId: a?.id ?? null, afterFileId: b?.id ?? null });
  }
  if (r.declarationLeadCount <= MAX_VISIBLE && directDeclarations.some(id => !ids.has(id))) return null;
  const without: string[] = [];
  const seen = new Set<string>();
  for (const id of r.filesWithoutDeclaration) {
    if (!file(id, projectId) || !direct.has(id) || seen.has(id) ||
        leads.some(lead => lead.beforeFileId === id || lead.afterFileId === id)) return null;
    seen.add(id);
    without.push(id);
  }
  return { version: 1, changedFileCount: r.changedFileCount, declarationLeadCount: r.declarationLeadCount,
    filesWithoutDeclarationCount: r.filesWithoutDeclarationCount, leads, filesWithoutDeclaration: without };
}
