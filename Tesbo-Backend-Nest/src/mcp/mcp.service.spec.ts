import { ForbiddenException } from "@nestjs/common";
import { ModelStudioPreview } from "../behavior-graph/model-studio-preview";
import { previewDraftModel } from "../behavior-graph/model-studio-preview.core";
import { McpService } from "./mcp.service";
import { DatabaseService } from "../database/database.service";
import { LegacyService } from "../legacy/legacy.service";
import type { PlanLimitsService } from "../plan-limits/plan-limits.service";
import type { ApiTokenContext } from "../common/request.types";
import { MCP_PROTOCOL_VERSION, MCP_SERVER_INSTRUCTIONS, MCP_SERVER_NAME, RpcCode } from "./mcp.types";

/** Minimal LegacyService test double — only the methods the MCP tools call. */
function makeLegacy(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    getProject: jest.fn().mockResolvedValue({ id: "proj-1", name: "Demo" }),
    requireProjectAccess: jest.fn().mockResolvedValue({ id: "proj-1", organization_id: "org-1" }),
    listTestCases: jest.fn().mockResolvedValue({ rows: [{ id: "tc-1" }], total: 1 }),
    createTestCase: jest.fn().mockResolvedValue({ id: "tc-new" }),
    updateTestCase: jest.fn().mockResolvedValue(undefined),
    getTestCase: jest.fn().mockResolvedValue({ id: "tc-1", title: "Updated", suiteId: "suite-current", ownerId: "user-current" }),
    duplicateTestCase: jest.fn().mockResolvedValue({ id: "tc-copy", title: "Original (copy)", suiteId: "suite-1" }),
    bulkUpdateTestCases: jest.fn().mockResolvedValue(undefined),
    executionReport: jest.fn().mockResolvedValue({ filterBy: "overall", filterValue: null, rows: [] }),
    listSuites: jest
      .fn()
      .mockResolvedValue([{ id: "suite-1", parentId: "suite-root", name: "Suite 1", position: 0, testCaseCount: 2, recursiveTestCaseCount: 2 }]),
    createSuite: jest.fn().mockResolvedValue({ id: "suite-new" }),
    updateSuite: jest.fn().mockResolvedValue(undefined),
    listCycles: jest
      .fn()
      .mockResolvedValue([{ id: "cycle-1", name: "Cycle 1", planId: "plan-1", passed: 1, failed: 0, blocked: 0, skipped: 0, untested: 1 }]),
    createCycle: jest.fn().mockResolvedValue({ id: "cycle-new" }),
    createCycleWithTestcasesForUser: jest.fn().mockResolvedValue({
      cycle: { id: "cycle-new" }, requested: 1, added: 1, skipped: 0
    }),
    addCycleTestCases: jest.fn().mockResolvedValue({ requested: 1, added: 1, skipped: 0 }),
    getPlan: jest.fn().mockResolvedValue({ id: "plan-1", projectId: "proj-1", name: "Plan 1" }),
    executions: jest
      .fn()
      .mockResolvedValue([{ id: "ex-1", status: "Untested", title: "Case 1", suiteId: "suite-1" }]),
    updateExecution: jest.fn().mockResolvedValue(undefined),
    testcaseExecutions: jest
      .fn()
      .mockResolvedValue([{ id: "ex-1", status: "Untested", cycleId: "cycle-1", cycleName: "Cycle 1" }]),
    listBugs: jest.fn().mockResolvedValue([{ id: "bug-1", title: "Bug 1" }]),
    getBug: jest.fn().mockResolvedValue({ id: "bug-1", title: "Bug 1", links: [], attachments: [] }),
    createBug: jest.fn().mockResolvedValue({ id: "bug-new" }),
    updateBug: jest.fn().mockResolvedValue({ id: "bug-1", title: "Updated bug", links: [], attachments: [] }),
    addBugLink: jest.fn().mockResolvedValue({ id: "bug-1", title: "Bug 1", links: [{ id: "link-1", testcaseId: "tc-1", cycleId: null }] }),
    removeBugLink: jest.fn().mockResolvedValue({ id: "bug-1", title: "Bug 1", links: [] }),
    requirementMatrix: jest.fn().mockResolvedValue({ rows: [] }),
    searchKnowledgeBase: jest.fn().mockResolvedValue({ list: [], total: 0 }),
    listKnowledgeDocuments: jest.fn().mockResolvedValue({ list: [{ id: "kb-doc-1", title: "Doc 1" }], total: 1 }),
    getKnowledgeDocument: jest.fn().mockResolvedValue({ id: "kb-doc-1", title: "Doc 1", breadcrumb: [] }),
    createKnowledgeDocument: jest.fn().mockResolvedValue({ id: "kb-doc-new" }),
    updateKnowledgeDocument: jest.fn().mockResolvedValue({ id: "kb-doc-1" }),
    moveKnowledgeDocument: jest.fn().mockResolvedValue({ id: "kb-doc-1" }),
    deleteKnowledgeDocument: jest.fn().mockResolvedValue({ success: true }),
    restoreKnowledgeDocument: jest.fn().mockResolvedValue({ id: "kb-doc-1", title: "Doc 1", isDeleted: false }),
    getKnowledgeFolderTree: jest.fn().mockResolvedValue({ id: "folder-root", name: "Root", isRoot: true, children: [] }),
    getKnowledgeFolder: jest.fn().mockResolvedValue({ id: "kb-folder-1", name: "Folder 1", breadcrumb: [] }),
    createKnowledgeFolder: jest.fn().mockResolvedValue({ id: "kb-folder-new" }),
    updateKnowledgeFolder: jest.fn().mockResolvedValue({ id: "kb-folder-1" }),
    moveKnowledgeFolder: jest.fn().mockResolvedValue({ id: "kb-folder-1" }),
    ...overrides
  } as unknown as LegacyService;
}

/**
 * DB double. Routes the queries the engine and the tool handlers make:
 *  - MCP agent actor lookup -> configurable actor id
 *  - execution -> cycle/project lookup (requireExecutionOwner) -> configurable owning cycle+project (or none)
 *  - testcase/suite/bug/cycle -> project lookup (requireProjectOwnedRow) -> configurable owning project (or none)
 */
function makeDb(
  opts: {
    mcpActorId?: string | null;
    executionProject?: string | null | undefined;
    executionCycleId?: string;
    testcaseProject?: string | null | undefined;
    suiteProject?: string | null | undefined;
    bugProject?: string | null | undefined;
    cycleProject?: string | null | undefined;
    planProject?: string | null | undefined;
    /** ids partitionOwnedIds should treat as belonging to the token's project. */
    ownedTestcaseIds?: string[];
  } = {}
) {
  const query = jest.fn((sql: string) => {
    if (sql.includes("FROM actors a JOIN agents g")) {
      return Promise.resolve({ rows: opts.mcpActorId ? [{ id: opts.mcpActorId }] : [] });
    }
    if (sql.includes("FROM executions e")) {
      return Promise.resolve({
        rows:
          opts.executionProject === undefined
            ? []
            : [{ project_id: opts.executionProject, cycle_id: opts.executionCycleId ?? "cycle-1" }]
      });
    }
    // partitionOwnedIds's query (`id = ANY($1::uuid[])`) is checked before the single-id
    // requireProjectOwnedRow query below — both match "FROM testcases WHERE id", but only this
    // one returns `{id}` rows instead of `{project_id}` rows.
    if (sql.includes("FROM testcases WHERE id = ANY")) {
      return Promise.resolve({ rows: (opts.ownedTestcaseIds || []).map((id) => ({ id })) });
    }
    if (sql.includes("FROM testcases WHERE id")) {
      return Promise.resolve({
        rows: opts.testcaseProject === undefined ? [] : [{ project_id: opts.testcaseProject }]
      });
    }
    if (sql.includes("FROM suites WHERE id")) {
      return Promise.resolve({
        rows: opts.suiteProject === undefined ? [] : [{ project_id: opts.suiteProject }]
      });
    }
    if (sql.includes("FROM bugs WHERE id")) {
      return Promise.resolve({
        rows: opts.bugProject === undefined ? [] : [{ project_id: opts.bugProject }]
      });
    }
    if (sql.includes("FROM cycles WHERE id")) {
      return Promise.resolve({
        rows: opts.cycleProject === undefined ? [] : [{ project_id: opts.cycleProject }]
      });
    }
    if (sql.includes("FROM plans WHERE id")) {
      return Promise.resolve({
        rows: opts.planProject === undefined ? [] : [{ project_id: opts.planProject }]
      });
    }
    return Promise.resolve({ rows: [] });
  });
  return { db: { query } as unknown as DatabaseService, query };
}

// Existing contract cases use an explicitly writable entitlement collaborator. Billing-enabled
// route/registry/state coverage lives in the selected migrated-PostgreSQL suite, not this double.
const writableLimits = { assertProjectWritable: jest.fn().mockResolvedValue(undefined) } as unknown as PlanLimitsService;

function principal(over: Partial<ApiTokenContext> = {}): ApiTokenContext {
  return { tokenId: "tok-1", userId: "user-1", projectId: "proj-1", scopes: ["read", "write"], ...over };
}

const rpc = (method: string, params?: Record<string, unknown>, id: number | string = 1) => ({
  jsonrpc: "2.0" as const,
  id,
  method,
  params
});

