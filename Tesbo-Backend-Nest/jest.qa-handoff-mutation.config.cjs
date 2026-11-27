// Reuse the canonical native proposal and handoff assertions. These unit tests
// exercise real domain code with database doubles; they do not prove persistence.
module.exports = {
  ...require("./jest.config.js"),
  testMatch: [
    "<rootDir>/src/legacy/testcase-proposal-review.spec.ts",
    "<rootDir>/src/legacy/requirement-automation-handoff.spec.ts"
  ]
};
