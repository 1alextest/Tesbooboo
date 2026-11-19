import assert from "node:assert/strict";
import test from "node:test";
import { REQUIRED_TOOLS, PROPOSAL_TOOLS, catalogFingerprint, catalogGaps, schemaGaps, summarize } from "./mcp-deploy-check.mjs";

const text = { type: "string" };
const citations = { type: "array" };
const caseFields = { title: text, attachments: text, postconditions: text, estimatedDuration: text, sourceRefs: citations };

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

function validTools(preview = false) {
  const tools = [
    tool("list_projects"),
    tool("get_testcase", caseFields),
    tool("list_qa_graph_changes"),
    tool("capture_qa_graph_change"),
    tool("preview_behavior_model_draft"),
    tool("create_behavior_model", { name: text, model: { type: "object" } }),
    tool("save_behavior_model_revision", { modelId: text, baseRevisionId: text, model: { type: "object" } }),
    tool("link_behavior_model_case", { modelId: text, revisionId: text, testcaseId: text, elementIds: { type: "array" } }),
    tool("get_behavior_model_coverage", { modelId: text }),
    tool("archive_behavior_model", { modelId: text })
  ];
  if (preview) {
    const candidate = () => ({ type: "object", properties: structuredClone(caseFields) });
    tools.push({ name: "stage_testcase_changes", inputSchema: { type: "object", required: ["requestKey", "operations"], properties: {
      requestKey: text, operations: { type: "array", items: { oneOf: [
        { type: "object", required: ["opType", "draft"], properties: { opType: { const: "create" }, draft: candidate() } },
        { type: "object", required: ["opType", "testcaseId", "expectedRevision", "fields"], properties: { opType: { enum: ["update", "archive"] }, testcaseId: text, expectedRevision: text, fields: candidate() } },
      ] } }
    } } }, tool("list_testcase_proposals"), tool("get_testcase_proposal_task", { taskId: text }));
  }
  return tools;
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

test("proposal schemas catch missing citations, estimates and revision guards", () => {
  const tools = validTools(true);
  const branches = tools.find(entry => entry.name === "stage_testcase_changes").inputSchema.properties.operations.items.oneOf;
  delete branches[0].properties.draft.properties.sourceRefs;
  delete branches[1].properties.expectedRevision;
  delete branches[1].properties.fields.properties.estimatedDuration;
  const errors = schemaGaps(tools).errors.join("\n");
  assert.match(errors, /stage_testcase_changes: missing field sourceRefs/);
  assert.match(errors, /stage_testcase_changes: missing field expectedRevision/);
  assert.match(errors, /stage_testcase_changes: missing field estimatedDuration/);
});

test("proposal schemas catch missing Notes/Postconditions in create and update operations", () => {
  const tools = validTools(true);
  const branches = tools.find(entry => entry.name === "stage_testcase_changes").inputSchema.properties.operations.items.oneOf;
  delete branches[0].properties.draft.properties.postconditions;
  delete branches[1].properties.fields.properties.attachments;
  const errors = schemaGaps(tools).errors.join("\n");
  assert.match(errors, /stage_testcase_changes: missing field postconditions/);
  assert.match(errors, /stage_testcase_changes: missing field attachments/);
});

test("the default-off proposal capability is explicit and cannot be replaced by direct publishers", () => {
  assert.deepEqual(catalogGaps(validTools()).errors, []);
  assert.deepEqual(catalogGaps(validTools(), { requireProposalPreview: true }).errors, PROPOSAL_TOOLS.map(name => `missing tool: ${name}`));
  assert.deepEqual(catalogGaps(validTools(true), { requireProposalPreview: true }).errors, []);
  assert.deepEqual(schemaGaps(validTools(true)).errors, []);
  assert.match(catalogGaps([...validTools(), tool("create_testcase", caseFields)]).errors.join("\n"), /direct publication tool must not be advertised: create_testcase/);
});

test("proposal deduplication and target revisions are required, not merely documented properties", () => {
  const tools = validTools(true);
  const schema = tools.find(entry => entry.name === "stage_testcase_changes").inputSchema;
  schema.required = ["operations"];
  schema.properties.operations.items.oneOf[1].required = ["opType", "testcaseId", "fields"];
  const errors = schemaGaps(tools).errors.join("\n");
  assert.match(errors, /requestKey and operations must be required/);
  assert.match(errors, /update expectedRevision must be required/);
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
