import type { ModelStudioPreview } from "../behavior-graph/model-studio-preview";
import type { ModelStudioRepository } from "../behavior-graph/model-studio-repository";
import type { DatabaseService } from "../database/database.service";
import type { LegacyService } from "../legacy/legacy.service";
import type { ProjectSourceGraphCoordinator } from "../behavior-graph/project-source-graph.coordinator";
import type { GraphChangeReviewDelivery } from "../behavior-graph/graph-change-review.delivery";

/**
 * Tesbo MCP — protocol types.
 *
 * The "Tesbo MCP" card ships an MCP (Model Context Protocol) server as an in-process
 * module inside Tesbo-Backend-Nest, exposed over an HTTP transport (see mcp.controller.ts).
 * MCP is JSON-RPC 2.0; this file defines the small slice of the wire format we implement
 * (initialize / tools/list / tools/call / ping) plus the internal tool-registry shape.
 *
 * Design note: this is a dependency-free implementation of the JSON-RPC/MCP surface rather
 * than a wrapper around @modelcontextprotocol/sdk. The protocol layer is tiny and keeping it
 * in-tree makes the whole thing unit-testable without a running app or DB — which matters
 * because the Playwright e2e suite cannot boot in the build sandbox.
 */

/** Answered to a client that names no protocol version, or one this server does not support. */
export const MCP_PROTOCOL_VERSION = "2024-11-05";
/**
 * Every version `initialize` will echo back when a client asks for it. 2025-03-26 is left out
 * deliberately: it requires servers to accept JSON-RPC batches, which this server does not — a
 * client asking for it is answered with MCP_PROTOCOL_VERSION, exactly as before.
 */
export const MCP_SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", MCP_PROTOCOL_VERSION] as const;
export const MCP_SERVER_NAME = "tesbo-mcp";
export const MCP_SERVER_VERSION = "0.1.0";

/**
 * Streamable HTTP's session header. Tesbo uses it for one thing: telling a client its cached tool
 * list is out of date. The id embeds a fingerprint of the tool definitions (see McpService), and a
 * request carrying an id from a different fingerprint gets HTTP 404 — which the MCP spec requires a
 * client to answer by re-initializing, i.e. re-fetching tools/list. A session grants nothing: every
 * request is still authorized by its bearer token alone.
 */
export const MCP_SESSION_HEADER = "mcp-session-id";

/**
 * Returned in `initialize`'s result as the MCP spec's optional top-level `instructions` field —
 * a hint to the calling model, read once per session, that orients it to the whole server rather
 * than one tool at a time. Individual tool descriptions (mcp.tools.ts) already cover their own
 * required/optional fields and edge cases in detail; this fills the gap above that: the shape of
 * the domain, and the handful of behavioral rules that span multiple tools and would otherwise
 * only be discoverable by trial and error.
 */
export const MCP_SERVER_INSTRUCTIONS = `Tesbo is a test management system. This server exposes one project's test cases, suites (folders), test cycles (test runs), executions (a test case's result within a run), bugs, and a separate Knowledge Base (folders + documents) — always scoped to the project this token was issued for.

Typical shapes:
- Test cases live in suites (list_suites, list_testcases with suiteId).
- A cycle is a test run: create_cycle_from_testcases seeds it with test cases, each becoming one execution; record results with record_execution_result / bulk_record_execution_results.
- A bug can link to a test case, a cycle, and/or a specific execution (create_bug/update_bug's links, link_testcase_to_bug/unlink_testcase_from_bug) — linking a failed execution to a bug sets that execution to Failed.
- The Knowledge Base is a separate document/folder tree, not part of the test-case hierarchy — start with search_knowledge_base or list_knowledge_folders.
- Versioned QA impact review is shared with the existing Zyra Change Review page: list_qa_graph_changes reads committed revisions and explicit case candidates. Use get_testcase for an existing candidate's full canonical details rather than cloning test cases.
- capture_qa_graph_change is an optional write-scoped, project-bound observation of an administrator-approved Git source. It accepts no source path, manifest, semantic claim, test outcome or approval from the caller; missing bindings fail closed. A code change or missing explicit reference prompts QA investigation, not a Failed execution or proven coverage.
- Captured changes and notifications do not run tests or approve them. Only actually executed tests with attributable evidence may receive results through the existing execution tools, under human QA review.

Rules worth knowing before calling a write tool:
- Machine clients cannot directly create, update, archive, restore, duplicate, bulk-publish or change requirements on official test cases. Cached calls to those old tools return HUMAN_PUBLICATION_REQUIRED.
- The unpublished proposal review preview is off by default. Only when stage_testcase_changes is advertised can this client prepare unpublished create/update/archive proposals without a model key. Otherwise use native human editing; do not assume a missing staging capability is available.
- When the preview is available, supply an explicit requestKey; updates and archives bind the current get_testcase editRevision. Read the resulting task with get_testcase_proposal_task or list_testcase_proposals.
- A task ID identifies a proposal workflow, never a newly published test case. A human must inspect the exact proposal revision and save selected changes in Tesbo. There is no MCP apply or approval tool.
- Stage restore as an update with status Draft. A new case is published as Draft; human publication and subsequent test-case approval are separate decisions.
- update_suite only changes the fields you pass; every other field keeps its current value.
- Every id-addressed tool is already scoped to this token's project; passing an id from another project fails with a clear "not found" / "belongs to a different project" error rather than acting on it.

Example workflow: "file a bug for the test case that just failed" → get_testcase_executions or list_executions to find the failing execution, then create_bug with links: [{testcaseId, cycleId, executionId}].`;

