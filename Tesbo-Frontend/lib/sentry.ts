/**
 * Sentry is intentionally stage-only.
 * Enable only when BOTH are set on the stage host:
 *   NEXT_PUBLIC_SENTRY_DSN=<dsn>
 *   NEXT_PUBLIC_SENTRY_ENVIRONMENT=stage
 *
 * Production (app.tesbo.io) must leave these unset so Sentry never initializes.
 */

export const SENTRY_STAGE_HOST = "app-stage.tesbo.io";
export const SENTRY_PROD_HOST = "app.tesbo.io";

export type SentryRuntimeConfig =
  | { enabled: false }
  | { enabled: true; dsn: string; environment: "stage" };

function looksLikeProductionApiUrl(apiUrl: string): boolean {
  // Match api-app.tesbo.io but not api-app-stage.tesbo.io
  try {
    const host = new URL(apiUrl).hostname;
    return host === "api-app.tesbo.io";
  } catch {
    // Not a parseable absolute URL (a bare host, or a value with stray whitespace). Compare the
    // extracted host for equality rather than searching the raw string: a substring test would also
    // match "evil.api-app.tesbo.io.example" and, used as a stage/production switch, mislabel it.
    const host = apiUrl
      .trim()
      .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
      .split(/[/?#]/)[0]
      .split(":")[0]
      .toLowerCase();
    return host === "api-app.tesbo.io";
  }
}

/** Shared gate used by client / server / edge init. */
export function getSentryRuntimeConfig(): SentryRuntimeConfig {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() ?? "";
  const environment = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT?.trim() ?? "";

  if (!dsn || environment !== "stage") {
    return { enabled: false };
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim() ?? "";
  if (apiUrl && looksLikeProductionApiUrl(apiUrl)) {
    return { enabled: false };
  }

  return { enabled: true, dsn, environment: "stage" };
}

/** Browser safety net: never send events from production host. */
export function shouldSendClientEvent(hostname: string): boolean {
  if (hostname === SENTRY_PROD_HOST) return false;
  if (hostname === SENTRY_STAGE_HOST) return true;
  // Local / unknown hosts: only if stage env gate already passed at init
  return getSentryRuntimeConfig().enabled;
}
