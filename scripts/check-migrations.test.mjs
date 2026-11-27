import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  migrationChecksum,
  validateAppendOnly,
  validateMigrationFiles,
  validateMigrationManifest,
  reviewMigrationAllocations,
} from "./check-migrations.mjs";

const checker = fileURLToPath(new URL("./check-migrations.mjs", import.meta.url));
const migrationDirectory = "Tesbo-Backend-Nest/migrations";
const initialFiles = {
  "V1_initial.sql": "SELECT 1;\n",
  "V2_second.sql": "SELECT 2;\n",
};

function fixture(t, files = initialFiles) {
  const tempRoot = process.platform === "win32"
    ? path.join(process.env.LOCALAPPDATA, "Temp", "opencode")
    : os.tmpdir();
  const root = fs.mkdtempSync(path.join(tempRoot, "migration checker "));
  // Only this mkdtemp-created directory is ever removed; never reset a checkout.
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 3 }));
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^GIT_/i.test(name)));
  Object.assign(env, {
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: path.join(root, "no global config"),
    GIT_ATTR_NOSYSTEM: "1",
    GIT_TERMINAL_PROMPT: "0",
    GIT_AUTHOR_NAME: "Migration checker test",
    GIT_AUTHOR_EMAIL: "migration-checker@example.invalid",
    GIT_COMMITTER_NAME: "Migration checker test",
    GIT_COMMITTER_EMAIL: "migration-checker@example.invalid",
  });
  const git = (...args) => execFileSync("git", [
    "-c", "commit.gpgsign=false", "-c", `core.hooksPath=${path.join(root, "no hooks")}`, ...args,
  ], {
    cwd: root, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  git("init", "--quiet");
  git("config", "core.autocrlf", "false");
  const directory = path.join(root, migrationDirectory);
  fs.mkdirSync(directory, { recursive: true });
  const write = (name, content) => fs.writeFileSync(path.join(directory, name), content);
  for (const [name, content] of Object.entries(files)) write(name, content);
  git("add", "--all");
  git("commit", "--quiet", "--allow-empty", "-m", "migration baseline");
  const check = (...args) => {
    const result = spawnSync(process.execPath, [checker, ...args], {
      cwd: root, env, encoding: "utf8",
    });
    assert.ifError(result.error);
    return result;
  };
  return { root, directory, write, git, check, env };
}

function assertFailure(result, pattern) {
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, pattern);
  assert.doesNotMatch(result.stdout, /Validated|passed/);
}

function manifest(files = initialFiles) {
  const result = validateMigrationFiles(Object.entries(files).map(([name, content]) => ({ name, content })));
  assert.deepEqual(result.errors, []);
  return result.manifest;
}

test("pure validators allow unchanged manifests and contiguous append-only additions", () => {
  const base = manifest();
  const appended = manifest({ ...initialFiles, "V3_third.sql": "SELECT 3;\n" });
  assert.deepEqual(validateAppendOnly(base, base), []);
  assert.deepEqual(validateAppendOnly(base, appended), []);
  assert.equal(appended[2].checksum, migrationChecksum("SELECT 3;\n"));
});

test("checksums canonicalize only CRLF, retaining every other byte", () => {
  assert.equal(migrationChecksum("SELECT 1;\r\n\r\n"), migrationChecksum("SELECT 1;\n\n"));
  for (const changed of ["SELECT 1;\r", "SELECT 1;\n ", "\uFEFFSELECT 1;\n", "-- comment\nSELECT 1;\n"]) {
    assert.notEqual(migrationChecksum(changed), migrationChecksum("SELECT 1;\n"));
  }
  assert.notEqual(migrationChecksum(Buffer.from([0xff, 10])), migrationChecksum(Buffer.from([0xfe, 10])));
  assert.equal(migrationChecksum(Buffer.from([0xff, 13, 10])), migrationChecksum(Buffer.from([0xff, 10])));
  assert.throws(() => migrationChecksum(null), /string or Buffer/);
});

test("pure validators reject empty selections and malformed file metadata", () => {
  for (const files of [[], null, undefined, {}, [null], [{ name: "V1_a.sql" }], [{ name: "V1_a.sql", content: 1 }]]) {
    assert.ok(validateMigrationFiles(files).errors.length);
  }
  assert.match(validateMigrationFiles([{ content: "SELECT 1;" }]).errors.join("\n"), /invalid SQL migration filename/);
});

