import { LegacyService } from "./legacy.service";
import type { DatabaseService } from "../database/database.service";
import * as aiTrace from "../observability/ai-trace";

process.env.SECRETS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

/*
 * Usage parsing for the router/planner and update-authoring call paths.
 *
 * These were the last Zyra model calls that discarded provider cache accounting: OpenAI's
 * `prompt_tokens_details.cached_tokens` was dropped on the floor, and Anthropic's cache read/create
 * counts were folded into `input` but never kept as their own value. Both now land in
 * `__zyraUsage.cached`, which is what recordGeneration/recordStandaloneGeneration publish to Langfuse
 * as `cachedInputTokens`. This spec pins the wire-shape → usage mapping directly, with no network.
 */

type Usage = { input?: number; output?: number; total?: number; cached?: number };
type Reply = Record<string, unknown> & { __zyraUsage?: Usage };

type Internals = {
  zyraChatWithOpenAi: (key: Record<string, unknown>, model: string, context: string, message: string) => Promise<Reply>;
  zyraChatWithAnthropic: (key: Record<string, unknown>, model: string, context: string, message: string) => Promise<Reply>;
  zyraJsonCompletion: (provider: string, model: string, key: Record<string, unknown>, system: string, user: string) => Promise<Reply>;
  finalizeZyraToolDecisionWithAi: (params: Record<string, unknown>) => Promise<unknown>;
  planZyraChatScenarios: (params: Record<string, unknown>) => Promise<unknown>;
  buildZyraChatDecision: (projectId: string, userId: string, sessionId: string, message: string) => Promise<Reply>;
  summarizeForZyraMemory: (provider: string, model: string, key: Record<string, unknown>, prompt: string, scope: { projectId: string }) => Promise<string>;
  zyraAiAllocation: (projectId: string) => Promise<{ key: unknown }>;
  transcribeKnowledgeFile: (projectId: string, fileId: string, buffer: Buffer, ext: string, mimeType: string, fileName: string) => Promise<void>;
  authorZyraUpdates: (params: Record<string, unknown>) => Promise<{ operations: Array<Record<string, unknown>> }>;
};

function makeLegacy(): LegacyService {
  const db = { query: jest.fn(() => Promise.resolve({ rows: [] })) } as unknown as DatabaseService;
  const none = {} as never;
  return new LegacyService(db, none, none, none, none, none, none, none, none, none, none, none, none, none, none, none, none, none);
}

function mockResponse(payload: unknown): void {
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(payload) })) as unknown as typeof fetch;
}

const openAiKey = { provider: "openai", api_key: "test-key" };
const anthropicKey = { provider: "anthropic", api_key: "test-key" };

function completion(provider: string, usage: unknown, body: Record<string, unknown> = { reply: "ok", action: "answer", scenarios: ["valid scenario"] }) {
  const text = JSON.stringify(body);
  return provider === "anthropic"
    ? { content: [{ type: "text", text }], usage }
    : { choices: [{ message: { content: text } }], usage };
}

const wirePaths = [
  { name: "OpenAI router", provider: "openai", planner: false },
  { name: "Anthropic router", provider: "anthropic", planner: false },
  { name: "OpenAI planner", provider: "openai", planner: true },
  { name: "Anthropic planner", provider: "anthropic", planner: true }
] as const;

function callWire(svc: LegacyService, path: typeof wirePaths[number]): Promise<Reply> {
  const internal = svc as unknown as Internals;
  const key = path.provider === "anthropic" ? anthropicKey : openAiKey;
  const model = path.provider === "anthropic" ? "claude-sonnet-4-6" : "gpt-4o";
  if (path.planner) return internal.zyraJsonCompletion(path.provider, model, key, "system", "user");
  return path.provider === "anthropic"
    ? internal.zyraChatWithAnthropic(key, model, "context", "message")
    : internal.zyraChatWithOpenAi(key, model, "context", "message");
}

