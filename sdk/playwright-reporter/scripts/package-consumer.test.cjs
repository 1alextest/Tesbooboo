const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs/promises");
const path = require("node:path");
const { runNode } = require("../test-support/reporter.cjs");
const { consumerTempRoot } = require("../test-support/temp.cjs");

// Prove the smoke refuses incomplete builds. These are newly-created, minimal package fixtures;
// never rename/remove checkout artifacts to simulate a broken publish.
for (const missing of ["dist/index.js", "dist/index.d.ts", "dist/cli.js"]) {
  test(`packed consumer smoke fails, without a skip or rebuild, when ${missing} is missing`, async () => {
    const root = await fs.mkdtemp(path.join(consumerTempRoot(), "tesbo consumer missing-"));
    try {
      for (const dir of ["scripts", "test-support", "dist"]) await fs.mkdir(path.join(root, dir));
      await fs.writeFile(path.join(root, "package.json"), JSON.stringify({
        name: "@tesbox/playwright-reporter",
        main: "dist/index.js",
        types: "dist/index.d.ts",
        bin: { "playwright-reporter": "dist/cli.js", "tesbo-playwright": "dist/cli.js" }
      }));
      for (const artifact of ["dist/index.js", "dist/index.d.ts", "dist/cli.js"]) {
        if (artifact !== missing) await fs.writeFile(path.join(root, artifact), "// fixture\n");
      }
      for (const file of ["scripts/package-consumer.cjs", "test-support/reporter.cjs", "test-support/temp.cjs"]) {
        await fs.writeFile(path.join(root, file), await fs.readFile(path.resolve(__dirname, "..", file)));
      }
      const result = await runNode([path.join(root, "scripts", "package-consumer.cjs")], { cwd: root });
      assert.equal(result.code, 1, result.output);
      assert.match(result.output, /\[package-consumer\] FAILED:.*ENOENT/);
      assert.ok(result.output.includes(path.basename(missing)), result.output);
      assert.doesNotMatch(result.output, /external consumer created|npm pack contains/);
      await assert.rejects(fs.stat(path.join(root, missing)), { code: "ENOENT" });
    } finally {
      await fs.rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  });
}
