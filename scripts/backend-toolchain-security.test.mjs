import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const backend = fileURLToPath(new URL("../Tesbo-Backend-Nest/", import.meta.url));
const requireBackend = createRequire(join(backend, "package.json"));
const from = (name) => createRequire(requireBackend.resolve(`${name}/package.json`));
const cli = from("@nestjs/cli"), devkit = from("@angular-devkit/core");
const yaml3 = from("@istanbuljs/load-nyc-config").resolve("js-yaml");
const yaml4 = requireBackend.resolve("js-yaml");
const lock = JSON.parse(readFileSync(join(backend, "package-lock.json"), "utf8"));
const semver = requireBackend("semver");

function bounded(source, args = [], timeout = 8000, options = {}) {
  const child = spawnSync(process.execPath, ["--eval", source, ...args], {
    cwd: backend, encoding: "utf8", timeout, maxBuffer: 2 * 1024 * 1024, ...options,
  });
  assert.ifError(child.error);
  assert.equal(child.signal, null, `${child.signal}: ${child.stderr}`);
  assert.equal(child.status, 0, child.stdout + child.stderr);
  return child.stdout;
}

test("patched development tree preserves approved compiler/lint owners and removes the legacy editor/tmp chain", () => {
  for (const [name, version] of Object.entries({
    "@nestjs/cli": "10.4.9", "@nestjs/schematics": "10.2.3", "@angular-devkit/core": "17.3.11",
    "@angular-devkit/schematics": "17.3.11", "@angular-devkit/schematics-cli": "17.3.11",
    "@nestjs/common": "10.4.22", "@nestjs/core": "10.4.22", "@nestjs/platform-express": "10.4.22",
    typescript: "5.9.3", jest: "29.7.0", "ts-jest": "29.4.11",
    "@stryker-mutator/core": "10.1.1", "@stryker-mutator/jest-runner": "10.1.1",
    eslint: "9.39.4", "@typescript-eslint/parser": "8.59.4", "@typescript-eslint/eslint-plugin": "8.59.4",
  })) assert.equal(lock.packages[`node_modules/${name}`].version, version, name);
  for (const [path, pkg] of Object.entries(lock.packages)) {
    for (const [name, range] of Object.entries({
      handlebars: ">=4.7.10 <5", browserslist: ">=4.28.7 <5", "form-data": ">=4.0.6 <5",
      "js-yaml": ">=3.15.2 <4 || >=4.3.2 <5", picomatch: ">=2.3.2 <3 || >=3.0.2 <4 || >=4.0.4 <5", tmp: ">=0.2.6 <0.3",
    })) {
      if (path.endsWith(`/node_modules/${name}`) || path === `node_modules/${name}`) {
        assert(semver.satisfies(pkg.version, range), `${path}@${pkg.version} is not a patched supported line`);
        if (name !== "tmp" && name !== "picomatch") assert.equal(pkg.dev, true, `${path} must not enter the production tree`);
      }
    }
    assert(path !== "node_modules/external-editor" && !path.endsWith("/node_modules/external-editor"), `Legacy external-editor must not return: ${path}`);
  }
  assert.equal(cli("inquirer/package.json").version, "8.2.7");
  assert.equal(from("@angular-devkit/schematics-cli")("inquirer/package.json").version, "9.3.8");
  assert.equal(devkit("picomatch/package.json").version, "4.0.4");
  for (const name of ["anymatch", "readdirp"]) {
    assert.equal(from(name)("picomatch/package.json").version, "2.3.2", `${name} must keep its supported 2.x API`);
  }
});

test("Handlebars rejects the advisory's AST blockParams type confusion before any local sentinel executes", () => {
  const handlebars = requireBackend("handlebars");
  const ast = handlebars.parse("{{#if ok}}ordinary{{/if}}");
  ast.body[0].program.blockParams = { length: "(globalThis.__tesboCompilerProbe = 1)" };
  delete globalThis.__tesboCompilerProbe;
  try {
    let refusal;
    try { handlebars.compile(ast)({ ok: true }); } catch (error) { refusal = error; }
    assert.equal(globalThis.__tesboCompilerProbe, undefined, "untrusted AST must not execute JavaScript");
    assert(refusal instanceof Error, "invalid AST must be refused");
    assert.throws(() => handlebars.precompile(ast));
    assert.equal(handlebars.compile("Hello {{name}}")({ name: "café <script>" }), "Hello café &lt;script&gt;");
  } finally { delete globalThis.__tesboCompilerProbe; }
});

