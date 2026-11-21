// Exercise the publish boundary, not dist-test or a checkout symlink. Build explicitly beforehand;
// neither packing nor installing is allowed to repair missing production artifacts.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { PROJECT, TOKEN, RUN, CASE, withIngest, runNode, runPlaywrightFixture } = require("../test-support/reporter.cjs");
const { consumerTempRoot } = require("../test-support/temp.cjs");

const PACKAGE = "@tesbox/playwright-reporter";
const BINS = ["playwright-reporter", "tesbo-playwright"];
const TOOLING = ["@playwright/test", "playwright", "playwright-core", "typescript", "@types/node", "undici-types"];
const packageDir = path.resolve(__dirname, "..");

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function successful(label, args, options) {
  const result = await runNode(args, options);
  assert.equal(result.code, 0, `${label} failed:\n${result.output}`);
  return result.output;
}

function inside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`));
}

async function main() {
  const manifest = await readJson(path.join(packageDir, "package.json"));
  assert.equal(manifest.name, PACKAGE);
  const artifacts = [manifest.main, manifest.types, ...BINS.map((name) => {
    assert.equal(manifest.bin[name], "dist/cli.js", `missing or unexpected bin mapping: ${name}`);
    return manifest.bin[name];
  })];
  for (const artifact of new Set(artifacts)) {
    assert.equal(typeof artifact, "string", "package entrypoints must be declared");
    assert.ok((await fs.stat(path.join(packageDir, artifact))).isFile(), `missing production artifact: ${artifact}; run npm run build first`);
  }
  const npmCli = process.env.npm_execpath;
  assert.ok(npmCli && (await fs.stat(npmCli)).isFile(), "run this smoke with npm run test:package-consumer");

  const root = await fs.mkdtemp(path.join(consumerTempRoot(), "tesbo package consumer-"));
  try {
    assert.equal(inside(await fs.realpath(path.resolve(packageDir, "../..")), await fs.realpath(root)), false,
      "consumer must be outside the repository; choose an external TMPDIR/TEMP");
    const consumer = path.join(root, "fresh consumer");
    await fs.mkdir(consumer);
    console.log("[package-consumer] external consumer created (path includes spaces)");

    // No SDK secrets, module-resolution escape hatches, inherited npm auth/config, or install scripts.
    const env = { ...process.env };
    for (const key of Object.keys(env)) {
      if (/^(TESBO_|npm_|NPM_TOKEN$|NODE_AUTH_TOKEN$|NODE_PATH$|NODE_OPTIONS$)/i.test(key)) delete env[key];
    }
    env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
    env.CI = "1";
    const userconfig = path.join(root, "empty user.npmrc");
    const globalconfig = path.join(root, "empty global.npmrc");
    await fs.writeFile(userconfig, "");
    await fs.writeFile(globalconfig, "");
    const npmOptions = [
      "--ignore-scripts", "--no-audit", "--no-fund",
      "--registry=https://registry.npmjs.org",
      `--userconfig=${userconfig}`, `--globalconfig=${globalconfig}`,
      `--cache=${path.join(root, "npm cache")}`, "--fetch-retries=0", "--fetch-timeout=30000"
    ];
    const packed = JSON.parse(await successful("npm pack", [
      npmCli, "pack", "--json", "--pack-destination", root, ...npmOptions
    ], { cwd: packageDir, env, timeout: 30_000 }));
    assert.equal(packed.length, 1);
    assert.equal(path.basename(packed[0].filename), packed[0].filename);
    const packedFiles = new Set(packed[0].files.map((file) => file.path));
    for (const artifact of artifacts) assert.ok(packedFiles.has(artifact), `tarball omitted ${artifact}`);
    console.log("[package-consumer] real npm pack contains main, declarations and CLI");

    // Exact public tooling versions (including its non-optional closure) come from the SDK lockfile.
    // The consumer has its own installation: never reuse or link checkout node_modules.
    const lock = await readJson(path.join(packageDir, "package-lock.json"));
    const dependencies = { [PACKAGE]: `file:../${packed[0].filename}` };
    for (const name of TOOLING) {
      const version = lock.packages[`node_modules/${name}`]?.version;
      assert.match(version ?? "", /^\d+\.\d+\.\d+$/, `no exact locked version for ${name}`);
      dependencies[name] = version;
    }
    await fs.writeFile(path.join(consumer, "package.json"), JSON.stringify({
      name: "tesbo-packed-consumer-smoke", version: "1.0.0", private: true, dependencies
    }, null, 2));
    await successful("isolated npm install", [
      npmCli, "install", "--omit=optional", ...npmOptions
    ], { cwd: consumer, env, timeout: 180_000 });

    const installed = path.join(consumer, "node_modules", "@tesbox", "playwright-reporter");
    assert.equal((await fs.lstat(installed)).isSymbolicLink(), false, "tarball must be installed, not linked to the checkout");
    const installedManifest = await readJson(path.join(installed, "package.json"));
    assert.equal(installedManifest.version, manifest.version);
    for (const artifact of artifacts) assert.ok((await fs.stat(path.join(installed, artifact))).isFile(), `installed package omitted ${artifact}`);
    for (const name of TOOLING) {
      assert.equal((await readJson(path.join(consumer, "node_modules", name, "package.json"))).version, dependencies[name]);
    }

    for (const name of ["consumer.cjs", "consumer.mjs", "consumer.cts", "consumer.mts", "tsconfig.json"]) {
      await fs.writeFile(path.join(consumer, name), await fs.readFile(path.join(packageDir, "test-support", "consumer", name)));
    }
    for (const name of ["consumer.cjs", "consumer.mjs"]) {
      await successful(name, [path.join(consumer, name)], { cwd: consumer, env });
    }
    console.log("[package-consumer] package-name CommonJS and native ESM imports passed");
    await successful("consumer declarations", [
      path.join(consumer, "node_modules", "typescript", "bin", "tsc"), "-p", path.join(consumer, "tsconfig.json")
    ], { cwd: consumer, env, timeout: 30_000 });
    console.log("[package-consumer] strict CJS/ESM TypeScript consumers compiled (skipLibCheck=false)");

    for (const name of BINS) {
      assert.equal(installedManifest.bin[name], manifest.bin[name], `installed bin missing: ${name}`);
      const target = path.join(installed, installedManifest.bin[name]);
      const shim = path.join(consumer, "node_modules", ".bin", name);
      let executable = shim;
      if (process.platform === "win32") {
        // .cmd files cannot be execFile'd with shell=false. Verify each npm-generated alias points
        // at the installed target, then run that exact JS file with Node, never cmd.exe.
        const cmd = await fs.readFile(`${shim}.cmd`, "utf8");
        const relativeTarget = path.relative(path.dirname(shim), target).replaceAll("/", "\\");
        assert.ok(cmd.includes(`"%dp0%\\${relativeTarget}"`), `incorrect Windows bin shim: ${name}`);
        executable = target;
      } else {
        assert.equal(await fs.realpath(shim), await fs.realpath(target), `incorrect bin symlink: ${name}`);
        await fs.access(shim, require("node:fs").constants.X_OK);
      }
      assert.match(await fs.readFile(target, "utf8"), /^#!\/usr\/bin\/env node\r?\n/);
      const help = await successful(`${name} --help`, [executable, "--help"], { cwd: consumer, env });
      assert.match(help, /init/);
      assert.match(help, /doctor/);
      const version = await successful(`${name} --version`, [executable, "--version"], { cwd: consumer, env });
      assert.equal(version.trim(), manifest.version);
    }
    console.log("[package-consumer] both installed bin aliases expose harmless help/version");

    await withIngest("accepted", async (baseUrl, calls, fixture) => {
      const result = await runPlaywrightFixture({
        dir: consumer, reporter: PACKAGE, playwrightTest: "@playwright/test",
        playwrightCli: path.join(consumer, "node_modules", "@playwright", "test", "cli.js"),
        reporterOptions: {
          baseUrl, projectId: PROJECT, token: TOKEN, runName: "packed consumer smoke",
          strict: true, requireConfig: true, attachEvidence: "never", retries: 1, timeoutMs: 1_000
        },
        env
      });
      assert.equal(result.code, 0, result.output);
      const prefix = `/api/projects/${PROJECT}/automation`;
      assert.deepEqual(calls.map((call) => `${call.method} ${call.url}`), [
        `POST ${prefix}/cases/resolve`, `POST ${prefix}/runs`,
        `POST ${prefix}/runs/${RUN}/results`, `PATCH ${prefix}/runs/${RUN}/close`
      ], result.output);
      assert.deepEqual(calls[0].body, { caseIds: [CASE] });
      assert.deepEqual(calls[1].body.caseIds, [CASE]);
      assert.equal(calls[2].body.caseId, CASE);
      assert.equal(calls[2].body.status, "pass");
      assert.equal(calls[2].body.retryCount, 0);
      assert.deepEqual(calls[3].body, { status: "completed", summary: { total: 1, passed: 1, failed: 0, skipped: 0 } });
      assert.equal(fixture.closureApplied, true);
      assert.match(result.output, /reporting 1 linked test\(s\) to run/);
      assert.match(result.output, /closed \(completed\): 1 passed, 0 failed, 0 skipped/);
      assert.doesNotMatch(result.output, /closure unconfirmed|request\(s\) to Tesbo failed/);
      assert.equal(result.output.includes(TOKEN), false, "fixture token must not be logged");
    });
    console.log("[package-consumer] browser-free Playwright resolve/open/result/close passed");
  } finally {
    await fs.rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); // Only this script's mkdtemp.
  }
}

main().catch((error) => {
  console.error("[package-consumer] FAILED:", error.message);
  process.exitCode = 1;
});
