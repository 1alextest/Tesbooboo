import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { makeLegacy } from "./test-helpers/legacy-service.fixture";
import type { DatabaseService } from "../database/database.service";
import { assertNotGenericApproval } from "./testcase-edit-revision";
import { LegacyController } from "./legacy.controller";

const project = "11111111-1111-4111-8111-111111111111";
const testcase = "22222222-2222-4222-8222-222222222222";
const revision = "a".repeat(64), semantic = "b".repeat(64);
const body = { expectedRevision: revision, expectedApprovalRevision: semantic };

function fixture(currentRevision = revision, currentSemantic = semantic) {
  const query = jest.fn(async (sql: string) => {
    if (/SELECT p.id FROM projects/.test(sql)) return { rows: [{ id: project }] };
    if (/SELECT id FROM testcases/.test(sql)) return { rows: [{ id: testcase }] };
    if (/SELECT testcases.\*, testcase_approval_snapshot/.test(sql)) return { rows: [{ id: testcase, status: "In Review", edit_revision: currentRevision, semantic_revision: currentSemantic, snapshot: { case: { title: "Reviewed" } } }] };
    if (/UPDATE testcases SET status/.test(sql)) return { rows: [{ id: testcase, status: "Approved", external_id: "TC-1", title: "Reviewed" }] };
    if (/INSERT INTO testcase_approval_receipts/.test(sql)) return { rows: [{ id: "receipt", semantic_revision: semantic }] };
    return { rows: [] };
  });
  const transaction = jest.fn(async (work: (client: { query: typeof query }) => Promise<unknown>) => work({ query }));
  const service = makeLegacy({ query, transaction } as unknown as DatabaseService);
  jest.spyOn(service, "requireProjectAccess").mockResolvedValue({ id: project } as never);
  jest.spyOn(service as never, "enqueueTestcaseEmbedding" as never).mockImplementation((() => undefined) as never);
  const approve = (principal?: { kind: "human_session" | "api_token" }) => service.approveTestCaseForUser("reviewer", project, testcase, body, principal);
  return { service, query, transaction, approve };
}

describe("exact human testcase decisions", () => {
  it.each([undefined, { kind: "api_token" as const }])("rejects missing/machine principal before persistence: %j", async (principal) => {
    const f = fixture();
    await expect(f.approve(principal)).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.transaction).not.toHaveBeenCalled();
  });

  it.each([["c".repeat(64), semantic], [revision, "d".repeat(64)]])("rejects changed row or dependency revision", async (current, currentSemantic) => {
    const f = fixture(current, currentSemantic);
    await expect(f.approve({ kind: "human_session" })).rejects.toMatchObject({ status: 409 });
    expect(f.query.mock.calls.some(([sql]) => /^\s*(UPDATE|INSERT)\b/.test(sql))).toBe(false);
  });

  it("commits an exact snapshot and mandatory audit through the same client", async () => {
    const f = fixture();
    await expect(f.approve({ kind: "human_session" })).resolves.toMatchObject({ testcase: { status: "Approved" } });
    const insert = f.query.mock.calls.find(([sql]) => /INSERT INTO testcase_approval_receipts/.test(sql));
    expect(insert?.[0]).toContain("reviewed_snapshot, principal_kind");
    expect(f.query.mock.calls.some(([sql]) => /INSERT INTO audit_logs/.test(sql))).toBe(true);
  });

  it("propagates mandatory audit failure rather than returning success", async () => {
    const f = fixture(), original = f.query.getMockImplementation()!;
    f.query.mockImplementation(async (sql) => {
      if (/INSERT INTO audit_logs/.test(sql)) throw new Error("audit unavailable");
      return original(sql);
    });
    await expect(f.approve({ kind: "human_session" })).rejects.toThrow("audit unavailable");
  });

  it("passes trusted machine identity from the actual controller to the decision service", async () => {
    const approval = jest.fn();
    const controller = new LegacyController({ approveTestCaseForUser: approval } as never, {} as never, {} as never, {} as never);
    await controller.approveTestCase({ userId: "admin", apiToken: { tokenId: "machine" } } as never, project, testcase, body);
    expect(approval).toHaveBeenCalledWith("admin", project, testcase, body, { kind: "api_token" });
  });

  it.each(["Approved", "approved", " APPROVED "])("refuses generic approval payload %s", (status) => {
    expect(() => assertNotGenericApproval(status)).toThrow(BadRequestException);
  });
});
