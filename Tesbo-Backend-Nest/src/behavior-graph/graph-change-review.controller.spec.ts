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
    const controller = new GraphChangeReviewController(history as never, coordinator as never, {} as never, {} as never, {} as never);
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
      {} as never, {} as never, {} as never, sourceManagement as never, {} as never
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


  it("uses current human identity for idempotent run case-linking without execution claims", async () => {
    const runLinks = {
      listForUser: jest.fn().mockResolvedValue({ links: [] }),
      linkForUser: jest.fn().mockResolvedValue({
        historyId: "42", runId: "00000000-0000-4000-8000-000000000003",
        selected: 1, newlyLinked: 1
      })
    };
    const controller = new GraphChangeReviewController(
      {} as never, {} as never, {} as never, {} as never, runLinks as never
    );
    const cycleId = "00000000-0000-4000-8000-000000000003";
    const body = { testcaseIds: ["00000000-0000-4000-8000-000000000004"] };
    expect(await controller.listLinkedRuns({ userId: USER } as never, PROJECT, "42"))
      .toEqual({ links: [] });
    expect(await controller.linkRunCases({ userId: USER } as never, PROJECT, "42", cycleId, body))
      .toMatchObject({ newlyLinked: 1, selected: 1 });
    expect(runLinks.listForUser).toHaveBeenCalledWith(USER, PROJECT, "42");
    expect(runLinks.linkForUser).toHaveBeenCalledWith(USER, PROJECT, "42", cycleId, body);
  });

  it("retries only by calling the native committed notification service", async () => {
    const history = { listForUser: jest.fn() };
    const delivery = { deliverForUser: jest.fn().mockResolvedValue({
      status: "delivered", recipientCount: 2, pendingCount: 0
    }) };
    const controller = new GraphChangeReviewController(history as never, {} as never, delivery as never, {} as never, {} as never);
    expect(await controller.retryNotification({ userId: USER } as never, PROJECT, "7")).toMatchObject({
      status: "delivered", pendingCount: 0
    });
    expect(delivery.deliverForUser).toHaveBeenCalledWith(USER, PROJECT, "7");
  });

  it("does not accept client-authored source manifests or execution assertions", async () => {
    const history = { listForUser: jest.fn() };
    const coordinator = { captureForUser: jest.fn() };
    const controller = new GraphChangeReviewController(history as never, coordinator as never, {} as never, {} as never, {} as never);
    await expect(controller.capture({ userId: USER } as never, PROJECT, {
      repositoryRoot: "/tmp/other", executionAssertion: "passed"
    })).rejects.toMatchObject({ status: 400 });
    expect(coordinator.captureForUser).not.toHaveBeenCalled();
  });

  it("forwards malformed paging to the history guard rather than silently defaulting", async () => {
    const history = { listForUser: jest.fn().mockRejectedValue(new Error("invalid limit")) };
    const controller = new GraphChangeReviewController(history as never, {} as never, {} as never, {} as never, {} as never);
    await expect(controller.list({ userId: USER } as never, PROJECT, "NaN", "invalid"))
      .rejects.toThrow("invalid limit");
    expect(history.listForUser).toHaveBeenCalledWith(USER, PROJECT, NaN, "invalid");
  });
});
