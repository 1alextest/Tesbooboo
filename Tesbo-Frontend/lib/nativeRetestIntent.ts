import type { NativeRetestRequest } from "./api";

export type RetestScope = { userId: string; projectId: string; sourceCycleId: string };
export type RetestRouteHint = { projectRef: string; cycleRef: string };
export type RetestIntent = RetestScope & { version: 1; request: NativeRetestRequest; routeHint?: RetestRouteHint };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function key(scope: RetestScope): string {
  return `tesbo:retest:${scope.userId}:${scope.projectId}:${scope.sourceCycleId}`;
}

/** Browser intent is recovery state only; the native receipt owns whether a Run exists. */
export function readRetestIntent(storage: Storage, scope: RetestScope): RetestIntent | null {
  const raw = storage.getItem(key(scope));
  if (raw === null) return null;
  let value: RetestIntent;
  try { value = JSON.parse(raw) as RetestIntent; } catch { throw new Error("The saved retest request cannot be read. Check this Run's retests before starting another request."); }
  const request = value?.request;
  if (value?.version !== 1 || value.userId !== scope.userId || value.projectId !== scope.projectId ||
      value.sourceCycleId !== scope.sourceCycleId || !request || typeof request.requestKey !== "string" ||
      !UUID.test(request.requestKey) || !Array.isArray(request.executionIds) ||
      request.executionIds.length < 1 || request.executionIds.length > 100 ||
      request.executionIds.some(id => typeof id !== "string" || !UUID.test(id)) ||
      new Set(request.executionIds.map(id => id.toLowerCase())).size !== request.executionIds.length ||
      typeof request.name !== "string" || !request.name.trim() || request.name.length > 255 || request.name.includes("\0") ||
      typeof request.expectedPreviewDigest !== "string" || !/^[0-9a-f]{64}$/.test(request.expectedPreviewDigest) ||
      [request.environment, request.buildVersion].some(v => v !== undefined && (typeof v !== "string" || v.length > 128 || v.includes("\0"))) ||
      (request.description !== undefined && (typeof request.description !== "string" || request.description.length > 10000 || request.description.includes("\0")))) {
    throw new Error("The saved retest request is incomplete. Check this Run's retests before starting another request.");
  }
  return value;
}

/** The URL the user actually reviewed is a navigation hint, never an authorization decision. */
export function retestRouteHint(pathname: string): RetestRouteHint | undefined {
  const match = /^\/projects\/([^/]+)\/cycles\/([^/]+)\/?$/.exec(pathname);
  if (!match) return undefined;
  try {
    const projectRef = decodeURIComponent(match[1]), cycleRef = decodeURIComponent(match[2]);
    return /^[a-z0-9-]{1,300}$/i.test(projectRef) && /^[a-z0-9-]{1,300}$/i.test(cycleRef) ? { projectRef, cycleRef } : undefined;
  } catch { return undefined; }
}

/** Only a current user's validated, uniquely matching pending request may recover its route. */
export function findRetestRouteIntent(storage: Storage, userId: string, projectRef: string, cycleRef: string): RetestIntent | null {
  let found: RetestIntent | null = null;
  for (let index = 0; index < storage.length; index += 1) {
    const storedKey = storage.key(index);
    if (!storedKey?.startsWith(`tesbo:retest:${userId}:`)) continue;
    try {
      const candidate = JSON.parse(storage.getItem(storedKey) || "null") as RetestIntent | null;
      if (!candidate || candidate.userId !== userId || !UUID.test(candidate.projectId) || !UUID.test(candidate.sourceCycleId) || key(candidate) !== storedKey) continue;
      const intent = readRetestIntent(storage, candidate);
      if (!intent?.routeHint || typeof intent.routeHint.projectRef !== "string" || typeof intent.routeHint.cycleRef !== "string" ||
          intent.routeHint.projectRef.toLowerCase() !== projectRef.toLowerCase() || intent.routeHint.cycleRef.toLowerCase() !== cycleRef.toLowerCase()) continue;
      if (found) return null;
      found = intent;
    } catch { /* Malformed entries cannot grant a recovery route; the normal not-found state remains. */ }
  }
  return found;
}

/** Match the native request's canonical identity, not a second owner of eligibility or approval. */
export async function retestIntentDigest(intent: RetestIntent): Promise<string> {
  const request = intent.request;
  // These keys are the normalized wire contract, in the server's canonical lexicographic order.
  const canonical = {
    actorId: intent.userId.toLowerCase(),
    buildVersion: request.buildVersion?.trim() || null,
    description: request.description?.trim() || null,
    environment: request.environment?.trim() || null,
    executionIds: request.executionIds.map(id => id.toLowerCase()).sort(),
    expectedPreviewDigest: request.expectedPreviewDigest,
    name: request.name.trim(),
    requestKey: request.requestKey.toLowerCase(),
    sourceCycleId: intent.sourceCycleId.toLowerCase(),
  };
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(canonical)));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export function saveRetestIntent(storage: Storage, intent: RetestIntent): void {
  const existing = readRetestIntent(storage, intent);
  if (existing && JSON.stringify(existing.request) !== JSON.stringify(intent.request)) {
    throw new Error("A retest request is already awaiting recovery. Check its outcome before starting another.");
  }
  // Canonical URL rewrites may enrich the navigation hint while the exact request is in flight.
  const serialized = JSON.stringify({ ...intent, routeHint: existing?.routeHint ?? intent.routeHint });
  storage.setItem(key(intent), serialized);
  if (storage.getItem(key(intent)) !== serialized) throw new Error("The browser could not retain this retest request. Nothing was sent; enable browser storage and try again.");
}

export function updateRetestRouteHint(storage: Storage, scope: RetestScope, routeHint: RetestRouteHint): void {
  const existing = readRetestIntent(storage, scope);
  if (!existing || existing.routeHint?.projectRef === routeHint.projectRef && existing.routeHint.cycleRef === routeHint.cycleRef) return;
  const serialized = JSON.stringify({ ...existing, routeHint });
  storage.setItem(key(scope), serialized);
  if (storage.getItem(key(scope)) !== serialized) throw new Error("The retest recovery link could not be retained.");
}

export function clearRetestIntent(storage: Storage, intent: RetestIntent): void {
  const existing = readRetestIntent(storage, intent);
  if (existing?.request.requestKey === intent.request.requestKey) storage.removeItem(key(intent));
}