test("pure validators reject malformed manifest metadata instead of treating it as an empty baseline", () => {
  const valid = manifest({ "V1_a.sql": "SELECT 1;" })[0];
  for (const candidate of [
    [], null, {}, [null], [[]],
    [{ ...valid, name: "../V1_a.sql" }],
    [{ ...valid, name: "V1_a.sql\n" }],
    [{ ...valid, version: "1" }],
    [{ ...valid, version: 2 }],
    [{ ...valid, checksum: "" }],
    [{ ...valid, checksum: "g".repeat(64) }],
    [{ ...valid, checksum: `${valid.checksum}\n` }],
    [{ ...valid, checksum: undefined }],
    [{ ...valid, name: "V9007199254740992_huge.sql", version: 9007199254740992 }],
  ]) {
    assert.ok(validateMigrationManifest(candidate).length, JSON.stringify(candidate));
    assert.ok(validateAppendOnly(candidate, [valid]).length);
    assert.ok(validateAppendOnly([valid], candidate).length);
  }
});

test("pure validators detect changed, missing and renamed historical entries", () => {
  const base = manifest();
  assert.match(validateAppendOnly(base, manifest({ ...initialFiles, "V1_initial.sql": "SELECT 9;" })).join("\n"), /content changed/);
  assert.match(validateAppendOnly(base, manifest({ "V1_initial.sql": initialFiles["V1_initial.sql"] })).join("\n"), /deleted, renamed or renumbered/);
  assert.match(validateAppendOnly(base, manifest({
    "V1_renamed.sql": initialFiles["V1_initial.sql"], "V2_second.sql": initialFiles["V2_second.sql"],
  })).join("\n"), /must append after V2/);
});

test("CLI validates without a base and accepts append-only additions from a path with spaces", t => {
  const f = fixture(t);
  assert.match(f.root, /migration checker /);
  f.write("V3_third.sql", "SELECT 3;\n");
  const standalone = f.check();
  assert.equal(standalone.status, 0, standalone.stderr);
  assert.match(standalone.stdout, /Validated 3 non-empty SQL migrations V1\.\.V3/);
  const append = f.check("--base", "HEAD");
  assert.equal(append.status, 0, append.stderr);
  assert.match(append.stdout, /2 existing migrations unchanged \(canonical LF SHA-256\)/);
});

test("CLI rejects edits to existing migrations, including whitespace-only edits", async t => {
  for (const content of ["SELECT 99;\n", "SELECT 1;\n "]) {
    await t.test(JSON.stringify(content), t => {
      const f = fixture(t);
      f.write("V1_initial.sql", content);
      assertFailure(f.check("--base", "HEAD"), /content changed.*V1_initial\.sql/);
    });
  }
});

test("CLI rejects deletion of the last existing migration even with a valid remaining sequence", t => {
  const f = fixture(t);
  fs.unlinkSync(path.join(f.directory, "V2_second.sql"));
  assertFailure(f.check("--base", "HEAD"), /deleted, renamed or renumbered: V2_second\.sql/);
});

test("CLI rejects renaming an existing migration without a version gap", t => {
  const f = fixture(t);
  fs.renameSync(path.join(f.directory, "V1_initial.sql"), path.join(f.directory, "V1_renamed.sql"));
  assertFailure(f.check("--base", "HEAD"), /deleted, renamed or renumbered: V1_initial\.sql/);
});

test("CLI rejects renumbering existing migrations even when the final sequence is contiguous", t => {
  const f = fixture(t);
  fs.unlinkSync(path.join(f.directory, "V1_initial.sql"));
  fs.unlinkSync(path.join(f.directory, "V2_second.sql"));
  f.write("V1_second.sql", initialFiles["V2_second.sql"]);
  f.write("V2_initial.sql", initialFiles["V1_initial.sql"]);
  assertFailure(f.check("--base", "HEAD"), /deleted, renamed or renumbered: V1_initial\.sql/);
});

