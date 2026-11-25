import { LegacyService } from "./legacy.service";

const PROJECT = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
type Row = { provider: string; generated_count: number; saved_count: number; task_status: string };

/**
 * Exercise the actual Zyra dashboard read and inspect the SQL submitted to DB.
 * The synthetic DB fixture applies its real provider/status predicates, not a
 * mock return value that would conceal an unfiltered approval denominator.
 */
function setup(records: Row[]) {
  const svc = Object.create(LegacyService.prototype) as LegacyService;
  const inner = svc as unknown as Record<string, any>;
  inner.requireUser = jest.fn((user: string) => user);
  inner.requireProjectAccess = jest.fn().mockResolvedValue({});
  inner.getProject = jest.fn().mockResolvedValue({ settings: {} });
  inner.zyraAiAllocation = jest.fn().mockResolvedValue({ key: null, reason: "unconfigured" });
  inner.parseProjectSettings = jest.fn().mockReturnValue({ zyraAgent: {} });
  inner.testcaseRangeConfig = jest.fn().mockReturnValue({ requestedCount: 30 });
  inner.normalizeZyraCapabilities = jest.fn().mockReturnValue([]);
  inner.zyraCreatedTestcaseCount = jest.fn().mockResolvedValue(0);
  const sqls: string[] = [];
  inner.db = { query: jest.fn(async (sql: string) => {
    sqls.push(sql);
    if (sql.includes("SUM(saved_count)")) {
      const closed = records.filter(record => record.task_status === "done");
      // Reflect the exact artifact type restriction in the submitted aggregate:
      // without the SQL exclusion these fixtures MUST contaminate the result.
      const excludeNonTestcase = sql.includes("provider NOT IN ('external_requirement_proposal', 'external_document_proposal')");
      const caseRows = excludeNonTestcase
        ? closed.filter(record => !["external_requirement_proposal", "external_document_proposal"].includes(record.provider))
        : closed;
      return { rows: [{ saved: String(caseRows.reduce((sum, row) => sum + row.saved_count, 0)),
        generated: String(caseRows.reduce((sum, row) => sum + row.generated_count, 0)) }] };
    }
    if (sql.includes("zyra_token_usage")) return { rows: [{ total: "0" }] };
    if (sql.includes("zyra_chat_sessions")) return { rows: [{ last_used: null }] };
    if (sql.includes("FROM ai_generation_requests")) return { rows: [] };
    throw new Error("Unexpected Zyra dashboard SQL: " + sql.slice(0, 120));
  }) };
  return { svc, sqls };
}

describe("Zyra approval-rate artifact classification", () => {
  it("excludes done requirement/link and manual/policy proposals while keeping ordinary and chat case batches", async () => {
    const { svc, sqls } = setup([
      { provider: "ollama", generated_count: 10, saved_count: 4, task_status: "done" },
      { provider: "zyra_chat", generated_count: 5, saved_count: 3, task_status: "done" },
      { provider: "external_requirement_proposal", generated_count: 3, saved_count: 0, task_status: "done" },
      { provider: "external_document_proposal", generated_count: 1, saved_count: 0, task_status: "done" },
      { provider: "ollama", generated_count: 6, saved_count: 0, task_status: "in_review" },
    ]);
    const response = await svc.zyraAgent(PROJECT, USER);
    expect(response.approvalRate).toBe(47); // 7 approved / 15 decided case drafts
    expect(sqls.find(sql => sql.includes("SUM(saved_count)"))).toContain(
      "provider NOT IN ('external_requirement_proposal', 'external_document_proposal')"
    );
  });

  it("does not invent a 0% case approval rate for a project with only completed document proposals", async () => {
    const { svc } = setup([
      { provider: "external_requirement_proposal", generated_count: 3, saved_count: 0, task_status: "done" },
      { provider: "external_document_proposal", generated_count: 1, saved_count: 0, task_status: "done" }
    ]);
    const response = await svc.zyraAgent(PROJECT, USER);
    expect(response.approvalRate).toBeNull();
  });
});
