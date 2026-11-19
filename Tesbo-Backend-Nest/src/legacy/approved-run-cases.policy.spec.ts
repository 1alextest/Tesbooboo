import { ConflictException } from "@nestjs/common";
import { assertApprovedNewRunCases } from "./approved-run-cases.policy";

const PROJECT = "00000000-0000-4000-8000-000000000001";
const CYCLE = "00000000-0000-4000-8000-000000000002";
const APPROVED = "00000000-0000-4000-8000-000000000003";
const DRAFT = "00000000-0000-4000-8000-000000000004";

describe("canonical Approved-only new run-case eligibility policy", () => {
  it("locks current project case rows, excludes already-attached members and returns for Approved", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ id: APPROVED, status: "Approved", approval_current: true }] });
    await expect(assertApprovedNewRunCases({ query } as never, PROJECT, CYCLE, [APPROVED]))
      .resolves.toBeUndefined();
    const [sql, values] = query.mock.calls[0];
    expect(values).toEqual([PROJECT, [APPROVED], CYCLE]);
    for (const fragment of [
      "t.project_id=$1::uuid", "t.id=ANY($2::uuid[])", "t.deleted_at IS NULL",
      "ci.cycle_id=$3::uuid", "ci.deleted_at IS NULL", "FOR SHARE OF t"
    ]) expect(sql).toContain(fragment);
  });

  it("rejects the entire selection if any new case is not Approved", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [
      { id: APPROVED, status: "Approved", approval_current: true }, { id: DRAFT, status: "Draft", approval_current: false }
    ] });
    await expect(assertApprovedNewRunCases({ query } as never, PROJECT, CYCLE, [APPROVED, DRAFT]))
      .rejects.toBeInstanceOf(ConflictException);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("treats foreign/missing or already attached items as skipped, not as exposure of their statuses", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    await expect(assertApprovedNewRunCases({ query } as never, PROJECT, CYCLE, [DRAFT]))
      .resolves.toBeUndefined();
    await assertApprovedNewRunCases({ query } as never, PROJECT, CYCLE, []);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it.each(["In Review", "Deprecated", "Archived", "Draft", ""])(
    "rejects %s as a new attachment regardless of UI selection", async (status) => {
      const query = jest.fn().mockResolvedValue({ rows: [{ id: DRAFT, status }] });
      await expect(assertApprovedNewRunCases({ query } as never, PROJECT, CYCLE, [DRAFT]))
        .rejects.toMatchObject({ status: 409 });
    }
  );

  it.each([false, undefined])("refuses an Approved label with stale or unknown semantic receipt (%s)", async (approvalCurrent) => {
    const query = jest.fn().mockResolvedValue({ rows: [{ id: APPROVED, status: "Approved", approval_current: approvalCurrent }] });
    await expect(assertApprovedNewRunCases({ query } as never, PROJECT, CYCLE, [APPROVED]))
      .rejects.toMatchObject({ status: 409 });
    expect(query.mock.calls[1][0]).toContain("r.semantic_revision=encode(sha256");
  });
});
