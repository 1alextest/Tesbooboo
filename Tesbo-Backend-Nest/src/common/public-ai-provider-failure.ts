/**
 * The only permitted projection of an untrusted model/provider failure into
 * Zyra's persisted replies, progress events, trace metadata and activity.
 *
 * Never format thrown .message, nested .detail, getResponse() contents, URL,
 * stack, headers or request body. Even a provider's custom error text may
 * contain a customer credential or proprietary source material. Classification
 * uses only bounded numeric HTTP status / known error kinds.
 */
type ProviderFailure = {
  status?: unknown;
  statusCode?: unknown;
  getStatus?: () => unknown;
  response?: { status?: unknown } | null;
  name?: unknown;
  code?: unknown;
} | null;

function numericStatus(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599
    ? value : null;
}

export function publicAiProviderFailure(error: unknown): string {
  if (error === null || (typeof error !== "object" && typeof error !== "function")) {
    return "AI provider request failed. Please try again.";
  }
  const candidate = error as ProviderFailure;
  let status: number | null = null;
  // The standard Nest HttpException status is actionable without ever reading
  // its untrusted response message. Access failures themselves fall back closed.
  try {
    status = numericStatus(typeof candidate?.getStatus === "function"
      ? candidate.getStatus() : null)
      ?? numericStatus(candidate?.status)
      ?? numericStatus(candidate?.statusCode)
      ?? numericStatus(candidate?.response?.status);
  } catch {
    // Do not serialize or log an unsafe getter exception.
  }
  switch (status) {
    case 401: return "AI provider authentication failed. Check the configured credential.";
    case 403: return "AI provider denied the request. Check account and model permissions.";
    case 408:
    case 504: return "AI provider timed out. Please retry.";
    case 429: return "AI provider is rate-limited. Please retry later.";
    default:
      if (status !== null && status >= 500) return "AI provider is unavailable. Please retry later.";
      if (status !== null && status >= 400) return "AI provider rejected the request. Check the provider configuration.";
  }
  // Exact common transport codes only. Never include the code as text.
  try {
    if (candidate?.name === "AbortError" || candidate?.code === "ETIMEDOUT") {
      return "AI provider timed out. Please retry.";
    }
  } catch {
    // Ignore untrusted runtime properties.
  }
  return "AI provider request failed. Please try again.";
}
