import { createHash } from "node:crypto";
import type { GraphCaptureForComparison } from "./graph-comparison-gate";
import type { GraphEdge, GraphNode, GraphSnapshot } from "./graph-change-impact";

export type CachedRequirementProvider = "jira" | "linear" | "notion";

/**
 * Input rows must come from a single, authorized, coherent database projection.
 * These types are NOT an API contract; accepting external/client-supplied rows
 * would allow an attacker to manufacture completeness, IDs and provenance.
 */
export interface CurrentSourceScope {
  provider: CachedRequirementProvider;
  mappingId: string;
  connectionId: string;
  /** Current remote site/workspace, not an attested historical origin. */
  namespace: string;
  remoteProjectId: string;
}

export interface CachedRequirementRow {
  projectId: string;
  provider: CachedRequirementProvider;
  rowId: string;
  key: string;
  remoteId: string;
  summary: string | null;
  description: string | null;
  /** PostgreSQL JSONB::text when available, preserving server-side number representation. */
  propertiesJsonbText: string | null;
}

export interface CurrentCaseRow {
  projectId: string;
  id: string;
  title: string;
  description: string | null;
  preconditions: string | null;
  postconditions: string | null;
  stepsJsonbText: string | null;
  testData: string | null;
  jiraIssueKey: string | null;
  linearIssueKey: string | null;
  notionPageId: string | null;
}

export interface CurrentSourceProjection {
  projectId: string;
  /** Source-side coherence is verified by the trusted reader; never by this pure projector. */
  inventoryStatus: "complete" | "incomplete" | "unknown";
  diagnostics: readonly string[];
  sourceScopes: readonly CurrentSourceScope[];
  requirements: readonly CachedRequirementRow[];
  cases: readonly CurrentCaseRow[];
}

