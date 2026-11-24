import { unsupportedMcpProtocol } from "./mcp-protocol-compat";

const modern = {
  jsonrpc: "2.0", id: 71, method: "server/discover",
  params: {
    _meta: {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {}
    }
  }
};

describe("MCP version-era negotiation remains truthful until modern transport is implemented", () => {
  it("returns a recognized modern error with only versions this server actually implements", () => {
    expect(unsupportedMcpProtocol(modern, "2026-07-28")).toEqual({
      jsonrpc: "2.0", id: 71,
      error: {
        code: -32022,
        message: "Unsupported protocol version",
        data: { supported: ["2025-06-18", "2024-11-05"], requested: "2026-07-28" }
      }
    });
  });

  it("refuses modern calls before a side-effect-capable tools/call could be dispatched", () => {
    const call = {
      ...modern, method: "tools/call", id: "do-not-run",
      params: {
        ...modern.params,
        name: "capture_qa_graph_change", arguments: {}
      }
    };
    expect(unsupportedMcpProtocol(call, "2026-07-28")).toMatchObject({
      id: "do-not-run", error: { code: -32022 }
    });
  });

  it("rejects unsupported header-only and metadata-only requests without inventing 2026 support", () => {
    const list = { jsonrpc: "2.0", id: 2, method: "tools/list" };
    expect(unsupportedMcpProtocol(list, "2026-07-28")?.error.code).toBe(-32022);
    const fromMeta = { ...list, params: {
      _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28" }
    } };
    expect(unsupportedMcpProtocol(fromMeta, undefined)?.error.code).toBe(-32022);
    expect(unsupportedMcpProtocol(list, "1900-01-01")?.error.data.requested).toBe("1900-01-01");
  });

  it("refuses modern discovery with missing version instead of reporting a legacy method-not-found", () => {
    const noVersion = { jsonrpc: "2.0", id: "discover", method: "server/discover" };
    expect(unsupportedMcpProtocol(noVersion, undefined)).toMatchObject({
      id: "discover", error: { code: -32022, data: { requested: "unadvertised" } }
    });
  });

  it("does not change existing legacy initialize, list, call, notification or ping requests", () => {
    for (const method of ["initialize", "tools/list", "tools/call", "notifications/initialized", "ping"]) {
      const body = { jsonrpc: "2.0", id: 1, method,
        params: { protocolVersion: "2025-06-18" } };
      expect(unsupportedMcpProtocol(body, undefined)).toBeNull();
      expect(unsupportedMcpProtocol(body, "2025-06-18")).toBeNull();
      expect(unsupportedMcpProtocol(body, "2024-11-05")).toBeNull();
    }
  });

  it("ignores spoofed top-level metadata and refuses mismatched modern body despite legacy header", () => {
    const list = { jsonrpc: "2.0", id: 1, method: "tools/list",
      _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28" } };
    expect(unsupportedMcpProtocol(list, undefined)).toBeNull();
    const nested = { ...list, params: {
      _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28" }
    } };
    expect(unsupportedMcpProtocol(nested, "2025-06-18")?.error.data.requested).toBe("2026-07-28");
  });

  it("never trusts malformed body shapes or coerces attacker objects into versions", () => {
    for (const body of [null, undefined, 10, [], "", { params: { _meta: { "io.modelcontextprotocol/protocolVersion": { toString() { throw Error("should not run"); } } } } }]) {
      expect(unsupportedMcpProtocol(body, undefined)).toBeNull();
    }
    expect(unsupportedMcpProtocol({ id: 8, method: "server/discover" }, undefined)?.id).toBe(8);
  });
});
