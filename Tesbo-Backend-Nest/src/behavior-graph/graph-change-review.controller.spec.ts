import { GraphChangeReviewController } from "./graph-change-review.controller";
import { parseApprovedSourceCheckouts } from "./graph-change-review.module";
import { CurrentCacheGraphHistory } from "./current-cache-graph.history";
import type { DatabaseService } from "../database/database.service";
import type { CurrentCacheGraphReader } from "./current-cache-graph.reader";

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
    const controller = new GraphChangeReviewController(history as never, coordinator as never, {} as never, {} as never);
    expect(await controller.list({ userId: USER } as never, PROJECT, "10")).toEqual({
      entries: [{ id: "1" }]
    });
    expect(history.listForUser).toHaveBeenCalledWith(USER, PROJECT, 10, undefined);
    expect(await controller.capture({ userId: USER } as never, PROJECT)).toEqual({ stored: true, delivery: null });
    expect(coordinator.captureForUser).toHaveBeenCalledWith(USER, PROJECT);
  });

  it("routes source configuration through current human identity and owner management", async () => {
    const binding = { repositoryId: "org/repo", checkoutKey: "trusted", refName: "development",
      selectionPrefixes: ["src"], enabled: true };
    const sourceManagement = {
      getForOwner: jest.fn().mockResolvedValue({ configured: false, binding: null }),
      setForOwner: jest.fn().mockResolvedValue({ configured: true, binding })
    };
    const controller = new GraphChangeReviewController(
      {} as never, {} as never, {} as never, sourceManagement as never
    );
    expect(await controller.getSourceBinding({ userId: USER } as never, PROJECT))
      .toEqual({ configured: false, binding: null });
    expect(sourceManagement.getForOwner).toHaveBeenCalledWith(USER, PROJECT);
    expect(await controller.setSourceBinding({ userId: USER } as never, PROJECT, binding))
      .toEqual({ configured: true, binding });
    expect(sourceManagement.setForOwner).toHaveBeenCalledWith(USER, PROJECT, binding);
  });

  it("does not substitute an agent identity for denied source administration", async () => {
    const sourceManagement = {
      getForOwner: jest.fn().mockRejectedValue({ status: 403 }),
      setForOwner: jest.fn().mockRejectedValue({ status: 403 })
    };
    const controller = new GraphChangeReviewController(
      {} as never, {} as never, {} as never, sourceManagement as never
    );
    await expect(controller.getSourceBinding({ userId: null } as never, PROJECT))
      .rejects.toMatchObject({ status: 403 });
    await expect(controller.setSourceBinding({ userId: null } as never, PROJECT,
      { repositoryRoot: "/tmp/untrusted" })).rejects.toMatchObject({ status: 403 });
    expect(sourceManagement.setForOwner).toHaveBeenCalledWith(null, PROJECT,
      { repositoryRoot: "/tmp/untrusted" });
  });

  it("retries only by calling the native committed notification service", async () => {
    const history = { listForUser: jest.fn() };
    const delivery = { deliverForUser: jest.fn().mockResolvedValue({
      status: "delivered", recipientCount: 2, pendingCount: 0
    }) };
    const controller = new GraphChangeReviewController(history as never, {} as never, delivery as never, {} as never);
    expect(await controller.retryNotification({ userId: USER } as never, PROJECT, "7")).toMatchObject({
      status: "delivered", pendingCount: 0
    });
    expect(delivery.deliverForUser).toHaveBeenCalledWith(USER, PROJECT, "7");
  });

  it("does not accept client-authored source manifests or execution assertions", async () => {
    const history = { listForUser: jest.fn() };
    const coordinator = { captureForUser: jest.fn() };
    const controller = new GraphChangeReviewController(history as never, coordinator as never, {} as never, {} as never);
    await expect(controller.capture({ userId: USER } as never, PROJECT, {
      repositoryRoot: "/tmp/other", executionAssertion: "passed"
    })).rejects.toMatchObject({ status: 400 });
    expect(coordinator.captureForUser).not.toHaveBeenCalled();
  });

  it("forwards malformed paging to the history guard rather than silently defaulting", async () => {
    const history = { listForUser: jest.fn().mockRejectedValue(new Error("invalid limit")) };
    const controller = new GraphChangeReviewController(history as never, {} as never, {} as never, {} as never);
    await expect(controller.list({ userId: USER } as never, PROJECT, "NaN", "invalid"))
      .rejects.toThrow("invalid limit");
    expect(history.listForUser).toHaveBeenCalledWith(USER, PROJECT, NaN, "invalid");
  });

  describe("runtime history paging at the HTTP boundary", () => {
    function paging() {
      const query = jest.fn(async (_sql: string, _values: unknown[]) => ({
        rows: [{ authorized: true, entries: [] }]
      }));
      const history = new CurrentCacheGraphHistory(
        { query } as unknown as DatabaseService, {} as CurrentCacheGraphReader
      );
      const controller = new GraphChangeReviewController(
        history, {} as never, {} as never, {} as never
      );
      return { history, controller, query };
    }

    it.each([undefined, "1", "9223372036854775807"])("retains scalar cursor %p without numeric rounding", async (cursor) => {
      const { controller, query } = paging();
      expect(await controller.list({ userId: USER } as never, PROJECT, "100", cursor))
        .toEqual({ entries: [] });
      expect(query).toHaveBeenCalledTimes(1);
      expect(query.mock.calls[0][1]).toStrictEqual([PROJECT, USER, cursor ?? null, 100]);
    });

    it.each([
      ["single-value array", ["1"]],
      ["multi-value array", ["1", "2"]],
      ["number", 1],
      ["bigint", 1n],
      ["null", null],
      ["boolean", true],
      ["object", { id: "1" }],
      ["boxed string", Object("1")]
    ])("refuses a %s cursor before querying history", async (_label, cursor) => {
      const { history, query } = paging();
      // Express query types and JSON-RPC inputs are runtime data, not the
      // string promised by a TypeScript parameter annotation.
      await expect(history.listForUser(USER, PROJECT, 25, cursor as never))
        .rejects.toMatchObject({ status: 409, response: { error: "Invalid history cursor" } });
      expect(query).not.toHaveBeenCalled();
    });

    it.each(["", "0", "01", "-1", "1.0", "1e2", " 1", "1 ", "9223372036854775808", "99999999999999999999"])
    ("retains refusal of malformed or overflowing cursor %p", async (cursor) => {
      const { history, query } = paging();
      await expect(history.listForUser(USER, PROJECT, 25, cursor))
        .rejects.toMatchObject({ status: 409, response: { error: "Invalid history cursor" } });
      expect(query).not.toHaveBeenCalled();
    });

    it("does not coerce an object into a cursor or run caller conversion hooks", async () => {
      const { controller, query } = paging();
      const toString = jest.fn(() => "1");
      const valueOf = jest.fn(() => 1);
      await expect(controller.list({ userId: USER } as never, PROJECT, "25", { toString, valueOf } as never))
        .rejects.toMatchObject({ status: 409, response: { error: "Invalid history cursor" } });
      expect(toString).not.toHaveBeenCalled();
      expect(valueOf).not.toHaveBeenCalled();
      expect(query).not.toHaveBeenCalled();
    });

    it.each([
      ["array", ["25"]], ["object", { toString: () => "25" }], ["null", null], ["number", 25]
    ])("refuses non-string HTTP limit %s instead of coercing it", async (_label, limit) => {
      const { controller, query } = paging();
      await expect(controller.list({ userId: USER } as never, PROJECT, limit as never))
        .rejects.toMatchObject({ status: 409, response: { error: "Graph history limit must be 1–100" } });
      expect(query).not.toHaveBeenCalled();
    });

    it("keeps authentication refusal ahead of malformed paging without touching the database", async () => {
      const { controller, query } = paging();
      await expect(controller.list({ userId: null } as never, PROJECT, ["25"] as never, ["1"] as never))
        .rejects.toMatchObject({ status: 403 });
      expect(query).not.toHaveBeenCalled();
    });
  });
});
