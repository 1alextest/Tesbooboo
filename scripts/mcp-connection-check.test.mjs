import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const requireFrontend = createRequire(new URL("../Tesbo-Frontend/package.json", import.meta.url));
const ts = requireFrontend("typescript");
const source = readFileSync(new URL("../Tesbo-Frontend/lib/mcpConnectionCheck.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { checkMcpConnection, MCP_CHECK_TIMEOUT_MS } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
const endpoint = "https://api.example.invalid/api/projects/project-a/mcp", secret = "synthetic-credential-not-for-logs";
const tools = [{ name: "list_projects", inputSchema: { type: "object" } }, { name: "create_testcase", inputSchema: { type: "object" } }];
const envelope = (result, id = 1) => ({ jsonrpc: "2.0", id, result });
const read = (id = "project-a") => envelope({ isError: false, content: [{ type: "text", text: JSON.stringify({ projects: [{ id }] }) }] }, 2);
const response = (body, status = 201) => new Response(JSON.stringify(body), { status });
const run = (fetcher, signal = new AbortController().signal) => checkMcpConnection(endpoint, "project-a", secret, signal, fetcher);

test("discovery plus a real Read query use only the configured endpoint, explicit bearer, no cookies/redirects/cache/referrer or writes", async () => {
  const calls = [];
  assert.equal(await run(async (url, init) => {
    calls.push(JSON.parse(init.body));
    assert.equal(url, endpoint);
    assert.deepEqual(init.headers, { Authorization: `Bearer ${secret}`, "Content-Type": "application/json", Accept: "application/json" });
    assert.equal(init.credentials, "omit"); assert.equal(init.redirect, "error"); assert.equal(init.cache, "no-store"); assert.equal(init.referrerPolicy, "no-referrer");
    assert.equal(init.signal.aborted, false);
    assert.ok(!init.body.includes(secret));
    return response(calls.length === 1 ? envelope({ tools }) : read());
  }), 2);
  assert.deepEqual(calls, [{ jsonrpc: "2.0", id: 1, method: "tools/list" }, { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "list_projects", arguments: {} } }]);
});

for (const status of [401, 403, 404, 500]) {
  test(`HTTP ${status} fails closed without echoing a response body`, async () => {
    await assert.rejects(run(async () => response({ message: secret }, status)), (error) => !error.message.includes(secret) && /rejected|HTTP/.test(error.message));
  });
}
for (const [code, message] of [[-32001, /access to this project/], [-32002, /Read scope/], [-32603, /MCP returned an error/]]) {
  test(`HTTP 201 JSON-RPC error ${code} is not discovery success or raw remote text`, async () => {
    await assert.rejects(run(async () => response({ jsonrpc: "2.0", id: 1, error: { code, message: secret }, result: { tools } })), (error) => message.test(error.message) && !error.message.includes(secret));
  });
}
for (const [label, body] of [
  ["missing JSON-RPC version", { id: 1, result: { tools } }],
  ["wrong request ID", envelope({ tools }, 2)],
  ["empty tools", envelope({ tools: [] })],
  ["malformed tool", envelope({ tools: ["list_projects"] })],
  ["duplicate tool", envelope({ tools: [tools[0], tools[0]] })],
  ["missing project-read tool", envelope({ tools: [tools[1]] })],
]) {
  test(`${label} is not accepted as a valid catalog`, async () => {
    let calls = 0;
    await assert.rejects(run(async () => { calls++; return response(body); }), /unexpected MCP response/);
    assert.equal(calls, 1);
  });
}
for (const [label, body] of [
  ["wrong-project data", read("project-b")],
  ["a tool-level failure", envelope({ isError: true, content: [{ type: "text", text: secret }] }, 2)],
  ["malformed project JSON", envelope({ isError: false, content: [{ type: "text", text: secret }] }, 2)],
  ["Read refused despite valid discovery", { jsonrpc: "2.0", id: 2, error: { code: -32002, message: secret } }],
]) {
  test(`${label} cannot establish Read permission/project identity`, async () => {
    let calls = 0;
    await assert.rejects(run(async () => response(++calls === 1 ? envelope({ tools }) : body)), (error) => !error.message.includes(secret));
    assert.equal(calls, 2);
  });
}
test("HTML/invalid JSON and network/redirect errors cannot expose raw response or exception text", async () => {
  for (const fetcher of [async () => new Response(`<html>${secret}</html>`), async () => { throw new Error(secret); }]) {
    await assert.rejects(run(fetcher), (error) => /could not be verified/.test(error.message) && !error.message.includes(secret));
  }
});
test("the shared 10-second deadline aborts an unresponsive project read after successful discovery", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0, activeSignal;
  const pending = run(async (_url, init) => {
    if (++calls === 1) return response(envelope({ tools }));
    activeSignal = init.signal;
    return new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new Error(secret)), { once: true }));
  });
  // Flush the immediate catalog JSON promise chain without advancing the deadline.
  for (let turn = 0; turn < 20 && !activeSignal; turn++) await Promise.resolve();
  assert.ok(activeSignal, "the check must reach the project-read request");
  const rejected = assert.rejects(pending, /timed out after 10 seconds/);
  context.mock.timers.tick(MCP_CHECK_TIMEOUT_MS);
  await rejected; assert.equal(activeSignal.aborted, true); assert.equal(calls, 2);
});
test("caller cancellation aborts the current request (page/project disposal)", async () => {
  const controller = new AbortController(); let activeSignal;
  const pending = run(async (_url, init) => {
    activeSignal = init.signal;
    return new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new Error(secret)), { once: true }));
  }, controller.signal);
  controller.abort();
  await assert.rejects(pending, (error) => !error.message.includes(secret));
  assert.equal(activeSignal.aborted, true);
});