test("CLI rejects duplicate, gapped, malformed and empty migrations", async t => {
  const cases = [
    ["duplicate", "V2_duplicate.sql", "SELECT 3;", /duplicate migration version V2/],
    ["gap", "V4_gap.sql", "SELECT 4;", /gap in migration sequence: V3/],
    ["malformed", "V03_bad.sql", "SELECT 3;", /invalid SQL migration filename: V03_bad\.sql/],
    ["unsafe version", "V9007199254740992_huge.sql", "SELECT 3;", /invalid migration version metadata/],
    ["zero bytes", "V3_empty.sql", "", /empty SQL migration: V3_empty\.sql/],
    ["whitespace", "V3_empty.sql", " \r\n\t", /empty SQL migration: V3_empty\.sql/],
  ];
  for (const [label, name, content, pattern] of cases) {
    await t.test(label, t => {
      const f = fixture(t);
      f.write(name, content);
      assertFailure(f.check(), pattern);
    });
  }
});

test("CLI rejects missing, empty and invalid base arguments without executing shell syntax", async t => {
  const cases = [
    [["--base"], /Missing git ref after --base/],
    [["--base", ""], /Missing git ref after --base/],
    [["--base", "   "], /Missing git ref after --base/],
    [["--base", "missing-ref"], /Cannot resolve --base "missing-ref"/],
    [["--base", "--help"], /valid --base Git ref is required/],
    [["--base", "HEAD; touch injected"], /Cannot resolve --base/],
    [["--base", "HEAD & type nul > injected"], /Cannot resolve --base/],
    [["--base", "HEAD", "--base", "HEAD"], /Usage:/],
    [["--allow-edits"], /Usage:/],
  ];
  for (const [args, pattern] of cases) {
    await t.test(JSON.stringify(args), t => {
      const f = fixture(t);
      assertFailure(f.check(...args), pattern);
      assert.equal(fs.existsSync(path.join(f.root, "injected")), false);
    });
  }
});

test("CLI requires a commit ref, not a tree or blob", t => {
  const f = fixture(t);
  for (const ref of [f.git("rev-parse", "HEAD^{tree}"), f.git("rev-parse", `HEAD:${migrationDirectory}/V1_initial.sql`)]) {
    assertFailure(f.check("--base", ref), /Cannot resolve --base/);
  }
});

test("CLI rejects an empty current SQL selection", t => {
  const f = fixture(t, {});
  fs.writeFileSync(path.join(f.directory, "README.md"), "Not a migration.");
  assertFailure(f.check(), /must contain at least one SQL migration/);
});

test("CLI rejects an empty base selection instead of accepting any current history", t => {
  const f = fixture(t, {});
  f.write("V1_initial.sql", "SELECT 1;");
  assertFailure(f.check("--base", "HEAD"), /Base ref "HEAD" must contain at least one SQL migration/);
});

test("CLI validates the historical selection as well as the current selection", async t => {
  const cases = [
    [{ "V1_initial.sql": "SELECT 1;", "V3_gap.sql": "SELECT 3;" }, /Base ref "HEAD": gap/],
    [{ "V1_bad-name.sql": "SELECT 1;" }, /Base ref "HEAD": invalid SQL migration filename/],
    [{ "V1_initial.sql": " \r\n" }, /Base ref "HEAD": empty SQL migration/],
  ];
  for (const [files, pattern] of cases) {
    await t.test(JSON.stringify(Object.keys(files)), t => {
      const f = fixture(t, files);
      for (const name of Object.keys(files)) fs.unlinkSync(path.join(f.directory, name));
      f.write("V1_initial.sql", "SELECT 1;");
      assertFailure(f.check("--base", "HEAD"), pattern);
    });
  }
});

test("CLI accepts Git LF blobs checked out with Windows CRLF, but still rejects a real edit", t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.root, ".gitattributes"), "*.sql text eol=crlf\n");
  f.git("config", "core.autocrlf", "true");
  // Adding text attributes requires renormalizing the previously tracked files.
  f.git("add", "--renormalize", ".");
  f.git("add", ".gitattributes");
  f.git("commit", "--quiet", "-m", "Windows checkout normalization");
  // Materialize a real normalized checkout and its index stat data in this fixture.
  for (const name of Object.keys(initialFiles)) fs.unlinkSync(path.join(f.directory, name));
  f.git("checkout-index", "--all", "--force", "--index");
  assert.match(fs.readFileSync(path.join(f.directory, "V1_initial.sql"), "utf8"), /\r\n/);
  assert.match(f.git("ls-files", "--eol"), /i\/lf\s+w\/crlf\s+attr\/text eol=crlf/);
  // Independently prove that Git sees no content changes before checking our hashes.
  f.git("diff", "--exit-code");
  assert.equal(f.git("status", "--porcelain"), "");
  const unchanged = f.check("--base", "HEAD");
  assert.equal(unchanged.status, 0, unchanged.stderr);
  f.write("V2_second.sql", "SELECT 999;\r\n");
  assertFailure(f.check("--base", "HEAD"), /content changed.*V2_second\.sql/);
});

