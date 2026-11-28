import { EmailService } from "./email.service";
import { AppConfigService } from "../config/app-config.service";
import { EmailDeliveryPolicy } from "../config/email-delivery.policy";
import { EmailOutboxService } from "./email-outbox.service";

/**
 * EmailService.sendInvite builds the accept-invite email and (when delivery is permitted) posts it to
 * Postmark. No real network calls — fetch is mocked, matching the "no real Postgres / no real
 * network" rule for this suite.
 *
 * These build-the-email tests run in "live" mode so that the only fetch call in play is the send
 * itself: log mode first asks Postmark what kind of server the token belongs to, which is a second
 * call and is covered on its own in config/email-delivery.policy.spec.ts and in the log-mode block
 * at the bottom of this file.
 */
function makeService(configOverrides: Partial<Record<string, unknown>> = {}) {
  const config = {
    postmarkApiToken: "",
    postmarkFromEmail: "noreply@tesbo.io",
    otpExpiryMinutes: 10,
    emailDeliveryMode: "live",
    ...configOverrides
  } as unknown as AppConfigService;
  const outbox = new EmailOutboxService(config);
  return { svc: new EmailService(config, new EmailDeliveryPolicy(config), outbox), outbox };
}

describe("EmailService.sendInvite", () => {
  const originalFetch = global.fetch;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    logSpy.mockRestore();
  });

  it("records the accept link in the outbox instead of sending mail when no Postmark token is configured", async () => {
    global.fetch = jest.fn();
    const { svc, outbox } = makeService({ postmarkApiToken: "", emailDeliveryMode: "log", emailOutboxEnabled: true });

    await svc.sendInvite("bob@example.com", "Alice", "qa_engineer", "Acme Corp", "raw-token-123", [], "https://app.tesbo.io");

    expect(global.fetch).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith("[email] communication not posted (log mode)");
    const recorded = outbox.list("bob@example.com");
    expect(recorded).toHaveLength(1);
    expect(recorded[0].text).toContain("https://app.tesbo.io/invite/raw-token-123");
  });

  it("posts to Postmark with the accept URL, role label, and project names when a token is configured", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, text: jest.fn() });
    global.fetch = fetchMock as unknown as typeof fetch;
    const { svc } = makeService({ postmarkApiToken: "pm-token", postmarkFromEmail: "noreply@tesbo.io" });

    await svc.sendInvite(
      "bob@example.com",
      "Alice",
      "manager",
      "Acme Corp",
      "raw-token-123",
      ["Website", "Mobile"],
      "https://app.tesbo.io"
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.postmarkapp.com/email");
    expect(init.headers["X-Postmark-Server-Token"]).toBe("pm-token");
    const body = JSON.parse(init.body);
    expect(body.From).toBe("noreply@tesbo.io");
    expect(body.To).toBe("bob@example.com");
    expect(body.Subject).toBe("You have been invited to join Acme Corp");
    expect(body.TextBody).toContain("https://app.tesbo.io/invite/raw-token-123");
    expect(body.TextBody).toContain("Manager"); // role label mapping: manager -> "Manager"
    expect(body.HtmlBody).toContain("Website");
    expect(body.HtmlBody).toContain("Mobile");
  });

  it("labels any non-manager role as 'QA Engineer'", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, text: jest.fn() });
    global.fetch = fetchMock as unknown as typeof fetch;
    const { svc } = makeService({ postmarkApiToken: "pm-token" });

    await svc.sendInvite("bob@example.com", "Alice", "qa_engineer", "Acme Corp", "raw-token", [], "https://app.tesbo.io");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.TextBody).toContain("QA Engineer");
  });

  it("throws when Postmark rejects the request, surfacing the status and body", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 422, text: jest.fn().mockResolvedValue("Invalid From address") });
    global.fetch = fetchMock as unknown as typeof fetch;
    const { svc } = makeService({ postmarkApiToken: "pm-token" });

    await expect(
      svc.sendInvite("bob@example.com", "Alice", "qa_engineer", "Acme Corp", "raw-token", [], "https://app.tesbo.io")
    ).rejects.toThrow("Postmark returned 422: Invalid From address");
  });
});

