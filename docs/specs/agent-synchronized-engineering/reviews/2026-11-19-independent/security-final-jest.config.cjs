const source = process.env.SECURITY_REVIEW_SOURCE || "/workspace/scratch/fb086055b433/tesbo-review-native-final";
const deps = "/workspace/scratch/fb086055b433/Tesbooboo/Tesbo-Backend-Nest/node_modules";
module.exports = {
  rootDir: "/workspace/scratch/fb086055b433",
  roots: [source + "/Tesbo-Backend-Nest/src", "/workspace/scratch/fb086055b433/assurance-working"],
  testEnvironment: "node",
  testMatch: ["**/api-token-rest.guard.spec.ts", "**/suite-publication.spec.ts", "**/testcase-proposal-review.spec.ts", "**/mcp-publication.spec.ts", "**/mcp.service.spec.ts", "**/model-studio-runs.spec.ts", "**/security-final-contract-probes.spec.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  modulePaths: [deps],
  clearMocks: true,
  cacheDirectory: "/workspace/scratch/fb086055b433/assurance-working/security-final-jest-cache",
  transform: { "^.+\\.tsx?$": [deps + "/ts-jest", { tsconfig: source + "/Tesbo-Backend-Nest/tsconfig.json", diagnostics: false, isolatedModules: true }] }
};
