/*
 * Which build is this process?
 *
 * Two deploy paths already exist: the Jenkins/docker-compose path exports GIT_SHA, and a Railway
 * deployment triggered from GitHub exposes RAILWAY_GIT_COMMIT_SHA at runtime. Reading them in one
 * place means /api/health and the MCP serverInfo can never disagree about the running commit, and
 * the rest of the app has one owner for this fact rather than an ad-hoc `process.env.GIT_SHA` at
 * each call site.
 *
 * Railway's injected value wins when both are present. It describes the deployment that is actually
 * running, whereas a service-level GIT_SHA persists across deploys: on 2026-11-17 a manually set
 * GIT_SHA labelled a later GitHub-triggered redeploy of an older main with the development commit.
 * Jenkins/docker-compose never sets RAILWAY_GIT_COMMIT_SHA, so its GIT_SHA still resolves normally.
 *
 * "local" is the honest answer for local dev, e2e and any deploy that exposes neither variable. It
 * is deliberately not a fabricated hash: an unknown build must look unknown, not plausible.
 */
export function resolveBuildGitSha(env: NodeJS.ProcessEnv = process.env): string {
  for (const value of [env.RAILWAY_GIT_COMMIT_SHA, env.GIT_SHA]) {
    const trimmed = String(value ?? "").trim();
    if (trimmed) return trimmed;
  }
  return "local";
}

/** Resolved once per process; the running commit cannot change without a restart. */
export const BUILD_GIT_SHA = resolveBuildGitSha();
