import { LegacyService } from "./legacy.service";
import type { DatabaseService } from "../database/database.service";

process.env.SECRETS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

/*
 * Usage parsing for the router/planner call paths.
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
});
