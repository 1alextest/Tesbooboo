import { GraphReviewRunLinks } from "./graph-review-run-links";

const USER = "00000000-0000-4000-8000-000000000001";
const PROJECT = "00000000-0000-4000-8000-000000000002";
const RUN = "00000000-0000-4000-8000-000000000003";
const CASE = "00000000-0000-4000-8000-000000000004";
const HISTORY = "42";

function setup(eligible = 1, newlyLinked = 1) {
  const query = jest.fn().mockResolvedValue({
    rows: [{ eligible_count: eligible, newly_linked: newlyLinked }]
  });
  const transaction = jest.fn(async (fn: (client: { query: typeof query }) => Promise<unknown>) =>
    fn({ query }));
  const db = { transaction, query } as never;
  const legacy = { requireProjectAccess: jest.fn().mockResolvedValue({ id: PROJECT }) };
  return { svc: new GraphReviewRunLinks(db, legacy as never), query, transaction, legacy };
}

describe("committed graph review → native run/case relationships", () => {
  it("records canonical human-selected run/case links only after current authorization and membership", async () => {
    const { svc, query, transaction, legacy } = setup();
    expect(await svc.linkForUser(USER, PROJECT, HISTORY, RUN, { testcaseIds: [CASE] })).toEqual({
      historyId: HISTORY, runId: RUN, selected: 1, newlyLinked: 1
    });
    expect(legacy.requireProjectAccess).toHaveBeenCalledWith(USER, PROJECT);
    expect(transaction).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    for (const condition of [
      "pm.role IN", "organization_members", "FOR SHARE OF p, pm, om",
      "h.review_receipt_json IS NOT NULL", "c.deleted_at IS NULL",
      "ci.deleted_at IS NULL", "tc.deleted_at IS NULL", "jsonb_build_array",
      "ON CONFLICT (project_id, history_id, cycle_id, testcase_id) DO NOTHING"
    ]) expect(sql).toContain(condition);
    expect(params).toEqual([PROJECT, USER, HISTORY, RUN, [CASE]]);
    expect(sql).not.toContain("UPDATE executions");
    expect(sql).not.toContain("INSERT INTO testcases");
  });

  it("returns zero newly linked for native idempotent replay", async () => {
    const { svc } = setup(1, 0);
    expect(await svc.linkForUser(USER, PROJECT, HISTORY, RUN, { testcaseIds: [CASE] }))
      .toMatchObject({ selected: 1, newlyLinked: 0 });
  });

  it("rolls back and rejects any partially eligible case selection", async () => {
    const { svc, transaction } = setup(0, 0);
    await expect(svc.linkForUser(USER, PROJECT, HISTORY, RUN, { testcaseIds: [CASE] }))
      .rejects.toMatchObject({ status: 409 });
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it.each([
    {}, [], null, { testcaseIds: [] }, { testcaseIds: [CASE, CASE] },
    { testcaseIds: [CASE, "not-a-uuid"] },
    { testcaseIds: new Array(201).fill(CASE) },
    { testcaseIds: [CASE], status: "Passed" },
    { testcaseIds: [CASE], coverageAssertion: "verified" },
    { testcaseIds: [CASE], evidence: [] }
  ])("rejects malformed or forged QA outcome payloads before any mutation: %p", async (payload) => {
    const { svc, query, transaction } = setup();
    await expect(svc.linkForUser(USER, PROJECT, HISTORY, RUN, payload))
      .rejects.toMatchObject({ status: 400 });
    expect(query).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects invalid history, nonmember and malformed run IDs", async () => {
    const { svc, transaction } = setup();
    await expect(svc.linkForUser(null, PROJECT, HISTORY, RUN, { testcaseIds: [CASE] }))
      .rejects.toMatchObject({ status: 403 });
    await expect(svc.linkForUser(USER, PROJECT, "0 OR TRUE", RUN, { testcaseIds: [CASE] }))
      .rejects.toMatchObject({ status: 404 });
    await expect(svc.linkForUser(USER, PROJECT, HISTORY, "not-a-run", { testcaseIds: [CASE] }))
      .rejects.toMatchObject({ status: 404 });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("reads only authorized committed-review links, not inferred outcomes", async () => {
    const { svc, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ allowed: true, links: [{
      runId: RUN, caseId: CASE, linkedAt: "2026-11-15T00:00:00Z",
      runName: "Human QA review", runStatus: "Planning"
    }] }] });
    const read = await svc.listForUser(USER, PROJECT, HISTORY);
    expect(read.links).toHaveLength(1);
    expect(read.links[0]).toMatchObject({ runId: RUN, caseId: CASE });
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual([PROJECT, USER, HISTORY]);
    expect(sql).toContain("JOIN allowed a ON a.id=l.project_id");
    expect(sql).toContain("h.review_receipt_json IS NOT NULL");
    expect(JSON.stringify(read)).not.toContain("verified");
  });

  it("never leaks foreign or uncommitted receipt associations to a caller", async () => {
    const { svc, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ allowed: false, links: [] }] });
    await expect(svc.listForUser(USER, PROJECT, HISTORY))
      .rejects.toMatchObject({ status: 404 });
  });
});
