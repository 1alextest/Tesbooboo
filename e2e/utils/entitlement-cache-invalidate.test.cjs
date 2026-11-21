"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const net = require("node:net");
const { spawn } = require("node:child_process");
const path = require("node:path");

const script = path.join(__dirname, "entitlement-cache-invalidate.cjs");
const organizationId = "123e4567-e89b-12d3-a456-426614174000";

function invoke(url, id = organizationId) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, id], {
      env: { ...process.env, E2E_REDIS_URL: url, REDIS_URL: "" },
      stdio: ["ignore", "ignore", "pipe"],
    });
    let errors = "";
    child.stderr.on("data", (chunk) => { errors += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, errors }));
  });
}

async function fakeRedis(reply, check) {
  const server = net.createServer((socket) => {
    socket.on("data", (data) => {
      check?.(data.toString());
      socket.end(reply);
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    return await invoke("redis://127.0.0.1:" + server.address().port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("invalidates only the named organization's entitlement key", async () => {
  let command = "";
  const result = await fakeRedis(":1\r\n", (value) => { command = value; });
  assert.equal(result.code, 0, result.errors);
  assert.equal(command, "*2\r\n$3\r\nDEL\r\n$48\r\nentitlement:" + organizationId + "\r\n");
});

test("a missing cache key is an acknowledged no-op, not an error", async () => {
  const result = await fakeRedis(":0\r\n");
  assert.equal(result.code, 0, result.errors);
});

test("rejects unexpected Redis replies rather than treating them as success", async () => {
  const result = await fakeRedis("-ERR no permission\r\n");
  assert.notEqual(result.code, 0);
});

test("rejects non-loopback Redis targets without connecting", async () => {
  const result = await invoke("redis://cache.example.com:6379");
  assert.notEqual(result.code, 0);
  assert.match(result.errors, /loopback Redis/);
});

test("rejects malformed workspace identifiers", async () => {
  const result = await invoke("redis://127.0.0.1:6379", "not-a-uuid");
  assert.notEqual(result.code, 0);
  assert.match(result.errors, /organization UUID/);
});
