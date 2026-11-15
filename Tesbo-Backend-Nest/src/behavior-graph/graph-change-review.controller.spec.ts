import { GraphChangeReviewController } from "./graph-change-review.controller";
import { parseApprovedSourceCheckouts } from "./graph-change-review.module";

const USER = "00000000-0000-4000-8000-000000000001";
const PROJECT = "00000000-0000-4000-8000-000000000002";

describe("Zyra graph change-review native contract", () => {
  it("fails closed without an approved source checkout registry", () => {
    expect(parseApprovedSourceCheckouts("")).toEqual({});
    expect(Object.isFrozen(parseApprovedSourceCheckouts(""))).toBe(true);
  });

  it.each([
    "[]", "null", "not json",
    JSON.stringify({ source: { repositoryId: "org/repo", root: "../untrusted" } }),
    JSON.stringify({ source: { repositoryId: "org/repo", root: "/root", extra: true } }),
    JSON.stringify({ source: { repositoryId: "bad", root: "/approved" } }),
    JSON.stringify({ "../escape": { repositoryId: "org/repo", root: "/approved" } })
  ])("rejects unsafe or malformed source registry %s", (value) => {
    expect(() => parseApprovedSourceCheckouts(value)).toThrow();
  });

  it("accepts exact server config and never normalizes a client path", () => {
    const config = parseApprovedSourceCheckouts(JSON.stringify({
      product: { repositoryId: "org/repo", root: "/srv/approved/repo" }
    }));
    expect(config.product).toEqual({ repositoryId: "org/repo", root: "/srv/approved/repo" });
    expect(Object.isFrozen(config.product)).toBe(true);
  });

  it("passes the current authenticated project identity to the canonical history reader", async () => {
    const history = { listForUser: jest.fn().mockResolvedValue([{ id: "1" }]) };
    const coordinator = { captureForUser: jest.fn().mockResolvedValue({ stored: true }) };
    const controller = new GraphChangeReviewController(history as never, coordinator as never);
    expect(await controller.list({ userId: USER } as never, PROJECT, "10")).toEqual({
      entries: [{ id: "1" }]
    });
    expect(history.listForUser).toHaveBeenCalledWith(USER, PROJECT, 10, undefined);
    expect(await controller.capture({ userId: USER } as never, PROJECT)).toEqual({ stored: true });
    expect(coordinator.captureForUser).toHaveBeenCalledWith(USER, PROJECT);
  });

  it("forwards malformed paging to the history guard rather than silently defaulting", async () => {
    const history = { listForUser: jest.fn().mockRejectedValue(new Error("invalid limit")) };
    const controller = new GraphChangeReviewController(history as never, {} as never);
    await expect(controller.list({ userId: USER } as never, PROJECT, "NaN", "invalid"))
      .rejects.toThrow("invalid limit");
    expect(history.listForUser).toHaveBeenCalledWith(USER, PROJECT, NaN, "invalid");
  });
});
