import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const frontend = fileURLToPath(new URL("../Tesbo-Frontend/", import.meta.url));
const requireFrontend = createRequire(new URL("../Tesbo-Frontend/package.json", import.meta.url));
const ts = requireFrontend("typescript");

// Compile the production modules and their local dependencies; only HTTP is supplied by the test.
function load(relative, fetcher = () => { throw new Error("Unexpected HTTP"); }) {
  const cache = new Map();
  function read(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} }; cache.set(filename, module);
    const source = readFileSync(filename, "utf8");
    const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    const localRequire = (name) => name.startsWith(".") ? read(resolve(dirname(filename), name + ".ts")) : requireFrontend(name);
    new Function("require", "module", "exports", "fetch", "process", js)(localRequire, module, module.exports, fetcher,
      { env: { NEXT_PUBLIC_API_URL: "https://model-recovery.invalid" } });
    return module.exports;
  }
  return read(resolve(frontend, relative));
}

const intentOwner = load("components/model-studio/model-run-intent.ts");
const intent = {
  version: 1, id: "first-intent", projectId: "project-a", modelId: "model-a", principalId: "human-a",
  modelName: "Checkout", revisionId: "revision-a", revisionNumber: 1, contentHash: "content-a",
  requestedAt: "2026-11-20T10:00:00.000Z", outcome: "OUTCOME_UNKNOWN",
  request: { caseIds: ["case-b", "case-a"], name: "Exact requested run", environment: "QA" },
};
const storage = () => {
  const rows = new Map();
  return { getItem: (key) => rows.get(key) ?? null, setItem: (key, value) => rows.set(key, value), removeItem: (key) => rows.delete(key) };
};

test("a persisted unknown intent reloads its exact request only for the same principal, project and model", () => {
  const local = storage(); intentOwner.writeModelRunIntent(local, intent);
  assert.deepEqual(intentOwner.readModelRunIntent(local, intent), intent);
  for (const scope of [{ ...intent, principalId: "human-b" }, { ...intent, projectId: "project-b" }, { ...intent, modelId: "model-b" }]) {
    assert.equal(intentOwner.readModelRunIntent(local, scope), null);
  }
});

test("an old acknowledgement cannot erase a newer distinct intent", () => {
  const local = storage(), next = { ...intent, id: "distinct-new-intent" };
  intentOwner.writeModelRunIntent(local, next);
  intentOwner.clearModelRunIntent(local, intent, intent.id);
  assert.deepEqual(intentOwner.readModelRunIntent(local, intent), next);
  intentOwner.clearModelRunIntent(local, intent, next.id);
  assert.equal(intentOwner.readModelRunIntent(local, intent), null);
});

test("unreadable, malformed and wrongly scoped recovery records are errors, never an absent request", () => {
  const local = storage(), key = intentOwner.modelRunIntentKey(intent);
  for (const raw of ["{", JSON.stringify({ ...intent, principalId: "another-human" }), JSON.stringify({ ...intent, request: {} })]) {
    local.setItem(key, raw); assert.throws(() => intentOwner.readModelRunIntent(local, intent));
  }
  assert.throws(() => intentOwner.readModelRunIntent({ getItem() { throw new Error("Storage refused"); } }, intent), /Storage refused/);
  assert.throws(() => intentOwner.writeModelRunIntent({ setItem() { throw new Error("Quota exceeded"); } }, intent), /Quota exceeded/);
});

const created = { projectId: "project-a", modelId: "model-a", modelRevisionId: "revision-a", cycleId: "native-a", run: { id: "native-a", name: "Created native run" } };
const dispatch = (api) => api.dispatchModelStudioRun("project-a", "model-a", "revision-a", intent.request);
for (const [label, response] of [
  ["network loss", () => { throw new TypeError("Failed to fetch"); }],
  ["timeout", () => { const error = new Error("Timed out"); error.name = "TimeoutError"; throw error; }],
  ["server failure", () => new Response('{"error":"Server unavailable"}', { status: 503 })],
  ["HTTP timeout", () => new Response("", { status: 408 })],
  ["truncated success", () => new Response("{", { status: 201 })],
  ["empty success", () => new Response(null, { status: 204 })],
  ["wrong model response", () => Response.json({ ...created, modelId: "foreign-model" })],
]) {
  test(`${label} preserves unknown Model Studio creation without replaying POST`, async () => {
    let calls = 0;
    const api = load("lib/api.ts", async (_url, options) => { assert.equal(options.method, "POST"); calls++; return response(); });
    await assert.rejects(dispatch(api), (error) => error instanceof api.MutationOutcomeUnknownError && /outcome unconfirmed/.test(error.message));
    assert.equal(calls, 1);
  });
}

test("confirmed validation/access/conflict refusals retain their status and permit a later deliberate command", async () => {
  for (const status of [400, 403, 409, 422]) {
    let calls = 0;
    const api = load("lib/api.ts", async () => ++calls === 1
      ? Response.json({ error: "Review the mapping before starting a new run." }, { status }) : Response.json(created, { status: 201 }));
    await assert.rejects(dispatch(api), (error) => error instanceof api.ApiError && error.status === status);
    assert.equal(calls, 1);
    assert.deepEqual(await dispatch(api), created); assert.equal(calls, 2);
  }
});

test("bounded GET retries remain unchanged by the typed mutation outcome", async () => {
  let calls = 0;
  const api = load("lib/api.ts", async () => {
    if (++calls === 1) throw new TypeError("Failed to fetch");
    return Response.json({ runs: [] });
  });
  assert.deepEqual(await api.api("/runs"), { runs: [] }); assert.equal(calls, 2);
});