/**
 * What a local or CI stack actually does. EMAIL_DELIVERY_MODE=log is the default, so this is the
 * configuration the e2e suite and every developer machine runs under, and the one that has to be
 * incapable of bouncing mail off the addresses the suite invents.
 */
describe("EmailService in log mode (the default: local, CI, e2e)", () => {
  const originalFetch = global.fetch;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  function makeLogModeService(serverDeliveryType: string) {
    const config = {
      postmarkApiToken: "pm-token",
      postmarkFromEmail: "noreply@tesbo.io",
      otpExpiryMinutes: 10,
      emailDeliveryMode: "log",
      emailOutboxEnabled: true
    } as unknown as AppConfigService;
    // First call is the server-type probe, every later one is a send.
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue({ DeliveryType: serverDeliveryType }) })
      .mockResolvedValue({ ok: true, text: jest.fn() });
    global.fetch = fetchMock as unknown as typeof fetch;
    const outbox = new EmailOutboxService(config);
    return { svc: new EmailService(config, new EmailDeliveryPolicy(config), outbox), outbox, fetchMock };
  }

  function sends(fetchMock: jest.Mock) {
    return fetchMock.mock.calls.filter(([url]) => url === "https://api.postmarkapp.com/email");
  }

  beforeEach(() => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("records the OTP in the outbox and never emails it, even with a sandbox server available", async () => {
    const { svc, outbox, fetchMock } = makeLogModeService("Sandbox");

    await svc.sendOtp("bob@example.com", "123456");

    // The log line carries the kind and outcome only — never the code.
    expect(logSpy).toHaveBeenCalledWith("[email] otp not posted (log mode)");
    expect(outbox.list("bob@example.com")[0]?.text).toContain("verification code is 123456");
    expect(fetchMock).not.toHaveBeenCalled(); // not even the probe: the answer can't change the outcome
  });

  it("replays an invite through the sandbox server and records the accept link", async () => {
    const { svc, outbox, fetchMock } = makeLogModeService("Sandbox");

    await svc.sendInvite("bob@example.com", "Alice", "manager", "Acme Corp", "raw-token-123", [], "https://app.tesbo.io");

    // Posted for real, so the template and the Postmark API path are genuinely exercised — and
    // delivered to nobody, because a sandbox server never delivers.
    expect(sends(fetchMock)).toHaveLength(1);
    const body = JSON.parse(sends(fetchMock)[0][1].body);
    expect(body.TextBody).toContain("https://app.tesbo.io/invite/raw-token-123");
    // The link the invitee needs is recorded for the suite; the log does not carry it.
    expect(outbox.list("bob@example.com")[0]?.text).toContain("https://app.tesbo.io/invite/raw-token-123");
    expect(logSpy).toHaveBeenCalledWith("[email] communication posted (sandbox)");
  });

  it("sends nothing at all when the configured token turns out to be a LIVE server", async () => {
    const { svc, outbox, fetchMock } = makeLogModeService("Live");

    await svc.sendInvite("bob@example.com", "Alice", "manager", "Acme Corp", "raw-token-123", [], "https://app.tesbo.io");

    expect(sends(fetchMock)).toHaveLength(0);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Blocking delivery"));
    expect(outbox.list("bob@example.com")[0]?.text).toContain("https://app.tesbo.io/invite/raw-token-123");
    expect(logSpy).toHaveBeenCalledWith("[email] communication not posted (log mode)");
  });

  it("blocks billing email against a live server too, without failing the operation behind it", async () => {
    const { svc, outbox, fetchMock } = makeLogModeService("Live");

    // Billing mail is best-effort by design: it fires from Stripe webhooks and upload paths, where a
    // mail problem must not turn a paid invoice into a failed webhook Stripe then retries.
    await svc.sendPaymentFailed("owner@example.com", "Acme Corp", "https://app.tesbo.io/settings", 30);

    expect(sends(fetchMock)).toHaveLength(0);
    expect(outbox.list("owner@example.com")).toHaveLength(1);
    // Outcome only — the recipient and the billing URL stay out of the log.
    expect(logSpy).toHaveBeenCalledWith("[email] communication not posted (log mode)");
  });
});
