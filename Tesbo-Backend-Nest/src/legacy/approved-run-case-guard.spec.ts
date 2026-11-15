import { assertApprovedRunCases } from "./approved-run-case-guard";
import type { PoolClient } from "pg";

const PROJECT = "00000000-0000-4000-8000-000000000001";
const GOOD = "00000000-0000-4000-8000-000000000002";
const BAD = "00000000-0000-4000-8000-000000000003";

describe("canonical test-run Approved eligibility guard", () => {
  const rows = (status: string) => {
    const query = jest.fn().mockResolvedValue({ rows: [
      { id: GOOD, status: "Approved" }, { id: BAD, status }
    ] });
    return { query, client: { query } as unknown as Pick<PoolClient, "query"> };
  };

  it("checks active owned case status with a locking query in the write transaction", async () => {
    const { client, query } = rows("Approved");
    await expect(assertApprovedRunCases(client, PROJECT, [GOOD, BAD])).resolves.toBeUndefined();
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("project_id=$1::uuid");
    expect(sql).toContain("id=ANY($2::uuid[])");
    expect(sql).toContain("deleted_at IS NULL");
    expect(sql).toContain("FOR SHARE");
    expect(params).toEqual([PROJECT, [GOOD, BAD]]);
  });

  it.each(["Draft", "In Review", "Deprecated", "Rejected", ""])(
    "rejects known %s without writing and identifies only ineligible cases", async (status) => {
      const { client } = rows(status);
      await expect(assertApprovedRunCases(client, PROJECT, [GOOD, BAD]))
        .rejects.toMatchObject({
          status: 409, response: {
            error: "Only Approved test cases can be added to a test run",
            ineligibleTestcaseIds: [BAD]
          }
        });
    }
  );

  it("does not query an empty selection", async () => {
    const { client, query } = rows("Draft");
    await assertApprovedRunCases(client, PROJECT, []);
    expect(query).not.toHaveBeenCalled();
  });
});
