import { seedLangfuseModelPrices } from "./langfuse-model-prices";

describe("langfuse-model-prices", () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env.LANGFUSE_SEED_MODEL_PRICES;
  const config = { baseUrl: "http://langfuse.test:3100/", publicKey: "pk-test", secretKey: "sk-test" };

  beforeEach(() => {
    jest.resetAllMocks();
    delete process.env.LANGFUSE_SEED_MODEL_PRICES;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalEnv === undefined) delete process.env.LANGFUSE_SEED_MODEL_PRICES;
    else process.env.LANGFUSE_SEED_MODEL_PRICES = originalEnv;
  });

  it("does nothing when seeding is disabled", async () => {
    process.env.LANGFUSE_SEED_MODEL_PRICES = "false";
    global.fetch = jest.fn() as unknown as typeof fetch;
    await expect(seedLangfuseModelPrices(config)).resolves.toBeUndefined();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("posts model definitions and treats conflicts/existing definitions as non-fatal", async () => {
    const responses = [
      { ok: true, status: 200, text: async () => "ok" },
      { ok: false, status: 409, text: async () => "already exists" },
      { ok: false, status: 400, text: async () => "duplicate model" },
      { ok: false, status: 500, text: async () => "boom" }
    ];
    global.fetch = jest.fn(async (_url, init) => {
      expect(init?.method).toBe("POST");
      expect((init?.headers as Record<string, string>).Authorization).toMatch(/^Basic /);
      return (responses.shift() ?? { ok: true, status: 200, text: async () => "ok" }) as Response;
    }) as unknown as typeof fetch;

    await expect(seedLangfuseModelPrices(config)).resolves.toBeUndefined();
    expect(global.fetch).toHaveBeenCalledTimes(8);
  });

  it("never throws on network failures", async () => {
    global.fetch = jest.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    await expect(seedLangfuseModelPrices(config)).resolves.toBeUndefined();
  });
});
