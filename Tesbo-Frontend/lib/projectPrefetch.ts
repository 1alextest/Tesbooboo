import { api, getProject, listProjectMembers } from "./api";

/**
 * Starts the project-scoped requests while AppDataProvider is still waiting on the session check,
 * instead of after it. On a hard load of /projects/<ref>/..., the chain used to be strictly
 * sequential: session + workspace + project list -> route-resolve -> project + members. The
 * second and third stages do not depend on the first one's *result*, only on its permission to
 * render, so they can run alongside it.
 *
 * Nothing here widens access. The calls are the same GETs the providers would have made, with the
 * same cookie, and the API authorizes each one. The session gate in AppDataProvider is untouched:
 * nothing protected renders until authMe() succeeds. If the session is invalid these requests
 * simply fail, nobody consumes them, and the login redirect proceeds as before.
 *
 * Each entry is take-once and expires after TTL_MS, so a later mount (another visit to the same
 * project, a refetch) always makes a real request rather than reading a stale result.
 */
const TTL_MS = 15_000;

type Entry = { at: number; promise: Promise<unknown> };
const store = new Map<string, Entry>();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ResolvedProject = { projectId: string; projectKey?: string };

export const routeResolveKey = (ref: string) => `route-resolve:${ref.toLowerCase()}`;
export const projectKey = (projectId: string) => `project:${projectId}`;
export const membersKey = (projectId: string) => `members:${projectId}`;

function put(key: string, promise: Promise<unknown>) {
  // The prefetch is speculative: when nothing ever consumes it (invalid session, user navigated
  // away) a rejection must not surface as an unhandled one.
  promise.catch(() => undefined);
  store.set(key, { at: Date.now(), promise });
}

/** Returns the prefetched promise for `key` once, or undefined if absent or expired. */
export function takePrefetched<T>(key: string): Promise<T> | undefined {
  const entry = store.get(key);
  store.delete(key);
  if (!entry || Date.now() - entry.at > TTL_MS) return undefined;
  return entry.promise as Promise<T>;
}

export function clearProjectPrefetch(): void {
  store.clear();
}

/** Called once on a hard load. No-op for any URL that is not inside a project. */
export function prefetchProjectForPath(pathname: string): void {
  const match = /^\/projects\/([^/]+)/.exec(pathname);
  if (!match) return;
  let ref: string;
  try {
    ref = decodeURIComponent(match[1]);
  } catch {
    return;
  }

  // Same query RouteParamsProvider sends for a bare project URL; deeper URLs (a bug, a cycle) send
  // extra params, miss this entry, and make their own call. The project chain below still gains.
  // A uuid needs no lookup (RouteParamsProvider renders it immediately), so start the project
  // requests right away instead of behind the resolve.
  if (UUID_RE.test(ref)) {
    put(projectKey(ref), getProject(ref));
    put(membersKey(ref), listProjectMembers(ref));
  }

  const resolve = api<ResolvedProject>(`/api/route-resolve?${new URLSearchParams({ project: ref }).toString()}`);
  put(routeResolveKey(ref), resolve);

  void resolve
    .then(({ projectId }) => {
      if (store.has(projectKey(projectId))) return;
      put(projectKey(projectId), getProject(projectId));
      put(membersKey(projectId), listProjectMembers(projectId));
    })
    .catch(() => undefined);
}
