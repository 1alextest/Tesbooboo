import { assertApprovedCycleCasesAtWrite } from "./approved-cycle-cases";

const PROJECT = "00000000-0000-4000-8000-000000000001";
const RUN = "00000000-0000-4000-8000-000000000002";
const CASE = "00000000-0000-4000-8000-000000000003";

function fixture(rows: Array<{ id: string; status: string; already_attached: boolean }>) {
  const query = jest.fn().mockResolvedValue({ rows });
  return { query, client: { query } as never };
}

describe("canonical Approved-only test run case membership guard", () => {
  it("locks the actual project-scoped testcase row before write", async () => {
    const { client, query } = fixture([{ id: CASE, status: "Approved", already_attached: false }]);
    await expect(assertApprovedCycleCasesAtWrite(client, PROJECT, RUN, [CASE]))
      .resolves.toBeUndefined();
    const [sql, args] = query.mock.calls[0] as [string, unknown[]];
    for (const fragment of [
      "FOR SHARE OF t", "t.project_id=$1::uuid", "t.id=ANY($2::uuid[])",
      "t.deleted_at IS NULL", "ci.cycle_id=$3::uuid",
      "ci.deleted_at IS NULL", "AS already_attached"
    ]) expect(sql).toContain(fragment);
    expect(args).toEqual([PROJECT, [CASE], RUN]);
  });

  it.each(["Draft", "In Review", "Deprecated", "Unknown"])(
    "refuses new %s cases with conflict before inserting",
    async (status) => {
      const { client } = fixture([{ id: CASE, status, already_attached: false }]);
      await expect(assertApprovedCycleCasesAtWrite(client, PROJECT, RUN, [CASE]))
        .rejects.toMatchObject({ status: 409, response: {
          error: "Only Approved test cases can be added to a test run",
          ineligibleTestcaseIds: [CASE]
        } });
    }
  );

  it("allows an idempotent already-attached historical case after later demotion", async () => {
    const { client } = fixture([{ id: CASE, status: "Draft", already_attached: true }]);
    await expect(assertApprovedCycleCasesAtWrite(client, PROJECT, RUN, [CASE]))
      .resolves.toBeUndefined();
  });

  it("keeps unknown and other-project identifiers in the caller's existing skip path", async () => {
    const { client, query } = fixture([]);
    await assertApprovedCycleCasesAtWrite(client, PROJECT, RUN, [CASE]);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("does not query if there are no canonical case identifiers", async () => {
    const { client, query } = fixture([]);
    await assertApprovedCycleCasesAtWrite(client, PROJECT, RUN, []);
    expect(query).not.toHaveBeenCalled();
  });
});
