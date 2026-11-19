import { Injectable } from "@nestjs/common";
import { AppConfigService } from "../config/app-config.service";

/**
 * One message that was handed to EmailService.
 *
 * `text`/`html` are the delivered bodies, so a message read from here has exactly the shape and
 * content the recipient would have received — including any OTP code or reset link.
 */
export interface OutboxMessage {
  to: string;
  kind: string;
  subject: string;
  text: string;
  html?: string;
  createdAt: string;
}

/**
 * A bounded, in-memory mailbox for test stacks.
 *
 * Why this exists: with EMAIL_DELIVERY_MODE=log the backend used to print OTP codes and reset links
 * to stdout, and the e2e suite scraped the container log for them. That made the log a credential
 * store — a crafted address could forge an adjacent line, and anyone with log access could read a
 * live reset token. The outbox keeps the same substitute-mailbox capability without writing secrets
 * to a log stream.
 *
 * It is off by default and only answers when **both** conditions hold:
 *   - EMAIL_OUTBOX_ENABLED=1 (set only by the disposable e2e stack), and
 *   - email delivery is in `log` mode, so nothing here was ever going to a real recipient.
 *
 * A production stack satisfies neither, and the controller then answers 404 — the endpoint does not
 * exist as far as any caller can tell.
 */
@Injectable()
export class EmailOutboxService {
  private readonly messages: OutboxMessage[] = [];

  constructor(private readonly config: AppConfigService) {}

  get enabled(): boolean {
    return this.config.emailOutboxEnabled && this.config.emailDeliveryMode === "log";
  }

  record(message: OutboxMessage): void {
    if (!this.enabled) return;
    this.messages.push(message);
    // Bounded so a long-running stack cannot grow this without limit; only recent messages matter
    // to a test that is polling for the one it just triggered.
    if (this.messages.length > 200) this.messages.splice(0, this.messages.length - 200);
  }

  /** Newest first. An address filter is an exact, case-insensitive match. */
  list(to?: string): OutboxMessage[] {
    const wanted = to?.trim().toLowerCase();
    return this.messages
      .filter((message) => !wanted || message.to.trim().toLowerCase() === wanted)
      .slice()
      .reverse();
  }

  clear(): void {
    this.messages.length = 0;
  }
}
