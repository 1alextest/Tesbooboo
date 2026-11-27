import {
  isKbTranscriptionRecoveryModeInvalid,
  resolveGraphQaRecoveryMode,
  resolveKbTranscriptionRecoveryMode
} from "./app-config.service";

describe("graph QA recovery mode configuration", () => {
  it("defaults to off", () => {
    expect(resolveGraphQaRecoveryMode(undefined, undefined)).toBe("off");
    expect(resolveGraphQaRecoveryMode("", "")).toBe("off");
  });

  it("preserves the legacy enabled flag as global only when MODE is unset", () => {
    expect(resolveGraphQaRecoveryMode(undefined, "1")).toBe("global");
    expect(resolveGraphQaRecoveryMode("", "1")).toBe("global");
    expect(resolveGraphQaRecoveryMode(undefined, " 1")).toBe("off");
    expect(resolveGraphQaRecoveryMode(undefined, "1\n")).toBe("off");
    expect(resolveGraphQaRecoveryMode("project", "1")).toBe("project");
    expect(resolveGraphQaRecoveryMode("off", "1")).toBe("off");
  });

  it("accepts explicit modes case-insensitively and fails an unknown value closed", () => {
    expect(resolveGraphQaRecoveryMode(" PROJECT ", undefined)).toBe("project");
    expect(resolveGraphQaRecoveryMode("GLOBAL", undefined)).toBe("global");
    expect(resolveGraphQaRecoveryMode("everything", "1")).toBe("off");
  });
});

describe("KB transcription recovery mode configuration", () => {
  it("keeps the existing automatic global sweep when unset", () => {
    expect(resolveKbTranscriptionRecoveryMode(undefined)).toBe("global");
    expect(resolveKbTranscriptionRecoveryMode("")).toBe("global");
  });

  it("accepts explicit off/project/global and fails an invalid explicit value closed", () => {
    expect(resolveKbTranscriptionRecoveryMode(" OFF ")).toBe("off");
    expect(resolveKbTranscriptionRecoveryMode("project")).toBe("project");
    expect(resolveKbTranscriptionRecoveryMode("GLOBAL")).toBe("global");
    expect(resolveKbTranscriptionRecoveryMode("everything")).toBe("off");
  });

  it("distinguishes a deliberate off from a misspelled explicit mode", () => {
    expect(isKbTranscriptionRecoveryModeInvalid(undefined)).toBe(false);
    expect(isKbTranscriptionRecoveryModeInvalid("   ")).toBe(false);
    expect(isKbTranscriptionRecoveryModeInvalid("OFF")).toBe(false);
    expect(isKbTranscriptionRecoveryModeInvalid("projet")).toBe(true);
  });
});