function prepareRouter(svc: LegacyService, key: Record<string, unknown> = openAiKey): void {
  const internal = svc as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>;
  const responses = {
    resolveJiraIssueKeysDetailed: { keys: [], extracted: [], configuredProjectKeys: [] },
    zyraAgentSettings: { capabilities: { generation: true, knowledgeBase: false, testcaseStorage: true, suiteOperations: true } },
    existingTestcaseSnapshot: [],
    zyraAiAllocation: { key, reason: "" },
    zyraChatProjectSnapshot: { suites: [], testcaseCount: 0, unassignedTestCaseCount: 0 },
    relevantJiraSnapshot: [],
    zyraPendingCreateBatches: [],
    zyraPriorTurnContextRefs: undefined,
    zyraResolveContextRefs: { jira: [], jiraIssueKeys: [], knowledge: [], bugs: [], knowledgeConfidence: "none" }
  };
  for (const [method, value] of Object.entries(responses)) jest.spyOn(internal, method).mockResolvedValue(value);
}

function prepareUpdateAuthoring(svc: LegacyService, provider: string) {
  const internal = svc as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>;
  jest.spyOn(internal, "findProjectTestcase").mockResolvedValue({ id: "synthetic-case" });
  jest.spyOn(internal, "getTestCase").mockResolvedValue({ id: "synthetic-case", externalId: "SYN-TC-1", title: "Synthetic case", steps: [] });
  jest.spyOn(internal, "zyraTaskKnowledge").mockResolvedValue({ knowledge: [] });
  return {
    projectId: "synthetic-project", provider,
    model: provider === "anthropic" ? "claude-haiku-4-5" : "gpt-4.1",
    key: provider === "anthropic" ? anthropicKey : openAiKey,
    message: "Update the synthetic title",
    raw: { operations: [{ type: "update", testcaseId: "synthetic-case", fields: { description: "Keep this field" } }] },
    trace: { span: null, traceId: null },
    sources: { knowledge: [], jira: [], existingTestcases: [], bugs: [] }
  };
}

const authoredUpdate = {
  updates: [{ externalId: "SYN-TC-1", fields: { title: "Synthetic updated title" }, sourceRefs: [] }],
  // A completion is content, not a trusted source of provider accounting or request identity.
  __zyraModel: "invented-model", __zyraUsage: { input: 999, output: 999, total: 1998 }
};