test("Handlebars own-property lookup cannot expose Function through a prototype's constructor", () => {
  const handlebars = requireBackend("handlebars");
  const template = handlebars.compile('{{lookup target "constructor"}}');
  assert.equal(template({ target: Function.prototype }, { allowProtoMethodsByDefault: true }), "");
  assert.equal(handlebars.compile('{{lookup target "ordinary"}}')({ target: { ordinary: "preserved" } }), "preserved");
});

test("multipart names and filenames escape CR/LF/quotes without changing ordinary fields or bytes", () => {
  const FormData = from("superagent")("form-data");
  const form = new FormData();
  form.append('field"\r\nX-CI-Probe: field\r\nend="', "field value");
  form.append("files[0]", Buffer.from("café 漢字\u0000bytes"), { filename: 'fixture"\r\nX-CI-Probe: file\r\nend=".txt' });
  const body = form.getBuffer().toString("utf8");
  assert(!body.includes("\r\nX-CI-Probe:"), "input must not become a multipart header");
  assert(body.includes("%22%0D%0AX-CI-Probe: field%0D%0Aend=%22"));
  assert(body.includes("%22%0D%0AX-CI-Probe: file%0D%0Aend=%22.txt"));
  assert(body.includes('name="files[0]"'));
  assert(body.includes("field value"));
  assert(body.includes("café 漢字\u0000bytes"));
});

test("Browserslist tolerates prototype-shaped custom stats without inherited lookups or prototype mutation", () => {
  const browserslist = requireBackend("browserslist");
  const before = Object.getOwnPropertyDescriptors(Object.prototype);
  for (const key of ["__proto__", "toString", "valueOf", "constructor", "hasOwnProperty", "isPrototypeOf"]) {
    const stats = JSON.parse(JSON.stringify({ [key]: { onekey: 5 }, chrome: { "100": 50 } }));
    assert.deepEqual(browserslist("chrome 100", { stats, path: backend }), ["chrome 100"]);
  }
  assert.deepEqual(Object.getOwnPropertyDescriptors(Object.prototype), before);
});

test("Browserslist evicts old query results instead of retaining every distinct query indefinitely", () => {
  bounded(`
    const assert = require('node:assert/strict'), browserslist = require(process.argv[1]);
    const first = browserslist('chrome 100');
    assert.equal(browserslist('chrome 100'), first);
    for (let i = 0; i < 1200; i++) {
      const year = 1800 + Math.floor(i / 336), month = 1 + Math.floor((i % 336) / 28), day = 1 + (i % 28);
      browserslist('since ' + year + '-' + month + '-' + day);
    }
    const after = browserslist('chrome 100');
    assert.deepEqual(after, first);
    assert.notEqual(after, first, 'the oldest result must have been evicted, not retained forever');
  `, [requireBackend.resolve("browserslist")]);
});

test("Picomatch's actual Devkit dependency bounds adversarial extglobs and retains ordinary file matching", () => {
  bounded(`
    const assert = require('node:assert/strict'), picomatch = require(process.argv[1]);
    for (const pattern of ['+(a|aa)', '+(*|?)', '+(+(a))', '*(+(a))', '+(+(+(a)))']) {
      assert.equal(typeof picomatch(pattern)('a'.repeat(44) + '!'), 'boolean');
    }
    const matches = picomatch('src/**/*.ts');
    assert.equal(matches('src/legacy/legacy.service.ts'), true);
    assert.equal(matches('src/legacy/legacy.service.js'), false);
  `, [devkit.resolve("picomatch")]);
});

for (const [line, entry] of [["3.x Istanbul", yaml3], ["4.x lint/config", yaml4]]) {
  test(`YAML ${line} bounds repeated empty merge sources while preserving ordinary aliases and Unicode`, () => {
    bounded(`
      const assert = require('node:assert/strict'), yaml = require(process.argv[1]);
      const src = 'arr: &arr [' + Array(2000).fill('{}').join(',') + ']\\ntargets:\\n' + '  - <<: *arr\\n'.repeat(200);
      assert.throws(() => yaml.load(src, { maxTotalMergeKeys: 10000 }), /merge/i);
      const ordinary = yaml.load('defaults: &d { name: "café 漢字", enabled: true }\\noverrides:\\n  <<: *d\\n  enabled: false\\n');
      assert.deepEqual(ordinary.overrides, { name: 'café 漢字', enabled: false });
    `, [entry]);
  });
}

