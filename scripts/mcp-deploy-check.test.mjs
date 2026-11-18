import assert from "node:assert/strict";
import test from "node:test";
import { REQUIRED_TOOLS, catalogFingerprint, catalogGaps, schemaGaps, summarize } from "./mcp-deploy-check.mjs";

const text = { type: "string" };
const citations = { type: "array" };
const caseFields = { title: text, attachments: text, postconditions: text, estimatedDuration: text, sourceRefs: citations };
const authoredFields = { ...caseFields, expectedRevision: text };

function tool(name, properties = {}, nested = false) {
  // Clone per tool: tests mutate the returned schema to simulate a regression, and a shared
  // properties object would leak that mutation into every later test.
  const own = JSON.parse(JSON.stringify(properties));
  return {
    name,
    inputSchema: nested
      ? { type: "object", properties: { testcases: { type: "array", items: { type: "object", properties: own } } } }
      : { type: "object", properties: own }
  };
}

function validTools() {
  return [
    tool("list_projects"),
    tool("get_testcase", caseFields),
    tool("create_testcase", caseFields),
    tool("update_testcase", authoredFields),
    tool("bulk_create_testcases", caseFields, true),
    tool("list_qa_graph_changes"),
    tool("capture_qa_graph_change"),
    tool("preview_behavior_model_draft"),
    tool("create_behavior_model", { name: text, model: { type: "object" } }),
    tool("save_behavior_model_revision", { modelId: text, baseRevisionId: text, model: { type: "object" } }),
    tool("link_behavior_model_case", { modelId: text, revisionId: text, testcaseId: text, elementIds: { type: "array" } }),
    tool("get_behavior_model_coverage", { modelId: text }),
    tool("archive_behavior_model", { modelId: text })
  ];
}

test("a complete catalog and the required field schemas have no gaps", () => {
  const tools = validTools();
  assert.deepEqual(catalogGaps(tools).errors, []);
  assert.deepEqual(schemaGaps(tools).errors, []);
  assert.equal(catalogGaps(tools).count, REQUIRED_TOOLS.length);
});

test("catalog gaps identify missing tools, duplicates and unnamed entries", () => {
  const missing = validTools().filter((entry) => entry.name !== "capture_qa_graph_change");
  assert.match(catalogGaps(missing).errors.join("\n"), /missing tool: capture_qa_graph_change/);

  const duplicated = [...validTools(), tool("list_projects")];
  assert.match(catalogGaps(duplicated).errors.join("\n"), /duplicate tool: list_projects/);

  const unnamed = [...validTools(), { inputSchema: {} }];
  assert.match(catalogGaps(unnamed).errors.join("\n"), /without a name/);
});

test("schema gaps catch missing citations, estimates and revision guards", () => {
  const tools = validTools().map((entry) => {
    if (entry.name === "create_testcase") delete entry.inputSchema.properties.sourceRefs;
    if (entry.name === "update_testcase") delete entry.inputSchema.properties.expectedRevision;
    if (entry.name === "bulk_create_testcases") delete entry.inputSchema.properties.testcases.items.properties.estimatedDuration;
    return entry;
  });
  const errors = schemaGaps(tools).errors.join("\n");
  assert.match(errors, /create_testcase: missing field sourceRefs/);
  assert.match(errors, /update_testcase: missing field expectedRevision/);
  assert.match(errors, /bulk_create_testcases: missing field estimatedDuration/);
});

test("schema gaps catch missing Notes/Postconditions on single and bulk creates", () => {
  const tools = validTools().map((entry) => {
    if (entry.name !== "create_testcase" && entry.name !== "bulk_create_testcases") return entry;
    const properties = entry.name === "bulk_create_testcases"
      ? entry.inputSchema.properties.testcases.items.properties
      : entry.inputSchema.properties;
    if (entry.name === "create_testcase") delete properties.postconditions;
    else delete properties.attachments;
    return entry;
  });
  const errors = schemaGaps(tools).errors.join("\n");
  assert.match(errors, /create_testcase: missing field postconditions/);
  assert.match(errors, /bulk_create_testcases: missing field attachments/);
});

test("a catalog matching the server's reported fingerprint passes", () => {
  const tools = validTools();
  const instructions = "Tesbo server instructions";
  const result = summarize({
    tools,
    instructions,
    serverVersion: `0.1.0+abc123.${catalogFingerprint(tools, instructions)}`,
    health: { gitSha: "abc123" },
    expectedGitSha: "abc123"
  });
  assert.equal(result.ok, true);
  assert.equal(result.fingerprintCheck, "matches");
});

test("a catalog that does not match the reported fingerprint fails", () => {
  const tools = validTools();
  const instructions = "Tesbo server instructions";
  const serverVersion = `0.1.0+abc123.${catalogFingerprint(tools, instructions)}`;
  const tampered = JSON.parse(JSON.stringify(tools));
  tampered[0].description = "changed after the server reported its version";
  const result = summarize({
    tools: tampered,
    instructions,
    serverVersion,
    health: { gitSha: "abc123" },
    expectedGitSha: "abc123"
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /catalog fingerprint .* does not match serverInfo.version/);
  assert.equal(result.fingerprintCheck, "mismatch");
});

test("fingerprint comparison is skipped when the server omits instructions", () => {
  const result = summarize({
    tools: validTools(),
    serverVersion: "0.1.0+abc123.0123456789abcdef",
    health: { gitSha: "abc123" }
  });
  assert.equal(result.ok, true);
  assert.equal(result.fingerprintCheck, "unavailable");
});

test("a matching build and catalog pass without warnings", () => {
  const result = summarize({
    tools: validTools(),
    serverVersion: "0.1.0+abc123.0123456789abcdef",
    health: { gitSha: "abc123" },
    expectedGitSha: "abc123"
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.toolCount, REQUIRED_TOOLS.length);
});

test("a build mismatch is a failure, not a warning", () => {
  const result = summarize({
    tools: validTools(),
    serverVersion: "0.1.0+abc123.0123456789abcdef",
    health: { gitSha: "abc123" },
    expectedGitSha: "def456"
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /does not match expected def456/);
});

test("an unidentified build is reported but does not fail the capability check", () => {
  const result = summarize({
    tools: validTools(),
    serverVersion: "0.1.0+local.0123456789abcdef",
    health: { gitSha: "local" },
    expectedGitSha: ""
  });
  assert.equal(result.ok, true);
  assert.equal(result.warnings.length, 2);
});

test("tool count is informational; capability gaps fail", () => {
  const result = summarize({
    tools: validTools(),
    serverVersion: "0.1.0+abc123.0123456789abcdef",
    health: { gitSha: "abc123" },
    expectedGitSha: "abc123",
    expectedToolCount: "58"
  });
  assert.equal(result.ok, true);
  assert.match(result.warnings.join("\n"), /differs from EXPECTED_TOOL_COUNT 58/);
});

test("a session without a reported version fails", () => {
  const result = summarize({ tools: validTools(), serverVersion: "", health: { gitSha: "abc123" } });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /did not report serverInfo.version/);
});
