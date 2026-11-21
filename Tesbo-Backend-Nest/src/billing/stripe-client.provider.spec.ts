import { AppConfigService } from "../config/app-config.service";
import { StripeClientProvider } from "./stripe-client.provider";

const FIELDS = ["CI", "GITHUB_ACTIONS", "TESBO_CI_STRIPE_READONLY_FIXTURE"] as const;
const original = Object.fromEntries(FIELDS.map(key => [key, process.env[key]]));

function config(overrides: Record<string, unknown> = {}): AppConfigService {
  return {
    databaseUrl: "postgresql://postgres:postgres@localhost:5432/tesbo_ci",
    stripeSecretKey: "sk_test_tesbo_ci",
    stripePriceIdProMonthly: "price_tesbo_ci_monthly_usd",
    stripePriceIdProAnnual: "price_tesbo_ci_annual_usd",
    stripePriceIdProMonthlyInr: undefined,
    stripePriceIdProAnnualInr: undefined,
    ...overrides,
  } as unknown as AppConfigService;
}

afterEach(() => {
  for (const key of FIELDS) {
    const value = original[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("Stripe read-only CI transport boundary", () => {
  it("uses the ordinary Stripe host when the opt-in is absent", () => {
    delete process.env.TESBO_CI_STRIPE_READONLY_FIXTURE;
    const client = new StripeClientProvider(config()).client as unknown as {
      _api: { host: string; protocol: string };
    };
    expect(client._api.host).not.toBe("127.0.0.1");
    expect(client._api.protocol).toBe("https");
  });

  it("refuses a fixture opt-in outside the exact GitHub Actions and disposable database scope", () => {
    process.env.TESBO_CI_STRIPE_READONLY_FIXTURE = "1";
    process.env.CI = "true";
    delete process.env.GITHUB_ACTIONS;
    expect(() => new StripeClientProvider(config())).toThrow(/exact disposable/);
    process.env.GITHUB_ACTIONS = "true";
    for (const invalid of [
      { databaseUrl: "postgresql://postgres:postgres@localhost:5432/tesbo" },
      { stripeSecretKey: "sk_live_example" },
      { stripePriceIdProMonthly: "price_unreviewed" },
      { stripePriceIdProMonthlyInr: "price_unreviewed" },
    ]) {
      expect(() => new StripeClientProvider(config(invalid))).toThrow(/exact disposable/);
    }
  });

  it("routes only the exact opted-in disposable stack to loopback", () => {
    process.env.TESBO_CI_STRIPE_READONLY_FIXTURE = "1";
    process.env.CI = "true";
    process.env.GITHUB_ACTIONS = "true";
    const client = new StripeClientProvider(config()).client as unknown as {
      _api: { host: string; protocol: string; port: number; maxNetworkRetries: number };
    };
    expect(client._api).toMatchObject({
      host: "127.0.0.1", protocol: "http", port: 9977, maxNetworkRetries: 0
    });
  });
});
