import { DatabaseService } from "../database/database.service";
import { embedTexts, resolveEmbeddingAllocation, type EmbeddingKeyAllocation } from "./rag-ai-allocation";
import { RAG_EMBEDDING_DIMENSION } from "./rag.constants";
import { readAiProviderJson } from "../common/public-ai-provider-failure";

/*
 * Which key gets used to produce embeddings, and what we say when none can be.
 *
 * This is a unit test rather than e2e because the interesting cases are combinations of
 * workspace key state — an Anthropic chat key with a Gemini key sitting beside it, an inactive
 * allocation, an organization with nothing capable — and provisioning six workspaces through
 * the real API to assert on a resolution decision would be slow and would obscure the thing
 * being tested. The end-to-end proof that a resolved allocation actually retrieves a document
 * lives in e2e/api/knowledge-base.spec.ts.
 *
 * The regression these lock down: resolveEmbeddingAllocation used to accept only `openai` and
 * return a bare `null` for everything else. Every allocated key in production is Anthropic, so
 * it returned null for every project, and because null is also what "nothing relevant" looks
 * like, semantic search was off everywhere for months with no error, no alert and no log line.
 */

type Row = Record<string, unknown>;

function fakeDb(opts: { allocated?: Row | null; organizationId?: string | null; workspaceKeys?: Row[] }): DatabaseService {
  const { allocated = null, organizationId = "org-1", workspaceKeys = [] } = opts;
  return {
    query: async (sql: string, params: unknown[] = []) => {
      if (sql.includes("project_ai_key_allocations")) return { rows: allocated ? [allocated] : [] };
      if (sql.includes("FROM projects")) return { rows: organizationId ? [{ organization_id: organizationId }] : [] };
      if (sql.includes("FROM workspace_ai_keys")) {
        // Mirrors the real query's filter so the test exercises the selection rule, not a stub
        // that hands back whatever it was given.
        const capable = params[1] as string[];
        const matching = workspaceKeys.filter((k) => k.is_active && capable.includes(String(k.provider).toLowerCase()));
        return { rows: matching.slice(0, 1) };
      }
      throw new Error(`unexpected query: ${sql.slice(0, 60)}`);
    }
  } as unknown as DatabaseService;
}

const anthropicKey = { name: "Claude", provider: "anthropic", api_key: "sk-ant-x", base_url: null, auth_header_name: null, auth_scheme: null, is_active: true };
const openaiKey = { name: "OpenAI", provider: "openai", api_key: "sk-x", base_url: null, auth_header_name: null, auth_scheme: null, is_active: true };
const mistralKey = { name: "Mistral", provider: "mistral", api_key: "m-x", base_url: null, auth_header_name: null, auth_scheme: null, is_active: true };

