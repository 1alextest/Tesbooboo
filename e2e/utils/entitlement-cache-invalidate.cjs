"use strict";

// Clear exactly one disposable fixture's cache entry. The default remains the billing tenant's
// entitlement cache; the only optional selector is the project's TTL-only overview aggregate.
// This does not change production invalidation or prove that a production TTL has elapsed.
const net = require("node:net");

const selector = process.argv[3];
if (process.argv.length > 4 || (selector !== undefined && selector !== "project-overview")) {
  throw new Error("The only supported optional cache selector is project-overview");
}
const ownerId = process.argv[2];
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ownerId || "")) {
  throw new Error(selector === "project-overview" ? "Expected exactly one project UUID" : "Expected exactly one organization UUID");
}
const location = new URL(process.env.E2E_REDIS_URL || process.env.REDIS_URL || "redis://127.0.0.1:6379");
if (
  location.protocol !== "redis:" ||
  !["localhost", "127.0.0.1"].includes(location.hostname) ||
  location.username || location.password ||
  (location.pathname && location.pathname !== "/" && location.pathname !== "/0")
) {
  throw new Error("Disposable E2E cache invalidation requires unauthenticated loopback Redis database 0");
}
const key = selector === "project-overview" ? `project-overview:${ownerId}` : `entitlement:${ownerId}`;
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
    console.error("Redis did not acknowledge exact-key cache invalidation");
    process.exitCode = 1;
  } else {
    acknowledged = true;
  }
  socket.end();
});
socket.on("timeout", () => {
  console.error("Timed out invalidating disposable E2E cache");
  socket.destroy();
  process.exitCode = 1;
});
socket.on("error", (error) => {
  console.error(`Cannot invalidate disposable E2E cache: ${error.code || error.message}`);
  process.exitCode = 1;
});
socket.on("close", () => {
  if (!acknowledged) process.exitCode = 1;
});
