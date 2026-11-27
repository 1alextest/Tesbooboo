const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const receiptFile = "src/legacy/legacy.service.ts";
const receiptExpression = "receipt.testcase.approvalRevision !== row.current_approval_revision";
const receiptStatement = `if (${receiptExpression}) throw new Error("stale");\n`;

function fixture(t, receiptSource) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tesbo-mutation-config-"));
  const configPath = path.join(root, "stryker.qa-handoff.config.cjs");
  t.after(() => {
    delete require.cache[configPath];
    delete require.cache[path.join(root, "stryker.ci.config.json")];
    fs.rmSync(root, { recursive: true, force: true });
  });
  for (const name of ["stryker.qa-handoff.config.cjs", "stryker.ci.config.json"]) {
    fs.copyFileSync(path.join(__dirname, name), path.join(root, name));
  }
  // Load the production config with its real installed parser, against small
  // source fixtures. The tests do not implement a competing range selector.
  fs.symlinkSync(path.join(__dirname, "node_modules"), path.join(root, "node_modules"), "dir");
  const sources = {
    "src/legacy/testcase-proposal-review.ts": 'const actor = principal.kind === "human_session" ? issuerId : principal.actorId ?? null;\n',
    "src/common/human-review-principal.ts": 'if (principal?.kind !== "human_session") throw new Error("human");\n',
    [receiptFile]: receiptSource
  };
  for (const [name, source] of Object.entries(sources)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), source);
  }
  return () => require(configPath);
}

test("a comment cannot stand in for a removed receipt guard", t => {
  const load = fixture(t, `if (false) throw new Error("stale");\n// ${receiptExpression}\n`);
  assert.throws(load, /QA handoff mutation scope requires one/);
});

test("a string cannot stand in for a removed receipt guard", t => {
  const load = fixture(t, `const description = ${JSON.stringify(receiptExpression)};\n`);
  assert.throws(load, /QA handoff mutation scope requires one/);
});

test("two executable receipt comparisons require a scope review", t => {
  const load = fixture(t, receiptStatement + receiptStatement);
  assert.throws(load, /QA handoff mutation scope requires one/);
});

test("a moved executable comparison resolves its new range despite a comment decoy", t => {
  const load = fixture(t, `// ${receiptExpression}\n\nconst refused =\n  ${receiptExpression};\n`);
  assert.equal(load().mutate[2], "src/legacy/legacy.service.ts:4:2-4:69");
});
