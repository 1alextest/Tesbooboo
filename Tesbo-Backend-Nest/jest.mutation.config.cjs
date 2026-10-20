// Restrict the mutation dry run to the tests for the mutated security utility.
// The complete backend suite has independent pre-existing Notion test failures.
module.exports = {
  ...require("./jest.config.js"),
  testMatch: ["<rootDir>/src/common/external-url.util.spec.ts"]
};