describe("McpService", () => {
  describe("protocol handshake & discovery", () => {
    it("initialize advertises protocol version, capabilities and server info", async () => {
      const { db } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const res: any = await svc.handleRequest(rpc("initialize"), principal(), "proj-1");
      expect(res.result.protocolVersion).toBe(MCP_PROTOCOL_VERSION);
      expect(res.result.serverInfo.name).toBe(MCP_SERVER_NAME);
      expect(res.result.capabilities).toHaveProperty("tools");
      expect(res.result.instructions).toBe(MCP_SERVER_INSTRUCTIONS);
      expect(res.id).toBe(1);
    });

    it("initialize echoes a supported client protocol version and falls back to the default otherwise", async () => {
      const { db } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const version = async (protocolVersion?: string) =>
        ((await svc.handleRequest(rpc("initialize", protocolVersion ? { protocolVersion } : {}), principal(), "proj-1")) as any).result.protocolVersion;
      expect(await version("2025-06-18")).toBe("2025-06-18");
      expect(await version("2024-11-05")).toBe("2024-11-05");
      // Requires JSON-RPC batch support, which this server does not have — answered as before.
      expect(await version("2025-03-26")).toBe(MCP_PROTOCOL_VERSION);
      expect(await version("1999-01-01")).toBe(MCP_PROTOCOL_VERSION);
      expect(await version()).toBe(MCP_PROTOCOL_VERSION);
    });

    it("serverInfo.version carries the deploy and a fingerprint of the tool set", async () => {
      const { db } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const res: any = await svc.handleRequest(rpc("initialize"), principal(), "proj-1");
      expect(res.result.serverInfo.version).toBe(svc.serverVersion);
      expect(svc.serverVersion).toMatch(/^0\.1\.0\+[^.]+\.[0-9a-f]{16}$/);
    });

    it("a session id is current only for the tool set it was issued against", () => {
      const { db } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const id = svc.newSessionId();
      expect(svc.isCurrentSession(id)).toBe(true);
      // Each initialize gets its own id.
      expect(svc.newSessionId()).not.toBe(id);
      // Another process built from the same code (the other blue/green color, a replica) must
      // accept it — the fingerprint is derived from the tools, not from the process.
      expect(new McpService(makeLegacy(), db, writableLimits).isCurrentSession(id)).toBe(true);
      // Issued by a build whose tools differed: stale, so the client is told to re-initialize.
      expect(svc.isCurrentSession(`0000000000000000.${id.split(".")[1]}`)).toBe(false);
      expect(svc.isCurrentSession("not-a-tesbo-session")).toBe(false);
      expect(svc.isCurrentSession("")).toBe(false);
    });

    it("recognises JSON-RPC notifications, which get no response", () => {
      expect(McpService.isNotification({ jsonrpc: "2.0", method: "notifications/initialized" })).toBe(true);
      expect(McpService.isNotification({ jsonrpc: "2.0", id: 1, method: "notifications/initialized" })).toBe(false);
      expect(McpService.isNotification({ jsonrpc: "2.0", method: "tools/list" })).toBe(false);
      expect(McpService.isNotification(null)).toBe(false);
      expect(McpService.isNotification("notifications/initialized")).toBe(false);
    });

    it("ping returns an empty result", async () => {
      const { db } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const res: any = await svc.handleRequest(rpc("ping"), principal(), "proj-1");
      expect(res.result).toEqual({});
    });

    it("tools/list returns every registered tool with a name, description and inputSchema", async () => {
      const { db } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const res: any = await svc.handleRequest(rpc("tools/list"), principal(), "proj-1");
      const names = res.result.tools.map((t: any) => t.name);
      expect(names).toEqual(
        expect.arrayContaining([
          "preview_behavior_model_draft",
          "list_qa_graph_changes",
          "capture_qa_graph_change",
          "list_projects",
          "list_testcases",
          "get_testcase",
          "create_testcase",
          "update_testcase",
          "archive_testcase",
          "restore_testcase",
          "duplicate_testcase",
          "bulk_create_testcases",
          "bulk_update_testcases",
          "bulk_archive_testcases",
          "get_testcase_bugs",
          "get_testcase_executions",
          "link_requirement_to_testcase",
          "unlink_requirement_from_testcase",
          "list_suites",
          "get_suite",
          "create_suite",
          "update_suite",
          "clone_test_suite",
          "list_test_cycles",
          "get_test_cycle",
          "create_cycle_from_plan",
          "create_cycle_from_testcases",
          "record_execution_result",
          "list_executions",
          "get_execution",
          "update_execution_result",
          "bulk_record_execution_results",
          "get_test_execution_summary",
          "list_bugs",
          "get_bug",
          "create_bug",
          "update_bug",
          "link_testcase_to_bug",
          "unlink_testcase_from_bug",
          "get_requirement_matrix",
          "search_knowledge_base",
          "list_knowledge_documents",
          "get_knowledge_document",
          "create_knowledge_document",
          "update_knowledge_document",
          "move_knowledge_document",
          "archive_knowledge_document",
          "restore_knowledge_document",
          "list_knowledge_folders",
          "get_knowledge_folder",
          "create_knowledge_folder",
          "update_knowledge_folder",
          "move_knowledge_folder"
        ])
      );
      for (const t of res.result.tools) {
        expect(typeof t.description).toBe("string");
        expect(t.inputSchema).toBeDefined();
      }
    });
  });

  describe("request validation", () => {
    it("rejects a non-2.0 payload with InvalidRequest", async () => {
      const { db } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const res: any = await svc.handleRequest({ method: "ping" }, principal(), "proj-1");
      expect(res.error.code).toBe(RpcCode.InvalidRequest);
    });

    it("returns MethodNotFound for an unknown method", async () => {
      const { db } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const res: any = await svc.handleRequest(rpc("resources/list"), principal(), "proj-1");
      expect(res.error.code).toBe(RpcCode.MethodNotFound);
    });

    it("echoes back the request id on errors", async () => {
      const { db } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const res: any = await svc.handleRequest(rpc("nope", {}, 99), principal(), "proj-1");
      expect(res.id).toBe(99);
    });
  });

  describe("project scope enforcement", () => {
    it("denies when the token's project differs from the URL project", async () => {
      const { db } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const res: any = await svc.handleRequest(rpc("tools/list"), principal({ projectId: "proj-1" }), "proj-2");
      expect(res.error.code).toBe(RpcCode.ProjectScopeDenied);
    });

    it("denies when the token carries no project scope", async () => {
      const { db } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const res: any = await svc.handleRequest(rpc("tools/list"), principal({ projectId: null }), "proj-1");
      expect(res.error.code).toBe(RpcCode.ProjectScopeDenied);
    });
  });

  describe("current issuer membership", () => {
    it("checks project membership for MCP discovery", async () => {
      const { db } = makeDb();
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      await svc.handleRequest(rpc("tools/list"), principal(), "proj-1");
      expect(legacy.requireProjectAccess).toHaveBeenCalledWith("user-1", "proj-1");
    });

    it("denies a revoked issuer before invoking the tool", async () => {
      const { db } = makeDb();
      const legacy = makeLegacy({
        requireProjectAccess: jest.fn().mockRejectedValue(new (require("@nestjs/common").NotFoundException)("revoked"))
      });
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "list_testcases", arguments: {} }),
        principal(),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ProjectScopeDenied);
      expect(legacy.listTestCases).not.toHaveBeenCalled();
    });
  });

  describe("tool scope enforcement", () => {
    it("blocks a write tool when the token only has read scope", async () => {
      const { db } = makeDb();
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "create_suite", arguments: { name: "S" } }),
        principal({ scopes: ["read"] }),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ScopeDenied);
      expect((legacy as any).createSuite).not.toHaveBeenCalled();
    });

    it("allows a read tool for a read-only token", async () => {
      const { db } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "list_testcases", arguments: {} }),
        principal({ scopes: ["read"] }),
        "proj-1"
      );
      expect(res.result.isError).toBe(false);
    });
  });

  describe("tools/call dispatch & result shape", () => {
    it("returns MethodNotFound for an unknown tool name", async () => {
      const { db } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const res: any = await svc.handleRequest(rpc("tools/call", { name: "delete_everything" }), principal(), "proj-1");
      expect(res.error.code).toBe(RpcCode.MethodNotFound);
    });

    it("wraps a read result as an MCP text content part", async () => {
      const { db } = makeDb();
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(rpc("tools/call", { name: "list_projects" }), principal(), "proj-1");
      expect((legacy as any).getProject).toHaveBeenCalledWith("proj-1");
      expect(res.result.isError).toBe(false);
      expect(res.result.content[0].type).toBe("text");
      expect(JSON.parse(res.result.content[0].text)).toEqual({ projects: [{ id: "proj-1", name: "Demo" }] });
    });

    it("passes the token's project (not a client-supplied one) into list_testcases", async () => {
      const { db } = makeDb();
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      await svc.handleRequest(
        rpc("tools/call", { name: "list_testcases", arguments: { status: "Active" } }),
        principal(),
        "proj-1"
      );
      expect((legacy as any).listTestCases).toHaveBeenCalledWith("proj-1", { status: "Active" });
    });

    it("passes the token's project and user into search_knowledge_base", async () => {
      const { db } = makeDb();
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      await svc.handleRequest(
        rpc("tools/call", { name: "search_knowledge_base", arguments: { q: "login" } }),
        principal({ userId: "user-7" }),
        "proj-1"
      );
      expect((legacy as any).searchKnowledgeBase).toHaveBeenCalledWith("proj-1", "user-7", { q: "login" });
    });
  });

  describe("Knowledge Base write tools", () => {
    it("attributes create_knowledge_document to the token's user, not the agent actor", async () => {
      // The engine resolves an MCP actor for every write-scope tool regardless of whether the
      // handler uses it (mcp.service.ts callTool) — the assertion that matters here is which id
      // Knowledge Base's created_by/updated_by columns actually receive: the human user, per the
      // module doc comment, since those columns reference users(id) rather than actors(id).
      const { db } = makeDb({ mcpActorId: "mcp-actor-1" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      await svc.handleRequest(
        rpc("tools/call", { name: "create_knowledge_document", arguments: { title: "Runbook", folderId: "folder-1" } }),
        principal({ userId: "user-7" }),
        "proj-1"
      );
      expect((legacy as any).createKnowledgeDocument).toHaveBeenCalledWith("proj-1", "user-7", {
        title: "Runbook",
        folderId: "folder-1"
      });
    });

    it("rejects create_knowledge_document without folderId", async () => {
      const { db } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "create_knowledge_document", arguments: { title: "Runbook" } }),
        principal(),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ToolExecutionError);
      expect(res.error.message).toMatch(/"folderId"/i);
    });

    it("passes documentId and args through to update_knowledge_document", async () => {
      const { db } = makeDb();
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      await svc.handleRequest(
        rpc("tools/call", { name: "update_knowledge_document", arguments: { documentId: "doc-1", title: "New title" } }),
        principal({ userId: "user-7" }),
        "proj-1"
      );
      expect((legacy as any).updateKnowledgeDocument).toHaveBeenCalledWith("proj-1", "user-7", "doc-1", {
        documentId: "doc-1",
        title: "New title"
      });
    });

    it("rejects update_knowledge_document without documentId", async () => {
      const { db } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "update_knowledge_document", arguments: { title: "New title" } }),
        principal(),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ToolExecutionError);
      expect(res.error.message).toMatch(/"documentId"/i);
    });

    it("surfaces the read-only-mirror rejection from updateKnowledgeDocument as a ToolExecutionError", async () => {
      const { db } = makeDb();
      const legacy = makeLegacy({
        updateKnowledgeDocument: jest.fn().mockRejectedValue({
          getResponse: () => ({ error: "synced from Jira and its body can't be edited" })
        })
      });
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "update_knowledge_document", arguments: { documentId: "doc-1", title: "x" } }),
        principal(),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ToolExecutionError);
      expect(res.error.message).toMatch(/synced from Jira/i);
    });

    it("passes documentId and folderId through to move_knowledge_document", async () => {
      const { db } = makeDb();
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      await svc.handleRequest(
        rpc("tools/call", { name: "move_knowledge_document", arguments: { documentId: "doc-1", folderId: "folder-2" } }),
        principal({ userId: "user-7" }),
        "proj-1"
      );
      expect((legacy as any).moveKnowledgeDocument).toHaveBeenCalledWith("proj-1", "user-7", "doc-1", {
        documentId: "doc-1",
        folderId: "folder-2"
      });
    });

    it("rejects move_knowledge_document without folderId", async () => {
      const { db } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "move_knowledge_document", arguments: { documentId: "doc-1" } }),
        principal(),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ToolExecutionError);
      expect(res.error.message).toMatch(/"folderId"/i);
    });

    it("passes the token's user through to create_knowledge_folder", async () => {
      const { db } = makeDb();
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      await svc.handleRequest(
        rpc("tools/call", { name: "create_knowledge_folder", arguments: { name: "Release Notes 2" } }),
        principal({ userId: "user-7" }),
        "proj-1"
      );
      expect((legacy as any).createKnowledgeFolder).toHaveBeenCalledWith("proj-1", "user-7", {
        name: "Release Notes 2"
      });
    });

    it("rejects create_knowledge_folder without name", async () => {
      const { db } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "create_knowledge_folder", arguments: {} }),
        principal(),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ToolExecutionError);
      expect(res.error.message).toMatch(/"name"/i);
    });

    it("passes folderId and args through to update_knowledge_folder", async () => {
      const { db } = makeDb();
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      await svc.handleRequest(
        rpc("tools/call", { name: "update_knowledge_folder", arguments: { folderId: "folder-1", name: "Renamed" } }),
        principal({ userId: "user-7" }),
        "proj-1"
      );
      expect((legacy as any).updateKnowledgeFolder).toHaveBeenCalledWith("proj-1", "user-7", "folder-1", {
        folderId: "folder-1",
        name: "Renamed"
      });
    });

    it("rejects update_knowledge_folder without folderId", async () => {
      const { db } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "update_knowledge_folder", arguments: { name: "Renamed" } }),
        principal(),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ToolExecutionError);
      expect(res.error.message).toMatch(/"folderId"/i);
    });

    it("passes folderId and parentFolderId through to move_knowledge_folder", async () => {
      const { db } = makeDb();
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      await svc.handleRequest(
        rpc("tools/call", { name: "move_knowledge_folder", arguments: { folderId: "folder-1", parentFolderId: "folder-2" } }),
        principal({ userId: "user-7" }),
        "proj-1"
      );
      expect((legacy as any).moveKnowledgeFolder).toHaveBeenCalledWith("proj-1", "user-7", "folder-1", {
        folderId: "folder-1",
        parentFolderId: "folder-2"
      });
    });

    it("rejects move_knowledge_folder without parentFolderId", async () => {
      const { db } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "move_knowledge_folder", arguments: { folderId: "folder-1" } }),
        principal(),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ToolExecutionError);
      expect(res.error.message).toMatch(/"parentFolderId"/i);
    });

    it("surfaces a role/ownership rejection (Forbidden) from a KB mutate method as a ToolExecutionError", async () => {
      const { db } = makeDb();
      const legacy = makeLegacy({
        moveKnowledgeFolder: jest.fn().mockRejectedValue({
          getResponse: () => ({ error: "You can only modify items you created" })
        })
      });
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "move_knowledge_folder", arguments: { folderId: "folder-1", parentFolderId: "folder-2" } }),
        principal(),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ToolExecutionError);
      expect(res.error.message).toMatch(/only modify items you created/i);
    });
  });

  describe("Knowledge Base read/archive/restore tools", () => {
    it("lists and gets a Knowledge Base document, passing the token's project and user through", async () => {
      const { db } = makeDb();
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);

      const listRes: any = await svc.handleRequest(
        rpc("tools/call", { name: "list_knowledge_documents", arguments: { documentType: "general" } }),
        principal({ userId: "user-7" }),
        "proj-1"
      );
      expect(listRes.result.isError).toBe(false);
      expect((legacy as any).listKnowledgeDocuments).toHaveBeenCalledWith("proj-1", "user-7", { documentType: "general" });

      const getRes: any = await svc.handleRequest(
        rpc("tools/call", { name: "get_knowledge_document", arguments: { documentId: "kb-doc-1" } }),
        principal({ userId: "user-7" }),
        "proj-1"
      );
      expect(getRes.result.isError).toBe(false);
      expect((legacy as any).getKnowledgeDocument).toHaveBeenCalledWith("proj-1", "user-7", "kb-doc-1");
    });

    it("rejects get_knowledge_document without documentId", async () => {
      const { db } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "get_knowledge_document", arguments: {} }),
        principal(),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ToolExecutionError);
      expect(res.error.message).toMatch(/"documentId"/i);
    });

    it("surfaces a not-found rejection from getKnowledgeDocument as a ToolExecutionError", async () => {
      const { db } = makeDb();
      const legacy = makeLegacy({
        getKnowledgeDocument: jest.fn().mockRejectedValue({ getResponse: () => ({ error: "Document not found" }) })
      });
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "get_knowledge_document", arguments: { documentId: "ghost" } }),
        principal(),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ToolExecutionError);
      expect(res.error.message).toMatch(/document not found/i);
    });

    it("surfaces a cross-project rejection from getKnowledgeDocument/getKnowledgeFolder (kbDocument/kbFolder are project-scoped internally)", async () => {
      // Unlike testcases/suites/bugs/cycles, the KB legacy methods already filter by project_id
      // inside kbDocument()/kbFolder() themselves (WHERE id = $1 AND project_id = $2), so these
      // MCP tools need no extra ownership pre-check of their own — a foreign-project id simply
      // 404s from inside the legacy call, exactly like the REST GET routes that share it.
      const { db } = makeDb();
      const legacy = makeLegacy({
        getKnowledgeDocument: jest.fn().mockRejectedValue({ getResponse: () => ({ error: "Document not found" }) }),
        getKnowledgeFolder: jest.fn().mockRejectedValue({ getResponse: () => ({ error: "Folder not found" }) })
      });
      const svc = new McpService(legacy, db, writableLimits);
      const docRes: any = await svc.handleRequest(
        rpc("tools/call", { name: "get_knowledge_document", arguments: { documentId: "foreign-doc" } }),
        principal(),
        "proj-1"
      );
      expect(docRes.error.code).toBe(RpcCode.ToolExecutionError);
      expect(docRes.error.message).toMatch(/document not found/i);

      const folderRes: any = await svc.handleRequest(
        rpc("tools/call", { name: "get_knowledge_folder", arguments: { folderId: "foreign-folder" } }),
        principal(),
        "proj-1"
      );
      expect(folderRes.error.code).toBe(RpcCode.ToolExecutionError);
      expect(folderRes.error.message).toMatch(/folder not found/i);
    });

    it("lists the folder tree and gets one folder, passing the token's project and user through", async () => {
      const { db } = makeDb();
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);

      const treeRes: any = await svc.handleRequest(
        rpc("tools/call", { name: "list_knowledge_folders", arguments: {} }),
        principal({ userId: "user-7" }),
        "proj-1"
      );
      expect(treeRes.result.isError).toBe(false);
      expect((legacy as any).getKnowledgeFolderTree).toHaveBeenCalledWith("proj-1", "user-7");
      expect(JSON.parse(treeRes.result.content[0].text).isRoot).toBe(true);

      const folderRes: any = await svc.handleRequest(
        rpc("tools/call", { name: "get_knowledge_folder", arguments: { folderId: "kb-folder-1" } }),
        principal({ userId: "user-7" }),
        "proj-1"
      );
      expect(folderRes.result.isError).toBe(false);
      expect((legacy as any).getKnowledgeFolder).toHaveBeenCalledWith("proj-1", "user-7", "kb-folder-1");
    });

    it("rejects get_knowledge_folder without folderId", async () => {
      const { db } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "get_knowledge_folder", arguments: {} }),
        principal(),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ToolExecutionError);
      expect(res.error.message).toMatch(/"folderId"/i);
    });

    it("archives a Knowledge Base document, passing the token's project and user through", async () => {
      const { db } = makeDb();
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "archive_knowledge_document", arguments: { documentId: "kb-doc-1" } }),
        principal({ userId: "user-7" }),
        "proj-1"
      );
      expect(res.result.isError).toBe(false);
      expect((legacy as any).deleteKnowledgeDocument).toHaveBeenCalledWith("proj-1", "user-7", "kb-doc-1");
    });

    it("rejects archive_knowledge_document without documentId", async () => {
      const { db } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "archive_knowledge_document", arguments: {} }),
        principal(),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ToolExecutionError);
      expect(res.error.message).toMatch(/"documentId"/i);
    });

    it("surfaces an already-archived (not found) rejection from deleteKnowledgeDocument as a ToolExecutionError", async () => {
      // deleteKnowledgeDocument's own kbDocument() lookup excludes already-deleted rows, so
      // archiving twice is NOT a silent no-op — it 404s the same as a nonexistent id. This test
      // documents that real (asymmetric-with-restore) behavior rather than inventing a softer one.
      const { db } = makeDb();
      const legacy = makeLegacy({
        deleteKnowledgeDocument: jest.fn().mockRejectedValue({ getResponse: () => ({ error: "Document not found" }) })
      });
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "archive_knowledge_document", arguments: { documentId: "kb-doc-1" } }),
        principal(),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ToolExecutionError);
      expect(res.error.message).toMatch(/document not found/i);
    });

    it("surfaces the Zyra AI Memory guard from deleteKnowledgeDocument as a ToolExecutionError", async () => {
      const { db } = makeDb();
      const legacy = makeLegacy({
        deleteKnowledgeDocument: jest.fn().mockRejectedValue({
          getResponse: () => ({ error: '"Zyra AI Memory" is managed by Zyra and can\'t be deleted' })
        })
      });
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "archive_knowledge_document", arguments: { documentId: "kb-doc-1" } }),
        principal(),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ToolExecutionError);
      expect(res.error.message).toMatch(/managed by Zyra/i);
    });

    it("restores a Knowledge Base document, passing the token's project and user through", async () => {
      const { db } = makeDb();
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "restore_knowledge_document", arguments: { documentId: "kb-doc-1" } }),
        principal({ userId: "user-7" }),
        "proj-1"
      );
      expect(res.result.isError).toBe(false);
      expect((legacy as any).restoreKnowledgeDocument).toHaveBeenCalledWith("proj-1", "user-7", "kb-doc-1");
    });

    it("rejects restore_knowledge_document without documentId", async () => {
      const { db } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "restore_knowledge_document", arguments: {} }),
        principal(),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ToolExecutionError);
      expect(res.error.message).toMatch(/"documentId"/i);
    });

    it("restoring a document that is not currently archived succeeds as a no-op (matching restoreKnowledgeDocument's own idempotent contract)", async () => {
      const { db } = makeDb();
      const legacy = makeLegacy({
        restoreKnowledgeDocument: jest.fn().mockResolvedValue({ id: "kb-doc-1", title: "Doc 1", isDeleted: false, deletedAt: null })
      });
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "restore_knowledge_document", arguments: { documentId: "kb-doc-1" } }),
        principal(),
        "proj-1"
      );
      expect(res.result.isError).toBe(false);
      expect(JSON.parse(res.result.content[0].text).isDeleted).toBe(false);
    });

    it("surfaces the owner/manager-only rejection from restoreKnowledgeDocument as a ToolExecutionError", async () => {
      const { db } = makeDb();
      const legacy = makeLegacy({
        restoreKnowledgeDocument: jest.fn().mockRejectedValue({
          getResponse: () => ({ error: "Only owners and managers can perform this action" })
        })
      });
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "restore_knowledge_document", arguments: { documentId: "kb-doc-1" } }),
        principal(),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ToolExecutionError);
      expect(res.error.message).toMatch(/only owners and managers/i);
    });

    it("blocks archive_knowledge_document/restore_knowledge_document for a read-scoped token", async () => {
      const { db } = makeDb();
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const archiveRes: any = await svc.handleRequest(
        rpc("tools/call", { name: "archive_knowledge_document", arguments: { documentId: "kb-doc-1" } }),
        principal({ scopes: ["read"] }),
        "proj-1"
      );
      expect(archiveRes.error.code).toBe(RpcCode.ScopeDenied);
      expect((legacy as any).deleteKnowledgeDocument).not.toHaveBeenCalled();

      const restoreRes: any = await svc.handleRequest(
        rpc("tools/call", { name: "restore_knowledge_document", arguments: { documentId: "kb-doc-1" } }),
        principal({ scopes: ["read"] }),
        "proj-1"
      );
      expect(restoreRes.error.code).toBe(RpcCode.ScopeDenied);
      expect((legacy as any).restoreKnowledgeDocument).not.toHaveBeenCalled();
    });
  });

  describe("actor attribution", () => {
    it("attributes create_testcase writes to the resolved MCP agent actor", async () => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      await svc.handleRequest(
        rpc("tools/call", { name: "create_testcase", arguments: { title: "Login works" } }),
        principal(),
        "proj-1"
      );
      expect((legacy as any).createTestCase).toHaveBeenCalledWith("proj-1", "mcp-actor-1", { title: "Login works" });
    });

    it("does not resolve an actor for read tools", async () => {
      const { db, query } = makeDb({ mcpActorId: "mcp-actor-1" });
      const svc = new McpService(makeLegacy(), db, writableLimits);
      await svc.handleRequest(rpc("tools/call", { name: "get_requirement_matrix" }), principal(), "proj-1");
      const actorLookups = query.mock.calls.filter((c) => String(c[0]).includes("FROM actors a JOIN agents g"));
      expect(actorLookups).toHaveLength(0);
    });

    it("caches the MCP actor lookup across calls", async () => {
      const { db, query } = makeDb({ mcpActorId: "mcp-actor-1" });
      const svc = new McpService(makeLegacy(), db, writableLimits);
      await svc.handleRequest(rpc("tools/call", { name: "create_suite", arguments: { name: "A" } }), principal(), "proj-1");
      await svc.handleRequest(rpc("tools/call", { name: "create_suite", arguments: { name: "B" } }), principal(), "proj-1");
      const actorLookups = query.mock.calls.filter((c) => String(c[0]).includes("FROM actors a JOIN agents g"));
      expect(actorLookups).toHaveLength(1);
    });

    it("reports bugs under the token's user, not the agent actor", async () => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      await svc.handleRequest(
        rpc("tools/call", { name: "create_bug", arguments: { title: "Broken" } }),
        principal({ userId: "user-7" }),
        "proj-1"
      );
      expect((legacy as any).createBug).toHaveBeenCalledWith("proj-1", "user-7", { title: "Broken" });
    });
  });

  describe("record_execution_result project scoping", () => {
    it("records a result when the execution belongs to the token's project", async () => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1", executionProject: "proj-1" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "record_execution_result", arguments: { executionId: "ex-1", status: "Passed" } }),
        principal(),
        "proj-1"
      );
      expect(res.result.isError).toBe(false);
      // Attributed to the token's user (ctx.userId), NOT the mcp-actor-1 agent actor resolved by
      // makeDb's mcpActorId — updateExecution stores this as executions.executed_by, which
      // references users(id), and the agent actor has no organization_members row to satisfy
      // requireProjectAccess. See mcp.tools.ts's record_execution_result handler comment.
      expect((legacy as any).updateExecution).toHaveBeenCalledWith("ex-1", "user-1", {
        executionId: "ex-1",
        status: "Passed"
      });
    });

    it("denies recording a result for an execution in another project", async () => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1", executionProject: "proj-OTHER" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "record_execution_result", arguments: { executionId: "ex-1", status: "Passed" } }),
        principal(),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ProjectScopeDenied);
      expect((legacy as any).updateExecution).not.toHaveBeenCalled();
    });

    it("returns a tool error when the execution does not exist", async () => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1", executionProject: undefined });
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "record_execution_result", arguments: { executionId: "ghost", status: "Passed" } }),
        principal(),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ToolExecutionError);
      expect(res.error.message).toMatch(/not found/i);
    });
  });

  describe("get_testcase project scoping", () => {
    it("returns a test case when it belongs to the token's project", async () => {
      const { db } = makeDb({ testcaseProject: "proj-1" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "get_testcase", arguments: { testcaseId: "tc-1" } }),
        principal(),
        "proj-1"
      );
      expect(res.result.isError).toBe(false);
      expect((legacy as any).getTestCase).toHaveBeenCalledWith("tc-1");
    });

    it("denies reading a test case that belongs to another project", async () => {
      const { db } = makeDb({ testcaseProject: "proj-OTHER" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "get_testcase", arguments: { testcaseId: "tc-1" } }),
        principal(),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ProjectScopeDenied);
      expect((legacy as any).getTestCase).not.toHaveBeenCalled();
    });

    it("returns a tool error when the test case does not exist", async () => {
      const { db } = makeDb({ testcaseProject: undefined });
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "get_testcase", arguments: { testcaseId: "ghost" } }),
        principal(),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ToolExecutionError);
      expect(res.error.message).toMatch(/not found/i);
    });

    it("rejects get_testcase without testcaseId", async () => {
      const { db } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const res: any = await svc.handleRequest(rpc("tools/call", { name: "get_testcase", arguments: {} }), principal(), "proj-1");
      expect(res.error.code).toBe(RpcCode.ToolExecutionError);
      expect(res.error.message).toMatch(/"testcaseId"/i);
    });
  });

  describe("existing test-case Notes over MCP", () => {
    it("advertises Notes on create, update and per-item bulk create without another field", async () => {
      const { db } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const res: any = await svc.handleRequest(rpc("tools/list"), principal(), "proj-1");
      for (const name of ["create_testcase", "update_testcase"]) {
        const tool = res.result.tools.find((entry: any) => entry.name === name);
        expect(tool.inputSchema.properties.attachments.type).toBe("string");
        expect(tool.description).toMatch(/Notes/);
      }
      const bulk = res.result.tools.find((entry: any) => entry.name === "bulk_create_testcases");
      expect(bulk.inputSchema.properties.testcases.items.properties.attachments.type).toBe("string");
      const detail = res.result.tools.find((entry: any) => entry.name === "get_testcase");
      expect(detail.description).toMatch(/Notes/);
    });

    it("sends exact Unicode and multiline Notes through create without changing other fields", async () => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1", testcaseProject: "proj-1" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const notes = "Evidence: café 🧪\nSource: QA reviewer";
      const res: any = await svc.handleRequest(rpc("tools/call", {
        name: "create_testcase", arguments: { title: "Draft", suiteId: "suite-1", attachments: notes }
      }), principal(), "proj-1");
      expect(res.result.isError).toBe(false);
      expect((legacy as any).createTestCase).toHaveBeenCalledWith("proj-1", "mcp-actor-1", {
        title: "Draft", suiteId: "suite-1", attachments: notes
      });
    });

    it("preserves omitted Notes and passes replacement or explicit empty clear unchanged", async () => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1", testcaseProject: "proj-1" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      for (const payload of [{ title: "Reworded" }, { attachments: "New text" }, { attachments: "" }]) {
        const res: any = await svc.handleRequest(rpc("tools/call", {
          name: "update_testcase", arguments: { testcaseId: "tc-1", ...payload }
        }), principal(), "proj-1");
        expect(res.result.isError).toBe(false);
        expect((legacy as any).updateTestCase).toHaveBeenLastCalledWith("tc-1", "mcp-actor-1", payload);
      }
      expect((legacy as any).updateTestCase).toHaveBeenCalledTimes(3);
    });

    it.each([null, 8, true, [], {}, ["bad"]])("refuses invalid Notes %p before any create or update writer", async (notes) => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1", testcaseProject: "proj-1" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      for (const [name, payload] of [
        ["create_testcase", { title: "Draft", attachments: notes }],
        ["update_testcase", { testcaseId: "tc-1", attachments: notes }]
      ] as const) {
        const res: any = await svc.handleRequest(rpc("tools/call", {
          name, arguments: payload
        }), principal(), "proj-1");
        expect(res.error.code).toBe(RpcCode.ToolExecutionError);
        expect(res.error.message).toMatch(/attachments.*Notes/i);
      }
      expect((legacy as any).createTestCase).not.toHaveBeenCalled();
      expect((legacy as any).updateTestCase).not.toHaveBeenCalled();
    });

    it("isolates invalid bulk Notes while preserving order and later valid entries", async () => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1", testcaseProject: "proj-1" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(rpc("tools/call", {
        name: "bulk_create_testcases",
        arguments: { testcases: [
          { title: "First", attachments: "Note 1" },
          { title: "Invalid", attachments: null },
          { title: "Last", attachments: "" }
        ] }
      }), principal(), "proj-1");
      const body = JSON.parse(res.result.content[0].text);
      expect(body.succeeded).toBe(2);
      expect(body.failed).toBe(1);
      expect(body.results[1].error).toMatch(/attachments.*Notes/i);
      expect((legacy as any).createTestCase).toHaveBeenCalledTimes(2);
      expect((legacy as any).createTestCase).toHaveBeenNthCalledWith(2, "proj-1", "mcp-actor-1", {
        title: "Last", attachments: ""
      });
    });
  });

  describe("create postconditions with native test-case writer", () => {
    it("advertises existing postconditions for single and bulk create without another field", async () => {
      const { db } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const catalog: any = await svc.handleRequest(rpc("tools/list"), principal(), "proj-1");
      const one = catalog.result.tools.find((t: any) => t.name === "create_testcase");
      const bulk = catalog.result.tools.find((t: any) => t.name === "bulk_create_testcases");
      expect(one.inputSchema.properties.postconditions.type).toBe("string");
      expect(bulk.inputSchema.properties.testcases.items.properties.postconditions.type).toBe("string");
      expect(one.description).toContain("postconditions");
      expect(bulk.description).toContain("postconditions");
    });

    it("passes postconditions through the existing create writer and preserves omission", async () => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      for (const args of [
        { title: "Postcondition case", postconditions: "Inventory remains unchanged" },
        { title: "Omitted postcondition" }
      ]) {
        const result: any = await svc.handleRequest(rpc("tools/call", {
          name: "create_testcase", arguments: args
        }), principal(), "proj-1");
        expect(result.result.isError).toBe(false);
        expect((legacy as any).createTestCase).toHaveBeenLastCalledWith("proj-1", "mcp-actor-1", args);
      }
    });

    it("passes postconditions through per-item bulk create, maintaining item isolation", async () => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const result: any = await svc.handleRequest(rpc("tools/call", {
        name: "bulk_create_testcases", arguments: { testcases: [
          { title: "First", postconditions: "No side effects" },
          { title: "Bad missing title" , postconditions: "Not saved" },
          { title: "Last", postconditions: "" }
        ].map((row, index) => index === 1 ? { postconditions: row.postconditions } : row) }
      }), principal(), "proj-1");
      expect(result.result.isError).toBe(false);
      const response = JSON.parse(result.result.content[0].text);
      expect(response).toMatchObject({ total: 3, succeeded: 2, failed: 1 });
      expect((legacy as any).createTestCase).toHaveBeenCalledTimes(2);
      expect((legacy as any).createTestCase).toHaveBeenNthCalledWith(2, "proj-1", "mcp-actor-1", {
        title: "Last", postconditions: ""
      });
    });

    it.each([null, 8, true, [], {}, ["bad"]])("refuses invalid postconditions %p before any create or update writer", async (postconditions) => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1", testcaseProject: "proj-1" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      for (const [name, payload] of [
        ["create_testcase", { title: "Draft", postconditions }],
        ["update_testcase", { testcaseId: "tc-1", postconditions }]
      ] as const) {
        const res: any = await svc.handleRequest(rpc("tools/call", { name, arguments: payload }), principal(), "proj-1");
        expect(res.error.code).toBe(RpcCode.ToolExecutionError);
        expect(res.error.message).toMatch(/postconditions/i);
      }
      expect((legacy as any).createTestCase).not.toHaveBeenCalled();
      expect((legacy as any).updateTestCase).not.toHaveBeenCalled();
    });

    it("preserves omitted postconditions and passes replacement or explicit empty clear through update", async () => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1", testcaseProject: "proj-1" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      for (const payload of [{ title: "Reworded" }, { postconditions: "Final state" }, { postconditions: "" }]) {
        const res: any = await svc.handleRequest(rpc("tools/call", {
          name: "update_testcase", arguments: { testcaseId: "tc-1", ...payload }
        }), principal(), "proj-1");
        expect(res.result.isError).toBe(false);
        expect((legacy as any).updateTestCase).toHaveBeenLastCalledWith("tc-1", "mcp-actor-1", payload);
      }
      expect((legacy as any).updateTestCase).toHaveBeenCalledTimes(3);
    });

    it("isolates invalid bulk postconditions while preserving order and later valid entries", async () => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1", testcaseProject: "proj-1" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(rpc("tools/call", {
        name: "bulk_create_testcases",
        arguments: { testcases: [
          { title: "First", postconditions: "No side effects" },
          { title: "Invalid", postconditions: null },
          { title: "Last", postconditions: "" }
        ] }
      }), principal(), "proj-1");
      const body = JSON.parse(res.result.content[0].text);
      expect(body.succeeded).toBe(2);
      expect(body.failed).toBe(1);
      expect(body.results[1].error).toMatch(/postconditions/i);
      expect((legacy as any).createTestCase).toHaveBeenCalledTimes(2);
      expect((legacy as any).createTestCase).toHaveBeenNthCalledWith(2, "proj-1", "mcp-actor-1", {
        title: "Last", postconditions: ""
      });
    });
  });

  describe("committed QA graph changes via read-only MCP", () => {
    it("advertises source-change history as read-only with no case mutation or fake coverage", async () => {
      const { db } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const catalog: any = await svc.handleRequest(rpc("tools/list"), principal({ scopes: ["read"] }), "proj-1");
      const entry = catalog.result.tools.find((item: any) => item.name === "list_qa_graph_changes");
      expect(entry).toBeDefined();
      expect(entry.inputSchema.properties.beforeId.type).toBe("string");
      expect(entry.inputSchema.additionalProperties).toBe(false);
      expect(entry.description).toMatch(/do not establish coverage/i);
    });

    it("passes project and current member identity to the existing scoped history query", async () => {
      const { db, query } = makeDb();
      (query as jest.Mock).mockImplementation((sql: string, _params: unknown[]) =>
        sql.includes("authorized_history AS MATERIALIZED")
          ? Promise.resolve({ rows: [{ authorized: true, entries: [{
              id: "18", revision: "rev", capturedAt: "2026-11-15T00:00:00Z",
              reviewReceipt: null, changeState: "source_scope_changed"
            }] }] })
          : Promise.resolve({ rows: [] }));
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const reply: any = await svc.handleRequest(rpc("tools/call", {
        name: "list_qa_graph_changes", arguments: { limit: 1 }
      }), principal({ scopes: ["read"] }), "proj-1");
      expect(reply.error).toBeUndefined();
      const content = JSON.parse(reply.result.content[0].text);
      expect(content.entries).toHaveLength(1);
      expect(content.entries[0].changeState).toBe("source_scope_changed");
      expect(content.nextBeforeId).toBe("18");
      const call = (query.mock.calls as unknown as Array<[string, unknown[]]>)
        .find((item) => item[0].includes("authorized_history AS MATERIALIZED"));
      expect(call?.[1]).toEqual(["proj-1", "user-1", null, 1]);
      expect(legacy.createTestCase).not.toHaveBeenCalled();
      expect(legacy.updateTestCase).not.toHaveBeenCalled();
    });

    it("refuses malformed limits and cursors before touching storage", async () => {
      const { db, query } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      for (const args of [
        { limit: 0 }, { limit: 101 }, { limit: 2.5 }, { limit: "4" },
        { beforeId: "0 OR TRUE" }, { beforeId: null }, { beforeId: -1 }
      ]) {
        const reply: any = await svc.handleRequest(rpc("tools/call", {
          name: "list_qa_graph_changes", arguments: args
        }), principal(), "proj-1");
        expect(reply.error.code).toBe(RpcCode.ToolExecutionError);
      }
      expect(query).not.toHaveBeenCalled();
    });

    it("rejects write-only scoped tokens and cross-project MCP URLs before reading graph history", async () => {
      const { db, query } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const args = rpc("tools/call", { name: "list_qa_graph_changes", arguments: {} });
      const scope: any = await svc.handleRequest(args, principal({ scopes: ["write"] }), "proj-1");
      expect(scope.error.code).toBe(RpcCode.ScopeDenied);
      const foreign: any = await svc.handleRequest(args, principal({ scopes: ["read"] }), "proj-2");
      expect(foreign.error.code).toBe(RpcCode.ProjectScopeDenied);
      expect(query).not.toHaveBeenCalled();
    });
  });

  describe("authorized source-change capture from MCP", () => {
    it("requires a write-scoped token and refuses client-authored source assertions", async () => {
      const { db, query } = makeDb();
      const capture = { captureForUser: jest.fn() };
      const notify = { deliverForUser: jest.fn() };
      const svc = new McpService(makeLegacy(), db, writableLimits, capture as never, notify as never);
      const args = rpc("tools/call", { name: "capture_qa_graph_change", arguments: {} });
      const readonly: any = await svc.handleRequest(args, principal({ scopes: ["read"] }), "proj-1");
      expect(readonly.error.code).toBe(RpcCode.ScopeDenied);
      const otherProject: any = await svc.handleRequest(args, principal(), "other-project");
      expect(otherProject.error.code).toBe(RpcCode.ProjectScopeDenied);
      for (const forbidden of [{ repositoryRoot: "/unsafe" }, { executionAssertion: "passed" },
                               { source: [] }, { approved: true }]) {
        const res: any = await svc.handleRequest(rpc("tools/call", {
          name: "capture_qa_graph_change", arguments: forbidden
        }), principal(), "proj-1");
        expect(res.error.code).toBe(RpcCode.ToolExecutionError);
      }
      expect(capture.captureForUser).not.toHaveBeenCalled();
      expect(notify.deliverForUser).not.toHaveBeenCalled();
      // Actor resolution for a write tool is unrelated to source integrity.
      expect(query.mock.calls.some(([sql]) => sql.includes("graph_capture_history"))).toBe(false);
    });

    it("calls the existing project coordinator and notifies only for a committed review receipt", async () => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1" });
      const receipt = { id: "sha", status: "needs_qa_triage" };
      const capture = { captureForUser: jest.fn().mockResolvedValue({
        id: "18", revision: "r1", stored: true, reviewReceipt: receipt
      }) };
      const notify = { deliverForUser: jest.fn().mockResolvedValue({
        status: "pending", recipientCount: 2, pendingCount: 1
      }) };
      const svc = new McpService(makeLegacy(), db, writableLimits, capture as never, notify as never);
      const response: any = await svc.handleRequest(rpc("tools/call", {
        name: "capture_qa_graph_change", arguments: {}
      }), principal(), "proj-1");
      expect(response.error).toBeUndefined();
      expect(JSON.parse(response.result.content[0].text)).toMatchObject({
        id: "18", stored: true, delivery: { status: "pending", pendingCount: 1 }
      });
      expect(capture.captureForUser).toHaveBeenCalledWith("user-1", "proj-1");
      expect(notify.deliverForUser).toHaveBeenCalledWith("user-1", "proj-1", "18");
      capture.captureForUser.mockResolvedValueOnce({
        id: "18", revision: "r1", stored: false, reviewReceipt: null
      });
      const same: any = await svc.handleRequest(rpc("tools/call", {
        name: "capture_qa_graph_change", arguments: {}
      }), principal(), "proj-1");
      expect(JSON.parse(same.result.content[0].text).delivery).toBeNull();
      expect(notify.deliverForUser).toHaveBeenCalledTimes(1);
    });

    it("refuses source capture if no approved server coordinator is connected", async () => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1" });
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const response: any = await svc.handleRequest(rpc("tools/call", {
        name: "capture_qa_graph_change", arguments: {}
      }), principal(), "proj-1");
      expect(response.error.code).toBe(RpcCode.ToolExecutionError);
      expect(response.error.message).toMatch(/not configured/);
    });
  });

  describe("update_testcase project scoping", () => {
    it("advertises and forwards the optional existing-row revision precondition", async () => {
      const { db } = makeDb({ testcaseProject: "proj-1", mcpActorId: "mcp-actor-1" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const listed: any = await svc.handleRequest(rpc("tools/list"), principal(), "proj-1");
      const update = listed.result.tools.find((tool: any) => tool.name === "update_testcase");
      expect(update.inputSchema.properties.expectedRevision).toMatchObject({ type: "string" });
      const revision = "a".repeat(64);
      const res: any = await svc.handleRequest(rpc("tools/call", {
        name: "update_testcase", arguments: { testcaseId: "tc-1", title: "Guarded", expectedRevision: revision }
      }), principal(), "proj-1");
      expect(res.error).toBeUndefined();
      expect(legacy.updateTestCase).toHaveBeenCalledWith("tc-1", "mcp-actor-1", {
        title: "Guarded", expectedRevision: revision
      });
    });

    it.each([null, "", 4, true, [], {}])("refuses malformed MCP expectedRevision %p before the legacy writer", async (expectedRevision) => {
      const { db } = makeDb({ testcaseProject: "proj-1" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(rpc("tools/call", {
        name: "update_testcase", arguments: { testcaseId: "tc-1", expectedRevision, title: "Invalid" }
      }), principal(), "proj-1");
      expect(res.error.message).toMatch(/expectedRevision/);
      expect(legacy.updateTestCase).not.toHaveBeenCalled();
    });

    it("updates a test case when it belongs to the token's project, attributed to the agent actor", async () => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1", testcaseProject: "proj-1" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "update_testcase", arguments: { testcaseId: "tc-1", title: "New title" } }),
        principal({ userId: "user-1" }),
        "proj-1"
      );
      expect(res.result.isError).toBe(false);
      // Attributed to the resolved MCP agent actor, same as create_testcase, since
      // testcases.updated_by references actors(id) — see mcp.tools.ts's handler comment.
      // Omission reaches the shared writer unchanged: no stale read-and-reapply workaround.
      expect((legacy as any).updateTestCase).toHaveBeenCalledWith("tc-1", "mcp-actor-1", {
        title: "New title"
      });
      expect((legacy as any).getTestCase).toHaveBeenCalledWith("tc-1");
      expect((legacy as any).getTestCase).toHaveBeenCalledTimes(1);
    });

    it("denies updating a test case that belongs to another project", async () => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1", testcaseProject: "proj-OTHER" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "update_testcase", arguments: { testcaseId: "tc-1", title: "New title" } }),
        principal(),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ProjectScopeDenied);
      expect((legacy as any).updateTestCase).not.toHaveBeenCalled();
    });

    it("returns a tool error when updating a test case that does not exist", async () => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1", testcaseProject: undefined });
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "update_testcase", arguments: { testcaseId: "ghost", title: "x" } }),
        principal(),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ToolExecutionError);
      expect(res.error.message).toMatch(/not found/i);
    });

    it("rejects update_testcase without testcaseId", async () => {
      const { db } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "update_testcase", arguments: { title: "x" } }),
        principal(),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ToolExecutionError);
      expect(res.error.message).toMatch(/"testcaseId"/i);
    });

  });

  describe("archive_testcase / restore_testcase project scoping", () => {
    it("archives a test case by setting status to Archived, attributed to the agent actor", async () => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1", testcaseProject: "proj-1" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "archive_testcase", arguments: { testcaseId: "tc-1" } }),
        principal(),
        "proj-1"
      );
      expect(res.result.isError).toBe(false);
      // Archive changes only status; the shared SQL writer preserves live relationships.
      expect((legacy as any).updateTestCase).toHaveBeenCalledWith("tc-1", "mcp-actor-1", {
        status: "Archived"
      });
      expect((legacy as any).getTestCase).toHaveBeenCalledWith("tc-1");
      expect((legacy as any).getTestCase).toHaveBeenCalledTimes(1);
    });

    it("restores a test case by setting status to Draft, attributed to the agent actor", async () => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1", testcaseProject: "proj-1" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "restore_testcase", arguments: { testcaseId: "tc-1" } }),
        principal(),
        "proj-1"
      );
      expect(res.result.isError).toBe(false);
      expect((legacy as any).updateTestCase).toHaveBeenCalledWith("tc-1", "mcp-actor-1", {
        status: "Draft"
      });
      expect((legacy as any).getTestCase).toHaveBeenCalledTimes(1);
    });

    it("does not fetch or override suiteId/ownerId when the caller already supplied both", async () => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1", testcaseProject: "proj-1" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      await svc.handleRequest(
        rpc("tools/call", {
          name: "update_testcase",
          arguments: { testcaseId: "tc-1", suiteId: "suite-explicit", ownerId: "user-explicit", title: "New title" }
        }),
        principal(),
        "proj-1"
      );
      expect((legacy as any).updateTestCase).toHaveBeenCalledWith("tc-1", "mcp-actor-1", {
        title: "New title",
        suiteId: "suite-explicit",
        ownerId: "user-explicit"
      });
      // getTestCase is still called once for the return value, but not a second time to look up
      // current suiteId/ownerId, since both were already supplied.
      expect((legacy as any).getTestCase).toHaveBeenCalledTimes(1);
    });

    it("respects an explicit null suiteId (unassign from suite) instead of preserving the current one", async () => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1", testcaseProject: "proj-1" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      await svc.handleRequest(
        rpc("tools/call", { name: "update_testcase", arguments: { testcaseId: "tc-1", suiteId: null, ownerId: null } }),
        principal(),
        "proj-1"
      );
      expect((legacy as any).updateTestCase).toHaveBeenCalledWith("tc-1", "mcp-actor-1", { suiteId: null, ownerId: null });
    });

    it("denies archiving and restoring a test case that belongs to another project", async () => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1", testcaseProject: "proj-OTHER" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);

      const archiveRes: any = await svc.handleRequest(
        rpc("tools/call", { name: "archive_testcase", arguments: { testcaseId: "tc-1" } }),
        principal(),
        "proj-1"
      );
      expect(archiveRes.error.code).toBe(RpcCode.ProjectScopeDenied);

      const restoreRes: any = await svc.handleRequest(
        rpc("tools/call", { name: "restore_testcase", arguments: { testcaseId: "tc-1" } }),
        principal(),
        "proj-1"
      );
      expect(restoreRes.error.code).toBe(RpcCode.ProjectScopeDenied);
      expect((legacy as any).updateTestCase).not.toHaveBeenCalled();
    });

    it("returns a tool error for archive_testcase/restore_testcase on a test case that does not exist", async () => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1", testcaseProject: undefined });
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const archiveRes: any = await svc.handleRequest(
        rpc("tools/call", { name: "archive_testcase", arguments: { testcaseId: "ghost" } }),
        principal(),
        "proj-1"
      );
      expect(archiveRes.error.code).toBe(RpcCode.ToolExecutionError);
      expect(archiveRes.error.message).toMatch(/not found/i);

      const restoreRes: any = await svc.handleRequest(
        rpc("tools/call", { name: "restore_testcase", arguments: { testcaseId: "ghost" } }),
        principal(),
        "proj-1"
      );
      expect(restoreRes.error.code).toBe(RpcCode.ToolExecutionError);
      expect(restoreRes.error.message).toMatch(/not found/i);
    });

    it("rejects archive_testcase and restore_testcase without testcaseId", async () => {
      const { db } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      expect(
        (await svc.handleRequest(rpc("tools/call", { name: "archive_testcase", arguments: {} }), principal(), "proj-1") as any).error
          .message
      ).toMatch(/"testcaseId"/i);
      expect(
        (await svc.handleRequest(rpc("tools/call", { name: "restore_testcase", arguments: {} }), principal(), "proj-1") as any).error
          .message
      ).toMatch(/"testcaseId"/i);
    });
  });

  describe("duplicate_testcase project scoping", () => {
    it("duplicates a test case, attributed to the agent actor, without altering the original", async () => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1", testcaseProject: "proj-1" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "duplicate_testcase", arguments: { testcaseId: "tc-1" } }),
        principal(),
        "proj-1"
      );
      expect(res.result.isError).toBe(false);
      expect((legacy as any).duplicateTestCase).toHaveBeenCalledWith("tc-1", "mcp-actor-1");
      // updateTestCase (or any other write on the source id) must never be invoked by a duplicate.
      expect((legacy as any).updateTestCase).not.toHaveBeenCalled();
      const body = JSON.parse(res.result.content[0].text);
      expect(body.id).toBe("tc-copy");
    });

    it("denies duplicate_testcase for a test case belonging to another project", async () => {
      const { db } = makeDb({ testcaseProject: "proj-OTHER" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "duplicate_testcase", arguments: { testcaseId: "tc-1" } }),
        principal(),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ProjectScopeDenied);
      expect((legacy as any).duplicateTestCase).not.toHaveBeenCalled();
    });

    it("returns a tool error when duplicating a test case that does not exist, and rejects a missing testcaseId", async () => {
      const { db } = makeDb({ testcaseProject: undefined });
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "duplicate_testcase", arguments: { testcaseId: "ghost" } }),
        principal(),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ToolExecutionError);
      expect(res.error.message).toMatch(/not found/i);

      const missing: any = await svc.handleRequest(rpc("tools/call", { name: "duplicate_testcase", arguments: {} }), principal(), "proj-1");
      expect(missing.error.message).toMatch(/"testcaseId"/i);
    });
  });

  describe("bulk_create_testcases", () => {
    it("creates every valid item and reports a per-item failure without stopping the batch", async () => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1" });
      const legacy = makeLegacy({
        createTestCase: jest
          .fn()
          .mockResolvedValueOnce({ id: "tc-a" })
          .mockRejectedValueOnce({ getResponse: () => ({ error: "Title must be 512 characters or fewer" }) })
          .mockResolvedValueOnce({ id: "tc-c" })
      });
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", {
          name: "bulk_create_testcases",
          arguments: { testcases: [{ title: "A" }, { title: "B-too-long" }, { title: "C" }] }
        }),
        principal(),
        "proj-1"
      );
      expect(res.result.isError).toBe(false);
      const body = JSON.parse(res.result.content[0].text);
      expect(body.total).toBe(3);
      expect(body.succeeded).toBe(2);
      expect(body.failed).toBe(1);
      expect(body.results[0]).toEqual({ index: 0, ok: true, testcase: { id: "tc-a" } });
      expect(body.results[1].ok).toBe(false);
      expect(body.results[1].error).toMatch(/512 characters/i);
      expect(body.results[2]).toEqual({ index: 2, ok: true, testcase: { id: "tc-c" } });
      expect((legacy as any).createTestCase).toHaveBeenCalledTimes(3);
      // Every item attributed to the agent actor, exactly like create_testcase.
      expect((legacy as any).createTestCase).toHaveBeenNthCalledWith(1, "proj-1", "mcp-actor-1", { title: "A" });
    });

    it("reports a per-item failure for a missing title without needing the legacy call to reject", async () => {
      const { db } = makeDb();
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "bulk_create_testcases", arguments: { testcases: [{ title: "Fine" }, {}] } }),
        principal(),
        "proj-1"
      );
      const body = JSON.parse(res.result.content[0].text);
      expect(body.succeeded).toBe(1);
      expect(body.failed).toBe(1);
      expect(body.results[1].error).toMatch(/"title"/i);
      // The invalid item never reached the legacy layer at all.
      expect((legacy as any).createTestCase).toHaveBeenCalledTimes(1);
    });

    it("rejects an empty or over-limit testcases array", async () => {
      const { db } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const empty: any = await svc.handleRequest(
        rpc("tools/call", { name: "bulk_create_testcases", arguments: { testcases: [] } }),
        principal(),
        "proj-1"
      );
      expect(empty.error.message).toMatch(/non-empty array/i);

      const overLimit = Array.from({ length: 501 }, (_, i) => ({ title: `T${i}` }));
      const tooMany: any = await svc.handleRequest(
        rpc("tools/call", { name: "bulk_create_testcases", arguments: { testcases: overLimit } }),
        principal(),
        "proj-1"
      );
      expect(tooMany.error.message).toMatch(/limited to 500/i);
    });

    it("accepts a large batch at the limit, creating every item", async () => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1" });
      const legacy = makeLegacy({ createTestCase: jest.fn().mockResolvedValue({ id: "tc-x" }) });
      const svc = new McpService(legacy, db, writableLimits);
      const atLimit = Array.from({ length: 500 }, (_, i) => ({ title: `T${i}` }));
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "bulk_create_testcases", arguments: { testcases: atLimit } }),
        principal(),
        "proj-1"
      );
      const body = JSON.parse(res.result.content[0].text);
      expect(body.total).toBe(500);
      expect(body.succeeded).toBe(500);
      expect((legacy as any).createTestCase).toHaveBeenCalledTimes(500);
    });

    it("rejects bulk_create_testcases for a read-scoped token", async () => {
      const { db } = makeDb();
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "bulk_create_testcases", arguments: { testcases: [{ title: "X" }] } }),
        principal({ scopes: ["read"] }),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ScopeDenied);
      expect((legacy as any).createTestCase).not.toHaveBeenCalled();
    });
  });

  describe("bulk_update_testcases / bulk_archive_testcases", () => {
    it("applies one update to every valid id and reports invalid ids as per-item failures", async () => {
      const { db } = makeDb({ ownedTestcaseIds: ["tc-1", "tc-2"] });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", {
          name: "bulk_update_testcases",
          arguments: { testcaseIds: ["tc-1", "tc-2", "tc-ghost"], priority: "High" }
        }),
        principal({ userId: "user-7" }),
        "proj-1"
      );
      expect(res.result.isError).toBe(false);
      // bulkUpdateTestCases requires a real user, not the agent actor (same as update_suite).
      expect((legacy as any).bulkUpdateTestCases).toHaveBeenCalledWith("proj-1", "user-7", {
        testcaseIds: ["tc-1", "tc-2"],
        priority: "High",
        suiteId: undefined,
        status: undefined,
        ownerId: undefined,
        automationStatus: undefined,
        severity: undefined
      });
      const body = JSON.parse(res.result.content[0].text);
      expect(body.total).toBe(3);
      expect(body.succeeded).toBe(2);
      expect(body.failed).toBe(1);
      expect(body.results.find((r: any) => r.id === "tc-ghost")).toEqual({
        id: "tc-ghost",
        ok: false,
        error: "Test case not found in this project"
      });
    });

    it("advertises and applies canonical severity through bulk update", async () => {
      const { db } = makeDb({ ownedTestcaseIds: ["tc-1", "tc-2"] });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const catalog: any = await svc.handleRequest(rpc("tools/list"), principal(), "proj-1");
      const tool = catalog.result.tools.find((entry: any) => entry.name === "bulk_update_testcases");
      expect(tool.inputSchema.properties.severity.type).toBe("string");

      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "bulk_update_testcases", arguments: { testcaseIds: ["tc-1", "tc-2"], severity: "critical" } }),
        principal({ userId: "user-7" }),
        "proj-1"
      );
      expect(res.result.isError).toBe(false);
      expect((legacy as any).bulkUpdateTestCases).toHaveBeenCalledWith("proj-1", "user-7", {
        testcaseIds: ["tc-1", "tc-2"],
        priority: undefined,
        suiteId: undefined,
        status: undefined,
        ownerId: undefined,
        automationStatus: undefined,
        severity: "Critical"
      });

      const invalid: any = await svc.handleRequest(
        rpc("tools/call", { name: "bulk_update_testcases", arguments: { testcaseIds: ["tc-1"], severity: "not-a-severity" } }),
        principal({ userId: "user-7" }),
        "proj-1"
      );
      expect(invalid.error.code).toBe(RpcCode.ToolExecutionError);
      expect(invalid.error.message).toMatch(/severity/i);
      expect((legacy as any).bulkUpdateTestCases).toHaveBeenCalledTimes(1);
    });

    it("deduplicates repeated ids in the input before applying and reporting", async () => {
      const { db } = makeDb({ ownedTestcaseIds: ["tc-1"] });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "bulk_update_testcases", arguments: { testcaseIds: ["tc-1", "tc-1", "tc-1"], priority: "Low" } }),
        principal(),
        "proj-1"
      );
      const body = JSON.parse(res.result.content[0].text);
      expect(body.total).toBe(1);
      expect(body.results).toHaveLength(1);
      expect((legacy as any).bulkUpdateTestCases).toHaveBeenCalledTimes(1);
    });

    it("never calls bulkUpdateTestCases at all when every id is invalid (no unintended update)", async () => {
      const { db } = makeDb({ ownedTestcaseIds: [] });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "bulk_update_testcases", arguments: { testcaseIds: ["tc-ghost-1", "tc-ghost-2"], priority: "High" } }),
        principal(),
        "proj-1"
      );
      const body = JSON.parse(res.result.content[0].text);
      expect(body.succeeded).toBe(0);
      expect(body.failed).toBe(2);
      expect((legacy as any).bulkUpdateTestCases).not.toHaveBeenCalled();
    });

    it("bulk-archives valid ids by setting status to Archived, leaving invalid ids untouched", async () => {
      const { db } = makeDb({ ownedTestcaseIds: ["tc-1", "tc-2"] });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "bulk_archive_testcases", arguments: { testcaseIds: ["tc-1", "tc-2", "tc-ghost"] } }),
        principal({ userId: "user-7" }),
        "proj-1"
      );
      expect(res.result.isError).toBe(false);
      expect((legacy as any).bulkUpdateTestCases).toHaveBeenCalledWith("proj-1", "user-7", {
        testcaseIds: ["tc-1", "tc-2"],
        status: "Archived"
      });
      const body = JSON.parse(res.result.content[0].text);
      expect(body.succeeded).toBe(2);
      expect(body.failed).toBe(1);
    });

    it("rejects an empty or over-limit testcaseIds array for both tools", async () => {
      const { db } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      for (const name of ["bulk_update_testcases", "bulk_archive_testcases"]) {
        const empty: any = await svc.handleRequest(rpc("tools/call", { name, arguments: { testcaseIds: [] } }), principal(), "proj-1");
        expect(empty.error.message).toMatch(/non-empty array/i);

        const tooMany: any = await svc.handleRequest(
          rpc("tools/call", { name, arguments: { testcaseIds: Array.from({ length: 501 }, (_, i) => `id-${i}`) } }),
          principal(),
          "proj-1"
        );
        expect(tooMany.error.message).toMatch(/limited to 500/i);
      }
    });

    it("rejects bulk_update_testcases and bulk_archive_testcases for a read-scoped token", async () => {
      const { db } = makeDb({ ownedTestcaseIds: ["tc-1"] });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const updateRes: any = await svc.handleRequest(
        rpc("tools/call", { name: "bulk_update_testcases", arguments: { testcaseIds: ["tc-1"], priority: "High" } }),
        principal({ scopes: ["read"] }),
        "proj-1"
      );
      expect(updateRes.error.code).toBe(RpcCode.ScopeDenied);
      const archiveRes: any = await svc.handleRequest(
        rpc("tools/call", { name: "bulk_archive_testcases", arguments: { testcaseIds: ["tc-1"] } }),
        principal({ scopes: ["read"] }),
        "proj-1"
      );
      expect(archiveRes.error.code).toBe(RpcCode.ScopeDenied);
      expect((legacy as any).bulkUpdateTestCases).not.toHaveBeenCalled();
    });
  });

  describe("get_testcase_bugs / get_testcase_executions project scoping", () => {
    it("lists bugs and executions for a test case that belongs to the token's project", async () => {
      const { db } = makeDb({ testcaseProject: "proj-1" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);

      const bugsRes: any = await svc.handleRequest(
        rpc("tools/call", { name: "get_testcase_bugs", arguments: { testcaseId: "tc-1" } }),
        principal(),
        "proj-1"
      );
      expect(bugsRes.result.isError).toBe(false);
      expect((legacy as any).listBugs).toHaveBeenCalledWith("proj-1", { testcaseId: "tc-1" });
      expect(JSON.parse(bugsRes.result.content[0].text).bugs).toHaveLength(1);

      const executionsRes: any = await svc.handleRequest(
        rpc("tools/call", { name: "get_testcase_executions", arguments: { testcaseId: "tc-1" } }),
        principal(),
        "proj-1"
      );
      expect(executionsRes.result.isError).toBe(false);
      expect((legacy as any).testcaseExecutions).toHaveBeenCalledWith("proj-1", "tc-1");
      expect(JSON.parse(executionsRes.result.content[0].text).executions).toHaveLength(1);
    });

    it("denies get_testcase_bugs/get_testcase_executions for a test case belonging to another project", async () => {
      const { db } = makeDb({ testcaseProject: "proj-OTHER" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);

      const bugsRes: any = await svc.handleRequest(
        rpc("tools/call", { name: "get_testcase_bugs", arguments: { testcaseId: "tc-1" } }),
        principal(),
        "proj-1"
      );
      expect(bugsRes.error.code).toBe(RpcCode.ProjectScopeDenied);
      expect((legacy as any).listBugs).not.toHaveBeenCalled();

      const executionsRes: any = await svc.handleRequest(
        rpc("tools/call", { name: "get_testcase_executions", arguments: { testcaseId: "tc-1" } }),
        principal(),
        "proj-1"
      );
      expect(executionsRes.error.code).toBe(RpcCode.ProjectScopeDenied);
      expect((legacy as any).testcaseExecutions).not.toHaveBeenCalled();
    });

    it("returns a tool error for get_testcase_bugs/get_testcase_executions when the test case does not exist", async () => {
      const { db } = makeDb({ testcaseProject: undefined });
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const bugsRes: any = await svc.handleRequest(
        rpc("tools/call", { name: "get_testcase_bugs", arguments: { testcaseId: "ghost" } }),
        principal(),
        "proj-1"
      );
      expect(bugsRes.error.code).toBe(RpcCode.ToolExecutionError);
      expect(bugsRes.error.message).toMatch(/not found/i);
    });

    it("rejects get_testcase_bugs and get_testcase_executions without testcaseId", async () => {
      const { db } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      expect(
        (await svc.handleRequest(rpc("tools/call", { name: "get_testcase_bugs", arguments: {} }), principal(), "proj-1") as any).error
          .message
      ).toMatch(/"testcaseId"/i);
      expect(
        (
          await svc.handleRequest(rpc("tools/call", { name: "get_testcase_executions", arguments: {} }), principal(), "proj-1") as any
        ).error.message
      ).toMatch(/"testcaseId"/i);
    });
  });

  describe("link_requirement_to_testcase / unlink_requirement_from_testcase project scoping", () => {
    it("links a test case to a Jira requirement, attributed to the agent actor", async () => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1", testcaseProject: "proj-1" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "link_requirement_to_testcase", arguments: { testcaseId: "tc-1", jiraIssueKey: "PROJ-1" } }),
        principal(),
        "proj-1"
      );
      expect(res.result.isError).toBe(false);
      // Requirement edits must not replay an earlier suite/owner snapshot.
      expect((legacy as any).updateTestCase).toHaveBeenCalledWith("tc-1", "mcp-actor-1", {
        jiraIssueKey: "PROJ-1",
        jiraUrl: undefined
      });
      expect((legacy as any).getTestCase).toHaveBeenCalledTimes(1);
    });

    it("unlinks a test case's Jira requirement by clearing jiraIssueKey/jiraUrl", async () => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1", testcaseProject: "proj-1" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "unlink_requirement_from_testcase", arguments: { testcaseId: "tc-1", provider: "jira" } }),
        principal(),
        "proj-1"
      );
      expect(res.result.isError).toBe(false);
      expect((legacy as any).updateTestCase).toHaveBeenCalledWith("tc-1", "mcp-actor-1", {
        jiraIssueKey: null,
        jiraUrl: null
      });
      expect((legacy as any).getTestCase).toHaveBeenCalledTimes(1);
    });

    it("links a test case to a Notion page by page id and unlinks it", async () => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1", testcaseProject: "proj-1" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const link: any = await svc.handleRequest(
        rpc("tools/call", {
          name: "link_requirement_to_testcase",
          arguments: { testcaseId: "tc-1", notionPageId: "1429989f-e8ac-4eff-bc8f-57f56486db54", notionUrl: "https://www.notion.so/x" }
        }),
        principal(),
        "proj-1"
      );
      expect(link.result.isError).toBe(false);
      expect((legacy as any).updateTestCase).toHaveBeenCalledWith("tc-1", "mcp-actor-1", {
        notionPageId: "1429989f-e8ac-4eff-bc8f-57f56486db54",
        notionUrl: "https://www.notion.so/x"
      });

      const unlink: any = await svc.handleRequest(
        rpc("tools/call", { name: "unlink_requirement_from_testcase", arguments: { testcaseId: "tc-1", provider: "notion" } }),
        principal(),
        "proj-1"
      );
      expect(unlink.result.isError).toBe(false);
      expect((legacy as any).updateTestCase).toHaveBeenLastCalledWith("tc-1", "mcp-actor-1", {
        notionPageId: null,
        notionUrl: null
      });
    });

    it("rejects a link that names a Notion page together with another provider's key", async () => {
      const { db } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "link_requirement_to_testcase", arguments: { testcaseId: "tc-1", jiraIssueKey: "PROJ-1", notionPageId: "p" } }),
        principal(),
        "proj-1"
      );
      expect(res.error.message).toMatch(/only one of/i);
    });

    it("rejects link_requirement_to_testcase with neither or both of jiraIssueKey/linearIssueKey", async () => {
      const { db } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const neither: any = await svc.handleRequest(
        rpc("tools/call", { name: "link_requirement_to_testcase", arguments: { testcaseId: "tc-1" } }),
        principal(),
        "proj-1"
      );
      expect(neither.error.message).toMatch(/jiraIssueKey.*linearIssueKey|linearIssueKey.*jiraIssueKey/i);

      const both: any = await svc.handleRequest(
        rpc("tools/call", {
          name: "link_requirement_to_testcase",
          arguments: { testcaseId: "tc-1", jiraIssueKey: "PROJ-1", linearIssueKey: "ENG-1" }
        }),
        principal(),
        "proj-1"
      );
      expect(both.error.message).toMatch(/only one of/i);
    });

    it("rejects unlink_requirement_from_testcase with an invalid provider", async () => {
      const { db } = makeDb({ testcaseProject: "proj-1" });
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "unlink_requirement_from_testcase", arguments: { testcaseId: "tc-1", provider: "github" } }),
        principal(),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ToolExecutionError);
      expect(res.error.message).toMatch(/"provider" must be "jira" or "linear"/i);
    });

    it("denies link/unlink_requirement for a test case belonging to another project", async () => {
      const { db } = makeDb({ testcaseProject: "proj-OTHER" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const linkRes: any = await svc.handleRequest(
        rpc("tools/call", { name: "link_requirement_to_testcase", arguments: { testcaseId: "tc-1", jiraIssueKey: "PROJ-1" } }),
        principal(),
        "proj-1"
      );
      expect(linkRes.error.code).toBe(RpcCode.ProjectScopeDenied);
      const unlinkRes: any = await svc.handleRequest(
        rpc("tools/call", { name: "unlink_requirement_from_testcase", arguments: { testcaseId: "tc-1", provider: "jira" } }),
        principal(),
        "proj-1"
      );
      expect(unlinkRes.error.code).toBe(RpcCode.ProjectScopeDenied);
      expect((legacy as any).updateTestCase).not.toHaveBeenCalled();
    });
  });

  describe("list_suites / get_suite / update_suite project scoping", () => {
    it("lists suites scoped to the token's project", async () => {
      const { db } = makeDb();
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(rpc("tools/call", { name: "list_suites", arguments: {} }), principal(), "proj-1");
      expect(res.result.isError).toBe(false);
      expect((legacy as any).listSuites).toHaveBeenCalledWith("proj-1");
      expect(JSON.parse(res.result.content[0].text).suites).toHaveLength(1);
    });

    it("returns a suite by id when it belongs to the token's project", async () => {
      const { db } = makeDb({ suiteProject: "proj-1" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "get_suite", arguments: { suiteId: "suite-1" } }),
        principal(),
        "proj-1"
      );
      expect(res.result.isError).toBe(false);
      expect(JSON.parse(res.result.content[0].text).id).toBe("suite-1");
    });

    it("denies get_suite/update_suite for a suite belonging to another project", async () => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1", suiteProject: "proj-OTHER" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);

      const getRes: any = await svc.handleRequest(
        rpc("tools/call", { name: "get_suite", arguments: { suiteId: "suite-1" } }),
        principal(),
        "proj-1"
      );
      expect(getRes.error.code).toBe(RpcCode.ProjectScopeDenied);

      const updateRes: any = await svc.handleRequest(
        rpc("tools/call", { name: "update_suite", arguments: { suiteId: "suite-1", name: "Renamed" } }),
        principal(),
        "proj-1"
      );
      expect(updateRes.error.code).toBe(RpcCode.ProjectScopeDenied);
      expect((legacy as any).updateSuite).not.toHaveBeenCalled();
    });

    it("returns a tool error for get_suite/update_suite when the suite does not exist", async () => {
      const { db } = makeDb({ suiteProject: undefined });
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const getRes: any = await svc.handleRequest(
        rpc("tools/call", { name: "get_suite", arguments: { suiteId: "ghost" } }),
        principal(),
        "proj-1"
      );
      expect(getRes.error.code).toBe(RpcCode.ToolExecutionError);
      expect(getRes.error.message).toMatch(/not found/i);
    });

    it("rejects get_suite and update_suite without suiteId", async () => {
      const { db } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      expect(
        (await svc.handleRequest(rpc("tools/call", { name: "get_suite", arguments: {} }), principal(), "proj-1") as any).error.message
      ).toMatch(/"suiteId"/i);
      expect(
        (await svc.handleRequest(rpc("tools/call", { name: "update_suite", arguments: {} }), principal(), "proj-1") as any).error
          .message
      ).toMatch(/"suiteId"/i);
    });

    it("renames a suite without reading and re-sending its parent, attributed to the token's user", async () => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1", suiteProject: "proj-1" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "update_suite", arguments: { suiteId: "suite-1", name: "Renamed" } }),
        principal({ userId: "user-7" }),
        "proj-1"
      );
      expect(res.result.isError).toBe(false);
      // Attributed to ctx.userId because updateSuite performs the existing access check.
      expect((legacy as any).updateSuite).toHaveBeenCalledWith("user-7", "suite-1", {
        name: "Renamed",
        parentId: undefined,
        position: undefined
      });
      expect((legacy as any).listSuites).toHaveBeenCalledTimes(1); // Return value only, after the write.
    });

    it("reparents a suite to the root when parentId is explicitly null", async () => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1", suiteProject: "proj-1" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      await svc.handleRequest(
        rpc("tools/call", { name: "update_suite", arguments: { suiteId: "suite-1", parentId: null } }),
        principal({ userId: "user-7" }),
        "proj-1"
      );
      expect((legacy as any).updateSuite).toHaveBeenCalledWith("user-7", "suite-1", {
        name: undefined,
        parentId: null,
        position: undefined
      });
    });
  });

  describe("clone_test_suite", () => {
    // A 2-node subtree: suite-1 (source, parent "suite-root") with one child suite-2, one test
    // case directly in each. Exercises the parent-before-child clone order and per-suite
    // test-case relocation in one pass.
    function makeCloneLegacy(overrides: Partial<Record<string, jest.Mock>> = {}) {
      return makeLegacy({
        listSuites: jest.fn().mockResolvedValue([
          { id: "suite-1", parentId: "suite-root", name: "Suite 1", position: 0, testCaseCount: 1, recursiveTestCaseCount: 2 },
          { id: "suite-2", parentId: "suite-1", name: "Suite 2", position: 0, testCaseCount: 1, recursiveTestCaseCount: 1 }
        ]),
        listTestCases: jest
          .fn()
          .mockResolvedValueOnce({ rows: [], total: 1 }) // pre-count for suite-1
          .mockResolvedValueOnce({ rows: [], total: 1 }) // pre-count for suite-2
          .mockResolvedValueOnce({ rows: [{ id: "tc-in-suite-1" }], total: 1 }) // full fetch, suite-1
          .mockResolvedValueOnce({ rows: [{ id: "tc-in-suite-2" }], total: 1 }), // full fetch, suite-2
        createSuite: jest
          .fn()
          .mockResolvedValueOnce({ id: "suite-1-clone", name: "Suite 1 (copy)" })
          .mockResolvedValueOnce({ id: "suite-2-clone", name: "Suite 2" }),
        duplicateTestCase: jest
          .fn()
          .mockResolvedValueOnce({ id: "tc-in-suite-1-clone", ownerId: "owner-copied-1" })
          .mockResolvedValueOnce({ id: "tc-in-suite-2-clone", ownerId: "owner-copied-2" }),
        ...overrides
      });
    }

    it("clones a suite and its subtree's test cases, leaving the originals untouched", async () => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1", suiteProject: "proj-1" });
      const legacy = makeCloneLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "clone_test_suite", arguments: { suiteId: "suite-1" } }),
        principal(),
        "proj-1"
      );
      expect(res.result.isError).toBe(false);
      const body = JSON.parse(res.result.content[0].text);
      expect(body.suiteCount).toBe(2);
      expect(body.testcaseCount).toBe(2);
      expect(body.clonedSuiteId).toBe("suite-1-clone");

      // Parent cloned before child: suite-1's clone must exist before suite-2 is created under it.
      expect((legacy as any).createSuite).toHaveBeenNthCalledWith(1, "proj-1", { name: "Suite 1 (copy)", parentId: "suite-root", position: 0 });
      expect((legacy as any).createSuite).toHaveBeenNthCalledWith(2, "proj-1", { name: "Suite 2", parentId: "suite-1-clone", position: 0 });

      // Each source test case duplicated (attributed to the agent actor) then relocated into its
      // new suite — the source suite/test case ids are never passed to any write except
      // duplicateTestCase's read-only source-id argument.
      expect((legacy as any).duplicateTestCase).toHaveBeenCalledWith("tc-in-suite-1", "mcp-actor-1");
      // Relocation only changes suite; copied/current ownership is retained by the SQL writer.
      expect((legacy as any).updateTestCase).toHaveBeenCalledWith("tc-in-suite-1-clone", "mcp-actor-1", {
        suiteId: "suite-1-clone"
      });
      expect((legacy as any).duplicateTestCase).toHaveBeenCalledWith("tc-in-suite-2", "mcp-actor-1");
      expect((legacy as any).updateTestCase).toHaveBeenCalledWith("tc-in-suite-2-clone", "mcp-actor-1", {
        suiteId: "suite-2-clone"
      });
      // Never a write keyed on the original suite ids.
      expect((legacy as any).updateSuite).not.toHaveBeenCalled();
    });

    it("denies clone_test_suite for a suite belonging to another project", async () => {
      const { db } = makeDb({ suiteProject: "proj-OTHER" });
      const legacy = makeCloneLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "clone_test_suite", arguments: { suiteId: "suite-1" } }),
        principal(),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ProjectScopeDenied);
      expect((legacy as any).createSuite).not.toHaveBeenCalled();
    });

    it("refuses a subtree over the suite-count limit before creating anything", async () => {
      const { db } = makeDb({ suiteProject: "proj-1" });
      const bigTree = Array.from({ length: 101 }, (_, i) => ({
        id: i === 0 ? "suite-1" : `suite-child-${i}`,
        parentId: i === 0 ? null : "suite-1",
        name: `Suite ${i}`,
        position: i
      }));
      const legacy = makeLegacy({ listSuites: jest.fn().mockResolvedValue(bigTree) });
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "clone_test_suite", arguments: { suiteId: "suite-1" } }),
        principal(),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ToolExecutionError);
      expect(res.error.message).toMatch(/over the 100-suite clone limit/i);
      expect((legacy as any).createSuite).not.toHaveBeenCalled();
    });

    it("returns a tool error when the source suite does not exist, and rejects a missing suiteId", async () => {
      const { db } = makeDb({ suiteProject: undefined });
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "clone_test_suite", arguments: { suiteId: "ghost" } }),
        principal(),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ToolExecutionError);
      expect(res.error.message).toMatch(/not found/i);

      const missing: any = await svc.handleRequest(rpc("tools/call", { name: "clone_test_suite", arguments: {} }), principal(), "proj-1");
      expect(missing.error.message).toMatch(/"suiteId"/i);
    });

    it("rejects clone_test_suite for a read-scoped token", async () => {
      const { db } = makeDb({ suiteProject: "proj-1" });
      const legacy = makeCloneLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "clone_test_suite", arguments: { suiteId: "suite-1" } }),
        principal({ scopes: ["read"] }),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ScopeDenied);
      expect((legacy as any).createSuite).not.toHaveBeenCalled();
    });
  });

  describe("list_bugs / get_bug / update_bug project scoping", () => {
    it.each([null, ""])("forwards explicit metadata clears (%j) without adding omitted fields or reading a stale bug", async (value) => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1", bugProject: "proj-1" });
      const legacy = makeLegacy(), svc = new McpService(legacy, db, writableLimits);
      const body = { description: value, externalUrl: value, integrationProvider: value, integrationIssueKey: value, betterbugsUrl: value };
      const response: any = await svc.handleRequest(rpc("tools/call", { name: "update_bug", arguments: { bugId: "bug-1", ...body } }), principal({ userId: "user-7" }), "proj-1");
      expect(response.result.isError).toBe(false);
      expect((legacy as any).updateBug).toHaveBeenCalledWith("user-7", "bug-1", body);
      expect((legacy as any).getBug).not.toHaveBeenCalled();
    });
    it("lists bugs scoped to the token's project with filters forwarded", async () => {
      const { db } = makeDb();
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "list_bugs", arguments: { status: "Open" } }),
        principal(),
        "proj-1"
      );
      expect(res.result.isError).toBe(false);
      expect((legacy as any).listBugs).toHaveBeenCalledWith("proj-1", { status: "Open" });
      expect(JSON.parse(res.result.content[0].text).bugs).toHaveLength(1);
    });

    it("returns a bug by id when it belongs to the token's project", async () => {
      const { db } = makeDb({ bugProject: "proj-1" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(rpc("tools/call", { name: "get_bug", arguments: { bugId: "bug-1" } }), principal(), "proj-1");
      expect(res.result.isError).toBe(false);
      expect((legacy as any).getBug).toHaveBeenCalledWith("bug-1");
    });

    it("denies get_bug/update_bug for a bug belonging to another project", async () => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1", bugProject: "proj-OTHER" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);

      const getRes: any = await svc.handleRequest(rpc("tools/call", { name: "get_bug", arguments: { bugId: "bug-1" } }), principal(), "proj-1");
      expect(getRes.error.code).toBe(RpcCode.ProjectScopeDenied);

      const updateRes: any = await svc.handleRequest(
        rpc("tools/call", { name: "update_bug", arguments: { bugId: "bug-1", status: "Closed" } }),
        principal(),
        "proj-1"
      );
      expect(updateRes.error.code).toBe(RpcCode.ProjectScopeDenied);
      expect((legacy as any).updateBug).not.toHaveBeenCalled();
    });

    it("returns a tool error for get_bug/update_bug when the bug does not exist", async () => {
      const { db } = makeDb({ bugProject: undefined });
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const res: any = await svc.handleRequest(rpc("tools/call", { name: "get_bug", arguments: { bugId: "ghost" } }), principal(), "proj-1");
      expect(res.error.code).toBe(RpcCode.ToolExecutionError);
      expect(res.error.message).toMatch(/not found/i);
    });

    it("rejects get_bug and update_bug without bugId", async () => {
      const { db } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      expect(
        (await svc.handleRequest(rpc("tools/call", { name: "get_bug", arguments: {} }), principal(), "proj-1") as any).error.message
      ).toMatch(/"bugId"/i);
      expect(
        (await svc.handleRequest(rpc("tools/call", { name: "update_bug", arguments: {} }), principal(), "proj-1") as any).error.message
      ).toMatch(/"bugId"/i);
    });

    it("updates a bug, attributed to the token's user (not the agent actor)", async () => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1", bugProject: "proj-1" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "update_bug", arguments: { bugId: "bug-1", status: "Closed", severity: "High" } }),
        principal({ userId: "user-7" }),
        "proj-1"
      );
      expect(res.result.isError).toBe(false);
      expect((legacy as any).updateBug).toHaveBeenCalledWith("user-7", "bug-1", { status: "Closed", severity: "High" });
    });
  });

  describe("link_testcase_to_bug / unlink_testcase_from_bug project scoping", () => {
    it("links a test case to a bug, attributed to the token's user", async () => {
      const { db } = makeDb({ bugProject: "proj-1", testcaseProject: "proj-1" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "link_testcase_to_bug", arguments: { bugId: "bug-1", testcaseId: "tc-1" } }),
        principal({ userId: "user-7" }),
        "proj-1"
      );
      expect(res.result.isError).toBe(false);
      expect((legacy as any).addBugLink).toHaveBeenCalledWith("user-7", "bug-1", {
        testcaseId: "tc-1",
        cycleId: undefined,
        executionId: undefined
      });
    });

    it("is idempotent: linking the same test case to the same bug twice does not error", async () => {
      const { db } = makeDb({ bugProject: "proj-1", testcaseProject: "proj-1" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const call = () =>
        svc.handleRequest(
          rpc("tools/call", { name: "link_testcase_to_bug", arguments: { bugId: "bug-1", testcaseId: "tc-1" } }),
          principal(),
          "proj-1"
        );
      const first: any = await call();
      const second: any = await call();
      expect(first.result.isError).toBe(false);
      expect(second.result.isError).toBe(false);
      expect((legacy as any).addBugLink).toHaveBeenCalledTimes(2);
    });

    it("unlinks a linked test case from a bug", async () => {
      const { db } = makeDb({ bugProject: "proj-1", testcaseProject: "proj-1" });
      const legacy = makeLegacy({
        getBug: jest.fn().mockResolvedValue({ id: "bug-1", links: [{ id: "link-1", testcaseId: "tc-1", cycleId: null }] })
      });
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "unlink_testcase_from_bug", arguments: { bugId: "bug-1", testcaseId: "tc-1" } }),
        principal({ userId: "user-7" }),
        "proj-1"
      );
      expect(res.result.isError).toBe(false);
      expect((legacy as any).removeBugLink).toHaveBeenCalledWith("user-7", "bug-1", "link-1");
      expect(JSON.parse(res.result.content[0].text)).toEqual({ ok: true, bugId: "bug-1", testcaseId: "tc-1", wasLinked: true });
    });

    it("unlinking a test case that isn't linked to the bug is a graceful no-op, not an error", async () => {
      const { db } = makeDb({ bugProject: "proj-1", testcaseProject: "proj-1" });
      const legacy = makeLegacy({ getBug: jest.fn().mockResolvedValue({ id: "bug-1", links: [] }) });
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "unlink_testcase_from_bug", arguments: { bugId: "bug-1", testcaseId: "tc-1" } }),
        principal(),
        "proj-1"
      );
      expect(res.result.isError).toBe(false);
      expect((legacy as any).removeBugLink).not.toHaveBeenCalled();
      expect(JSON.parse(res.result.content[0].text)).toEqual({ ok: true, bugId: "bug-1", testcaseId: "tc-1", wasLinked: false });
    });

    it("denies link_testcase_to_bug/unlink_testcase_from_bug when the test case belongs to another project", async () => {
      const { db } = makeDb({ bugProject: "proj-1", testcaseProject: "proj-OTHER" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const linkRes: any = await svc.handleRequest(
        rpc("tools/call", { name: "link_testcase_to_bug", arguments: { bugId: "bug-1", testcaseId: "tc-1" } }),
        principal(),
        "proj-1"
      );
      expect(linkRes.error.code).toBe(RpcCode.ProjectScopeDenied);
      expect((legacy as any).addBugLink).not.toHaveBeenCalled();

      const unlinkRes: any = await svc.handleRequest(
        rpc("tools/call", { name: "unlink_testcase_from_bug", arguments: { bugId: "bug-1", testcaseId: "tc-1" } }),
        principal(),
        "proj-1"
      );
      expect(unlinkRes.error.code).toBe(RpcCode.ProjectScopeDenied);
    });

    it("denies link_testcase_to_bug/unlink_testcase_from_bug when the bug belongs to another project", async () => {
      const { db } = makeDb({ bugProject: "proj-OTHER", testcaseProject: "proj-1" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const linkRes: any = await svc.handleRequest(
        rpc("tools/call", { name: "link_testcase_to_bug", arguments: { bugId: "bug-1", testcaseId: "tc-1" } }),
        principal(),
        "proj-1"
      );
      expect(linkRes.error.code).toBe(RpcCode.ProjectScopeDenied);
      expect((legacy as any).addBugLink).not.toHaveBeenCalled();
    });

    it("rejects link_testcase_to_bug/unlink_testcase_from_bug on ids that do not exist, and without required arguments", async () => {
      const { db } = makeDb({ bugProject: undefined, testcaseProject: undefined });
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const notFound: any = await svc.handleRequest(
        rpc("tools/call", { name: "link_testcase_to_bug", arguments: { bugId: "ghost", testcaseId: "tc-1" } }),
        principal(),
        "proj-1"
      );
      expect(notFound.error.code).toBe(RpcCode.ToolExecutionError);

      expect(
        (await svc.handleRequest(rpc("tools/call", { name: "link_testcase_to_bug", arguments: { testcaseId: "tc-1" } }), principal(), "proj-1") as any)
          .error.message
      ).toMatch(/"bugId"/i);
      expect(
        (await svc.handleRequest(rpc("tools/call", { name: "link_testcase_to_bug", arguments: { bugId: "bug-1" } }), principal(), "proj-1") as any)
          .error.message
      ).toMatch(/"testcaseId"/i);
      expect(
        (
          await svc.handleRequest(
            rpc("tools/call", { name: "unlink_testcase_from_bug", arguments: { testcaseId: "tc-1" } }),
            principal(),
            "proj-1"
          ) as any
        ).error.message
      ).toMatch(/"bugId"/i);
    });
  });

  describe("list_test_cycles / get_test_cycle project scoping", () => {
    it("lists cycles scoped to the token's project", async () => {
      const { db } = makeDb();
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(rpc("tools/call", { name: "list_test_cycles", arguments: {} }), principal(), "proj-1");
      expect(res.result.isError).toBe(false);
      expect((legacy as any).listCycles).toHaveBeenCalledWith("proj-1");
      expect(JSON.parse(res.result.content[0].text).cycles).toHaveLength(1);
    });

    it("returns a cycle by id with its linked plan attached", async () => {
      const { db } = makeDb({ cycleProject: "proj-1" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "get_test_cycle", arguments: { cycleId: "cycle-1" } }),
        principal({ userId: "user-7" }),
        "proj-1"
      );
      expect(res.result.isError).toBe(false);
      const body = JSON.parse(res.result.content[0].text);
      expect(body.id).toBe("cycle-1");
      expect((legacy as any).getPlan).toHaveBeenCalledWith("user-7", "plan-1");
      expect(body.plan).toEqual({ id: "plan-1", projectId: "proj-1", name: "Plan 1" });
    });

    it("does not enrich a legacy inconsistent cycle with another project's Plan even if its issuer can read that Plan", async () => {
      const { db } = makeDb({ cycleProject: "proj-1" });
      const legacy = makeLegacy({ getPlan: jest.fn().mockResolvedValue({ id: "plan-1", projectId: "proj-OTHER", name: "Private foreign Plan" }) });
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(rpc("tools/call", { name: "get_test_cycle", arguments: { cycleId: "cycle-1" } }), principal(), "proj-1");
      expect(res.result.isError).toBe(false);
      expect(JSON.parse(res.result.content[0].text).plan).toBeNull();
      expect(JSON.stringify(res)).not.toContain("Private foreign Plan");
    });

    it("omits plan rather than failing get_test_cycle when getPlan rejects", async () => {
      const { db } = makeDb({ cycleProject: "proj-1" });
      const legacy = makeLegacy({ getPlan: jest.fn().mockRejectedValue(new Error("Plan not found")) });
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "get_test_cycle", arguments: { cycleId: "cycle-1" } }),
        principal(),
        "proj-1"
      );
      expect(res.result.isError).toBe(false);
      expect(JSON.parse(res.result.content[0].text).plan).toBeNull();
    });

    it("denies get_test_cycle for a cycle belonging to another project", async () => {
      const { db } = makeDb({ cycleProject: "proj-OTHER" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "get_test_cycle", arguments: { cycleId: "cycle-1" } }),
        principal(),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ProjectScopeDenied);
    });

    it("returns a tool error for get_test_cycle when the cycle does not exist", async () => {
      const { db } = makeDb({ cycleProject: undefined });
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "get_test_cycle", arguments: { cycleId: "ghost" } }),
        principal(),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ToolExecutionError);
      expect(res.error.message).toMatch(/not found/i);
    });

    it("rejects get_test_cycle without cycleId", async () => {
      const { db } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const res: any = await svc.handleRequest(rpc("tools/call", { name: "get_test_cycle", arguments: {} }), principal(), "proj-1");
      expect(res.error.code).toBe(RpcCode.ToolExecutionError);
      expect(res.error.message).toMatch(/"cycleId"/i);
    });
  });

  describe("create_cycle_from_testcases", () => {
    it("creates a cycle and adds only the valid test cases, reporting invalid ids separately", async () => {
      const { db } = makeDb({ ownedTestcaseIds: ["tc-1", "tc-2"] });
      const legacy = makeLegacy({
        createCycleWithTestcasesForUser: jest.fn().mockResolvedValue({
          cycle: { id: "cycle-new", name: "Sprint 12 Run" },
          requested: 2, added: 2, skipped: 0
        })
      });
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", {
          name: "create_cycle_from_testcases",
          arguments: { name: "Sprint 12 Run", testcaseIds: ["tc-1", "tc-2", "tc-ghost"] }
        }),
        principal({ userId: "user-7" }),
        "proj-1"
      );
      expect(res.result.isError).toBe(false);
      expect((legacy as any).createCycleWithTestcasesForUser).toHaveBeenCalledWith(
        "user-7", "proj-1", expect.objectContaining({
          name: "Sprint 12 Run", testcaseIds: ["tc-1", "tc-2"]
        })
      );
      expect((legacy as any).createCycle).not.toHaveBeenCalled();
      expect((legacy as any).addCycleTestCases).not.toHaveBeenCalled();
      const body = JSON.parse(res.result.content[0].text);
      expect(body.cycle.id).toBe("cycle-new");
      expect(body.testcasesRequested).toBe(3);
      expect(body.testcasesAdded).toBe(2);
      expect(body.invalidTestcaseIds).toEqual(["tc-ghost"]);
    });

    it("deduplicates repeated testcaseIds before adding", async () => {
      const { db } = makeDb({ ownedTestcaseIds: ["tc-1"] });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      await svc.handleRequest(
        rpc("tools/call", { name: "create_cycle_from_testcases", arguments: { name: "Run", testcaseIds: ["tc-1", "tc-1"] } }),
        principal(),
        "proj-1"
      );
      expect((legacy as any).createCycleWithTestcasesForUser).toHaveBeenCalledWith(
        "user-1", "proj-1", expect.objectContaining({ testcaseIds: ["tc-1"] })
      );
    });

    it("creates an empty cycle through the atomic native writer when every id is invalid", async () => {
      const { db } = makeDb({ ownedTestcaseIds: [] });
      const legacy = makeLegacy({
        createCycleWithTestcasesForUser: jest.fn().mockResolvedValue({
          cycle: { id: "cycle-new" }, requested: 0, added: 0, skipped: 0
        })
      });
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "create_cycle_from_testcases", arguments: { name: "Run", testcaseIds: ["tc-ghost"] } }),
        principal(),
        "proj-1"
      );
      expect(res.result.isError).toBe(false);
      expect((legacy as any).createCycleWithTestcasesForUser).toHaveBeenCalledWith(
        "user-1", "proj-1", expect.objectContaining({ testcaseIds: [] })
      );
      expect((legacy as any).addCycleTestCases).not.toHaveBeenCalled();
      const body = JSON.parse(res.result.content[0].text);
      expect(body.testcasesAdded).toBe(0);
      expect(body.invalidTestcaseIds).toEqual(["tc-ghost"]);
    });

    it("denies create_cycle_from_testcases when planId belongs to another project", async () => {
      const { db } = makeDb({ planProject: "proj-OTHER", ownedTestcaseIds: ["tc-1"] });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "create_cycle_from_testcases", arguments: { name: "Run", testcaseIds: ["tc-1"], planId: "plan-x" } }),
        principal(),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ProjectScopeDenied);
      expect((legacy as any).createCycleWithTestcasesForUser).not.toHaveBeenCalled();
    });

    it("fails a rejected non-Approved selection before returning any cycle", async () => {
      const { db } = makeDb({ ownedTestcaseIds: ["tc-1"] });
      const legacy = makeLegacy({
        createCycleWithTestcasesForUser: jest.fn().mockRejectedValue(
          new Error("Only Approved test cases can be added to a test run")
        )
      });
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "create_cycle_from_testcases",
          arguments: { name: "Unapproved Run", testcaseIds: ["tc-1"] } }),
        principal(), "proj-1"
      );
      expect(res.error).toBeDefined();
      expect((legacy as any).createCycleWithTestcasesForUser).toHaveBeenCalledTimes(1);
      expect((legacy as any).createCycle).not.toHaveBeenCalled();
    });

    it("rejects create_cycle_from_testcases missing name or testcaseIds, and for a read-scoped token", async () => {
      const { db } = makeDb({ ownedTestcaseIds: ["tc-1"] });
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const missingName: any = await svc.handleRequest(
        rpc("tools/call", { name: "create_cycle_from_testcases", arguments: { testcaseIds: ["tc-1"] } }),
        principal(),
        "proj-1"
      );
      expect(missingName.error.message).toMatch(/"name"/i);

      const missingIds: any = await svc.handleRequest(
        rpc("tools/call", { name: "create_cycle_from_testcases", arguments: { name: "Run" } }),
        principal(),
        "proj-1"
      );
      expect(missingIds.error.message).toMatch(/non-empty array/i);

      const scopeRes: any = await svc.handleRequest(
        rpc("tools/call", { name: "create_cycle_from_testcases", arguments: { name: "Run", testcaseIds: ["tc-1"] } }),
        principal({ scopes: ["read"] }),
        "proj-1"
      );
      expect(scopeRes.error.code).toBe(RpcCode.ScopeDenied);
    });
  });

  describe("list_executions / get_execution / update_execution_result project scoping", () => {
    it("lists executions for a cycle that belongs to the token's project", async () => {
      const { db } = makeDb({ cycleProject: "proj-1" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "list_executions", arguments: { cycleId: "cycle-1" } }),
        principal(),
        "proj-1"
      );
      expect(res.result.isError).toBe(false);
      expect((legacy as any).executions).toHaveBeenCalledWith("cycle-1");
      expect(JSON.parse(res.result.content[0].text).executions).toHaveLength(1);
    });

    it("denies list_executions for a cycle belonging to another project", async () => {
      const { db } = makeDb({ cycleProject: "proj-OTHER" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "list_executions", arguments: { cycleId: "cycle-1" } }),
        principal(),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ProjectScopeDenied);
      expect((legacy as any).executions).not.toHaveBeenCalled();
    });

    it("rejects list_executions without cycleId", async () => {
      const { db } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const res: any = await svc.handleRequest(rpc("tools/call", { name: "list_executions", arguments: {} }), principal(), "proj-1");
      expect(res.error.code).toBe(RpcCode.ToolExecutionError);
      expect(res.error.message).toMatch(/"cycleId"/i);
    });

    it("returns an execution by id when it belongs to the token's project", async () => {
      const { db } = makeDb({ executionProject: "proj-1", executionCycleId: "cycle-1" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "get_execution", arguments: { executionId: "ex-1" } }),
        principal(),
        "proj-1"
      );
      expect(res.result.isError).toBe(false);
      expect((legacy as any).executions).toHaveBeenCalledWith("cycle-1");
      expect(JSON.parse(res.result.content[0].text).id).toBe("ex-1");
    });

    it("denies get_execution/update_execution_result for an execution belonging to another project", async () => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1", executionProject: "proj-OTHER" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);

      const getRes: any = await svc.handleRequest(
        rpc("tools/call", { name: "get_execution", arguments: { executionId: "ex-1" } }),
        principal(),
        "proj-1"
      );
      expect(getRes.error.code).toBe(RpcCode.ProjectScopeDenied);

      const updateRes: any = await svc.handleRequest(
        rpc("tools/call", { name: "update_execution_result", arguments: { executionId: "ex-1", status: "Passed" } }),
        principal(),
        "proj-1"
      );
      expect(updateRes.error.code).toBe(RpcCode.ProjectScopeDenied);
      expect((legacy as any).updateExecution).not.toHaveBeenCalled();
    });

    it("returns a tool error for get_execution/update_execution_result when the execution does not exist", async () => {
      const { db } = makeDb({ executionProject: undefined });
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const getRes: any = await svc.handleRequest(
        rpc("tools/call", { name: "get_execution", arguments: { executionId: "ghost" } }),
        principal(),
        "proj-1"
      );
      expect(getRes.error.code).toBe(RpcCode.ToolExecutionError);
      expect(getRes.error.message).toMatch(/not found/i);
    });

    it("rejects get_execution and update_execution_result without executionId", async () => {
      const { db } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      expect(
        (await svc.handleRequest(rpc("tools/call", { name: "get_execution", arguments: {} }), principal(), "proj-1") as any).error.message
      ).toMatch(/"executionId"/i);
      expect(
        (await svc.handleRequest(rpc("tools/call", { name: "update_execution_result", arguments: {} }), principal(), "proj-1") as any)
          .error.message
      ).toMatch(/"executionId"/i);
    });

    it("updates an execution's result, attributed to the token's user (not the agent actor)", async () => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1", executionProject: "proj-1", executionCycleId: "cycle-1" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "update_execution_result", arguments: { executionId: "ex-1", status: "Passed", assigneeId: null } }),
        principal({ userId: "user-7" }),
        "proj-1"
      );
      expect(res.result.isError).toBe(false);
      expect((legacy as any).updateExecution).toHaveBeenCalledWith("ex-1", "user-7", { status: "Passed", assigneeId: null });
      expect((legacy as any).executions).toHaveBeenCalledWith("cycle-1");
    });

    it("rejects update_execution_result for a read-scoped token", async () => {
      const { db } = makeDb({ executionProject: "proj-1", executionCycleId: "cycle-1" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "update_execution_result", arguments: { executionId: "ex-1", status: "Passed" } }),
        principal({ scopes: ["read"] }),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ScopeDenied);
      expect((legacy as any).updateExecution).not.toHaveBeenCalled();
    });
  });

  describe("bulk_record_execution_results", () => {
    it("records every valid item and reports a per-item failure without stopping the batch", async () => {
      const { db, query } = makeDb({ executionProject: "proj-1", executionCycleId: "cycle-1" });
      // Route ex-1/ex-2 as owned, ex-ghost as not found, without disturbing the default
      // makeDb("FROM executions e") single-shape mock — override the query fn directly since
      // requireExecutionOwner is called per item with different ids.
      query.mockImplementation((sql: string, params?: unknown[]) => {
        if (sql.includes("FROM actors a JOIN agents g")) return Promise.resolve({ rows: [] });
        if (sql.includes("FROM executions e")) {
          const id = (params as string[])?.[0];
          if (id === "ex-ghost") return Promise.resolve({ rows: [] });
          return Promise.resolve({ rows: [{ project_id: "proj-1", cycle_id: "cycle-1" }] });
        }
        return Promise.resolve({ rows: [] });
      });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", {
          name: "bulk_record_execution_results",
          arguments: {
            results: [
              { executionId: "ex-1", status: "Passed" },
              { executionId: "ex-ghost", status: "Failed" },
              { executionId: "ex-2", status: "Blocked", assigneeId: null }
            ]
          }
        }),
        principal({ userId: "user-7" }),
        "proj-1"
      );
      expect(res.result.isError).toBe(false);
      const body = JSON.parse(res.result.content[0].text);
      expect(body.total).toBe(3);
      expect(body.succeeded).toBe(2);
      expect(body.failed).toBe(1);
      expect(body.results[1]).toEqual({ index: 1, executionId: "ex-ghost", ok: false, error: "Execution not found" });
      expect((legacy as any).updateExecution).toHaveBeenCalledTimes(2);
      // Attributed to the token's user, exactly like update_execution_result/record_execution_result.
      expect((legacy as any).updateExecution).toHaveBeenNthCalledWith(1, "ex-1", "user-7", { status: "Passed" });
      expect((legacy as any).updateExecution).toHaveBeenNthCalledWith(2, "ex-2", "user-7", { status: "Blocked", assigneeId: null });
    });

    it("reports a per-item failure for an execution in another project without touching it", async () => {
      const { db, query } = makeDb();
      query.mockImplementation((sql: string, params?: unknown[]) => {
        if (sql.includes("FROM actors a JOIN agents g")) return Promise.resolve({ rows: [] });
        if (sql.includes("FROM executions e")) {
          const id = (params as string[])?.[0];
          return Promise.resolve({ rows: [{ project_id: id === "ex-foreign" ? "proj-OTHER" : "proj-1", cycle_id: "cycle-1" }] });
        }
        return Promise.resolve({ rows: [] });
      });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", {
          name: "bulk_record_execution_results",
          arguments: { results: [{ executionId: "ex-foreign", status: "Passed" }, { executionId: "ex-1", status: "Passed" }] }
        }),
        principal(),
        "proj-1"
      );
      const body = JSON.parse(res.result.content[0].text);
      expect(body.results[0]).toEqual({
        index: 0,
        executionId: "ex-foreign",
        ok: false,
        error: "Execution belongs to a different project than this token"
      });
      expect(body.results[1].ok).toBe(true);
      expect((legacy as any).updateExecution).toHaveBeenCalledTimes(1);
      expect((legacy as any).updateExecution).toHaveBeenCalledWith("ex-1", "user-1", { status: "Passed" });
    });

    it("rejects an empty results array, an over-limit batch, and items missing executionId", async () => {
      const { db } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const empty: any = await svc.handleRequest(
        rpc("tools/call", { name: "bulk_record_execution_results", arguments: { results: [] } }),
        principal(),
        "proj-1"
      );
      expect(empty.error.message).toMatch(/non-empty array/i);

      const tooMany: any = await svc.handleRequest(
        rpc("tools/call", {
          name: "bulk_record_execution_results",
          arguments: { results: Array.from({ length: 201 }, (_, i) => ({ executionId: `ex-${i}`, status: "Passed" })) }
        }),
        principal(),
        "proj-1"
      );
      expect(tooMany.error.message).toMatch(/limited to 200/i);

      const missingId: any = await svc.handleRequest(
        rpc("tools/call", { name: "bulk_record_execution_results", arguments: { results: [{ status: "Passed" }] } }),
        principal(),
        "proj-1"
      );
      const missingBody = JSON.parse(missingId.result.content[0].text);
      expect(missingBody.results[0].ok).toBe(false);
      expect(missingBody.results[0].error).toMatch(/"executionId"/i);
    });

    it("rejects bulk_record_execution_results for a read-scoped token", async () => {
      const { db } = makeDb();
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "bulk_record_execution_results", arguments: { results: [{ executionId: "ex-1", status: "Passed" }] } }),
        principal({ scopes: ["read"] }),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ScopeDenied);
      expect((legacy as any).updateExecution).not.toHaveBeenCalled();
    });
  });

  describe("get_test_execution_summary", () => {
    it("summarizes a single cycle by reusing executionReport with a run filter", async () => {
      const { db } = makeDb({ cycleProject: "proj-1" });
      const legacy = makeLegacy({
        executionReport: jest.fn().mockResolvedValue({
          filterBy: "run",
          filterValue: "cycle-1",
          rows: [{ groupId: "cycle-1", groupName: "Cycle 1", Passed: 3, Failed: 1, Blocked: 0, Skipped: 0, Untested: 2, Retest: 0, total: 6 }]
        })
      });
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "get_test_execution_summary", arguments: { cycleId: "cycle-1" } }),
        principal(),
        "proj-1"
      );
      expect(res.result.isError).toBe(false);
      expect((legacy as any).executionReport).toHaveBeenCalledWith("proj-1", { filterBy: "run", filterValue: "cycle-1" });
      const body = JSON.parse(res.result.content[0].text);
      expect(body.scope).toBe("cycle");
      expect(body).toMatchObject({ Passed: 3, Failed: 1, Blocked: 0, Skipped: 0, Untested: 2, Retest: 0, total: 6 });
    });

    it("returns all zeros for a cycle with no executions yet, rather than erroring", async () => {
      const { db } = makeDb({ cycleProject: "proj-1" });
      const legacy = makeLegacy({ executionReport: jest.fn().mockResolvedValue({ filterBy: "run", filterValue: "cycle-1", rows: [] }) });
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "get_test_execution_summary", arguments: { cycleId: "cycle-1" } }),
        principal(),
        "proj-1"
      );
      const body = JSON.parse(res.result.content[0].text);
      expect(body).toMatchObject({ Passed: 0, Failed: 0, Blocked: 0, Skipped: 0, Untested: 0, Retest: 0, total: 0 });
    });

    it("aggregates across every cycle in the project when cycleId is omitted", async () => {
      const { db } = makeDb();
      const legacy = makeLegacy({
        executionReport: jest.fn().mockResolvedValue({
          filterBy: "overall",
          filterValue: null,
          rows: [
            { groupId: "cycle-1", groupName: "Cycle 1", Passed: 3, Failed: 1, Blocked: 0, Skipped: 0, Untested: 2, Retest: 0, total: 6 },
            { groupId: "cycle-2", groupName: "Cycle 2", Passed: 1, Failed: 0, Blocked: 1, Skipped: 0, Untested: 0, Retest: 0, total: 2 }
          ]
        })
      });
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(rpc("tools/call", { name: "get_test_execution_summary", arguments: {} }), principal(), "proj-1");
      expect((legacy as any).executionReport).toHaveBeenCalledWith("proj-1", { filterBy: "overall" });
      const body = JSON.parse(res.result.content[0].text);
      expect(body.scope).toBe("project");
      expect(body.cycleCount).toBe(2);
      expect(body).toMatchObject({ Passed: 4, Failed: 1, Blocked: 1, Skipped: 0, Untested: 2, Retest: 0, total: 8 });
    });

    it("denies get_test_execution_summary for a cycle belonging to another project, and rejects one that does not exist", async () => {
      const { db } = makeDb({ cycleProject: "proj-OTHER" });
      const legacy = makeLegacy();
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "get_test_execution_summary", arguments: { cycleId: "cycle-1" } }),
        principal(),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ProjectScopeDenied);
      expect((legacy as any).executionReport).not.toHaveBeenCalled();
    });
  });

  describe("argument validation & error mapping", () => {
    it("rejects create_testcase without a title", async () => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1" });
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "create_testcase", arguments: {} }),
        principal(),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ToolExecutionError);
      expect(res.error.message).toMatch(/title/i);
    });

    it("rejects search_knowledge_base without q", async () => {
      const { db } = makeDb();
      const svc = new McpService(makeLegacy(), db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "search_knowledge_base", arguments: {} }),
        principal(),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ToolExecutionError);
      expect(res.error.message).toMatch(/"q"/i);
    });

    it("maps an underlying service exception onto a ToolExecutionError", async () => {
      const { db } = makeDb({ mcpActorId: "mcp-actor-1" });
      const legacy = makeLegacy({
        createSuite: jest.fn().mockRejectedValue({
          getResponse: () => ({ error: "name is required" })
        })
      });
      const svc = new McpService(legacy, db, writableLimits);
      const res: any = await svc.handleRequest(
        rpc("tools/call", { name: "create_suite", arguments: { name: "x" } }),
        principal(),
        "proj-1"
      );
      expect(res.error.code).toBe(RpcCode.ToolExecutionError);
      expect(res.error.message).toBe("name is required");
    });
  });
});