test("CLI canonicalizes CRLF in historical blobs too", t => {
  const f = fixture(t, { "V1_initial.sql": "SELECT 1;\r\n" });
  f.write("V1_initial.sql", "SELECT 1;\n");
  const result = f.check("--base", "HEAD");
  assert.equal(result.status, 0, result.stderr);
});

test("CLI preserves non-UTF-8 blob bytes while canonicalizing newlines", t => {
  const f = fixture(t, { "V1_initial.sql": Buffer.from([0xff, 13, 10]) });
  f.write("V1_initial.sql", Buffer.from([0xff, 10]));
  const unchanged = f.check("--base", "HEAD");
  assert.equal(unchanged.status, 0, unchanged.stderr);
  f.write("V1_initial.sql", Buffer.from([0xfe, 10]));
  assertFailure(f.check("--base", "HEAD"), /content changed.*V1_initial\.sql/);
});

test("CLI rejects non-regular SQL entries in the current selection", t => {
  const f = fixture(t);
  fs.mkdirSync(path.join(f.directory, "V3_directory.sql"));
  assertFailure(f.check(), /must be a regular file: V3_directory\.sql/);
});

test("CLI rejects malformed base file metadata (a symlink blob) without following it", t => {
  const f = fixture(t);
  // Make a Git symlink entry via the fixture index; no Windows symlink privilege needed.
  const blob = f.git("hash-object", "-w", `${migrationDirectory}/V1_initial.sql`);
  f.git("update-index", "--add", "--cacheinfo", `120000,${blob},${migrationDirectory}/V1_initial.sql`);
  f.git("commit", "--quiet", "-m", "invalid SQL entry mode");
  assertFailure(f.check("--base", "HEAD"), /Invalid base migration metadata: .* must be a regular SQL file/);
});

