import { IntegrationSyncDecisions, type ChatAllocation } from "./integration-sync-decisions";
import type { DatabaseService } from "../database/database.service";
import type { RemoteComment, RemoteTicket } from "./integration-sync.types";
import * as aiTrace from "../observability/ai-trace";

describe("integration decision trace identity", () => {
  afterEach(() => jest.restoreAllMocks());

  it("separates tenants and repeated attempts with identical provider IDs and timestamps", async () => {
    jest.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const record = jest.spyOn(aiTrace, "recordStandaloneGeneration").mockResolvedValue(undefined);
    const service = new IntegrationSyncDecisions({} as DatabaseService);
    jest.spyOn(service as unknown as { callOpenAI: (...args: unknown[]) => Promise<unknown> }, "callOpenAI")
      .mockResolvedValue({ text: "- Keep the existing behavior.", usage: { input: 10, output: 4 } });
    const allocation: ChatAllocation = { provider: "openai", api_key: "synthetic-private-key", default_model: "gpt-4.1",
      base_url: null, auth_header_name: null, auth_scheme: null, is_active: true };
    const ticket = { issueId: "provider-123", issueKey: "QA-123", summary: "Decision", description: "" } as RemoteTicket;
    const comments = [{ body: "Keep existing behavior.", author: "QA", createdAt: "2026-11-21T00:00:00Z" }] as unknown as RemoteComment[];
    // The call remains executable against the old implementation, which ignores the new scope
    // argument: a failing-before run must expose an identity defect, not a TypeScript mismatch.
    const summarize = service.summarize.bind(service) as (...args: unknown[]) => Promise<string | null>;
    const scopes = [
      { organizationId: "org-1", projectId: "project-1", runId: "run-1", ticketId: "native-1" },
      { organizationId: "org-2", projectId: "project-2", runId: "run-2", ticketId: "native-2" },
      { organizationId: "org-1", projectId: "project-1", runId: "run-1", ticketId: "native-1" }
    ];
    for (const scope of scopes) await summarize(allocation, ticket, comments, scope);
    expect(record).toHaveBeenCalledTimes(3);
    expect(new Set(record.mock.calls.map(([entry]) => entry.traceSeed)).size).toBe(3);
    for (const [index, [entry]] of record.mock.calls.entries()) {
      const scope = scopes[index];
      expect(entry.metadata).toMatchObject({ organizationId: scope.organizationId, projectId: scope.projectId,
        runId: scope.runId, nativeTicketId: scope.ticketId });
      expect(entry.traceSeed).toContain(`${scope.projectId}:${scope.runId}:${scope.ticketId}:`);
      expect(JSON.stringify(entry)).not.toContain(allocation.api_key);
    }
  });
});

