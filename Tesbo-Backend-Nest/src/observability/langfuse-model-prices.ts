import { Logger } from "@nestjs/common";
import { runInNewContext } from "node:vm";

const logger = new Logger("LangfuseModelPrices");
const PAGE_SIZE = 100;
const MAX_PAGES = 10;
const MAX_RESPONSE_BYTES = 1_000_000;
const SEED_TIMEOUT_MS = 5_000;

type ModelPriceSeed = {
  modelName: string;
  matchPattern: string;
  unit: "TOKENS";
  inputPrice: number;
  outputPrice: number;
};

type InventoryModel = { id: string; modelName: string; matchPattern: string };

// Verified standard USD/token rates; exact IDs only. This is an optional fallback for missing
// definitions, not an override of Langfuse's maintained prices or an operator's custom models.
// Sources and exclusions are recorded in docs/langfuse-observability-plan.md §3.5.
const MODEL_PRICE_SEEDS: ModelPriceSeed[] = [
  { modelName: "claude-sonnet-4-6", matchPattern: "(?i)^claude-sonnet-4-6$", unit: "TOKENS", inputPrice: 0.000003, outputPrice: 0.000015 },
  { modelName: "claude-haiku-4-5", matchPattern: "(?i)^claude-haiku-4-5$", unit: "TOKENS", inputPrice: 0.000001, outputPrice: 0.000005 },
  { modelName: "gpt-4.1", matchPattern: "(?i)^gpt-4\\.1$", unit: "TOKENS", inputPrice: 0.000002, outputPrice: 0.000008 },
  { modelName: "gpt-4.1-mini", matchPattern: "(?i)^gpt-4\\.1-mini$", unit: "TOKENS", inputPrice: 0.0000004, outputPrice: 0.0000016 }
];

function modelsEndpoint(baseUrl: string): URL {
  const base = new URL(baseUrl);
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
    throw new Error("Invalid Langfuse endpoint");
  }
  base.pathname = `${base.pathname.replace(/\/+$/, "")}/`;
  return new URL("api/public/models", base);
}

async function readJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing model inventory body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) throw new Error("Model inventory body exceeds limit");
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

async function readInventory(endpoint: URL, headers: Record<string, string>, signal: AbortSignal): Promise<InventoryModel[]> {
  const models: InventoryModel[] = [];
  const ids = new Set<string>();
  let expectedTotal: number | undefined;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = new URL(endpoint);
    url.searchParams.set("page", String(page));
    url.searchParams.set("limit", String(PAGE_SIZE));
    const response = await fetch(url, { method: "GET", headers, signal, redirect: "manual" });
    if (!response.ok || response.redirected || (response.url && new URL(response.url).origin !== endpoint.origin)) {
      throw new Error("Model inventory request failed");
    }
    const body = await readJson(response);
    if (!object(body) || !Array.isArray(body.data) || !object(body.meta)) throw new Error("Invalid model inventory");
    const { totalItems, totalPages } = body.meta;
    if (typeof totalItems !== "number" || !Number.isInteger(totalItems) || totalItems < 0 ||
        totalItems > PAGE_SIZE * MAX_PAGES || totalPages !== Math.ceil(totalItems / PAGE_SIZE) ||
        body.meta.page !== page || body.meta.limit !== PAGE_SIZE ||
        (expectedTotal !== undefined && totalItems !== expectedTotal) ||
        body.data.length !== Math.min(PAGE_SIZE, Math.max(0, totalItems - (page - 1) * PAGE_SIZE))) {
      throw new Error("Incomplete model inventory");
    }
    expectedTotal = totalItems;
    for (const row of body.data) {
      if (!object(row) || typeof row.id !== "string" || !row.id || row.id.length > 256 || ids.has(row.id) ||
          typeof row.modelName !== "string" || !row.modelName || row.modelName.length > 256 ||
          typeof row.matchPattern !== "string" || row.matchPattern.length > 512 || typeof row.isLangfuseManaged !== "boolean") {
        throw new Error("Invalid model definition");
      }
      ids.add(row.id);
      models.push({ id: row.id, modelName: row.modelName, matchPattern: row.matchPattern });
    }
    if (page >= Number(totalPages)) return models;
  }
  throw new Error("Model inventory page limit exceeded");
}

