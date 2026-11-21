"use strict";

// Clear exactly one disposable billing tenant's entitlement cache after direct SQL fixtures.
// The production owner invalidates this key on its own writes; Postgres-only E2E setup cannot.
const net = require("node:net");

const organizationId = process.argv[2];
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(organizationId || "")) {
  throw new Error("Expected exactly one organization UUID");
}
const location = new URL(process.env.E2E_REDIS_URL || process.env.REDIS_URL || "redis://127.0.0.1:6379");
if (
  location.protocol !== "redis:" ||
  !["localhost", "127.0.0.1"].includes(location.hostname) ||
  location.username || location.password ||
  (location.pathname && location.pathname !== "/" && location.pathname !== "/0")
) {
  throw new Error("Billing E2E cache invalidation requires unauthenticated loopback Redis database 0");
}
const key = `entitlement:${organizationId}`;
let received = "";
let acknowledged = false;
const socket = net.createConnection({ host: location.hostname, port: Number(location.port || "6379") });
socket.setTimeout(3000);
socket.on("connect", () => {
  socket.write(`*2\r\n$3\r\nDEL\r\n$${Buffer.byteLength(key)}\r\n${key}\r\n`);
});
socket.on("data", (data) => {
  received += data.toString("utf8");
  if (!received.includes("\r\n")) return;
  if (!/^:[01]\r\n$/.test(received)) {
    console.error("Redis did not acknowledge exact-key entitlement invalidation");
    process.exitCode = 1;
  } else {
    acknowledged = true;
  }
  socket.end();
});
socket.on("timeout", () => {
  console.error("Timed out invalidating billing E2E entitlement cache");
  socket.destroy();
  process.exitCode = 1;
});
socket.on("error", (error) => {
  console.error(`Cannot invalidate billing E2E entitlement cache: ${error.code || error.message}`);
  process.exitCode = 1;
});
socket.on("close", () => {
  if (!acknowledged) process.exitCode = 1;
});
