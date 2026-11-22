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
