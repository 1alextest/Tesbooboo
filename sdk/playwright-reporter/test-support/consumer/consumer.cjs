const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const sdk = require("@tesbox/playwright-reporter");

assert.equal(fs.realpathSync(require.resolve("@tesbox/playwright-reporter")),
  fs.realpathSync(path.join(__dirname, "node_modules/@tesbox/playwright-reporter/dist/index.js")));
assert.equal(typeof sdk.default, "function");
assert.equal(typeof new sdk.default({ enabled: false }).onBegin, "function");
assert.equal(typeof sdk.TesboClient, "function");
assert.equal(sdk.tesboTag("PACKAGE-TC-1"), '@tesbo.testId("PACKAGE-TC-1")');