describe("Zyra provider usage parsing (cached input tokens)", () => {
  let svc: LegacyService;
  const realFetch = global.fetch;

  beforeEach(() => {
    svc = makeLegacy();
  });

  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  it("keeps OpenAI prompt_tokens_details.cached_tokens on the router call", async () => {
    mockResponse({
      choices: [{ message: { content: JSON.stringify({ reply: "ok", action: "answer" }) } }],
      usage: { prompt_tokens: 1000, completion_tokens: 50, total_tokens: 1050, prompt_tokens_details: { cached_tokens: 512 } }
    });

    const raw = await (svc as unknown as Internals).zyraChatWithOpenAi(openAiKey, "gpt-4o", "context", "message");

    expect(raw.__zyraUsage).toEqual({ input: 1000, output: 50, total: 1050, cached: 512 });
  });

  it("keeps Anthropic cache read/creation counts separate from the input total", async () => {
    mockResponse({
      content: [{ type: "text", text: JSON.stringify({ reply: "ok", action: "answer" }) }],
      usage: {
        input_tokens: 100,
        cache_read_input_tokens: 400,
        cache_creation_input_tokens: 100,
        output_tokens: 20
      }
    });

    const raw = await (svc as unknown as Internals).zyraChatWithAnthropic(anthropicKey, "claude-sonnet-4-6", "context", "message");

    expect(raw.__zyraUsage).toEqual({ input: 600, output: 20, total: 620, cached: 500 });
  });

  it("keeps OpenAI cached tokens on the planner JSON completion", async () => {
    mockResponse({
      choices: [{ message: { content: JSON.stringify({ scenarios: ["a"] }) } }],
      usage: { prompt_tokens: 200, completion_tokens: 10, total_tokens: 210, prompt_tokens_details: { cached_tokens: 128 } }
    });

    const parsed = await (svc as unknown as Internals).zyraJsonCompletion("openai", "gpt-4o", openAiKey, "system", "user");

    expect(parsed.__zyraUsage).toEqual({ input: 200, output: 10, total: 210, cached: 128 });
  });

  it("keeps Anthropic cached tokens on the planner JSON completion", async () => {
    mockResponse({
      content: [{ type: "text", text: JSON.stringify({ scenarios: ["a"] }) }],
      usage: { input_tokens: 40, cache_read_input_tokens: 60, output_tokens: 10 }
    });

    const parsed = await (svc as unknown as Internals).zyraJsonCompletion("anthropic", "claude-sonnet-4-6", anthropicKey, "system", "user");

    expect(parsed.__zyraUsage).toEqual({ input: 100, output: 10, total: 110, cached: 60 });
  });

  it("omits cached when the provider reports none, instead of publishing a zero", async () => {
    mockResponse({
      choices: [{ message: { content: JSON.stringify({ reply: "ok", action: "answer" }) } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
    });

    const raw = await (svc as unknown as Internals).zyraChatWithOpenAi(openAiKey, "gpt-4o", "context", "message");

    expect(raw.__zyraUsage).toEqual({ input: 10, output: 5, total: 15 });
    expect(raw.__zyraUsage).not.toHaveProperty("cached");
  });

  it.each(["finalizer", "planner", "memory"])("keeps simultaneous %s attempts in distinct traces", async (path) => {
    jest.spyOn(Date, "now").mockReturnValue(123456);
    const recorded = jest.spyOn(aiTrace, "recordStandaloneGeneration").mockResolvedValue(undefined);
    mockResponse({ choices: [{ message: { content: JSON.stringify({ reply: "ok", scenarios: ["valid scenario"] }) } }] });
    const internal = svc as unknown as Internals;
    const common = { projectId: "project-one", provider: "openai", model: "gpt-4o", key: openAiKey, message: "request" };
    const call = path === "finalizer"
      ? () => internal.finalizeZyraToolDecisionWithAi({ ...common, toolName: "test", toolDecision: { reply: "ok", testcases: [] } })
      : path === "planner"
        ? () => internal.planZyraChatScenarios({ ...common, knowledge: [], existingTestcases: [], maxScenarios: 1 })
        : () => internal.summarizeForZyraMemory("openai", "gpt-4o", openAiKey, "request", { projectId: "project-one" });
    await Promise.all([call(), call()]);
    expect(recorded).toHaveBeenCalledTimes(2);
    const seeds = recorded.mock.calls.map(([input]) => input.traceSeed);
    expect(new Set(seeds).size).toBe(2);
    expect(recorded.mock.calls.every(([input]) => input.metadata?.projectId === "project-one")).toBe(true);
  });

  it("does not report a transcription generation when no supported AI key was allocated", async () => {
    const recorded = jest.spyOn(aiTrace, "recordStandaloneGeneration").mockResolvedValue(undefined);
    const internal = svc as unknown as Internals;
    jest.spyOn(internal, "zyraAiAllocation").mockResolvedValue({ key: null });
    mockResponse({});
    await internal.transcribeKnowledgeFile("project-one", "file-one", Buffer.from("audio"), "mp3", "audio/mpeg", "sample.mp3");
    expect(global.fetch).not.toHaveBeenCalled();
    expect(recorded).not.toHaveBeenCalled();
  });

  describe.each(wirePaths)("$name usage boundaries", (path) => {
    it.each([
      ["absent", undefined], ["null", null], ["empty object", {}], ["array", []], ["string", "unknown"]
    ])("leaves %s usage unknown instead of inventing measured zero", async (_label, usage) => {
      mockResponse(completion(path.provider, usage));
      expect((await callWire(svc, path)).__zyraUsage).toBeUndefined();
    });

    it("rejects malformed token values without coercing them into measurements", async () => {
      const usage = path.provider === "anthropic"
        ? { input_tokens: -1, output_tokens: "5", cache_read_input_tokens: Number.NaN, cache_creation_input_tokens: Number.POSITIVE_INFINITY }
        : { prompt_tokens: -1, completion_tokens: "5", total_tokens: Number.POSITIVE_INFINITY, prompt_tokens_details: { cached_tokens: false } };
      mockResponse(completion(path.provider, usage));
      expect((await callWire(svc, path)).__zyraUsage).toBeUndefined();
    });

    it("preserves measured zero including an explicitly reported zero cache count", async () => {
      const usage = path.provider === "anthropic"
        ? { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
        : { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, prompt_tokens_details: { cached_tokens: 0 } };
      mockResponse(completion(path.provider, usage));
      expect((await callWire(svc, path)).__zyraUsage).toEqual({ input: 0, output: 0, total: 0, cached: 0 });
    });

    it("keeps a partial measurement without filling in the unreported output or total", async () => {
      mockResponse(completion(path.provider, path.provider === "anthropic" ? { input_tokens: 12 } : { prompt_tokens: 12 }));
      expect((await callWire(svc, path)).__zyraUsage).toEqual({ input: 12 });
    });

    it("does not accept a usage field invented inside the model completion", async () => {
      mockResponse(completion(path.provider, undefined, { reply: "ok", scenarios: ["valid"], __zyraUsage: { input: 999, output: 999 } }));
      expect((await callWire(svc, path)).__zyraUsage).toBeUndefined();
    });
  });

  it("does not turn malformed Anthropic cache accounting into a known total input", async () => {
    mockResponse(completion("anthropic", { input_tokens: 12, output_tokens: 3, cache_read_input_tokens: "4" }));
    expect((await callWire(svc, wirePaths[1])).__zyraUsage).toEqual({ output: 3 });
  });

  it.each(["finalizer", "planner"])("%s preserves missing and partial usage at the observation boundary", async (path) => {
    const recorded = jest.spyOn(aiTrace, "recordStandaloneGeneration").mockResolvedValue(undefined);
    const internal = svc as unknown as Internals;
    const params = { projectId: "project-one", provider: "openai", model: "gpt-4o", key: openAiKey, message: "request" };
    for (const usage of [undefined, { prompt_tokens: 12 }, { prompt_tokens: 0, completion_tokens: 0 }]) {
      mockResponse(completion("openai", usage));
      const result = path === "finalizer"
        ? await internal.finalizeZyraToolDecisionWithAi({ ...params, toolName: "test", toolDecision: { reply: "ok", testcases: [] } })
        : await internal.planZyraChatScenarios({ ...params, knowledge: [], existingTestcases: [], maxScenarios: 1 });
      expect(result).toBeDefined();
      expect(recorded.mock.calls.at(-1)?.[0].usage).toEqual(usage === undefined ? undefined : usage.completion_tokens === undefined ? { input: 12 } : { input: 0, output: 0 });
    }
  });

  it.each(["openai", "anthropic"])("%s memory summary preserves absent, invalid, partial and zero usage", async (provider) => {
    const recorded = jest.spyOn(aiTrace, "recordStandaloneGeneration").mockResolvedValue(undefined);
    const key = provider === "anthropic" ? anthropicKey : openAiKey;
    const partial = provider === "anthropic" ? { input_tokens: 12 } : { prompt_tokens: 12 };
    const zero = provider === "anthropic" ? { input_tokens: 0 } : { prompt_tokens: 0 };
    const invalid = provider === "anthropic" ? { input_tokens: "12", output_tokens: -1 } : { prompt_tokens: "12", completion_tokens: -1 };
    for (const [usage, expected] of [[undefined, undefined], [{}, undefined], [invalid, undefined], [partial, { input: 12 }], [zero, { input: 0 }]]) {
      mockResponse(completion(provider, usage));
      expect(await (svc as unknown as Internals).summarizeForZyraMemory(provider, "model", key, "prompt", { projectId: "project-one" })).not.toBe("");
      expect(recorded.mock.calls.at(-1)?.[0].usage).toEqual(expected);
    }
  });

  it("does not substitute an unlabelled router estimate for missing provider usage", async () => {
    prepareRouter(svc);
    const recorded = jest.spyOn(aiTrace, "recordGeneration").mockImplementation(() => undefined);
    mockResponse(completion("openai", undefined));
    const decision = await (svc as unknown as Internals).buildZyraChatDecision("project-one", "user-one", "session-one", "Explain the available coverage");
    expect(decision.reply).toBe("ok");
    const router = recorded.mock.calls.find(([, input]) => input.name === "router")?.[1];
    expect(router).toBeDefined();
    expect(router?.usage).toBeUndefined();
  });

  it("does not report a transcription generation when allocation rejects before fetch", async () => {
    const recorded = jest.spyOn(aiTrace, "recordStandaloneGeneration").mockResolvedValue(undefined);
    const internal = svc as unknown as Internals;
    jest.spyOn(internal, "zyraAiAllocation").mockRejectedValue(new Error("synthetic allocation failure"));
    mockResponse({});
    await internal.transcribeKnowledgeFile("project-one", "file-one", Buffer.from("audio"), "mp3", "audio/mpeg", "sample.mp3");
    expect(global.fetch).not.toHaveBeenCalled();
    expect(recorded).not.toHaveBeenCalled();
    expect((svc as unknown as { db: { query: jest.Mock } }).db.query).toHaveBeenCalledWith(expect.stringContaining("extraction_status = 'failed'"), ["file-one"]);
  });

  it.each(["success", "network failure"])("does record transcription after a real request attempt: %s", async (outcome) => {
    const recorded = jest.spyOn(aiTrace, "recordStandaloneGeneration").mockResolvedValue(undefined);
    const internal = svc as unknown as Internals;
    jest.spyOn(internal, "zyraAiAllocation").mockResolvedValue({ key: openAiKey });
    if (outcome === "success") mockResponse({ text: "" });
    else global.fetch = jest.fn().mockRejectedValue(new Error("synthetic network failure"));
    await internal.transcribeKnowledgeFile("project-one", "file-one", Buffer.from("audio"), "mp3", "audio/mpeg", "sample.mp3");
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(recorded).toHaveBeenCalledTimes(1);
    expect(recorded.mock.calls[0][0].name).toBe("knowledge.transcription");
    expect(recorded.mock.calls[0][0].errorMessage).toBe(outcome === "success" ? undefined : "synthetic network failure");
  });

  it.each(["wire", "finalizer", "router"])("%s uses the actual Anthropic fallback request model, never a completion-supplied identity", async (path) => {
    const standalone = jest.spyOn(aiTrace, "recordStandaloneGeneration").mockResolvedValue(undefined);
    const router = jest.spyOn(aiTrace, "recordGeneration").mockImplementation(() => undefined);
    const requestedModels: string[] = [];
    const key = { ...anthropicKey, default_model: "claude-haiku-4-5" };
    global.fetch = jest.fn(async (_url: unknown, init?: RequestInit) => {
      requestedModels.push(JSON.parse(String(init?.body)).model);
      return requestedModels.length === 1
        ? { ok: false, status: 404, json: async () => ({ error: { message: "model not found" } }) }
        : { ok: true, json: async () => completion("anthropic", { input_tokens: 10, output_tokens: 2 }, { reply: "ok", action: "answer", __zyraModel: "completion-forgery" }) };
    }) as unknown as typeof fetch;
    const internal = svc as unknown as Internals;
    let raw: Reply | undefined;
    if (path === "wire") raw = await internal.zyraChatWithAnthropic(key, key.default_model, "context", "message");
    else if (path === "finalizer") await internal.finalizeZyraToolDecisionWithAi({ projectId: "project-one", provider: "anthropic", model: key.default_model, key, message: "request", toolName: "test", toolDecision: { reply: "prior", testcases: [] } });
    else {
      prepareRouter(svc, key);
      await internal.buildZyraChatDecision("project-one", "user-one", "session-one", "Explain the available coverage");
    }
    expect(requestedModels).toHaveLength(2);
    expect(requestedModels[1]).not.toBe(requestedModels[0]);
    const observedModel = path === "wire" ? raw?.__zyraModel : path === "finalizer" ? standalone.mock.calls[0][0].model : router.mock.calls.find(([, input]) => input.name === "router")?.[1].model;
    expect(observedModel).toBe(requestedModels[1]);
  });

  it("planner traces use the actual normalized Anthropic request model", async () => {
    const recorded = jest.spyOn(aiTrace, "recordStandaloneGeneration").mockResolvedValue(undefined);
    mockResponse(completion("anthropic", { input_tokens: 10, output_tokens: 2 }));
    await (svc as unknown as Internals).planZyraChatScenarios({ projectId: "project-one", provider: "anthropic", model: "sonnet", key: anthropicKey, message: "request", knowledge: [], existingTestcases: [], maxScenarios: 1 });
    const sent = JSON.parse(String((global.fetch as jest.Mock).mock.calls[0][1].body)).model;
    expect(sent).not.toBe("sonnet");
    expect(recorded.mock.calls[0][0].model).toBe(sent);
  });

  it.each(["finalizer", "planner", "memory"])("%s failure traces retain the actual last request model", async (path) => {
    const recorded = jest.spyOn(aiTrace, "recordStandaloneGeneration").mockResolvedValue(undefined);
    const requestedModels: string[] = [];
    const model = path === "planner" ? "sonnet" : "claude-haiku-4-5";
    const failure = new Error("synthetic transport failure");
    global.fetch = jest.fn(async (_url: unknown, init?: RequestInit) => {
      requestedModels.push(JSON.parse(String(init?.body)).model);
      if (path !== "planner" && requestedModels.length === 1) {
        return { ok: false, status: 404, json: async () => ({ error: { message: "model not found" } }) };
      }
      throw failure;
    }) as unknown as typeof fetch;
    const internal = svc as unknown as Internals;
    const params = { projectId: "project-one", provider: "anthropic", model, key: anthropicKey, message: "request" };
    if (path === "memory") {
      await expect(internal.summarizeForZyraMemory("anthropic", model, anthropicKey, "prompt", { projectId: "project-one" })).resolves.toBe("");
    } else {
      const call = path === "finalizer"
        ? internal.finalizeZyraToolDecisionWithAi({ ...params, toolName: "test", toolDecision: { reply: "prior", testcases: [] } })
        : internal.planZyraChatScenarios({ ...params, knowledge: [], existingTestcases: [], maxScenarios: 1 });
      await expect(call).rejects.toBe(failure);
    }
    expect(requestedModels).toHaveLength(path === "planner" ? 1 : 2);
    expect(requestedModels.at(-1)).not.toBe(model);
    expect(recorded).toHaveBeenCalledTimes(1);
    expect(recorded.mock.calls[0][0]).toMatchObject({ model: requestedModels.at(-1), errorMessage: "synthetic transport failure" });
  });

  describe.each(["openai", "anthropic"])("%s update authoring consumer", (provider) => {
    it.each([
      "absent", "null", "empty", "wrong type", "input only", "output only", "malformed", "partial malformed", "measured zero", "cache only", "full"
    ])("preserves %s provider usage without changing the authored fields", async (kind) => {
      const anthropic = provider === "anthropic";
      const cases: Record<string, [unknown, Usage | undefined]> = {
        absent: [undefined, undefined],
        null: [null, undefined],
        empty: [{}, undefined],
        "wrong type": ["unknown", undefined],
        "input only": [anthropic ? { input_tokens: 12 } : { prompt_tokens: 12 }, { input: 12 }],
        "output only": [anthropic ? { output_tokens: 3 } : { completion_tokens: 3 }, { output: 3 }],
        malformed: [anthropic
          ? { input_tokens: "12", output_tokens: -1, cache_read_input_tokens: false }
          : { prompt_tokens: "12", completion_tokens: -1, total_tokens: Number.POSITIVE_INFINITY, prompt_tokens_details: { cached_tokens: false } }, undefined],
        "partial malformed": [anthropic ? { input_tokens: 12, output_tokens: "2" } : { prompt_tokens: 12, completion_tokens: "2" }, { input: 12 }],
        "measured zero": [anthropic
          ? { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
          : { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, prompt_tokens_details: { cached_tokens: 0 } }, { input: 0, output: 0, total: 0, cached: 0 }],
        "cache only": [anthropic ? { cache_read_input_tokens: 3 } : { prompt_tokens_details: { cached_tokens: 3 } }, { cached: 3 }],
        full: [anthropic
          ? { input_tokens: 7, output_tokens: 2, cache_read_input_tokens: 3 }
          : { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12, prompt_tokens_details: { cached_tokens: 3 } }, { input: 10, output: 2, total: 12, cached: 3 }]
      };
      const [usage, expected] = cases[kind];
      const params = prepareUpdateAuthoring(svc, provider);
      const recorded = jest.spyOn(aiTrace, "recordGeneration").mockImplementation(() => undefined);
      const ledger = jest.spyOn(svc as unknown as { recordZyraTokenUsage: (...args: unknown[]) => Promise<void> }, "recordZyraTokenUsage");
      mockResponse(completion(provider, usage, authoredUpdate));
      const result = await (svc as unknown as Internals).authorZyraUpdates(params);
      expect(result.operations).toEqual([{
        type: "update", testcaseId: "synthetic-case",
        fields: { description: "Keep this field", title: "Synthetic updated title" }, __sourceRefs: []
      }]);
      expect(recorded).toHaveBeenCalledTimes(1);
      expect(recorded.mock.calls[0][1]).toMatchObject({ name: "update_authoring", model: params.model });
      expect(recorded.mock.calls[0][1].usage).toEqual(expected);
      expect(ledger).toHaveBeenCalledWith("synthetic-project", "chat_generate", provider, params.model, expected || {});
      const writes = (svc as unknown as { db: { query: jest.Mock } }).db.query.mock.calls;
      if (!expected || kind === "cache only" || kind === "measured zero") {
        expect(writes.filter(([sql]) => String(sql).includes("INSERT INTO zyra_token_usage"))).toEqual([]);
      }
    });
  });

  it.each(["success", "transport failure", "HTTP failure", "authentication failure"])("update authoring retains the actual fallback model on %s", async (outcome) => {
    const params = prepareUpdateAuthoring(svc, "anthropic");
    const recorded = jest.spyOn(aiTrace, "recordGeneration").mockImplementation(() => undefined);
    const requestedModels: string[] = [];
    global.fetch = jest.fn(async (_url: unknown, init?: RequestInit) => {
      requestedModels.push(JSON.parse(String(init?.body)).model);
      if (requestedModels.length === 1) return { ok: false, status: 404, json: async () => ({ error: { message: "model not found" } }) };
      if (outcome === "transport failure") throw new Error("synthetic transport failure");
      if (outcome === "HTTP failure") return { ok: false, status: 503, json: async () => ({ error: { message: "synthetic unavailable" } }) };
      if (outcome === "authentication failure") return { ok: false, status: 401, json: async () => ({ error: { message: "synthetic unauthorized" } }) };
      return { ok: true, json: async () => completion("anthropic", { input_tokens: 10, output_tokens: 2 }, authoredUpdate) };
    }) as unknown as typeof fetch;
    const result = await (svc as unknown as Internals).authorZyraUpdates(params);
    expect(requestedModels).toEqual(["claude-haiku-4-5", "claude-sonnet-4-6"]);
    expect(recorded).toHaveBeenCalledTimes(1);
    expect(recorded.mock.calls[0][1]).toMatchObject({ name: "update_authoring", model: requestedModels[1] });
    const writes = (svc as unknown as { db: { query: jest.Mock } }).db.query.mock.calls.filter(([sql]) => String(sql).includes("INSERT INTO zyra_token_usage"));
    if (outcome === "success") {
      expect(result.operations[0].fields).toEqual({ description: "Keep this field", title: "Synthetic updated title" });
      expect(result.operations[0]).not.toHaveProperty("__authoringError");
      expect(recorded.mock.calls[0][1].usage).toEqual({ input: 10, output: 2, total: 12 });
      expect(writes).toHaveLength(1);
      expect(writes[0][1]).toEqual(["synthetic-project", "chat_generate", "anthropic", requestedModels[1], 10, 2, 12]);
    } else {
      expect(result.operations[0].fields).toEqual({ description: "Keep this field" });
      expect(result.operations[0].__authoringError).toEqual(expect.stringContaining("so nothing was staged for it"));
      expect(recorded.mock.calls[0][1].errorMessage).toEqual(expect.stringContaining("drafting it failed"));
      expect(recorded.mock.calls[0][1].usage).toBeUndefined();
      expect(writes).toEqual([]);
    }
  });

  it("update authoring keeps actual models local to concurrent batches", async () => {
    const params = prepareUpdateAuthoring(svc, "anthropic");
    const internal = svc as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>;
    jest.spyOn(internal, "findProjectTestcase").mockImplementation(async (_projectId, id) => ({ id }));
    jest.spyOn(internal, "getTestCase").mockImplementation(async (id) => ({ id, externalId: `SYN-TC-${id}`, title: "Synthetic case", steps: [] }));
    const recorded = jest.spyOn(aiTrace, "recordGeneration").mockImplementation(() => undefined);
    global.fetch = jest.fn(async (_url: unknown, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));
      const firstBatch = request.messages[0].content.includes('"SYN-TC-1"');
      if (firstBatch && request.model === "claude-haiku-4-5") return { ok: false, status: 404, json: async () => ({ error: { message: "model not found" } }) };
      const ids = firstBatch ? [1, 2, 3, 4, 5] : [6];
      return { ok: true, json: async () => completion("anthropic", { input_tokens: ids.length, output_tokens: 1 }, {
        updates: ids.map((id) => ({ externalId: `SYN-TC-${id}`, fields: { title: `Updated ${id}` }, sourceRefs: [] }))
      }) };
    }) as unknown as typeof fetch;
    const result = await (svc as unknown as Internals).authorZyraUpdates({
      ...params, raw: { operations: [1, 2, 3, 4, 5, 6].map((id) => ({ type: "update", testcaseId: String(id), fields: {} })) }
    });
    expect(result.operations.map((op) => op.fields)).toEqual([1, 2, 3, 4, 5, 6].map((id) => ({ title: `Updated ${id}` })));
    expect(recorded).toHaveBeenCalledTimes(2);
    const observations = recorded.mock.calls.map(([, data]) => data);
    expect(observations.find((data) => (data.input as { cases: number }).cases === 5)?.model).toBe("claude-sonnet-4-6");
    expect(observations.find((data) => (data.input as { cases: number }).cases === 1)?.model).toBe("claude-haiku-4-5");
    const writes = (svc as unknown as { db: { query: jest.Mock } }).db.query.mock.calls.filter(([sql]) => String(sql).includes("INSERT INTO zyra_token_usage"));
    expect(writes.map(([, values]) => [values[3], values[4]]).sort()).toEqual([["claude-haiku-4-5", 1], ["claude-sonnet-4-6", 5]]);
  });
});
