import { Logger } from "@nestjs/common";

const logger = new Logger("LangfuseModelPrices");

type ModelPriceSeed = {
  modelName: string;
  matchPattern: string;
  unit: "TOKENS";
  inputPrice: number;
  outputPrice: number;
};

/**
 * Phase 1 cost-accounting seed for models our catalog can select but the Langfuse instance may not
 * price yet (see docs/langfuse-observability-plan.md §3.5). Prices are USD per token (Langfuse
 * model definitions use unit prices). Values are approximate/public as of 2026 and should be
 * revisited when provider pricing changes — correctness of token counts does not depend on this.
 */
const MODEL_PRICE_SEEDS: ModelPriceSeed[] = [
  { modelName: "claude-sonnet-4-6", matchPattern: "(?i)^claude-sonnet-4-6$", unit: "TOKENS", inputPrice: 0.000003, outputPrice: 0.000015 },
  { modelName: "claude-haiku-4-5", matchPattern: "(?i)^claude-haiku-4-5(-.*)?$", unit: "TOKENS", inputPrice: 0.000001, outputPrice: 0.000005 },
  { modelName: "claude-sonnet-4", matchPattern: "(?i)^claude-sonnet-4$", unit: "TOKENS", inputPrice: 0.000003, outputPrice: 0.000015 },
  { modelName: "claude-sonnet-4-20250514", matchPattern: "(?i)^claude-sonnet-4-20250514$", unit: "TOKENS", inputPrice: 0.000003, outputPrice: 0.000015 },
  { modelName: "claude-3-7-sonnet", matchPattern: "(?i)^claude-3-7-sonnet(-.*)?$", unit: "TOKENS", inputPrice: 0.000003, outputPrice: 0.000015 },
  { modelName: "gpt-4.1", matchPattern: "(?i)^gpt-4\\.1(-\\d{4}-\\d{2}-\\d{2})?$", unit: "TOKENS", inputPrice: 0.000002, outputPrice: 0.000008 },
  { modelName: "gpt-4.1-mini", matchPattern: "(?i)^gpt-4\\.1-mini(-\\d{4}-\\d{2}-\\d{2})?$", unit: "TOKENS", inputPrice: 0.0000004, outputPrice: 0.0000016 },
  { modelName: "gemini-2.0-flash", matchPattern: "(?i)^gemini-2\\.0-flash(-.*)?$", unit: "TOKENS", inputPrice: 0.0000001, outputPrice: 0.0000004 }
];

function authHeader(publicKey: string, secretKey: string): string {
  return `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString("base64")}`;
}

async function upsertModel(
  baseUrl: string,
  publicKey: string,
  secretKey: string,
  seed: ModelPriceSeed
): Promise<"created" | "exists" | "failed"> {
  const url = `${baseUrl.replace(/\/+$/, "")}/api/public/models`;
  const body = JSON.stringify({
    modelName: seed.modelName,
    matchPattern: seed.matchPattern,
    unit: seed.unit,
    inputPrice: seed.inputPrice,
    outputPrice: seed.outputPrice
  });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader(publicKey, secretKey),
        "Content-Type": "application/json"
      },
      body
    });

    if (response.ok) return "created";
    // Langfuse returns 409/400 when a matching model definition already exists; treat as non-fatal.
    if (response.status === 409 || response.status === 400) {
      const text = await response.text().catch(() => "");
      if (/exist|duplicate|already|conflict/i.test(text) || response.status === 409) return "exists";
      logger.warn(`Model price seed skipped for ${seed.modelName}: ${response.status} ${text.slice(0, 160)}`);
      return "failed";
    }
    const text = await response.text().catch(() => "");
    logger.warn(`Model price seed failed for ${seed.modelName}: ${response.status} ${text.slice(0, 160)}`);
    return "failed";
  } catch (err) {
    logger.warn(`Model price seed error for ${seed.modelName}: ${err instanceof Error ? err.message : err}`);
    return "failed";
  }
}

/**
 * Best-effort seed of known missing model prices. Never throws; observability must not affect app behavior.
 */
export async function seedLangfuseModelPrices(config: { baseUrl: string; publicKey: string; secretKey: string }): Promise<void> {
  if (String(process.env.LANGFUSE_SEED_MODEL_PRICES || "true").toLowerCase() === "false") {
    logger.log("Model price seeding disabled by LANGFUSE_SEED_MODEL_PRICES=false.");
    return;
  }

  let created = 0;
  let exists = 0;
  let failed = 0;
  for (const seed of MODEL_PRICE_SEEDS) {
    const result = await upsertModel(config.baseUrl, config.publicKey, config.secretKey, seed);
    if (result === "created") created += 1;
    else if (result === "exists") exists += 1;
    else failed += 1;
  }
  logger.log(`Model price seed complete: created=${created} existing=${exists} failed=${failed}.`);
}
