import { Injectable } from "@nestjs/common";
import Stripe from "stripe";
import { AppConfigService } from "../config/app-config.service";

/**
 * A disposable CI stack can exercise the real billing API through the Stripe SDK against a
 * deliberately read-only loopback transport. Never accept an arbitrary host or secret override:
 * the fixed endpoint and all identifying conditions must match the GitHub Actions test stack.
 * Live deployments keep the ordinary Stripe transport, unchanged.
 */
@Injectable()
export class StripeClientProvider {
  readonly client: Stripe;

  constructor(config: AppConfigService) {
    const ciFixtureRequested = process.env.TESBO_CI_STRIPE_READONLY_FIXTURE === "1";
    if (ciFixtureRequested) {
      const permitted =
        process.env.CI === "true" &&
        process.env.GITHUB_ACTIONS === "true" &&
        config.databaseUrl === "postgresql://postgres:postgres@localhost:5432/tesbo_ci" &&
        config.stripeSecretKey === "sk_test_tesbo_ci" &&
        config.stripePriceIdProMonthly === "price_tesbo_ci_monthly_usd" &&
        config.stripePriceIdProAnnual === "price_tesbo_ci_annual_usd" &&
        !config.stripePriceIdProMonthlyInr &&
        !config.stripePriceIdProAnnualInr;
      if (!permitted) {
        throw new Error("Read-only Stripe CI fixture requires the exact disposable GitHub Actions environment");
      }
      this.client = new Stripe(config.stripeSecretKey, {
        host: "127.0.0.1", port: 9977, protocol: "http", maxNetworkRetries: 0
      });
      return;
    }
    this.client = new Stripe(config.stripeSecretKey || "sk_test_not_configured");
  }
}
