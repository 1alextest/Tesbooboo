export const PROJECT: string;
export const TOKEN: string;
export const RUN: string;
export const CASE: string;

export type CloseFixture = "accepted" | "minimal" | "mismatch" | "denied" | "unavailable" | "disconnect" | "timeout" | "lost-ack" |
  "invalid-json" | "empty" | "null" | "array" | "wrong-run" | "missing-mismatch" | "invalid-mismatch" |
  "invalid-pair" | "invalid-status" | "invalid-already" | "reported-incomplete" | "null-status" |
  "already-incomplete" | "already-unknown" | "already-null-status" | "retry-then-accepted" | "unknown-result";

export function withIngest(
  outcome: CloseFixture,
  body: (baseUrl: string, calls: Array<{ method: string; url: string; body: Record<string, unknown> }>, fixture: { closureApplied: boolean }) => Promise<void>
): Promise<void>;

export function runNode(
  args: string[],
  options?: { cwd?: string; env?: NodeJS.ProcessEnv; timeout?: number }
): Promise<{ code: number; output: string }>;

export function runPlaywrightFixture(options: {
  dir: string;
  reporter: string;
  playwrightCli: string;
  playwrightTest: string;
  reporterOptions: Record<string, unknown>;
  failingTest?: boolean;
  env?: NodeJS.ProcessEnv;
}): Promise<{ code: number; output: string }>;
