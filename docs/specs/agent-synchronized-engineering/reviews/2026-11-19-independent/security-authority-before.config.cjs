module.exports = {
  ...require("./security-final-jest.config.cjs"),
  testMatch: ["**/model-studio-runs.spec.ts"],
  moduleNameMapper: {
    "^\\./model-studio-repository$": "/workspace/scratch/fb086055b433/tesbo-review-3ebda243/Tesbo-Backend-Nest/src/behavior-graph/model-studio-repository.ts"
  }
};
