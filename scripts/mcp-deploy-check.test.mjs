import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, writeFileSync, chmodSync, rmSync, symlinkSync, unlinkSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import path from "node:path";
import { requireApprovedMcpEndpoint } from "./mcp-approved-origin.mjs";
import { REQUIRED_TOOLS, PROPOSAL_TOOLS, NATIVE_PILOT_READ_TOOLS,
  readOnlyPilotCatalogGaps, summarizeNativePilotCases, catalogFingerprint, catalogGaps,
  schemaGaps, summarize } from "./mcp-deploy-check.mjs";

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
    tool("archive_behavior_model", { modelId: text }),
    tool("run_behavior_model", { modelId: text, revisionId: text })
  ];
  if (preview) {
    const candidate = () => ({ type: "object", properties: structuredClone(caseFields) });
    tools.push({ name: "stage_testcase_changes", inputSchema: { type: "object", required: ["requestKey", "operations"], properties: {
      requestKey: text, operations: { type: "array", items: { oneOf: [
        { type: "object", required: ["opType", "draft"], properties: { opType: { const: "create" }, draft: candidate() } },
        { type: "object", required: ["opType", "testcaseId", "expectedRevision", "fields"], properties: { opType: { enum: ["update", "archive"] }, testcaseId: text, expectedRevision: text, fields: candidate() } },
      ] } }
    } } }, tool("list_testcase_proposals"), tool("get_testcase_proposal_task", { taskId: text }),
      tool("stage_requirement_change_bundle", { requestKey: text, operations: { type: "array" } }),
      tool("get_requirement_proposal_task", { taskId: text }), tool("list_requirement_proposals"));
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
  for (const name of ["create_testcase", "create_suite", "update_suite"]) {
    assert.ok(catalogGaps([...validTools(), tool(name, caseFields)]).errors.includes(`direct publication tool must not be advertised: ${name}`));
  }
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

test("missing instructions fail verification instead of reporting an unavailable fingerprint as OK", () => {
  const result = summarize({
    tools: validTools(),
    serverVersion: "0.1.0+abc123.0123456789abcdef",
    health: { gitSha: "abc123" }
  });
  assert.equal(result.ok, false);
  assert.equal(result.fingerprintCheck, "unavailable");
  assert.match(result.errors.join("\n"), /instructions.*fingerprint/);
});

test("a matching build and catalog pass without warnings", () => {
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
  assert.deepEqual(result.warnings, []);
  assert.equal(result.toolCount, REQUIRED_TOOLS.length);
});

test("a build mismatch is a failure, not a warning", () => {
  const tools = validTools();
  const instructions = "Tesbo server instructions";
  const result = summarize({
    tools,
    instructions,
    serverVersion: `0.1.0+abc123.${catalogFingerprint(tools, instructions)}`,
    health: { gitSha: "abc123" },
    expectedGitSha: "def456"
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /does not match expected def456/);
});

test("an unidentified build is reported but does not fail the capability check", () => {
  const tools = validTools();
  const instructions = "Tesbo server instructions";
  const result = summarize({
    tools,
    instructions,
    serverVersion: `0.1.0+local.${catalogFingerprint(tools, instructions)}`,
    health: { gitSha: "local" },
    expectedGitSha: ""
  });
  assert.equal(result.ok, true);
  assert.equal(result.warnings.length, 2);
});

test("tool count is informational; capability gaps fail", () => {
  const tools = validTools();
  const instructions = "Tesbo server instructions";
  const result = summarize({
    tools,
    instructions,
    serverVersion: `0.1.0+abc123.${catalogFingerprint(tools, instructions)}`,
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

test("missing and malformed reported catalog fingerprints fail verification", () => {
  for (const serverVersion of ["0.1.0+abc123", "0.1.0+abc123.not-a-fingerprint", "0.1.0+abc123.0123456789abcde"]) {
    const result = summarize({
      tools: validTools(), instructions: "Tesbo server instructions", serverVersion,
      health: { gitSha: "abc123" }, expectedGitSha: "abc123"
    });
    assert.equal(result.ok, false, serverVersion);
    assert.match(result.errors.join("\n"), /valid catalog fingerprint/);
  }
});

function privateMcpFixture() {
  const dir = mkdtempSync(path.join(tmpdir(), "tesbo-approved-origin-"));
  const token = path.join(dir, "tesbo.token");
  const origin = path.join(dir, "tesbo-approved-origin");
  writeFileSync(token, "synthetic-token-only", { mode: 0o600 });
  writeFileSync(origin, "https://trusted.example.test\n", { mode: 0o600 });
  return { token, origin, dir, dispose: () => rmSync(dir, { recursive: true, force: true }) };
}

test("MCP credential requires a separately approved exact HTTPS origin", () => {
  const x = privateMcpFixture();
  try {
    const url = requireApprovedMcpEndpoint("https://trusted.example.test/api/projects/example/mcp", x.token);
    assert.equal(url.origin, "https://trusted.example.test");
    assert.throws(() => requireApprovedMcpEndpoint("https://attacker.example.test/api/projects/example/mcp", x.token), /origin differs/);
    assert.throws(() => requireApprovedMcpEndpoint("https://trusted.example.test:4433/api/projects/example/mcp", x.token), /origin differs/);
    assert.throws(() => requireApprovedMcpEndpoint("http://trusted.example.test/api/projects/example/mcp", x.token), /must be HTTPS/);
    assert.throws(() => requireApprovedMcpEndpoint("https://user:password@trusted.example.test/api/projects/example/mcp", x.token), /embedded credentials/);
    assert.throws(() => requireApprovedMcpEndpoint("https://trusted.example.test/api/projects/example/mcp?redirect=1", x.token), /embedded credentials/);
    assert.throws(() => requireApprovedMcpEndpoint("https://trusted.example.test/other/api/mcp", x.token), /project-scoped/);
  } finally { x.dispose(); }
});

test("an explicitly approved self-hosted HTTPS origin may use a custom port", () => {
  const x = privateMcpFixture();
  try {
    writeFileSync(x.origin, "https://trusted.example.test:8443", { mode: 0o600 });
    const endpoint = requireApprovedMcpEndpoint("https://trusted.example.test:8443/api/projects/example/mcp", x.token);
    assert.equal(endpoint.origin, "https://trusted.example.test:8443");
    assert.throws(() => requireApprovedMcpEndpoint("https://trusted.example.test/api/projects/example/mcp", x.token), /origin differs/);
  } finally { x.dispose(); }
});

test("missing or malformed approved-origin file fails closed", () => {
  const x = privateMcpFixture();
  try {
    writeFileSync(x.origin, "https://trusted.example.test/path", { mode: 0o600 });
    assert.throws(() => requireApprovedMcpEndpoint("https://trusted.example.test/api/projects/example/mcp", x.token), /exact HTTPS origin/);
    writeFileSync(x.origin, "https://trusted.example.test", { mode: 0o600 });
    unlinkSync(x.origin);
    assert.throws(() => requireApprovedMcpEndpoint("https://trusted.example.test/api/projects/example/mcp", x.token), /unavailable/);
  } finally { x.dispose(); }
});

test("POSIX file permission and symlink attacks cannot redirect a credential", () => {
  if (process.platform === "win32") return; // Windows ACLs are an OS setup prerequisite.
  const x = privateMcpFixture();
  try {
    chmodSync(x.origin, 0o644);
    assert.throws(() => requireApprovedMcpEndpoint("https://trusted.example.test/api/projects/example/mcp", x.token), /must be private/);
    chmodSync(x.origin, 0o600);
    chmodSync(x.token, 0o644);
    assert.throws(() => requireApprovedMcpEndpoint("https://trusted.example.test/api/projects/example/mcp", x.token), /must be private/);
    chmodSync(x.token, 0o600);
    const link = path.join(x.dir, "token.link");
    symlinkSync(x.token, link);
    assert.throws(() => requireApprovedMcpEndpoint("https://trusted.example.test/api/projects/example/mcp", link), /regular file/);
  } finally { x.dispose(); }
});

test("post-deploy credential is never sent before verified same-origin health and exact build", () => {
  const x = privateMcpFixture();
  try {
    const hook = path.join(x.dir, "mock-fetch.mjs");
    const events = path.join(x.dir, "events.txt");
    // Isolated child process intercepts fetch: not one real network connection.
    writeFileSync(hook, `
import { appendFileSync } from "node:fs";
globalThis.fetch = async (url, init = {}) => {
  const path = new URL(url).pathname;
  appendFileSync(process.env.TESBO_MCP_TEST_EVENTS, path + ":" + (init.headers?.Authorization ? "AUTH" : "NONE") + "\\n");
  const health = path === "/api/health";
  return new Response(JSON.stringify(health ? { gitSha: process.env.TESBO_MCP_TEST_HEALTH } :
    { jsonrpc: "2.0", result: { tools: [] } }), { status: health ? 200 : 201,
    headers: { "content-type": "application/json" } });
};
`, { mode: 0o600 });
    const checker = fileURLToPath(new URL("./mcp-deploy-check.mjs", import.meta.url));
    function invoke(sha) {
      writeFileSync(events, "");
      return spawnSync(process.execPath, ["--import", pathToFileURL(hook).href, checker], {
        env: { ...process.env,
          TESBO_MCP_URL: "https://trusted.example.test/api/projects/example/mcp",
          TESBO_MCP_TOKEN_FILE: x.token,
          TESBO_MCP_TOKEN: "synthetic-token-only",
          EXPECTED_GIT_SHA: "a".repeat(40),
          TESBO_MCP_TEST_HEALTH: sha,
          TESBO_MCP_TEST_EVENTS: events },
        encoding: "utf8", timeout: 12000
      });
    }
    const denied = invoke("b".repeat(40));
    assert.equal(denied.status, 1, denied.stderr);
    assert.match(denied.stderr, /token not sent/);
    assert.equal(readFileSync(events, "utf8"), "/api/health:NONE\n");

    const allowed = invoke("a".repeat(40));
    // No required tools are present in this deliberately tiny mock catalog;
    // an authenticated request may occur ONLY after build identity matched.
    assert.equal(allowed.status, 1, allowed.stdout + allowed.stderr);
    assert.match(readFileSync(events, "utf8"), /^\/api\/health:NONE\n\/api\/projects\/example\/mcp:AUTH\n/);
  } finally { x.dispose(); }
});

function invokeSyntheticMcp({ script = "mcp-deploy-check.mjs", mode = "complete", fileToken = "synthetic-file-token", environmentToken = "synthetic-other-token", endpoint = "https://trusted.example.test/api/projects/example/mcp" } = {}) {
  const x = privateMcpFixture();
  try {
    writeFileSync(x.token, fileToken, { mode: 0o600 });
    const events = path.join(x.dir, "events.jsonl");
    const hook = path.join(x.dir, "mock-fetch.mjs");
    const tools = validTools();
    if (mode === "duplicate-name-echo") tools.push(tool(fileToken), tool(fileToken));
    if (mode.startsWith("pilot-") && mode !== "pilot-missing-tool") tools.push(tool("list_testcases"), tool("list_suites"));
    const instructions = "Synthetic MCP instructions";
    const build = mode === "version-echo" ? fileToken : "a".repeat(40);
    const version = `0.1.0+${build}.${catalogFingerprint(tools, instructions)}`;
    writeFileSync(events, "");
    // Preload installs fetch before the entrypoint runs. No imported entrypoint and
    // no real URL is contacted; every credential and response here is synthetic.
    writeFileSync(hook, `
import { appendFileSync } from "node:fs";
const tools = ${JSON.stringify(tools)};
globalThis.fetch = async (url, init = {}) => {
  const pathname = new URL(url).pathname;
  const authorization = init.headers?.Authorization ?? init.headers?.authorization ?? null;
  appendFileSync(process.env.TESBO_MCP_TEST_EVENTS, JSON.stringify({ pathname, authorization, redirect: init.redirect, method: pathname === "/api/health" ? null : JSON.parse(init.body).method, tool: pathname === "/api/health" ? null : JSON.parse(init.body).params?.name || null, environmentBearerPresent: Boolean(process.env.TESBO_MCP_TOKEN) }) + "\\n");
  const mode = process.env.TESBO_MCP_TEST_MODE;
  if (mode === "native-header-validation") new Request(url, init);
  if (mode === "transport-error") throw new Error("Synthetic transport rejected " + authorization);
  if (pathname === "/api/health") {
    return new Response(JSON.stringify({ gitSha: "a".repeat(40) }), {
      status: mode === "health-redirect" ? 302 : 200,
      headers: { location: "https://unapproved.example.test/api/health" }
    });
  }
  if (mode === "rpc-redirect") return new Response("", { status: 302, headers: { location: "https://unapproved.example.test/mcp" } });
  if (mode.startsWith("consent-")) {
    const token = authorization?.slice(7);
    const code = mode === "consent-string" ? token : mode === "consent-object" ? { echo: token } : mode === "consent-array" ? [token] : -32001;
    return new Response(JSON.stringify({ jsonrpc: "2.0", error: { code, message: token } }), { status: 201 });
  }
  const request = JSON.parse(init.body);
  if (request.method === "tools/call") {
    if (mode === "pilot-refused") return new Response(JSON.stringify({jsonrpc:"2.0",error:{
      code:-32001,message:authorization+" rejected"}}),{status:201});
    const payload=request.params.name==="list_testcases"
      ? (mode==="pilot-malformed" ? {unexpected:true} : [
          {id:"private-case-1",title:"Highly confidential title",status:"Draft"},
          {id:"private-case-2",title:"Unreleased feature",status:"Approved"}])
      : {suites:[{id:"private-suite",name:"Top secret suite"}]};
    return new Response(JSON.stringify({jsonrpc:"2.0",result:{
      isError:false,content:[{type:"text",text:JSON.stringify(payload)}]}}),{status:201});
  }
  const result = request.method === "initialize"
    ? { serverInfo: { version: ${JSON.stringify(version)} }, ...(mode === "missing-instructions" ? {} : { instructions: ${JSON.stringify(instructions)} }) }
    : { tools };
  return new Response(JSON.stringify({ jsonrpc: "2.0", result }), { status: 201 });
};
`, { mode: 0o600 });
    const target = fileURLToPath(new URL(`./${script}`, import.meta.url));
    const shell = script.endsWith(".sh");
    const child = spawnSync(shell ? "bash" : process.execPath, shell ? [target] : ["--import", pathToFileURL(hook).href, target], {
      env: { ...process.env, NODE_OPTIONS: shell ? `--import=${pathToFileURL(hook).href}` : "", TESBO_MCP_URL: endpoint,
        TESBO_MCP_TOKEN_FILE: x.token, TESBO_MCP_TOKEN: environmentToken,
        EXPECTED_GIT_SHA: "a".repeat(40), EXPECTED_TOOL_COUNT: "", REQUIRE_PROPOSAL_PREVIEW: "",
        TESBO_PILOT_READ_ONLY: mode.startsWith("pilot-") ? "1" : "", TESBO_API_HEALTH_URL: "", TESBO_MCP_TEST_EVENTS: events, TESBO_MCP_TEST_MODE: mode },
      encoding: "utf8", timeout: 12000
    });
    assert.equal(child.error, undefined, child.error?.message);
    return { ...child, requests: readFileSync(events, "utf8").trim().split("\n").filter(Boolean).map(row => JSON.parse(row)) };
  } finally { x.dispose(); }
}

test("the validated credential file is the only bearer source, even when a different environment token is present", () => {
  const result = invokeSyntheticMcp();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const authenticated = result.requests.filter(row => row.authorization);
  assert.equal(authenticated.length, 2);
  assert.ok(authenticated.every(row => row.authorization === "Bearer synthetic-file-token"));
  assert.ok(!result.stdout.includes("synthetic-file-token"));
});

test("the checker works with the approved credential file and no environment bearer", () => {
  const result = invokeSyntheticMcp({ environmentToken: "" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.requests[0].authorization, null);
  assert.equal(result.requests.filter(row => row.authorization).length, 2);
});

test("checker result and failure diagnostics redact a bearer echoed in server-controlled fields", () => {
  for (const mode of ["version-echo", "duplicate-name-echo"]) {
    const result = invokeSyntheticMcp({ mode });
    assert.equal(result.status, mode === "version-echo" ? 0 : 1, result.stdout + result.stderr);
    assert.ok(!result.stdout.includes("synthetic-file-token"), "stdout must not echo the bearer");
    assert.ok(!result.stderr.includes("synthetic-file-token"), "stderr must not echo the bearer");
    assert.match(result.stdout, /\[redacted\]/);
  }
});

test("the shell wrapper supplies the approved file path without exporting a bearer", () => {
  const result = invokeSyntheticMcp({ script: "verify-production-mcp.sh" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.requests.length, 3);
  assert.equal(result.requests[0].authorization, null);
  assert.ok(result.requests.every(row => !row.environmentBearerPresent));
  assert.ok(result.requests.filter(row => row.authorization).every(row => row.authorization === "Bearer synthetic-file-token"));
  assert.ok(!result.stdout.includes("synthetic-file-token"));
  assert.ok(!result.stdout.includes("synthetic-other-token"));
});

test("an approved endpoint with an incomplete catalog fingerprint fails the real checker process", () => {
  const result = invokeSyntheticMcp({ mode: "missing-instructions" });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /instructions.*fingerprint/);
  assert.match(result.stdout, /FAILED/);
});

test("consent diagnostics never reflect a string, object or array supplied as an error code", () => {
  for (const mode of ["consent-string", "consent-object", "consent-array"]) {
    const result = invokeSyntheticMcp({ script: "mcp-consent-probe.mjs", mode });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.ok(!result.stdout.includes("synthetic-file-token"));
    assert.ok(!result.stderr.includes("synthetic-file-token"));
    const diagnostic = JSON.parse(result.stdout);
    assert.equal(diagnostic.code, null);
    assert.equal(diagnostic.message, "malformed protocol error (details withheld)");
  }
});

test("the expected numeric consent denial remains usable without reflecting the server message", () => {
  const result = invokeSyntheticMcp({ script: "mcp-consent-probe.mjs", mode: "consent-denied" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { status: 201, code: -32001, message: "external MCP consent is not approved" });
  assert.ok(!result.stdout.includes("synthetic-file-token"));
});

test("malformed file credentials fail before authenticated fetch can echo an invalid header", () => {
  for (const script of ["mcp-consent-probe.mjs", "mcp-deploy-check.mjs"]) {
    const result = invokeSyntheticMcp({ script, mode: "native-header-validation", fileToken: "synthetic-first-line\nsynthetic-second-line" });
    assert.ok(!result.stdout.includes("synthetic-first-line"));
    assert.ok(!result.stderr.includes("synthetic-first-line"));
    assert.equal(result.status, script === "mcp-consent-probe.mjs" ? 2 : 1);
    assert.equal(result.requests.filter(row => row.authorization).length, 0);
    assert.match(result.stderr, /invalid bearer value/);
  }
});

test("consent transport exceptions cannot print a reflected credential", () => {
  const result = invokeSyntheticMcp({ script: "mcp-consent-probe.mjs", mode: "transport-error" });
  assert.equal(result.status, 1);
  assert.ok(!result.stdout.includes("synthetic-file-token"));
  assert.ok(!result.stderr.includes("synthetic-file-token"));
  assert.match(result.stderr, /request failed \(details withheld\)/);
});

test("an unapproved HTTPS origin refuses before any network request", () => {
  for (const script of ["mcp-deploy-check.mjs", "mcp-consent-probe.mjs"]) {
    const result = invokeSyntheticMcp({ script, endpoint: "https://unapproved.example.test/api/projects/example/mcp" });
    assert.equal(result.status, 2, result.stdout + result.stderr);
    assert.deepEqual(result.requests, []);
    assert.match(result.stderr, /origin differs/);
  }
});

test("health and authenticated MCP redirects are refused without following another origin", () => {
  const health = invokeSyntheticMcp({ mode: "health-redirect" });
  assert.equal(health.status, 1, health.stdout + health.stderr);
  assert.equal(health.requests.length, 1);
  assert.equal(health.requests[0].authorization, null);
  assert.equal(health.requests[0].redirect, "manual");
  const rpc = invokeSyntheticMcp({ mode: "rpc-redirect" });
  assert.equal(rpc.status, 1, rpc.stdout + rpc.stderr);
  assert.equal(rpc.requests.length, 2);
  assert.ok(rpc.requests.every(row => row.redirect === "manual"));
});


test("TESBOPROJECT pilot requires both pre-existing authorized read tools, not write methods", () => {
  const allowed = [...validTools(), tool("list_testcases"), tool("list_suites")];
  assert.deepEqual(NATIVE_PILOT_READ_TOOLS, ["list_testcases", "list_suites"]);
  assert.deepEqual(readOnlyPilotCatalogGaps(allowed), []);
  assert.deepEqual(readOnlyPilotCatalogGaps(validTools()), [
    "native pilot read permission unavailable: list_testcases",
    "native pilot read permission unavailable: list_suites"
  ]);
  assert.deepEqual(readOnlyPilotCatalogGaps(null), ["native pilot tool catalog is unavailable"]);
});

test("bounded native inventory reports only counts, never case identities or sensitive fields", () => {
  const cases = [
    { id: "private-case-A", title: "Sensitive medical case", status: "Draft", sourceRefs: ["private"] },
    { id: "private-case-B", title: "Hidden client name", status: "Approved", token: "synthetic-secret" },
    { id: "private-case-C", title: "Unknown confidential title", status: "not-known" }
  ];
  const suites = { suites: [{ id: "private-suite", name: "Secret owner suite" }] };
  const result = summarizeNativePilotCases(cases, suites);
  assert.deepEqual(result, { sampledCases: 3, sampleLimit: 25, suites: 1,
    statusCounts: { Draft: 1, "In Review": 0, Approved: 1, Deprecated: 0, Archived: 0, Other: 1 },
    fullCaseTotalVerified: false, recordMutation: false });
  for(const privateValue of ["private-case-A", "private-suite", "Sensitive", "Hidden", "synthetic-secret"]) {
    assert.ok(!JSON.stringify(result).includes(privateValue));
  }
});

test("pilot refuses malformed, duplicate and unbounded native records", () => {
  const one = {id:"same",status:"Draft"};
  const suites = {suites:[{id:"s1"}]};
  for(const c of [[one,one],[{}],new Array(26).fill(0).map((_,i)=>({id:String(i)}))]){
    assert.throws(()=>summarizeNativePilotCases(c,suites),/incomplete|bounded/);
  }
  assert.throws(()=>summarizeNativePilotCases([one],{suites:[{name:"missing id"}]}),/incomplete|bounded/);
  assert.throws(()=>summarizeNativePilotCases({unexpected:[]},suites),/incomplete|bounded/);
  assert.throws(()=>summarizeNativePilotCases([one],{suites:new Array(2001).fill(0).map((_,i)=>({id:String(i)}))}),/incomplete|bounded/);
});

test("native pilot invokes only two read tools and never discloses case identities",()=>{
  const run=invokeSyntheticMcp({mode:"pilot-readonly"});
  assert.equal(run.status,0,run.stdout+run.stderr);
  assert.deepEqual(run.requests.filter(x=>x.method==="tools/call").map(x=>x.tool),["list_testcases","list_suites"]);
  assert.match(run.stdout,/"sampledCases":2/);
  assert.match(run.stdout,/"suites":1/);
  assert.match(run.stdout,/"recordMutation":false/);
  for(const secret of ["private-case-1","private-suite","confidential","Unreleased","synthetic-file-token"]){
    assert.ok(!run.stdout.includes(secret));assert.ok(!run.stderr.includes(secret));
  }
  assert.equal(run.requests[0].authorization,null);
  assert.equal(run.requests.filter(x=>x.authorization).length,4);
  assert.ok(run.requests.every(x=>x.redirect==="manual"));
});
test("native pilot missing read grants refuses without an attempted record query",()=>{
  const run=invokeSyntheticMcp({mode:"pilot-missing-tool"});
  assert.equal(run.status,1,run.stdout+run.stderr);
  assert.match(run.stderr,/native pilot read permission unavailable/);
  assert.equal(run.requests.filter(x=>x.method==="tools/call").length,0);
});
test("native pilot failure never reflects server token or private result",()=>{
  for(const mode of ["pilot-refused","pilot-malformed"]){
    const run=invokeSyntheticMcp({mode});
    assert.equal(run.status,1,run.stdout+run.stderr);
    assert.equal(run.requests.filter(x=>x.method==="tools/call").length,mode==="pilot-refused"?1:2);
    for(const secret of ["synthetic-file-token","Highly confidential title","private-case-1"]){
      assert.ok(!run.stdout.includes(secret));assert.ok(!run.stderr.includes(secret));
    }
  }
});
