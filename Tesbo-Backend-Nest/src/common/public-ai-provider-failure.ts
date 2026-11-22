/**
 * Shared provider ingress policy, extracted from LegacyService for embeddings,
 * transcription and integration summaries. Call only around provider I/O/header
 * construction; local domain exceptions keep their existing presentation contract.
 * Labels must come from a trusted catalog, never provider text or a custom identifier.
 */
export function describeAiProviderFailure(status: number, rawMessage?: string, label = "AI provider"): string {
  const message = String(rawMessage || "");
  if (status === 401 || /invalid x-api-key|authentication_error|invalid[_ ]api[_ ]key|incorrect api key|unauthorized/i.test(message)) {
    return `The ${label} API key is invalid or has been revoked. Update it in Workspace → Integrations, then use "Test connection" to verify.`;
  }
  if (status === 403 || /permission_error|forbidden|does not have access|not allowed/i.test(message)) {
    return `The ${label} API key was rejected for permissions — check the account's plan, billing, or model access, then update the key in Workspace → Integrations.`;
  }
  if (status === 429 || /rate.?limit|quota|insufficient_quota/i.test(message)) {
    return `${label} is rate-limited or out of quota right now. Wait a moment and retry, or check the account's usage limits.`;
  }
  if (/overloaded/i.test(message)) return `The ${label} service is overloaded. Try again shortly.`;
  if (status === 408 || status === 504) return `${label} did not answer in time (HTTP ${status}). Try again shortly.`;
  if (status >= 500 && status <= 599) return `${label} is temporarily unavailable (HTTP ${status}). Try again shortly.`;
  if (status === 404 || /model.{0,80}(?:not.?found|does not exist|unavailable)/i.test(message)) {
    return `The ${label} model or endpoint is unavailable. Check the model and base URL in Workspace → Integrations, then retry.`;
  }
  if (status >= 400 && status <= 499) {
    return `${label} rejected the request (HTTP ${status}). Check the model and request settings in Workspace → Integrations, then retry.`;
  }
  return `${label} request failed. Check the provider connection and try again.`;
}

export function isAiProviderTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

export async function withAiProviderIo<T>(operation: () => Promise<T>, label = "AI provider"): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    // Transport errors do not own an HTTP response status. Never activate an
    // arbitrary message, toString or getResponse while handling their failure.
    let name: unknown;
    let code: unknown;
    try {
      if (error !== null && (typeof error === "object" || typeof error === "function")) {
        name = (error as { name?: unknown }).name;
        code = (error as { code?: unknown }).code;
      }
    } catch { /* An unsafe error-kind getter also fails closed. */ }
    const timeout = name === "TimeoutError" || name === "AbortError" || code === "ETIMEDOUT";
    const safe = new Error(timeout ? `${label} request timed out. Try again.` : describeAiProviderFailure(0, undefined, label));
    if (timeout) safe.name = name === "AbortError" ? "AbortError" : "TimeoutError";
    throw safe;
  }
}

export async function readAiProviderJson<T extends object>(response: Response, label = "AI provider"): Promise<T> {
  try {
    const body = await withAiProviderIo(() => response.json() as Promise<T>, label);
    // An error body may be valid JSON without an error envelope. Keep the HTTP
    // status authoritative; successful response shapes remain the caller's job.
    if (!response.ok && (body === null || typeof body !== "object")) return {} as T;
    return body;
  } catch (error) {
    // Failed endpoints may return HTML/empty bodies; retain their HTTP status.
    // A successful but unreadable response must fail, and timeouts stay resumable.
    if (!response.ok && !isAiProviderTimeout(error)) return {} as T;
    throw error;
  }
}

export function buildAiProviderHeaders(build: () => Headers): Headers {
  try {
    return build();
  } catch {
    // Native Headers errors quote invalid values, including credentials.
    throw new Error("AI provider authentication headers are invalid. Check the key, header name, and authentication scheme in Workspace → Integrations.");
  }
}
