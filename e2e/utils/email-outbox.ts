import { env } from "./env";

/*
 * Reading the backend's test-only email outbox.
 *
 * With EMAIL_DELIVERY_MODE=log, nothing is emailed — so a suite that needs an OTP code or an invite
 * link has to read it from somewhere. It used to read the container log, which meant the backend
 * printed credentials to stdout and anyone with log access could read a live reset token. The
 * backend now records each message in a bounded in-memory outbox instead, exposed only when
 * EMAIL_OUTBOX_ENABLED=1 is set (the e2e stack sets it; production never does, and the route 404s).
 *
 * Every helper is best-effort: against a stack without the outbox the endpoint is absent, the
 * helpers return null, and callers skip.
 */

export interface OutboxMessage {
  to: string;
  kind: string;
  subject: string;
  text: string;
  html?: string;
  createdAt: string;
}

const OUTBOX_PATH = "/api/test/email-outbox";

async function fetchOutbox(email?: string): Promise<OutboxMessage[] | null> {
  const query = email ? `?to=${encodeURIComponent(email)}` : "";
  try {
    const res = await fetch(`${env.apiBaseUrl}${OUTBOX_PATH}${query}`);
    if (!res.ok) return null;
    const body = (await res.json()) as { messages?: OutboxMessage[] };
    return body.messages ?? [];
  } catch {
    return null;
  }
}

export async function emailOutboxAvailable(): Promise<boolean> {
  return (await fetchOutbox()) !== null;
}

export async function clearEmailOutbox(): Promise<void> {
  try {
    await fetch(`${env.apiBaseUrl}${OUTBOX_PATH}`, { method: "DELETE" });
  } catch {
    // best-effort, like everything here
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Polls the outbox until a message for `email` matches, or the deadline passes.
 *
 * The API call that triggers the message returns before EmailService necessarily records it, so a
 * single read can legitimately miss it.
 */
async function waitForMessage(
  email: string,
  predicate: (message: OutboxMessage) => boolean,
  timeoutMs: number,
): Promise<OutboxMessage | null> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const messages = await fetchOutbox(email);
    if (messages === null) return null;
    const match = messages.find(predicate);
    if (match) return match;
    if (Date.now() >= deadline) return null;
    await sleep(300);
  }
}

/** The six-digit verification code recorded for `email`, or null. */
export async function waitForOtpEmail(email: string, timeoutMs = 8_000): Promise<string | null> {
  const message = await waitForMessage(email, (m) => m.kind === "otp", timeoutMs);
  return message?.text.match(/\b(\d{6})\b/)?.[1] ?? null;
}

/** The accept-invite URL recorded for `email`, or null. */
export async function waitForInviteLinkEmail(email: string, timeoutMs = 8_000): Promise<string | null> {
  const message = await waitForMessage(
    email,
    (m) => m.subject.startsWith("You have been invited to join"),
    timeoutMs,
  );
  return message?.text.match(/https?:\/\/\S+/)?.[0] ?? null;
}

/** The password-reset URL recorded for `email`, or null. */
export async function waitForPasswordResetLinkEmail(email: string, timeoutMs = 8_000): Promise<string | null> {
  const message = await waitForMessage(
    email,
    (m) => m.subject === "Reset your Tesbo Test Manager password",
    timeoutMs,
  );
  return message?.text.match(/https?:\/\/\S+\/reset-password\/\S+/)?.[0] ?? null;
}
