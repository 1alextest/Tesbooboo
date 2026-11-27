const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const existing = require("./stryker.ci.config.json");

// Select actual binary expressions rather than fixed line numbers or text in
// comments/strings. A missing or duplicated guard requires an explicit scope review.
function mutationRange(relativePath, expression) {
  const source = fs.readFileSync(path.join(__dirname, relativePath), "utf8");
  const parsed = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const matches = [];
  const visit = node => {
    if (ts.isBinaryExpression(node) && node.getText(parsed) === expression) matches.push(node);
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  if (matches.length !== 1) {
    throw new Error(`QA handoff mutation scope requires one exact binary expression in ${relativePath}: ${expression}`);
  }
  const position = offset => {
    const { line, character } = parsed.getLineAndCharacterOfPosition(offset);
    return `${line + 1}:${character}`;
  };
  return `${relativePath}:${position(matches[0].getStart(parsed))}-${position(matches[0].getEnd())}`;
}

module.exports = {
  ...existing,
  // Jest already runs the selected tests. Retain every failing test identity so
  // an earlier sibling does not hide the intended scenario. Stryker still keeps
  // only the first failure message; inspect that limitation when citing evidence.
  disableBail: true,
  jest: { ...existing.jest, configFile: "jest.qa-handoff-mutation.config.cjs" },
  mutate: [
    mutationRange("src/legacy/testcase-proposal-review.ts", 'principal.kind === "human_session"'),
    mutationRange("src/common/human-review-principal.ts", 'principal?.kind !== "human_session"'),
    mutationRange("src/legacy/legacy.service.ts", "receipt.testcase.approvalRevision !== row.current_approval_revision")
  ],
  htmlReporter: { ...existing.htmlReporter, fileName: "reports/mutation/qa-handoff.html" },
  jsonReporter: { ...existing.jsonReporter, fileName: "reports/mutation/qa-handoff.json" }
};