export const CURRENT_CACHE_PROJECTION_CONTRACT = "tesbo-current-cached-requirement-links-v1";

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function identity(parts: readonly string[]): string {
  return JSON.stringify(parts);
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function incomplete(
  scopeFingerprint: string,
  diagnostics: readonly string[]
): GraphCaptureForComparison {
  return {
    contractId: CURRENT_CACHE_PROJECTION_CONTRACT,
    sourceScopeFingerprint: scopeFingerprint,
    inventoryStatus: "incomplete",
    unresolvedDiagnostics: [...diagnostics],
    snapshot: null
  };
}

/**
 * Deterministically projects existing cached requirement rows and native
 * test-case provider link slots. A link is explicitly NOT a coverage claim.
 *
 * This is a projection helper, not an authenticated source reader; it must
 * never be wired directly to REST/MCP, third-party inputs, or a public queue.
 */
export function projectCurrentCacheGraph(rows: CurrentSourceProjection): GraphCaptureForComparison {
  if (!rows || !hasText(rows.projectId)) throw new Error("Graph projection requires a project");
  if (!Array.isArray(rows.sourceScopes) || !Array.isArray(rows.requirements) ||
      !Array.isArray(rows.cases) || !Array.isArray(rows.diagnostics)) {
    throw new Error("Graph projection requires complete typed input collections");
  }

  const diagnostics: string[] = [...rows.diagnostics];
  const scopeKeys = new Set<string>();
  const scopes: string[][] = [];

  for (const scope of rows.sourceScopes) {
    if (!scope || !["jira", "linear", "notion"].includes(scope.provider) ||
        !hasText(scope.mappingId) || !hasText(scope.connectionId) ||
        !hasText(scope.namespace) || !hasText(scope.remoteProjectId)) {
      diagnostics.push("invalid current source scope");
      continue;
    }
    const key = scope.provider;
    if (scopeKeys.has(key)) diagnostics.push(`ambiguous ${key} source mapping`);
    scopeKeys.add(key);
    scopes.push([scope.provider, scope.mappingId, scope.connectionId, scope.namespace, scope.remoteProjectId]);
  }
  scopes.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const sourceScopeFingerprint = digest([CURRENT_CACHE_PROJECTION_CONTRACT, rows.projectId, scopes]);

  if (rows.inventoryStatus !== "complete" || diagnostics.length) {
    return {
      ...incomplete(sourceScopeFingerprint, diagnostics),
      inventoryStatus: rows.inventoryStatus === "complete" ? "incomplete" : "unknown"
    };
  }

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeIds = new Set<string>();
  const keys = new Map<string, string>();
  const ambiguous = new Set<string>();

  for (const requirement of rows.requirements) {
    if (!requirement || requirement.projectId !== rows.projectId ||
        !["jira", "linear", "notion"].includes(requirement.provider) ||
        !hasText(requirement.rowId) || !hasText(requirement.key) ||
        !hasText(requirement.remoteId) || !scopeKeys.has(requirement.provider)) {
      diagnostics.push("invalid, foreign or unscoped cached requirement");
      continue;
    }
    const id = identity(["cached_requirement", rows.projectId, requirement.provider, requirement.rowId]);
    if (nodeIds.has(id)) {
      diagnostics.push("duplicate cached requirement identity");
      continue;
    }
    nodeIds.add(id);
    nodes.push({
      id,
      type: "cached_requirement",
      version: digest([
        "requirement-content-v1", requirement.remoteId, requirement.key, requirement.summary,
        requirement.description, requirement.propertiesJsonbText
      ])
    });
    const key = identity([requirement.provider, requirement.key]);
    if (keys.has(key)) ambiguous.add(key);
    else keys.set(key, id);
  }

  const caseIds = new Set<string>();
  const links: Array<[string, CachedRequirementProvider, string]> = [];
  for (const testcase of rows.cases) {
    if (!testcase || testcase.projectId !== rows.projectId ||
        !hasText(testcase.id) || typeof testcase.title !== "string") {
      diagnostics.push("invalid or foreign test case");
      continue;
    }
    if (caseIds.has(testcase.id)) {
      diagnostics.push("duplicate test case identity");
      continue;
    }
    caseIds.add(testcase.id);
    const id = identity(["test_case", rows.projectId, testcase.id]);
    nodes.push({
      id,
      type: "test_case",
      version: digest([
        "case-content-v1", testcase.title, testcase.description, testcase.preconditions,
        testcase.postconditions, testcase.stepsJsonbText, testcase.testData
      ])
    });
    const refs: Array<[CachedRequirementProvider, string | null]> = [
      ["jira", testcase.jiraIssueKey],
      ["linear", testcase.linearIssueKey],
      ["notion", testcase.notionPageId]
    ];
    for (const [provider, key] of refs) {
      if (key !== null && key !== "" && !hasText(key)) {
        diagnostics.push("invalid nonblank source link");
      } else if (hasText(key)) {
        links.push([testcase.id, provider, key]);
      }
    }
  }

  for (const [caseId, provider, key] of links) {
    const refKey = identity([provider, key]);
    if (!scopeKeys.has(provider) || ambiguous.has(refKey) || !keys.has(refKey)) {
      diagnostics.push(`unresolved or ambiguous ${provider} link for test case ${caseId}`);
      continue;
    }
    const from = identity(["test_case", rows.projectId, caseId]);
    const to = keys.get(refKey)!;
    edges.push({
      id: identity(["requirement_link_slot", rows.projectId, caseId, provider]),
      type: "references_cached_requirement",
      from,
      to,
      version: digest(["requirement-link-v1", provider, key, from, to])
    });
  }

  if (diagnostics.length) return incomplete(sourceScopeFingerprint, diagnostics);
  nodes.sort((a, b) => a.id.localeCompare(b.id));
  edges.sort((a, b) => a.id.localeCompare(b.id));
  const revision = digest([
    CURRENT_CACHE_PROJECTION_CONTRACT, rows.projectId, sourceScopeFingerprint,
    nodes.map((n) => [n.id, n.type, n.version]),
    edges.map((e) => [e.id, e.type, e.from, e.to, e.version])
  ]);
  const snapshot: GraphSnapshot = { projectId: rows.projectId, revision, nodes, edges };
  return {
    contractId: CURRENT_CACHE_PROJECTION_CONTRACT,
    sourceScopeFingerprint,
    inventoryStatus: "complete",
    unresolvedDiagnostics: [],
    snapshot
  };
}
