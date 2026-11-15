import { ConflictException } from "@nestjs/common";
import { assertApprovedNewRunCases } from "./approved-run-cases.policy";

const PROJECT = "00000000-0000-4000-8000-000000000001";
const CYCLE = "00000000-0000-4000-8000-000000000002";
const APPROVED = "00000000-0000-4000-8000-000000000003";
const DRAFT = "00000000-0000-4000-8000-000000000004";

describe("canonical Approved-only new run-case eligibility policy", () => {
  it("locks current project case rows, excludes already-attached members and returns for Approved", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ id: APPROVED, status: "Approved" }] });
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
      { id: APPROVED, status: "Approved" }, { id: DRAFT, status: "Draft" }
    ] });
    await expect(assertApprovedNewRunCases({ query } as never, PROJECT, CYCLE, [APPROVED, DRAFT]))
      .rejects.toBeInstanceOf(ConflictException);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("treats foreign/missing or already attached items as skipped, not as exposure of their statuses", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    await expect(assertApprovedNewRunCases({ query } as never, PROJECT, CYCLE, [DRAFT]))
      .resolves.toBeUndefined();
    await assertApprovedNewRunCases({ query } as never, PROJECT, CYCLE, []);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it.each(["In Review", "Deprecated", "Archived", "Draft", ""])(
    "rejects %s as a new attachment regardless of UI selection", async (status) => {
      const query = jest.fn().mockResolvedValue({ rows: [{ id: DRAFT, status }] });
      await expect(assertApprovedNewRunCases({ query } as never, PROJECT, CYCLE, [DRAFT]))
        .rejects.toMatchObject({ status: 409 });
    }
  );
});