function coveredModelNames(models: InventoryModel[]): string[] {
  const compatible = models.map((model) => {
    const pattern = model.matchPattern.replace(/^\(\?i\)/, "");
    // PostgreSQL-only escapes, bracket syntax, locale-sensitive non-ASCII text, and constraints
    // outside this common subset make coverage ambiguous. Refuse the entire seed attempt.
    if (/[^\x20-\x7e]/.test(pattern) || /\\[A-Za-z0-9]/.test(pattern.replace(/\\[dDsSwW]/g, "")) ||
        /\[\[:|\[\[\.|\[\[=|\[\^?\]/.test(pattern) || /\(\?/.test(pattern.replace(/\(\?:/g, ""))) {
      throw new Error("Unsupported model match pattern");
    }
    // PostgreSQL ranges depend on collation. Broaden character classes to any character, so an
    // uncertain match only preserves more definitions. Lookarounds/backreferences were refused
    // above because broadening a negative constraint would not preserve that guarantee.
    const coveragePattern = pattern.replace(/\[(?:\\.|[^\]\\])*\]/g, ".").replace(/\\[dDsSwW]/g, ".");
    if (coveragePattern.includes("[")) throw new Error("Unsupported model bracket expression");
    return { modelName: model.modelName, pattern, coveragePattern, flags: model.matchPattern.startsWith("(?i)") ? "i" : "" };
  });
  // Bound regex evaluation too: an operator-supplied pattern must not stall API startup.
  return runInNewContext(`
    const covered = new Set();
    for (const model of models) {
      new RegExp(model.pattern, model.flags);
      const pattern = new RegExp(model.coveragePattern, model.flags);
      for (const name of names) {
        if (model.modelName.toLowerCase() === name || pattern.test(name)) covered.add(name);
      }
    }
    [...covered];
  `, { models: compatible, names: MODEL_PRICE_SEEDS.map((seed) => seed.modelName) }, { timeout: 100 }) as string[];
}

/** Explicit opt-in, missing-only seeding. Unknown coverage/cost is safer than a custom override. */
export async function seedLangfuseModelPrices(config: { baseUrl: string; publicKey: string; secretKey: string }): Promise<void> {
  if (String(process.env.LANGFUSE_SEED_MODEL_PRICES || "").trim().toLowerCase() !== "true") {
    logger.log("Model price seeding disabled; LANGFUSE_SEED_MODEL_PRICES=true is required.");
    return;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEED_TIMEOUT_MS);
  timeout.unref?.();
  try {
    if (!config.publicKey.trim() || !config.secretKey.trim()) throw new Error("Missing model inventory credentials");
    const endpoint = modelsEndpoint(config.baseUrl);
    const headers = { Authorization: `Basic ${Buffer.from(`${config.publicKey}:${config.secretKey}`).toString("base64")}`, "Content-Type": "application/json" };
    const inventory = await readInventory(endpoint, headers, controller.signal);
    const covered = new Set(coveredModelNames(inventory));
    let created = 0;
    for (const seed of MODEL_PRICE_SEEDS) {
      if (covered.has(seed.modelName)) continue;
      const response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(seed), signal: controller.signal, redirect: "manual" });
      // A conflict is not proof that the intended definition exists. Leave it for the next full
      // inventory check; never classify arbitrary server text as a successful or existing seed.
      if (!response.ok || response.redirected || (response.url && new URL(response.url).origin !== endpoint.origin)) {
        throw new Error("Model creation request failed");
      }
      await response.body?.cancel();
      created += 1;
    }
    logger.log(`Model price seed complete: created=${created} existing=${covered.size}.`);
  } catch {
    // API bodies/errors may reflect credentials. Diagnostics are fixed text, never server content.
    logger.warn("Model price seeding stopped: catalog validation or request failed; no existing definition was replaced.");
  } finally {
    controller.abort();
    clearTimeout(timeout);
  }
}