describe.each(["openai", "anthropic"])("integration decision %s usage boundary", (provider) => {
  const realFetch = global.fetch;
  const allocation: ChatAllocation = { provider, api_key: "synthetic-private-key", default_model: null,
    base_url: null, auth_header_name: null, auth_scheme: null, is_active: true };
  const ticket = { issueId: "remote-one", issueKey: "QA-1", summary: "Decision", description: "" } as RemoteTicket;
  const comments = [{ body: "Keep the existing behavior.", author: "QA", createdAt: "2026-11-21T00:00:00Z" }] as unknown as RemoteComment[];
  const scope = { organizationId: "org-one", projectId: "project-one", runId: "run-one", ticketId: "native-one" };

  function response(usage: unknown, text = "- Keep the existing behavior."): void {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => provider === "anthropic"
        ? { content: [{ type: "text", text }], usage }
        : { choices: [{ message: { content: text } }], usage }
    })) as unknown as typeof fetch;
  }

  async function summarize() {
    return new IntegrationSyncDecisions({} as DatabaseService).summarize(allocation, ticket, comments, scope);
  }

  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  it.each([
    ["missing", undefined], ["null", null], ["empty", {}], ["array", []], ["string", "unknown"]
  ])("keeps %s provider usage unknown without changing the decisions text", async (_label, usage) => {
    const recorded = jest.spyOn(aiTrace, "recordStandaloneGeneration").mockResolvedValue(undefined);
    response(usage);
    await expect(summarize()).resolves.toBe("- Keep the existing behavior.");
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(recorded).toHaveBeenCalledTimes(1);
    expect(recorded.mock.calls[0][0].usage).toBeUndefined();
  });

  it("keeps a partial count without inventing output tokens", async () => {
    const recorded = jest.spyOn(aiTrace, "recordStandaloneGeneration").mockResolvedValue(undefined);
    response(provider === "anthropic" ? { input_tokens: 12 } : { prompt_tokens: 12 });
    await expect(summarize()).resolves.toBe("- Keep the existing behavior.");
    expect(recorded.mock.calls[0][0].usage).toEqual({ input: 12 });
    expect(recorded.mock.calls[0][0].usage?.output).toBeUndefined();
  });

  it("does not coerce numeric strings or malformed counts into measurements", async () => {
    const recorded = jest.spyOn(aiTrace, "recordStandaloneGeneration").mockResolvedValue(undefined);
    response(provider === "anthropic"
      ? { input_tokens: "12", output_tokens: -1, cache_read_input_tokens: false }
      : { prompt_tokens: "12", completion_tokens: -1, total_tokens: Number.NaN, prompt_tokens_details: { cached_tokens: false } });
    await expect(summarize()).resolves.toBe("- Keep the existing behavior.");
    expect(recorded.mock.calls[0][0].usage).toBeUndefined();
  });

  it("retains explicit measured zero, including zero cache usage", async () => {
    const recorded = jest.spyOn(aiTrace, "recordStandaloneGeneration").mockResolvedValue(undefined);
    response(provider === "anthropic"
      ? { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
      : { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, prompt_tokens_details: { cached_tokens: 0 } });
    await expect(summarize()).resolves.toBe("- Keep the existing behavior.");
    expect(recorded.mock.calls[0][0].usage).toEqual({ input: 0, output: 0, total: 0, cached: 0 });
  });

  it("keeps the provider's cache accounting alongside known input/output counts", async () => {
    const recorded = jest.spyOn(aiTrace, "recordStandaloneGeneration").mockResolvedValue(undefined);
    response(provider === "anthropic"
      ? { input_tokens: 40, output_tokens: 10, cache_read_input_tokens: 60, cache_creation_input_tokens: 10 }
      : { prompt_tokens: 110, completion_tokens: 10, total_tokens: 120, prompt_tokens_details: { cached_tokens: 70 } });
    await expect(summarize()).resolves.toBe("- Keep the existing behavior.");
    expect(recorded.mock.calls[0][0].usage).toEqual({ input: 110, output: 10, total: 120, cached: 70 });
  });

  it("preserves the NONE product result while retaining valid partial usage", async () => {
    const recorded = jest.spyOn(aiTrace, "recordStandaloneGeneration").mockResolvedValue(undefined);
    response(provider === "anthropic" ? { output_tokens: 1 } : { completion_tokens: 1 }, " NONE. ");
    await expect(summarize()).resolves.toBeNull();
    expect(recorded.mock.calls[0][0]).toMatchObject({ output: "NONE.", usage: { output: 1 } });
    expect(recorded.mock.calls[0][0].usage?.input).toBeUndefined();
  });

  it("preserves provider failure as a degraded summary and an error observation", async () => {
    const recorded = jest.spyOn(aiTrace, "recordStandaloneGeneration").mockResolvedValue(undefined);
    global.fetch = jest.fn().mockRejectedValue(new Error("synthetic provider failure"));
    await expect(summarize()).resolves.toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(recorded).toHaveBeenCalledTimes(1);
    expect(recorded.mock.calls[0][0]).toMatchObject({ errorMessage: "synthetic provider failure" });
    expect(recorded.mock.calls[0][0].usage).toBeUndefined();
  });
});
