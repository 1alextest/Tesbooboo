import { resolveBuildGitSha } from "./build-provenance";

describe("resolveBuildGitSha", () => {
  it("prefers Railway's injected commit over a persisted GIT_SHA", () => {
    // RAILWAY_GIT_COMMIT_SHA describes the deployment actually running. A service-level GIT_SHA
    // survives across deploys and previously mislabelled a GitHub redeploy of older main.
    expect(resolveBuildGitSha({ GIT_SHA: "abc123", RAILWAY_GIT_COMMIT_SHA: "def456" })).toBe("def456");
  });

  it("uses the explicit GIT_SHA used by the Jenkins/docker-compose path", () => {
    expect(resolveBuildGitSha({ GIT_SHA: "abc123" })).toBe("abc123");
  });

  it("falls back to Railway's GitHub-triggered commit when GIT_SHA is absent", () => {
    expect(resolveBuildGitSha({ RAILWAY_GIT_COMMIT_SHA: "def456" })).toBe("def456");
  });

  it("trims surrounding whitespace and ignores blank values", () => {
    expect(resolveBuildGitSha({ GIT_SHA: "  abc123  " })).toBe("abc123");
    expect(resolveBuildGitSha({ GIT_SHA: "   ", RAILWAY_GIT_COMMIT_SHA: "def456" })).toBe("def456");
  });

  it("reports an unknown build as local rather than inventing a hash", () => {
    expect(resolveBuildGitSha({})).toBe("local");
    expect(resolveBuildGitSha({ GIT_SHA: "", RAILWAY_GIT_COMMIT_SHA: "" })).toBe("local");
  });
});
