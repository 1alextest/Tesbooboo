import { execFileSync } from "node:child_process";
import { env } from "./env";

/*
 * Reading the backend container's stdout.
 *
 * Used for delivery-policy observations (the boot line, refusal warnings) — never for message
 * contents. OTP codes and invite/reset links live in the test-only email outbox now; see
 * utils/email-outbox.ts for why the log stopped being the mailbox.
 *
 * Every function here is best-effort and returns null rather than throwing when `docker compose` is
 * unavailable — against a remote target there is no container to read, and the callers skip.
 */

/**
 * The last `tailLines` lines of the backend container's log ("all" for the whole thing), or null if
 * docker can't be reached.
 *
 * maxBuffer is raised because the default 1MB is easily exceeded by a busy container's log, and
 * execSync treats an overflow as a failure — which would look here like "docker is unavailable".
 */
export function readBackendLogs(tailLines: number | "all" = 500): string | null {
  try {
    // execFile with an argument array, not a shell string: the compose file and service come from
    // environment configuration, and interpolating them into a command line made them part of the
    // shell program. No shell is involved here, so no quoting rules to get wrong.
    return execFileSync(
      "docker",
      ["compose", "-f", env.dockerComposeFile, "logs", env.dockerService, "--no-color", `--tail=${tailLines}`],
      { encoding: "utf-8", maxBuffer: 256 * 1024 * 1024 },
    );
  } catch {
    return null;
  }
}

export function backendLogsAvailable(): boolean {
  return readBackendLogs(1) !== null;
}

export interface EmailDeliveryReport {
  mode: "live" | "log";
  server: string;
  reach: "recipients" | "sandbox_only" | "log_only";
}

/**
 * What the backend announced about email delivery when it booted.
 *
 * Read from the boot line rather than from the admin health endpoint so it needs no platform-admin
 * session: `[email] delivery mode=log postmark_server=sandbox reach=sandbox_only`.
 *
 * Uses a large tail because this line is printed once, at startup, and by the time a suite runs
 * there may be a lot of request logging after it.
 */
export function readEmailDeliveryReport(): EmailDeliveryReport | null {
  // A long-running container can push the boot line well past any fixed tail, and "not found"
  // would then read as "this stack didn't report", so fall back to the whole log before giving up.
  return reportFrom(readBackendLogs(20_000)) ?? reportFrom(readBackendLogs("all"));
}

function reportFrom(logs: string | null): EmailDeliveryReport | null {
  if (logs === null) return null;
  // Last occurrence wins: a restarted container prints the line again, and only the newest is true.
  const last = [...logs.matchAll(/\[email\] delivery mode=(\S+) postmark_server=(\S+) reach=(\S+)/g)].at(-1);
  if (!last) return null;
  return {
    mode: last[1] as EmailDeliveryReport["mode"],
    server: last[2],
    reach: last[3] as EmailDeliveryReport["reach"],
  };
}
