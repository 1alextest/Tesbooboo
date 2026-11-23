#!/usr/bin/env node
// Exercise the command Compose will use in the already-built production image.
// This checks executable compatibility and fail-fast configuration, not migrations.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";

const image = process.argv[2] ?? "tesbo-backend:ci";
const missingDatabase = "DATABASE_URL is required; the migrator never defaults to a local database.";

function docker(args, options = {}) {
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
    ...options,
  });
  if (result.error) throw result.error;
  assert.equal(result.signal, null, `Docker command terminated by ${result.signal}`);
  return result;
}

function isolatedRun(command, options = []) {
  const name = `tesbo-migrator-contract-${randomUUID()}`;
  try {
    return docker([
      "run", "--rm", "--name", name, "--network", "none", "--read-only",
      "--env", "DATABASE_URL=", "--env", "DATABASE_USER=", "--env", "DATABASE_PASSWORD=",
      ...options, image, ...command,
    ]);
  } finally {
    // Also clean up after a timeout: killing the Docker client need not stop its container.
    spawnSync("docker", ["rm", "--force", name], { encoding: "utf8", timeout: 10_000 });
  }
}

// Resolve only configuration; never start Compose services or load a local .env.
const resolved = docker([
  "compose", "--env-file", "/dev/null", "-f", "docker-compose.yml", "config", "--format", "json",
], { env: { ...process.env, DATABASE_URL: "", DATABASE_USER: "", DATABASE_PASSWORD: "" } });
assert.equal(resolved.status, 0, `Compose configuration failed: ${resolved.stderr}`);
const migrator = JSON.parse(resolved.stdout).services?.migrator;
assert.ok(migrator, "Compose must define its existing migrator service");
assert.equal(path.resolve(migrator.build?.context ?? ""), path.resolve("Tesbo-Backend-Nest"),
  "The contract image must match the Compose migrator build context");
assert.equal(migrator.build?.dockerfile ?? "Dockerfile", "Dockerfile");
assert.ok(!migrator.build?.target || migrator.build.target === "runtime",
  "The contract must exercise the production runtime stage");
assert.ok(!migrator.entrypoint, "Update this contract to exercise any explicit Compose entrypoint");
assert.ok(Array.isArray(migrator.command) && migrator.command.length > 0 &&
  migrator.command.every((part) => typeof part === "string" && part.length > 0),
  "Compose must resolve a nonempty migrator command array");

const managers = isolatedRun([
  "-ec", "if command -v npm >/dev/null 2>&1 || command -v npx >/dev/null 2>&1; then exit 1; fi; test ! -e /usr/local/lib/node_modules/npm",
], ["--entrypoint", "sh"]);
assert.equal(managers.status, 0, `Runtime package-manager removal regressed: ${managers.stderr}`);
console.log("PASS: npm and npx remain absent from the production runtime image.");

const result = isolatedRun(migrator.command);
assert.equal(result.status, 1,
  `Configured migrator must reach its missing-DATABASE_URL guard (exit ${result.status}): ${result.stderr}`);
assert.equal(result.stderr.trim(), missingDatabase,
  `Configured migrator did not reach its existing configuration guard: ${result.stderr}`);
assert.equal(result.stdout.trim(), "", "Unexpected output before configuration refusal");
console.log("PASS: the Compose migrator command reaches the compiled owner's configuration guard.");
console.log("No database connection, Compose startup, credentials or shared mounts were used.");
