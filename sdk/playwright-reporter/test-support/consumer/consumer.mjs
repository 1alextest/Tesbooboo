import assert from "node:assert/strict";
import sdk, { TesboClient, tesboTag } from "@tesbox/playwright-reporter";

// The published package is CommonJS: native ESM's default is its module.exports object.
assert.equal(typeof sdk.default, "function");
assert.equal(typeof new sdk.default({ enabled: false }).onBegin, "function");
assert.equal(TesboClient, sdk.TesboClient);
assert.equal(tesboTag("PACKAGE-TC-1"), '@tesbo.testId("PACKAGE-TC-1")');
