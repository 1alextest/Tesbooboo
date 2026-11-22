/** Provider-reported token counts; absent fields are unknown, including on partial responses. */
export type ProviderUsage = { input?: number; output?: number; total?: number; cached?: number };

/** Shared wire mapping for Zyra and integration summaries. Never coerce unknown values to zero. */
export function parseProviderUsage(wire: "openai" | "anthropic", raw: unknown): ProviderUsage | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const usage = raw as Record<string, unknown>;
  const count = (value: unknown): number | undefined =>
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
  let input: number | undefined;
  let output: number | undefined;
  let total: number | undefined;
  let cached: number | undefined;
  if (wire === "anthropic") {
    // Anthropic excludes cache reads/creations from input_tokens. Omitted optional cache
    // counters mean no cache usage; an explicitly malformed counter makes the sum unknown.
    const read = count(usage.cache_read_input_tokens);
    const created = count(usage.cache_creation_input_tokens);
    const cacheKnown = (usage.cache_read_input_tokens === undefined || read !== undefined) &&
      (usage.cache_creation_input_tokens === undefined || created !== undefined);
    const cacheTotal = cacheKnown ? count((read ?? 0) + (created ?? 0)) : undefined;
    if (read !== undefined || created !== undefined) cached = cacheTotal;
    const uncached = count(usage.input_tokens);
    if (uncached !== undefined && cacheTotal !== undefined) input = count(uncached + cacheTotal);
    output = count(usage.output_tokens);
    if (input !== undefined && output !== undefined) total = count(input + output);
  } else {
    input = count(usage.prompt_tokens);
    output = count(usage.completion_tokens);
    total = count(usage.total_tokens);
    const details = usage.prompt_tokens_details;
    cached = count(details && typeof details === "object" && !Array.isArray(details)
      ? (details as Record<string, unknown>).cached_tokens : undefined);
  }
  const parsed = {
    ...(input !== undefined ? { input } : {}),
    ...(output !== undefined ? { output } : {}),
    ...(total !== undefined ? { total } : {}),
    ...(cached !== undefined ? { cached } : {})
  };
  return Object.keys(parsed).length ? parsed : undefined;
}