describe("resolveEmbeddingAllocation", () => {
  describe("tier 1 — the project's own key can embed", () => {
    it("uses the allocated key directly, asking nothing of the user", async () => {
      const result = await resolveEmbeddingAllocation(fakeDb({ allocated: openaiKey }), "p1");
      expect(result.allocation).not.toBeNull();
      expect(result.allocation?.provider).toBe("openai");
      expect(result.allocation?.model).toBe("text-embedding-3-small");
    });

    it("asks a natively-wider model to emit the platform width rather than truncating it later", async () => {
      const result = await resolveEmbeddingAllocation(fakeDb({ allocated: openaiKey }), "p1");
      expect(result.allocation?.sendDimensionParam).toBe(true);
      expect(result.allocation?.dimension).toBe(RAG_EMBEDDING_DIMENSION);
    });

    it("leaves a natively-1024 model alone — there is nothing to reduce", async () => {
      const result = await resolveEmbeddingAllocation(fakeDb({ allocated: mistralKey }), "p1");
      expect(result.allocation?.sendDimensionParam).toBe(false);
      expect(result.allocation?.dimension).toBe(RAG_EMBEDDING_DIMENSION);
    });
  });

  describe("tier 2 — the chat provider cannot embed", () => {
    it("borrows an embeddings-capable key from the same workspace", async () => {
      const db = fakeDb({ allocated: anthropicKey, workspaceKeys: [anthropicKey, openaiKey] });
      const result = await resolveEmbeddingAllocation(db, "p1");
      expect(result.allocation?.provider).toBe("openai");
      expect(result.reason).toContain("cannot embed");
    });

    it("never picks a chat-only provider as the embeddings source", async () => {
      // The bug this guards against is subtle: Anthropic is active, allocated, and first in the
      // list. Only the capability registry keeps it from being chosen, and choosing it would
      // fail at request time with a 404 on an endpoint that does not exist.
      const db = fakeDb({ allocated: anthropicKey, workspaceKeys: [anthropicKey, mistralKey] });
      const result = await resolveEmbeddingAllocation(db, "p1");
      expect(result.allocation?.provider).toBe("mistral");
    });

    it("ignores an inactive key when looking for a fallback", async () => {
      const db = fakeDb({ allocated: anthropicKey, workspaceKeys: [{ ...openaiKey, is_active: false }] });
      const result = await resolveEmbeddingAllocation(db, "p1");
      expect(result.allocation).toBeNull();
    });
  });

  describe("tier 3 — nothing can embed, and that must be said out loud", () => {
    it("explains that the chat provider has no embeddings endpoint and names what would fix it", async () => {
      const result = await resolveEmbeddingAllocation(fakeDb({ allocated: anthropicKey }), "p1");
      expect(result.allocation).toBeNull();
      expect(result.reason).toContain("anthropic");
      expect(result.reason).toContain("openai");
      expect(result.reason).toMatch(/keyword only/i);
    });

    it("distinguishes an inactive allocation from an absent one", async () => {
      const inactive = await resolveEmbeddingAllocation(fakeDb({ allocated: { ...anthropicKey, is_active: false } }), "p1");
      expect(inactive.reason).toContain("inactive");

      const absent = await resolveEmbeddingAllocation(fakeDb({ allocated: null }), "p1");
      expect(absent.reason).toContain("No AI key is allocated");
    });

    it("never returns an empty reason — silence is the failure mode this replaced", async () => {
      const cases = [
        fakeDb({ allocated: anthropicKey }),
        fakeDb({ allocated: null }),
        fakeDb({ allocated: { ...anthropicKey, is_active: false } }),
        fakeDb({ allocated: anthropicKey, organizationId: null })
      ];
      for (const db of cases) {
        const result = await resolveEmbeddingAllocation(db, "p1");
        expect(result.allocation).toBeNull();
        expect(result.reason.trim().length).toBeGreaterThan(0);
      }
    });
  });

  it("reports a reason even on the happy path, so callers can log which key was chosen", async () => {
    const result = await resolveEmbeddingAllocation(fakeDb({ allocated: openaiKey }), "p1");
    expect(result.reason.trim().length).toBeGreaterThan(0);
  });
});