test("importing helpers has no CLI output, validation or exit-code side effects", t => {
  const f = fixture(t, {});
  fs.rmdirSync(f.directory);
  const script = `
    process.argv = [process.execPath, "unrelated.mjs", "--base", "invalid-ref"];
    const checker = await import(${JSON.stringify(pathToFileURL(checker).href)});
    if (typeof checker.validateAppendOnly !== "function") throw new Error("missing export");
    if (process.exitCode !== undefined) throw new Error("import changed exitCode");
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: f.root, env: f.env, encoding: "utf8",
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
});


test("pending slot review distinguishes target conflicts, identical work and peer collisions", () => {
  const baseline = manifest();
  const mk = files => manifest({ ...initialFiles, ...files });
  const target = { head: "a".repeat(40), manifest: mk({ "V3_target.sql": "SELECT 3;" }) };
  const candidate = (head, files) => ({
    head: head.repeat(40), mergeBase: "b".repeat(40), baseManifest: baseline, manifest: mk(files)
  });
  const a = candidate("c", { "V3_pending.sql": "SELECT 31;", "V4_next.sql": "SELECT 41;" });
  const b = candidate("d", { "V3_pending.sql": "SELECT 31;", "V4_next.sql": "SELECT 42;" });
  const identical = candidate("e", { "V3_target.sql": "SELECT 3;" });
  const old = candidate("f", {});
  const result = reviewMigrationAllocations(target, [old, b, identical, a]);
  assert.equal(result.status, "review-required");
  assert.deepEqual(result.conflicts.map(item => item.version), [3, 4]);
  assert.equal(result.conflicts[0].target.name, "V3_target.sql");
  assert.equal(result.conflicts[1].target, null);
  assert.equal(result.conflicts[1].candidates[0].name, result.conflicts[1].candidates[1].name);
  assert.notEqual(result.conflicts[1].candidates[0].checksum, result.conflicts[1].candidates[1].checksum);
  assert.equal(result.candidates.find(row => row.head === identical.head).additions[0].targetMatch, "identical");
  assert.deepEqual(result.candidates.find(row => row.head === old.head).additions, []);
  assert.equal(result.databaseLedger, "not-inspected");
  assert.equal(result.verification, "not-run");
  assert.deepEqual(reviewMigrationAllocations(target, [a, identical, b, old]), result);
  assert.equal(reviewMigrationAllocations(target, [identical, old]).status, "no-detected-slot-conflict");
});

test("pending review refuses altered ancestors, invalid manifests and repeated candidate identity", () => {
  const base = manifest();
  const target = { head: "a".repeat(40), manifest: base };
  const row = { head: "b".repeat(40), mergeBase: "c".repeat(40), baseManifest: base, manifest: base };
  assert.throws(() => reviewMigrationAllocations(target, [row, row]), /duplicate candidate/);
  assert.throws(() => reviewMigrationAllocations(target, []), /candidate inventories/);
  assert.throws(() => reviewMigrationAllocations(target, [{ ...row, manifest: [] }]), /non-empty migration manifest/);
  const modified = manifest({ ...initialFiles, "V1_initial.sql": "SELECT 99;" });
  assert.throws(() => reviewMigrationAllocations(target, [{ ...row, manifest: modified }]), /content changed/);
  assert.throws(() => reviewMigrationAllocations({ ...target, manifest: modified }, [row]), /content changed/);
  assert.throws(() => reviewMigrationAllocations(target, [{ ...row, head: "HEAD" }]), /Invalid or duplicate/);
});

test("CLI reviews exact divergent commits without executing SQL or inspecting dirty worktree files", t => {
  const f = fixture(t);
  const base = f.git("rev-parse", "HEAD");
  function branch(name, files) {
    f.git("checkout", "--detach", base);
    for (const [filename, content] of Object.entries(files)) f.write(filename, content);
    f.git("add", "--all"); f.git("commit", "--quiet", "--allow-empty", "-m", name);
    return f.git("rev-parse", "HEAD");
  }
  const target = branch("target", { "V3_target.sql": "SELECT 3;" });
  const a = branch("candidate A", { "V3_pending.sql": "SELECT 31;", "V4_next.sql": "SELECT 41;" });
  const b = branch("candidate B", { "V3_pending.sql": "SELECT 31;", "V4_next.sql": "SELECT 42;" });
  const same = branch("identical candidate", { "V3_target.sql": "SELECT 3;" });
  f.write("V2_second.sql", "not valid SQL and not committed");
  const before = f.git("status", "--porcelain");
  const review = f.check("--review-candidates", target, a, b, same, base);
  assert.equal(review.status, 1, review.stdout + review.stderr);
  const report = JSON.parse(review.stdout);
  assert.equal(report.target, target);
  assert.deepEqual(report.conflicts.map(x => x.version), [3, 4]);
  assert.ok(report.candidates.every(x => x.mergeBase === base));
  assert.equal(f.git("status", "--porcelain"), before);
  assert.equal(f.git("rev-parse", "HEAD"), same);
  const clear = f.check("--review-candidates", target, same, base);
  assert.equal(clear.status, 0, clear.stderr);
  assert.equal(JSON.parse(clear.stdout).status, "no-detected-slot-conflict");
  for (const ref of ["HEAD", target.slice(0, 12), "0".repeat(40), f.git("rev-parse", "HEAD^{tree}")]) {
    const invalid = f.check("--review-candidates", target, ref);
    assert.equal(invalid.status, 1);
    assert.doesNotMatch(invalid.stdout, /no-detected-slot-conflict/);
  }
  // Replacement refs must not substitute a different committed tree for an exact head.
  f.git("replace", target, a);
  try {
    const replaced = f.check("--review-candidates", target, a, b);
    assert.equal(replaced.status, 1, replaced.stderr);
    const retained = JSON.parse(replaced.stdout);
    assert.deepEqual(retained.conflicts.map(x => x.version), [3, 4]);
    assert.equal(retained.conflicts[0].target.name, "V3_target.sql");
  } finally { f.git("replace", "-d", target); }
  const duplicate = f.check("--review-candidates", target, a, a);
  assert.equal(duplicate.status, 1);
  assert.doesNotMatch(duplicate.stdout, /no-detected-slot-conflict/);
});