function scratch() {
  const root = process.platform === "win32" ? join(tmpdir(), "opencode") : tmpdir();
  mkdirSync(root, { recursive: true });
  return mkdtempSync(join(root, "tesbo-toolchain-"));
}

function nest(args, cwd) {
  const result = spawnSync(process.execPath, [cli.resolve("./bin/nest.js"), ...args], {
    cwd, encoding: "utf8", timeout: 60_000, maxBuffer: 2 * 1024 * 1024,
    env: { ...process.env, NODE_PATH: join(backend, "node_modules"), NO_COLOR: "1" },
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return result.stdout;
}

test("unchanged Nest CLI/Devkit generates in dry-run mode without writing and builds real generated code with both compilers", () => {
  const fixture = scratch();
  try {
    mkdirSync(join(fixture, "src"));
    writeFileSync(join(fixture, "package.json"), JSON.stringify({ name: "tesbo-toolchain-probe", private: true }));
    writeFileSync(join(fixture, "nest-cli.json"), JSON.stringify({ collection: "@nestjs/schematics", sourceRoot: "src" }));
    // The isolated project intentionally has no second node_modules installation. Resolve the
    // real loader from the tested backend tree and keep Nest external, just as an installed
    // project's node-externals configuration does. No compiler/loader is mocked or replaced.
    writeFileSync(join(fixture, "webpack.config.js"), `module.exports = options => ({ ...options,
      resolveLoader: { modules: [${JSON.stringify(join(backend, "node_modules"))}] },
      externals: [...options.externals, ({ request }, callback) => {
        if (request?.startsWith('@nestjs/')) return callback(null, 'commonjs ' + request);
        callback();
      }],
    });`);
    writeFileSync(join(fixture, "tsconfig.json"), JSON.stringify({ compilerOptions: {
      target: "ES2021", module: "commonjs", outDir: "dist", rootDir: "src", skipLibCheck: true,
      experimentalDecorators: true, emitDecoratorMetadata: true, types: [], baseUrl: backend,
      paths: { "@nestjs/*": ["node_modules/@nestjs/*"] },
    } }));
    const args = ["generate", "service", "security-probe", "--flat", "--no-spec", "--skip-import"];
    assert(nest([...args, "--dry-run"], fixture).includes("security-probe.service.ts"));
    assert.deepEqual(readdirSync(join(fixture, "src")), []);
    nest(args, fixture);
    assert(existsSync(join(fixture, "src/security-probe.service.ts")));
    writeFileSync(join(fixture, "src/main.ts"), 'import { SecurityProbeService } from "./security-probe.service"; console.log(new SecurityProbeService().constructor.name);');
    for (const options of [[], ["--webpack"]]) {
      nest(["build", ...options], fixture);
      const result = bounded("require(process.argv[1])", [join(fixture, "dist/main.js")], 8000, {
        env: { ...process.env, NODE_PATH: join(backend, "node_modules") },
      });
      assert(result.includes("SecurityProbeService"));
    }
  } finally { rmSync(fixture, { recursive: true, force: true }); } // Only this test's fresh directory.
});

test("both maintained Inquirer editor paths create and clean their own Unicode temporary files", () => {
  for (const parent of [cli, from("@angular-devkit/schematics-cli")]) {
    const editorRequire = createRequire(parent.resolve("inquirer"));
    const { ExternalEditor } = editorRequire("@inquirer/external-editor");
    const fixture = scratch();
    let editor;
    try {
      editor = new ExternalEditor("café 漢字\nretained input", { dir: fixture, prefix: "tesbo-", postfix: ".txt" });
      assert.equal(dirname(resolve(editor.tempFile)), resolve(fixture));
      assert.equal(readFileSync(editor.tempFile, "utf8"), "café 漢字\nretained input");
      editor.cleanup(); editor = undefined;
      assert.deepEqual(readdirSync(fixture), []);
    } finally { editor?.cleanup(); rmSync(fixture, { recursive: true, force: true }); }
  }
});
