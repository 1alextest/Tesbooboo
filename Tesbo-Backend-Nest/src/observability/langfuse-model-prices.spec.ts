import { Logger } from "@nestjs/common";
import { seedLangfuseModelPrices } from "./langfuse-model-prices";

type Model = { id: string; modelName: string; matchPattern: string; isLangfuseManaged: boolean };

function inventory(data: Model[] = [], page = 1, totalItems = data.length): Response {
  return new Response(JSON.stringify({ data, meta: { page, limit: 100, totalItems, totalPages: Math.ceil(totalItems / 100) } }), { status: 200 });
}

describe("langfuse-model-prices", () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env.LANGFUSE_SEED_MODEL_PRICES;
  const config = { baseUrl: "https://langfuse.test:3443/prefix/", publicKey: "pk-test", secretKey: "sk-synthetic-secret" };
  let fetchMock: jest.Mock;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env.LANGFUSE_SEED_MODEL_PRICES = "true";
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    logSpy = jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    global.fetch = originalFetch;
    if (originalEnv === undefined) delete process.env.LANGFUSE_SEED_MODEL_PRICES;
    else process.env.LANGFUSE_SEED_MODEL_PRICES = originalEnv;
  });

  function writes(): Record<string, unknown>[] {
    return fetchMock.mock.calls.filter(([, init]) => init?.method === "POST").map(([, init]) => JSON.parse(init.body));
  }

  it.each([undefined, "", "false", "1", "yes"])("does not make requests without explicit opt-in (%s)", async (value) => {
    if (value === undefined) delete process.env.LANGFUSE_SEED_MODEL_PRICES;
    else process.env.LANGFUSE_SEED_MODEL_PRICES = value;
    await expect(seedLangfuseModelPrices(config)).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads an empty inventory before creating only exact, verified model IDs", async () => {
    fetchMock.mockImplementation(async (_url: RequestInfo | URL, init?: RequestInit) => init?.method === "GET" ? inventory() : new Response("{}"));
    await seedLangfuseModelPrices(config);
    expect(fetchMock.mock.calls[0][1].method).toBe("GET");
    expect(writes()).toEqual([
      { modelName: "claude-sonnet-4-6", matchPattern: "(?i)^claude-sonnet-4-6$", unit: "TOKENS", inputPrice: 0.000003, outputPrice: 0.000015 },
      { modelName: "claude-haiku-4-5", matchPattern: "(?i)^claude-haiku-4-5$", unit: "TOKENS", inputPrice: 0.000001, outputPrice: 0.000005 },
      { modelName: "gpt-4.1", matchPattern: "(?i)^gpt-4\\.1$", unit: "TOKENS", inputPrice: 0.000002, outputPrice: 0.000008 },
      { modelName: "gpt-4.1-mini", matchPattern: "(?i)^gpt-4\\.1-mini$", unit: "TOKENS", inputPrice: 0.0000004, outputPrice: 0.0000016 }
    ]);
    for (const [url, init] of fetchMock.mock.calls) {
      expect(new URL(String(url)).origin).toBe("https://langfuse.test:3443");
      expect(new URL(String(url)).pathname).toBe("/prefix/api/public/models");
      expect(init.redirect).toBe("manual");
      expect(init.signal).toBeInstanceOf(AbortSignal);
      expect(init.headers.Authorization).toBe(`Basic ${Buffer.from(`${config.publicKey}:${config.secretKey}`).toString("base64")}`);
    }
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("preserves maintained and custom definitions matching by pattern, regardless of their prices", async () => {
    fetchMock.mockResolvedValue(inventory([
      { id: "managed-1", modelName: "Claude family", matchPattern: "(?i)^(anthropic/)?claude-.*$", isLangfuseManaged: true },
      { id: "custom-1", modelName: "Our GPT prices", matchPattern: "(?i)^gpt-4\\.1(-mini)?$", isLangfuseManaged: false }
    ]));
    await seedLangfuseModelPrices(config);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(writes()).toEqual([]);
    expect(logSpy).toHaveBeenCalledWith("Model price seed complete: created=0 existing=4.");
  });

  it("also preserves an existing exact model name with a different match pattern", async () => {
    fetchMock.mockImplementation(async (_url: RequestInfo | URL, init?: RequestInit) => init?.method === "GET" ? inventory([
      { id: "custom-1", modelName: "gpt-4.1", matchPattern: "^private-model-alias$", isLangfuseManaged: false }
    ]) : new Response("{}"));
    await seedLangfuseModelPrices(config);
    expect(writes()).toHaveLength(3);
    expect(writes().some((model) => model.modelName === "gpt-4.1")).toBe(false);
  });

  it("accepts common maintained alias patterns while conservatively preserving character-class coverage", async () => {
    fetchMock.mockImplementation(async (_url: RequestInfo | URL, init?: RequestInit) => init?.method === "GET" ? inventory([
      { id: "managed-1", modelName: "GPT aliases", matchPattern: "(?i)^(openai/)?(gpt-4\\.1)(@[a-zA-Z0-9]+)?$", isLangfuseManaged: true }
    ]) : new Response("{}"));
    await seedLangfuseModelPrices(config);
    expect(writes()).toHaveLength(3);
    expect(writes().some((model) => model.modelName === "gpt-4.1")).toBe(false);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("examines all pages before creating anything and preserves a match from the last page", async () => {
    const first = Array.from({ length: 100 }, (_, i) => ({ id: `id-${i}`, modelName: `other-${i}`, matchPattern: `^other-${i}$`, isLangfuseManaged: true }));
    fetchMock.mockImplementation(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") return new Response("{}");
      const page = Number(new URL(String(url)).searchParams.get("page"));
      return page === 1 ? inventory(first, 1, 101) : inventory([
        { id: "last-id", modelName: "gpt-4.1", matchPattern: "(?i)^gpt-4\\.1$", isLangfuseManaged: true }
      ], 2, 101);
    });
    await seedLangfuseModelPrices(config);
    expect(fetchMock.mock.calls.slice(0, 2).map(([, init]) => init.method)).toEqual(["GET", "GET"]);
    expect(writes()).toHaveLength(3);
    expect(writes().some((model) => model.modelName === "gpt-4.1")).toBe(false);
  });

  it("does not write when a later inventory page cannot be read", async () => {
    const first = Array.from({ length: 100 }, (_, i) => ({ id: `id-${i}`, modelName: `other-${i}`, matchPattern: `^other-${i}$`, isLangfuseManaged: true }));
    fetchMock.mockResolvedValueOnce(inventory(first, 1, 101)).mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
    await seedLangfuseModelPrices(config);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(writes()).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
  });

  it.each([
    { data: [], meta: { page: 1, limit: 100, totalItems: 1001, totalPages: 11 } },
    { data: [], meta: { page: 1, limit: 100, totalItems: 1, totalPages: 1 } },
    { data: [], meta: { page: 2, limit: 100, totalItems: 0, totalPages: 0 } },
    { data: [], meta: { page: 1, limit: 100, totalItems: 0, totalPages: 1 } },
    { data: [], meta: null },
    { data: [{ id: "id", modelName: "gpt-4.1", isLangfuseManaged: true }], meta: { page: 1, limit: 100, totalItems: 1, totalPages: 1 } }
  ])("fails closed on incomplete, oversized, or malformed catalog metadata (%#)", async (body) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(body)));
    await seedLangfuseModelPrices(config);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(writes()).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("fails closed on duplicate inventory IDs", async () => {
    fetchMock.mockResolvedValue(inventory([
      { id: "duplicate", modelName: "one", matchPattern: "^one$", isLangfuseManaged: true },
      { id: "duplicate", modelName: "two", matchPattern: "^two$", isLangfuseManaged: false }
    ]));
    await seedLangfuseModelPrices(config);
    expect(writes()).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
  });

  it.each(["(?i)^[[:alpha:]]+$", "(?i)^\\mclaude", "(?x)^claude - sonnet$", "[", "(?i)^[^]]+$", "(?i)^claude(?!-)$", "(?i)^mİni$"])("does not guess coverage for unsupported or invalid regex %s", async (matchPattern) => {
    fetchMock.mockResolvedValue(inventory([{ id: "id", modelName: "custom", matchPattern, isLangfuseManaged: false }]));
    await seedLangfuseModelPrices(config);
    expect(writes()).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("refuses an oversized inventory response", async () => {
    fetchMock.mockResolvedValue(new Response("x".repeat(1_000_001)));
    await seedLangfuseModelPrices(config);
    expect(writes()).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
  });

  it.each([400, 409, 500])("does not label failed creation as existing or print server content (HTTP %s)", async (status) => {
    fetchMock.mockImplementation(async (_url: RequestInfo | URL, init?: RequestInit) => init?.method === "GET" ? inventory() : new Response(`model does not exist: ${config.secretKey}`, { status }));
    await seedLangfuseModelPrices(config);
    expect(writes()).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalled();
    expect(logSpy.mock.calls.flat().join(" ")).not.toContain("complete");
    expect(warnSpy.mock.calls.flat().join(" ")).not.toContain(config.secretKey);
  });

  it.each(["GET", "POST"])("refuses redirects during %s without sending another request", async (method) => {
    fetchMock.mockImplementation(async (_url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method !== method) return inventory();
      return new Response(config.secretKey, { status: 307, headers: { Location: "https://another-origin.test/models" } });
    });
    await seedLangfuseModelPrices(config);
    expect(fetchMock).toHaveBeenCalledTimes(method === "GET" ? 1 : 2);
    expect(fetchMock.mock.calls.every(([, init]) => init.redirect === "manual")).toBe(true);
    expect(warnSpy.mock.calls.flat().join(" ")).not.toContain(config.secretKey);
  });

  it("stops within the task timeout and does not print a network exception", async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation((_url: RequestInfo | URL, init?: RequestInit) => {
      if (!init?.signal) throw new Error("Missing required abort signal");
      return new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new Error(config.secretKey)), { once: true }));
    });
    const pending = seedLangfuseModelPrices(config);
    jest.advanceTimersByTime(5_000);
    await expect(pending).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    expect(warnSpy.mock.calls.flat().join(" ")).not.toContain(config.secretKey);
  });

  it.each(["ftp://langfuse.test", "https://user:password@langfuse.test", "https://langfuse.test/?key=value", "https://langfuse.test/#fragment"])("refuses ambiguous endpoint %s", async (baseUrl) => {
    await seedLangfuseModelPrices({ ...config, baseUrl });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("reads previously created definitions on the next run instead of creating replacements", async () => {
    const saved: Model[] = [];
    fetchMock.mockImplementation(async (_url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "GET") return inventory(saved);
      const body = JSON.parse(String(init?.body));
      saved.push({ id: `created-${saved.length}`, modelName: body.modelName, matchPattern: body.matchPattern, isLangfuseManaged: false });
      return new Response("{}");
    });
    await seedLangfuseModelPrices(config);
    await seedLangfuseModelPrices(config);
    expect(writes()).toHaveLength(4);
    expect(logSpy).toHaveBeenLastCalledWith("Model price seed complete: created=0 existing=4.");
  });
});
