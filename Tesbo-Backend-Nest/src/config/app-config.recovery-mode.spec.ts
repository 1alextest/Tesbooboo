import { resolveGraphQaRecoveryMode } from "./app-config.service";

describe("graph QA recovery mode configuration", () => {
  it("defaults to off", () => {
    expect(resolveGraphQaRecoveryMode(undefined, undefined)).toBe("off");
    expect(resolveGraphQaRecoveryMode("", "")).toBe("off");
  });

  it("preserves the legacy enabled flag as global only when MODE is unset", () => {
    expect(resolveGraphQaRecoveryMode(undefined, "1")).toBe("global");
    expect(resolveGraphQaRecoveryMode("", "1")).toBe("global");
    expect(resolveGraphQaRecoveryMode("project", "1")).toBe("project");
    expect(resolveGraphQaRecoveryMode("off", "1")).toBe("off");
  });

  it("accepts explicit modes case-insensitively and fails an unknown value closed", () => {
    expect(resolveGraphQaRecoveryMode(" PROJECT ", undefined)).toBe("project");
    expect(resolveGraphQaRecoveryMode("GLOBAL", undefined)).toBe("global");
    expect(resolveGraphQaRecoveryMode("everything", "1")).toBe("off");
  });
});
