import { Controller, Delete, Get, Header, NotFoundException, Query } from "@nestjs/common";
import { EmailOutboxService } from "./email-outbox.service";

/**
 * Test-only mailbox. See EmailOutboxService for why it exists and what gates it.
 *
 * Every method answers 404 unless the outbox is enabled, so on a normal stack this route is
 * indistinguishable from one that was never registered. It is unauthenticated by design: the
 * disposable e2e backend runs on a loopback address in CI, and the suite usually calls it before
 * any session exists — it is reading the OTP that creates one.
 */
@Controller("/api/test/email-outbox")
export class EmailOutboxController {
  constructor(private readonly outbox: EmailOutboxService) {}

  @Get()
  @Header("Cache-Control", "no-store")
  list(@Query("to") to?: string) {
    if (!this.outbox.enabled) throw new NotFoundException();
    return { messages: this.outbox.list(to) };
  }

  @Delete()
  clear() {
    if (!this.outbox.enabled) throw new NotFoundException();
    this.outbox.clear();
    return { cleared: true };
  }
}