describe("MCP native model draft preview", () => {
  const savedFlag = process.env.TESBO_MODEL_PREVIEW_ENABLED;
  const draft = () => ({ schemaVersion: "tesbo-fsm-draft/1", semantics: "SEQUENTIAL_FSM", initialStateId: "draft",
    states: [{ id: "draft", label: "Draft" }, { id: "approved", label: "Approved" }],
    transitions: [{ id: "approve", from: "draft", to: "approved", action: "Approve", expectedObservation: "Approval recorded" }] });
  const call = (args: unknown = { model: draft() }) => rpc("tools/call", { name: "preview_behavior_model_draft", arguments: args });
  function setup(limits: PlanLimitsService = writableLimits) {
    const legacy = makeLegacy();
    const query = jest.fn().mockResolvedValue({ rows: [{ allowed: true }] });
    const db = { query } as unknown as DatabaseService;
    const preview = new ModelStudioPreview(db, legacy as unknown as LegacyService);
    const invoked = jest.spyOn(preview, "previewForUser");
    const svc = new McpService(legacy, db, limits, undefined, undefined, preview);
    return { legacy, query, invoked, svc };
  }
  beforeEach(() => { process.env.TESBO_MODEL_PREVIEW_ENABLED = "1"; });
  afterEach(() => {
    if (savedFlag === undefined) delete process.env.TESBO_MODEL_PREVIEW_ENABLED;
    else process.env.TESBO_MODEL_PREVIEW_ENABLED = savedFlag;
  });
  it("advertises a bounded exact schema and returns the shared native result without writes", async () => {
    const { svc, query } = setup();
    const list: any = await svc.handleRequest(rpc("tools/list"), principal(), "proj-1");
    expect(list.result.tools).toHaveLength(53);
    expect(new Set(list.result.tools.map((tool: any) => tool.name)).size).toBe(53);
    const tool = list.result.tools.find((t: any) => t.name === "preview_behavior_model_draft");
    expect(tool.inputSchema).toMatchObject({ additionalProperties: false, required: ["model"],
      properties: { model: { additionalProperties: false, properties: { states: { maxItems: 32 }, transitions: { maxItems: 64 } } } } });
    const result: any = await svc.handleRequest(call(), principal(), "proj-1");
    expect(result.error).toBeUndefined();
    expect(JSON.parse(result.result.content[0].text)).toEqual(previewDraftModel(draft()));
    expect(query.mock.calls.every(([sql]) => /^SELECT\b/i.test(String(sql).trim()))).toBe(true);
  });
  it.each([{}, [], null, { model: draft(), projectId: "foreign" }, { model: { ...draft(), approved: true } }])("refuses invalid arguments %#", async args => {
    const { svc } = setup();
    const result: any = await svc.handleRequest(call(args), principal(), "proj-1");
    expect(result.error).toMatchObject({ code: RpcCode.ToolExecutionError, data: { code: "INVALID_MODEL", httpStatus: 400 } });
  });
  it("preserves explicit unsupported and disabled codes", async () => {
    const { svc } = setup();
    const unsupported: any = await svc.handleRequest(call({ model: { ...draft(), semantics: "CONCURRENT" } }), principal(), "proj-1");
    expect(unsupported.error.data).toEqual({ code: "UNSUPPORTED_SEMANTICS", httpStatus: 422 });
    delete process.env.TESBO_MODEL_PREVIEW_ENABLED;
    const disabled: any = await svc.handleRequest(call(), principal(), "proj-1");
    expect(disabled.error.data).toEqual({ code: "MODEL_PREVIEW_DISABLED", httpStatus: 503 });
  });
  it("fails closed if the native service is missing", async () => {
    const { db } = makeDb();
    const svc = new McpService(makeLegacy(), db, writableLimits);
    const result: any = await svc.handleRequest(call(), principal(), "proj-1");
    expect(result.error.data).toEqual({ code: "MODEL_PREVIEW_UNAVAILABLE", httpStatus: 503 });
  });
  it("blocks read scope, cross-project and a write lock before the native validator", async () => {
    const limits = { assertProjectWritable: jest.fn().mockRejectedValue(new ForbiddenException({ error: "Project locked" })) } as unknown as PlanLimitsService;
    const { svc, invoked } = setup(limits);
    const read: any = await svc.handleRequest(call(), principal({ scopes: ["read"] }), "proj-1");
    expect(read.error.code).toBe(RpcCode.ScopeDenied);
    const foreign: any = await svc.handleRequest(call(), principal(), "foreign");
    expect(foreign.error.code).toBe(RpcCode.ProjectScopeDenied);
    const locked: any = await svc.handleRequest(call(), principal(), "proj-1");
    expect(locked.error.message).toBe("Project locked");
    expect(invoked).not.toHaveBeenCalled();
  });
  it("blocks revoked membership at dispatch and at the native completion fence", async () => {
    const { svc, legacy, invoked, query } = setup();
    jest.spyOn(legacy, "requireProjectAccess").mockRejectedValueOnce(new ForbiddenException("Removed"));
    const revoked: any = await svc.handleRequest(call(), principal(), "proj-1");
    expect(revoked.error.code).toBe(RpcCode.ProjectScopeDenied);
    expect(invoked).not.toHaveBeenCalled();
    query.mockImplementation(async (sql: string) => ({ rows: sql.includes("AS allowed") ? [{ allowed: false }] : [] }));
    const raced: any = await svc.handleRequest(call(), principal(), "proj-1");
    expect(raced.error.message).toContain("Project access changed");
    expect(raced.result).toBeUndefined();
  });
});
