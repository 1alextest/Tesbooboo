import { BadRequestException, ConflictException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { retestCreateInput, retestDigest, retestExecutionIds } from "./native-retest";

describe("native retest exact intent", () => {
  const first = "11111111-1111-4111-8111-111111111111";
  const second = "22222222-2222-4222-8222-222222222222";
  it("rejects a malformed or repeated occurrence instead of silently retesting a subset", () => {
    for (const invalid of [[], [first, first], [first, "missing"], "all", [null]]) {
      expect(() => retestExecutionIds(invalid)).toThrow();
    }
    const distinct = Array.from({ length: 101 }, () => randomUUID());
    expect(retestExecutionIds(distinct.slice(0,100))).toHaveLength(100);
    expect(() => retestExecutionIds(distinct)).toThrow();
  });
  it("binds a set selection consistently but changes the digest when a definition or result changes", () => {
    const a = { selected: retestExecutionIds([second, first]), definition: "approved-A", result: "Failed" };
    const b = { result: "Failed", definition: "approved-A", selected: retestExecutionIds([first, second]) };
    expect(retestDigest(a)).toBe(retestDigest(b));
    expect(retestDigest({ ...a, definition: "approved-B" })).not.toBe(retestDigest(a));
    expect(retestDigest({ ...a, result: "Passed" })).not.toBe(retestDigest(a));
  });
  it("preserves legacy manual intent and refuses a requested automation mode or unrecognized binding", () => {
    const input = { requestKey: randomUUID(), executionIds: [first], expectedPreviewDigest: "a".repeat(64), name: "Manual verification" };
    const legacy = retestCreateInput(input);
    expect(retestCreateInput({ ...input, executionMode: "manual" })).toEqual(legacy);
    expect(retestDigest(retestCreateInput({ ...input, executionMode: "manual" }))).toBe(retestDigest(legacy));
    function captureRefusal(run: () => unknown): unknown {
      try { run(); } catch (error) { return error; }
      throw new Error("Expected retest command to be refused");
    }
    for (const executionMode of ["automation", "automated", "playwright", null, false, {}]) {
      const error = captureRefusal(() => retestCreateInput({ ...input, executionMode }));
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getStatus()).toBe(409);
      expect((error as ConflictException).getResponse()).toEqual({
        code: "RETEST_AUTOMATION_UNAVAILABLE",
        error: expect.stringContaining("Automated retest execution is not available"),
      });
    }
    for (const extra of [{ automationBinding: {} }, { runnerTokenId: first }, { executionMode: "manual", automation: {} }]) {
      const error = captureRefusal(() => retestCreateInput({ ...input, ...extra }));
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getStatus()).toBe(400);
      expect((error as BadRequestException).getResponse()).toEqual({ error: expect.stringContaining("unsupported fields") });
    }
  });
  it("requires exact reviewed preview and explicit useful name while keeping unknown build truthful", () => {
    const input = { requestKey: randomUUID(), executionIds: [first], expectedPreviewDigest: "a".repeat(64), name: "Manual verification" };
    expect(retestCreateInput(input)).toMatchObject({ name: "Manual verification", buildVersion: null, environment: null });
    for (const change of [{ requestKey: "retry" }, { expectedPreviewDigest: undefined }, { name: "   " }, { name: "invalid\0name" }, { buildVersion: {} }, { environment: "x".repeat(129) }]) {
      expect(() => retestCreateInput({ ...input, ...change })).toThrow();
    }
    for (const invalid of [undefined, null, [], "all"]) expect(() => retestCreateInput(invalid)).toThrow();
  });
});
