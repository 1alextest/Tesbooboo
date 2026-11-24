"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const net = require("node:net");
const { spawn } = require("node:child_process");
const path = require("node:path");

const script = path.join(__dirname, "entitlement-cache-invalidate.cjs");
const organizationId = "123e4567-e89b-12d3-a456-426614174000";

function invoke(url, id = organizationId, ...selectors) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, id, ...selectors], {
      env: { ...process.env, E2E_REDIS_URL: url, REDIS_URL: "" },
      stdio: ["ignore", "ignore", "pipe"],
    });
    let errors = "";
    child.stderr.on("data", (chunk) => { errors += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, errors }));
  });
}

async function fakeRedis(reply, check, ...args) {
  const server = net.createServer((socket) => {
    socket.on("data", (data) => {
      check?.(data.toString());
      socket.end(reply);
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    return await invoke("redis://127.0.0.1:" + server.address().port, ...args);
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

test("invalidates only the named project's overview key when explicitly selected", async () => {
  const projectId = "de305d54-75b4-431b-adb2-eb6b9e546014";
  let command = "";
  const result = await fakeRedis(":1\r\n", (value) => { command = value; }, projectId, "project-overview");
  assert.equal(result.code, 0, result.errors);
  assert.equal(command, "*2\r\n$3\r\nDEL\r\n$53\r\nproject-overview:" + projectId + "\r\n");
});

test("rejects arbitrary cache selectors before sending any Redis command", async () => {
  let sent = false;
  const result = await fakeRedis(":1\r\n", () => { sent = true; }, organizationId, "session");
  assert.notEqual(result.code, 0);
  assert.match(result.errors, /only supported optional cache selector/);
  assert.equal(sent, false);
});

test("rejects extra cache arguments before sending any Redis command", async () => {
  let sent = false;
  const result = await fakeRedis(":1\r\n", () => { sent = true; }, organizationId, "project-overview", "another-key");
  assert.notEqual(result.code, 0);
  assert.match(result.errors, /only supported optional cache selector/);
  assert.equal(sent, false);
});

test("a missing cache key is an acknowledged no-op, not an error", async () => {
  for (const selectors of [[], ["project-overview"]]) {
    const result = await fakeRedis(":0\r\n", undefined, organizationId, ...selectors);
    assert.equal(result.code, 0, result.errors);
  }
});

test("rejects unexpected Redis replies rather than treating them as success", async () => {
  for (const selectors of [[], ["project-overview"]]) {
    const result = await fakeRedis("-ERR no permission\r\n", undefined, organizationId, ...selectors);
    assert.notEqual(result.code, 0);
  }
});

test("rejects non-loopback, credentialed, and nonzero-database Redis targets without connecting", async () => {
  for (const url of ["redis://cache.example.com:6379", "redis://fixture:fixture@127.0.0.1:6379", "redis://127.0.0.1:6379/1"]) {
    for (const selectors of [[], ["project-overview"]]) {
      const result = await invoke(url, organizationId, ...selectors);
      assert.notEqual(result.code, 0);
      assert.match(result.errors, /loopback Redis/);
    }
  }
});

test("rejects malformed workspace and project identifiers", async () => {
  for (const selectors of [[], ["project-overview"]]) {
    const result = await invoke("redis://127.0.0.1:6379", "not-a-uuid", ...selectors);
    assert.notEqual(result.code, 0);
    assert.match(result.errors, selectors.length ? /project UUID/ : /organization UUID/);
  }
});
