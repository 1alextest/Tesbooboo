#!/usr/bin/env node
/**
 * Stripe *read-only* wire fixture for the isolated GitHub Actions tesbo_ci stack.
 * This is not an emulator of payment processing: no writes, no synthetic subscriptions,
 * no hosted checkout, and no claim of live Stripe interoperability. Prices use fixed
 * synthetic IDs/amounts. The real Stripe SDK, billing service, database and UI run unchanged.
 */
import { createServer } from "node:http";

const HOST = "127.0.0.1";
const PORT = 9977;
const TOKEN = "Bearer sk_test_tesbo_ci";
const PRICES = new Map([
  ["price_tesbo_ci_monthly_usd", { unit_amount: 2500, interval: "month" }],
  ["price_tesbo_ci_annual_usd", { unit_amount: 25000, interval: "year" }]
]);

function send(res, status, value) {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(value));
}

createServer((req, res) => {
  const url = new URL(req.url || "/", "http://" + HOST + ":" + PORT);
  if (req.method === "GET" && url.pathname === "/health") {
    send(res, 200, { ready: true, writesEnabled: false, fixture: "stripe-price-readonly" });
    return;
  }
  if (req.headers.authorization !== TOKEN) {
    send(res, 401, { error: { type: "invalid_request_error", message: "Fixture authentication refused" } });
    return;
  }
  if (req.method !== "GET") {
    console.error("Read-only Stripe CI fixture refused a write:", req.method, url.pathname);
    send(res, 405, { error: { type: "invalid_request_error", message: "Stripe writes are disabled in the CI fixture" } });
    return;
  }
  const price = /^\/v1\/prices\/(price_tesbo_ci_(?:monthly|annual)_usd)$/.exec(url.pathname);
  if (price && url.search === "" && PRICES.has(price[1])) {
    const data = PRICES.get(price[1]);
    send(res, 200, {
      id: price[1], object: "price", active: true, currency: "usd",
      unit_amount: data.unit_amount, livemode: false, type: "recurring",
      recurring: { interval: data.interval, interval_count: 1 },
      product: "prod_tesbo_ci_only"
    });
    return;
  }
  if (url.pathname === "/v1/invoices" && url.searchParams.has("customer")) {
    // A read-only empty result; no invoice or real payment is invented.
    send(res, 200, { object: "list", data: [], has_more: false, url: "/v1/invoices" });
    return;
  }
  console.error("Read-only Stripe CI fixture refused an unknown path:", req.method, url.pathname);
  send(res, 404, { error: { type: "invalid_request_error", message: "No such fixture resource" } });
}).listen(PORT, HOST, () => console.log("Read-only Stripe price fixture bound to loopback", PORT));