/** The well-known agent slug MCP-driven writes are attributed to (seeded in V65). */
export const MCP_AGENT_SLUG = "tesbo-mcp";

export type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcSuccess {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result: unknown;
}

export interface JsonRpcErrorBody {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcError {
  jsonrpc: "2.0";
  id: JsonRpcId;
  error: JsonRpcErrorBody;
}

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcError;

/** JSON-RPC / MCP error codes. Negatives follow the JSON-RPC spec; we add app codes >= -32000. */
export const RpcCode = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
  /** Authenticated token is not scoped to the project it is trying to act on. */
  ProjectScopeDenied: -32001,
  /** Authenticated token lacks the scope (read/write) a tool requires. */
  ScopeDenied: -32002,
  /** Tool executed but the underlying operation failed (bad args, not found, etc.). */
  ToolExecutionError: -32003,
  /** The request's Mcp-Session-Id was issued for a different tool set; re-initialize. */
  SessionExpired: -32004
} as const;

/** A protocol-aware error the engine maps straight onto a JSON-RPC error response. */
export class McpError extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly data?: unknown
  ) {
    super(message);
    this.name = "McpError";
  }
}

export type TokenScope = "read" | "write";

/**
 * Everything a tool handler needs. `projectId` is always the token's own project (scope is
 * enforced before a handler runs), `actorId` is the dedicated MCP agent actor used for
 * actor-column attribution, and `userId` is the token's creating human (used where a column
 * references users(id) rather than actors(id), e.g. bugs.reported_by).
 */
export interface McpToolContext {
  projectId: string;
  /** Actual authenticated credential, never an id or identity supplied in tool arguments. */
  tokenId?: string;
  actorId: string | null;
  userId: string | null;
  scopes: TokenScope[];
  legacy: LegacyService;
  db: DatabaseService;
  /** Existing project-bound capture and native notification services. */
  graphCapture?: ProjectSourceGraphCoordinator;
  graphNotificationDelivery?: GraphChangeReviewDelivery;
  /** Same native opt-in, stateless validator as the REST preview. */
  modelPreview?: ModelStudioPreview;
  /** Persisted Model Studio drafts, revisions and case mappings (same owner as REST). */
  modelStudio?: ModelStudioRepository;
}

export interface McpTool {
  name: string;
  description: string;
  /** JSON Schema advertised to clients via tools/list. */
  inputSchema: Record<string, unknown>;
  /** Minimum token scope required to call this tool. */
  requiredScope: TokenScope;
  /** Retained only to give cached legacy calls an actionable refusal. */
  hiddenFromDiscovery?: boolean;
  /** Default-off unpublished proposal preview; only server configuration can enable it. */
  proposalPreviewOnly?: boolean;
  handler: (args: Record<string, unknown>, ctx: McpToolContext) => Promise<unknown>;
}
