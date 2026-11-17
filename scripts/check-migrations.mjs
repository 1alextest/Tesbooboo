import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolveBase, listGitTree, readGitBlob } from "./git-quality.mjs";

const migrationDirectory = "Tesbo-Backend-Nest/migrations";
const filenamePattern = /^V([1-9]\d*)_[a-zA-Z0-9_]+\.sql$/;

// Canonical-content hashes, not raw worktree-byte hashes: only CRLF -> LF.
// Keep every other byte (including lone CRs, BOMs and invalid UTF-8) significant.
// This avoids false edits from Git's Windows checkout newline conversion.
export function migrationChecksum(content) {
  if (typeof content !== "string" && !Buffer.isBuffer(content)) {
    throw new TypeError("Migration content must be a string or Buffer.");
  }
  const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
  const canonical = Buffer.allocUnsafe(bytes.length);
  let length = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 13 && bytes[i + 1] === 10) continue;
    canonical[length++] = bytes[i];
  }
  return createHash("sha256").update(canonical.subarray(0, length)).digest("hex");
}

// A manifest is a non-empty array of { name, version, checksum } entries.
// All validation functions are pure: no filesystem, Git, CLI or database access.
export function validateMigrationManifest(manifest, label = "Migration manifest") {
  const errors = [];
  if (!Array.isArray(manifest) || manifest.length === 0) {
    return [`${label} must be a non-empty migration manifest.`];
  }
  const versions = new Map();
  for (const entry of manifest) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push(`${label}: malformed migration metadata; expected { name, version, checksum }.`);
      continue;
    }
    const match = typeof entry.name === "string" && filenamePattern.exec(entry.name);
    if (!match || match[0] !== entry.name) {
      errors.push(`${label}: invalid SQL migration filename: ${String(entry.name)}`);
      continue;
    }
    const version = Number(match[1]);
    if (!Number.isSafeInteger(version) || entry.version !== version) {
      errors.push(`${label}: invalid migration version metadata: ${entry.name}`);
      continue;
    }
    if (typeof entry.checksum !== "string" || entry.checksum.length !== 64
        || !/^[a-f0-9]{64}$/.test(entry.checksum)) {
      errors.push(`${label}: invalid SHA-256 checksum metadata: ${entry.name}`);
    }
    if (versions.has(version)) {
      errors.push(`${label}: duplicate migration version V${version}: ${versions.get(version)} and ${entry.name}`);
    }
    versions.set(version, entry.name);
  }
  // Compare neighbours instead of iterating up to an untrusted version number.
  const sorted = [...versions.keys()].sort((a, b) => a - b);
  let expected = 1;
  for (const version of sorted) {
    if (version !== expected) errors.push(`${label}: gap in migration sequence: V${expected}`);
    expected = version + 1;
  }
  return errors;
}

export function validateMigrationFiles(files, label = "Migration selection") {
  if (!Array.isArray(files) || files.length === 0) {
    return { manifest: [], errors: [`${label} must contain at least one SQL migration.`] };
  }
  const manifest = [];
  const errors = [];
  for (const file of files) {
    if (!file || typeof file !== "object" || Array.isArray(file)
        || (typeof file.content !== "string" && !Buffer.isBuffer(file.content))) {
      errors.push(`${label}: malformed migration metadata; expected { name, content: string | Buffer }.`);
      continue;
    }
    const match = typeof file.name === "string" && filenamePattern.exec(file.name);
    manifest.push({
      name: file.name,
      version: match ? Number(match[1]) : NaN,
      checksum: migrationChecksum(file.content),
    });
    if (!file.content.toString("utf8").trim()) {
      errors.push(`${label}: empty SQL migration: ${String(file.name)}`);
    }
  }
  errors.push(...validateMigrationManifest(manifest, label));
  return { manifest, errors };
}

export function validateAppendOnly(baseManifest, currentManifest) {
  const errors = [
    ...validateMigrationManifest(baseManifest, "Base migration manifest"),
    ...validateMigrationManifest(currentManifest, "Current migration manifest"),
  ];
  if (errors.length) return errors;
  const currentByName = new Map(currentManifest.map(entry => [entry.name, entry]));
  const baseNames = new Set(baseManifest.map(entry => entry.name));
  const highestBaseVersion = baseManifest.reduce((highest, entry) => Math.max(highest, entry.version), 0);
  for (const previous of baseManifest) {
    const current = currentByName.get(previous.name);
    if (!current) {
      errors.push(`Existing migration deleted, renamed or renumbered: ${previous.name}`);
    } else if (current.checksum !== previous.checksum) {
      errors.push(`Existing migration content changed (canonical LF SHA-256): ${previous.name}`);
    }
  }
  for (const current of currentManifest) {
    if (!baseNames.has(current.name) && current.version <= highestBaseVersion) {
      errors.push(`Migration additions must append after V${highestBaseVersion}: ${current.name}`);
    }
  }
  return errors;
}

function readBaseFiles(cwd, commit) {
  const tree = listGitTree(commit, `${migrationDirectory}/`, { cwd });
  const files = [];
  for (const { mode, type, objectId, path: filename } of tree) {
    if (path.posix.dirname(filename) !== migrationDirectory || !filename.endsWith(".sql")) continue;
    if (type !== "blob" || !["100644", "100755"].includes(mode)) {
      throw new Error(`Invalid base migration metadata: ${filename} must be a regular SQL file.`);
    }
    files.push({
      name: path.posix.basename(filename),
      content: readGitBlob(objectId, { cwd }),
    });
  }
  return files;
}

function readCurrentFiles(cwd) {
  const directory = path.resolve(cwd, migrationDirectory);
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.name.endsWith(".sql"))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(entry => {
      if (!entry.isFile()) throw new Error(`SQL migration must be a regular file: ${entry.name}`);
      return { name: entry.name, content: fs.readFileSync(path.join(directory, entry.name)) };
    });
}

function main(args) {
  try {
    let base;
    if (args[0] === "--base" && (args.length === 1 || !args[1].trim())) {
      throw new Error("Missing git ref after --base.");
    }
    if (args.length) {
      if (args.length !== 2 || args[0] !== "--base") {
        throw new Error("Usage: node scripts/check-migrations.mjs [--base <git-ref>]");
      }
      base = args[1];
    }
    const cwd = process.cwd();
    const current = validateMigrationFiles(readCurrentFiles(cwd));
    const errors = [...current.errors];
    let previous;
    if (base !== undefined) {
      const commit = resolveBase(base, { cwd });
      previous = validateMigrationFiles(readBaseFiles(cwd, commit), `Base ref ${JSON.stringify(base)}`);
      errors.push(...previous.errors);
      if (!errors.length) errors.push(...validateAppendOnly(previous.manifest, current.manifest));
    }
    if (errors.length) {
      for (const error of errors) console.error(error);
      return 1;
    }
    console.log(`Validated ${current.manifest.length} non-empty SQL migrations V1..V${current.manifest.length}.`);
    if (previous) {
      console.log(`Append-only check passed against ${JSON.stringify(base)}: ${previous.manifest.length} existing migrations unchanged (canonical LF SHA-256).`);
    }
    return 0;
  } catch (error) {
    console.error(`Migration check failed: ${error.message}`);
    return 1;
  }
}

// Importing this module only exposes helpers; it never runs the CLI or migrator.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
