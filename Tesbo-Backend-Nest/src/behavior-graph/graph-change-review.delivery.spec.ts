import { GraphChangeReviewDelivery } from "./graph-change-review.delivery";

const USER = "00000000-0000-4000-8000-000000000001";
const PROJECT = "00000000-0000-4000-8000-000000000002";
const REVIEW = "27";
const ORG = "00000000-0000-4000-8000-000000000004";
const ids = [USER, "00000000-0000-4000-8000-000000000003"];

function fixture(options: { delivered?: string[]; confirmationFails?: boolean; missing?: boolean } = {}) {
  const writes: unknown[][] = [];
  const query = jest.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.includes("FROM graph_capture_history")) {
      return { rows: options.missing ? [] : [{ id: REVIEW, organization_id: ORG, recipient_ids: ids }] };
    }
    if (sql.includes("INSERT INTO notifications")) {
      writes.push(params);
      return { rows: [{ id: "inserted" }] };
    }
    if (sql.includes("FROM notifications")) {
      if (options.confirmationFails) throw new Error("Database unavailable after capture commit");
      return { rows: (options.delivered ?? ids).map((user_id) => ({ user_id })) };
    }
    throw new Error("Unexpected query");
  });
  const legacy = { requireProjectAccess: jest.fn().mockResolvedValue({ id: PROJECT }) };
  const svc = new GraphChangeReviewDelivery({ query } as never, legacy as never);
  return { svc, query, writes, legacy };
}

describe("committed native QA notification delivery", () => {
  it("uses a project-member and committed-receipt lookup with per-user idempotent dedupe", async () => {
    const { svc, query, writes } = fixture();
    expect(await svc.deliverForUser(USER, PROJECT, REVIEW)).toEqual({
      status: "delivered", recipientCount: 2, pendingCount: 0
    });
    expect(writes).toHaveLength(1);
    expect(writes[0][1]).toBe("qa_change_review");
    expect(writes[0][3]).toBe("zyra_change_review");
    expect(writes[0][4]).toBe(PROJECT);
    expect(writes[0][5]).toBe(`qa_change_review:${PROJECT}:${REVIEW}`);
    // Native writer filters current membership again at INSERT time.
    expect(writes[0]).toContain(ORG);
    expect(writes[0]).toContain(PROJECT);
    expect(writes[0]).toContainEqual(["qa_engineer", "manager", "owner"]);
    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain("h.review_receipt_json IS NOT NULL");
    expect(sql).toContain("project_members");
    expect(sql).toContain("organization_members");
  });

  it("reports only missing recipients as pending instead of asserting delivery", async () => {
    const { svc } = fixture({ delivered: [USER] });
    expect(await svc.deliverForUser(USER, PROJECT, REVIEW)).toEqual({
      status: "pending", recipientCount: 2, pendingCount: 1
    });
  });

  it("reports pending when notification confirmation fails after the capture commit", async () => {
    const { svc } = fixture({ confirmationFails: true });
    expect(await svc.deliverForUser(USER, PROJECT, REVIEW)).toEqual({
      status: "pending", recipientCount: 2, pendingCount: 2
    });
  });

  it("refuses arbitrary history identifiers, absent committed receipts and missing callers", async () => {
    const { svc, query } = fixture({ missing: true });
    await expect(svc.deliverForUser(USER, PROJECT, "1 OR TRUE")).rejects.toMatchObject({ status: 404 });
    await expect(svc.deliverForUser(USER, PROJECT, "999999999999999999999")).rejects.toMatchObject({ status: 404 });
    await expect(svc.deliverForUser(USER, PROJECT, REVIEW)).rejects.toMatchObject({ status: 404 });
    await expect(svc.deliverForUser(null, PROJECT, REVIEW)).rejects.toMatchObject({ status: 403 });
    expect(query).toHaveBeenCalledTimes(1);
  });
});