describe("embedding provider ingress", () => {
  const originalFetch = global.fetch;
  const privateDetail = "pvt-embed synthetic-private-embedding-context";
  const allocation = (): EmbeddingKeyAllocation => ({
    provider: "openai", api_key: "synthetic-only", base_url: "https://provider.invalid/v1", auth_header_name: null,
    auth_scheme: null, model: "text-embedding-3-small", dimension: RAG_EMBEDDING_DIMENSION, sendDimensionParam: true
  });

  afterEach(() => { global.fetch = originalFetch; jest.restoreAllMocks(); });

  it.each([null, "synthetic-private-envelope", 42, true])("normalizes a non-object HTTP error envelope %j without rewriting successful bodies", async (body) => {
    await expect(readAiProviderJson(new Response(JSON.stringify(body), { status: 500 }))).resolves.toEqual({});
    await expect(readAiProviderJson(new Response(JSON.stringify(body), { status: 200 }))).resolves.toEqual(body);
  });

  it.each([
    [401, null, "API key is invalid"],
    [403, null, "rejected for permissions"],
    [429, null, "rate-limited or out of quota"],
    [500, null, "temporarily unavailable (HTTP 500)"],
    [504, null, "did not answer in time (HTTP 504)"],
    [500, { error: { message: privateDetail } }, "temporarily unavailable (HTTP 500)"],
  ] as const)("preserves HTTP %s guidance for error envelope %j", async (status, body, guidance) => {
    global.fetch = jest.fn(async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
    const error = await embedTexts(allocation(), ["public synthetic input"]).then(() => null, (failure: unknown) => failure);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain(guidance);
    expect((error as Error).message).not.toContain(privateDetail);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it.each(["HTTP", "transport", "JSON", "api_key", "auth_header_name", "auth_scheme"])("keeps a failed %s request private", async (kind) => {
    const key = allocation();
    if (kind === "HTTP") global.fetch = jest.fn(async () => new Response(JSON.stringify({ error: { message: privateDetail } }), { status: 500 })) as typeof fetch;
    else if (kind === "transport") global.fetch = jest.fn().mockRejectedValue(new Error(privateDetail)) as typeof fetch;
    else if (kind === "JSON") global.fetch = jest.fn(async () => new Response(privateDetail)) as typeof fetch;
    else {
      key[kind as "api_key" | "auth_header_name" | "auth_scheme"] = `${privateDetail}\ninvalid`;
      // Run native request/header validation without making a network request.
      global.fetch = jest.fn(async (url, init) => { new Request(url, init); return new Response("{}"); }) as typeof fetch;
    }
    const error = await embedTexts(key, ["public synthetic input"]).then(() => null, (failure: unknown) => failure);
    expect(typeof (error as Error)?.message).toBe("string");
    expect((error as Error).message).not.toContain("pvt-embed");
    expect((error as Error).message).not.toContain("synthetic-private-embedding-context");
    expect((error as Error).message).toMatch(/failed|unavailable|headers are invalid/i);
    if (kind === "HTTP") expect((error as Error).message).toContain("HTTP 500");
    if (["api_key", "auth_header_name", "auth_scheme"].includes(kind)) expect(global.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ["null response", null],
    ["string response", privateDetail],
    ["missing data", {}],
    ["null data", { data: null }],
    ["non-array data", { data: { value: privateDetail } }],
    ["empty data", { data: [] }],
    ["null row", { data: [null] }],
    ["string row", { data: [privateDetail] }],
    ["missing vector", { data: [{ index: 0 }] }],
    ["null vector", { data: [{ index: 0, embedding: null }] }],
    ["string vector", { data: [{ index: 0, embedding: privateDetail }] }],
    ["object vector", { data: [{ index: 0, embedding: { value: privateDetail } }] }],
    ["empty vector", { data: [{ index: 0, embedding: [] }] }],
    ["string cell", { data: [{ index: 0, embedding: [privateDetail] }] }],
    ["null cell", { data: [{ index: 0, embedding: [null] }] }],
    ["object cell", { data: [{ index: 0, embedding: [{ value: privateDetail }] }] }],
    ["nested array cell", { data: [{ index: 0, embedding: [[0.1]] }] }],
    ["boolean cell", { data: [{ index: 0, embedding: [true] }] }],
    ["missing index", { data: [{ embedding: [0.1] }] }],
    ["string index", { data: [{ index: privateDetail, embedding: [0.1] }] }],
    ["negative index", { data: [{ index: -1, embedding: [0.1] }] }],
    ["fractional index", { data: [{ index: 0.5, embedding: [0.1] }] }],
    ["out-of-range index", { data: [{ index: 1, embedding: [0.1] }] }],
    ["extra vector", { data: [{ index: 0, embedding: [0.1] }, { index: 1, embedding: [0.2] }] }],
  ])("rejects a successful HTTP response with %s before returning any vector", async (_kind, response) => {
    global.fetch = jest.fn(async () => new Response(JSON.stringify(response))) as typeof fetch;
    await expect(embedTexts(allocation(), ["public synthetic input"])).rejects.toThrow(
      "AI provider returned invalid embedding data. Try again or check the embedding model."
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it.each(["1e999", "-1e999"])("rejects a non-finite cell parsed from real JSON number %s", async (number) => {
    global.fetch = jest.fn(async () => new Response(`{"data":[{"index":0,"embedding":[${number}]}]}`)) as typeof fetch;
    await expect(embedTexts(allocation(), ["public synthetic input"])).rejects.toThrow("AI provider returned invalid embedding data.");
  });

  it("rejects duplicate indices instead of silently misaligning vectors to inputs", async () => {
    global.fetch = jest.fn(async () => new Response(JSON.stringify({ data: [
      { index: 0, embedding: [0.1] }, { index: 0, embedding: [0.2] }
    ] }))) as typeof fetch;
    await expect(embedTexts(allocation(), ["first", "second"])).rejects.toThrow("AI provider returned invalid embedding data.");
  });

  it("preserves an empty batch response for an empty input batch", async () => {
    global.fetch = jest.fn(async () => new Response(JSON.stringify({ data: [] }))) as typeof fetch;
    await expect(embedTexts(allocation(), [])).resolves.toEqual([]);
  });

  it.each([true, false])("preserves vector order and custom auth with dimensions enabled=%s", async (sendDimensionParam) => {
    const key = { ...allocation(), auth_header_name: "X-Embedding-Key", auth_scheme: "Custom", sendDimensionParam };
    global.fetch = jest.fn(async () => new Response(JSON.stringify({ data: [
      { index: 1, embedding: [0.4, 0.5, 0.6] }, { index: 0, embedding: [0, -0.2, 1e-10] }
    ] }))) as typeof fetch;
    expect(await embedTexts(key, ["first", "second"])).toEqual([[0, -0.2, 1e-10], [0.4, 0.5, 0.6]]);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://provider.invalid/v1/embeddings");
    expect(new Headers(init.headers).get("X-Embedding-Key")).toBe("Custom synthetic-only");
    expect(JSON.parse(String(init.body))).toEqual({ model: key.model, input: ["first", "second"], ...(sendDimensionParam ? { dimensions: RAG_EMBEDDING_DIMENSION } : {}) });
  });
});
