import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolveBase, listGitTree, readGitBlob, exactCommitMergeBase } from "./git-quality.mjs";

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

/**
 * Read-only projection of full target and candidate migration inventories.
 * Each candidate is compared with its verified common ancestor, NOT with the
 * target as though missing inherited target files were candidate deletions.
 * No database ledger, applied state, SQL compatibility or merge permission.
 */
export function reviewMigrationAllocations(target, candidates) {
  const isSha = value => typeof value === "string" && [40, 64].includes(value.length) && /^[a-f0-9]+$/.test(value);
  if (!target || !isSha(target.head) || !Array.isArray(candidates) ||
      candidates.length < 1 || candidates.length > 32) {
    throw new Error("An exact target commit and 1–32 candidate inventories are required.");
  }
  const errors = validateMigrationManifest(target.manifest, "Target migration manifest");
  const byVersion = new Map();
  const seen = new Set();
  const targetSlots = new Map();
  if (errors.length) throw new Error(errors.join("; "));
  for (const migration of target.manifest) {
    targetSlots.set(migration.version, migration);
  }
  const same = (a, b) => a.name === b.name && a.checksum === b.checksum;
  const rows = [];
  for (const candidate of candidates) {
    if (!candidate || !isSha(candidate.head) || !isSha(candidate.mergeBase) || seen.has(candidate.head)) {
      throw new Error("Invalid or duplicate candidate commit inventory.");
    }
    seen.add(candidate.head);
    const problems = [
      ...validateAppendOnly(candidate.baseManifest, target.manifest),
      ...validateAppendOnly(candidate.baseManifest, candidate.manifest)
    ];
    if (problems.length) throw new Error("Candidate " + candidate.head + ": " + problems.join("; "));
    const inherited = new Set(candidate.baseManifest.map(migration => migration.name));
    const additions = candidate.manifest.filter(migration => !inherited.has(migration.name))
      .sort((a, b) => a.version - b.version)
      .map(migration => {
        const occupant = targetSlots.get(migration.version);
        const targetMatch = !occupant ? "unallocated" : same(migration, occupant) ? "identical" : "occupied_different";
        const allocation = { name: migration.name, version: migration.version, checksum: migration.checksum, targetMatch };
        const entries = byVersion.get(migration.version) ?? [];
        entries.push({ head: candidate.head, mergeBase: candidate.mergeBase, ...allocation });
        byVersion.set(migration.version, entries);
        return allocation;
      });
    rows.push({ head: candidate.head, mergeBase: candidate.mergeBase, additions });
  }
  const conflicts = [];
  for (const [version, entries] of byVersion) {
    const occupant = targetSlots.get(version) ?? null;
    const distinct = new Set([...(occupant ? [occupant] : []), ...entries].map(m => JSON.stringify([m.name, m.checksum])));
    if (distinct.size > 1) conflicts.push({
      version,
      target: occupant ? { name: occupant.name, version: occupant.version, checksum: occupant.checksum } : null,
      candidates: entries.sort((a, b) => a.head.localeCompare(b.head))
    });
  }
  return {
    status: conflicts.length ? "review-required" : "no-detected-slot-conflict",
    target: target.head,
    candidates: rows.sort((a, b) => a.head.localeCompare(b.head)),
    conflicts: conflicts.sort((a, b) => a.version - b.version),
    databaseLedger: "not-inspected",
    verification: "not-run",
    limitations: [
      "Only numbered SQL slots in the supplied committed inventories are compared. No PR discovery or exhaustive candidate inventory is asserted.",
      "An identical name and canonical checksum is not evidence of independent work, applied schema, or merge readiness.",
      "SQL effects, cross-version checksum reuse, dependencies and persistent migration history require separate authorized review."
    ]
  };
}

function reviewCommittedCandidates(cwd, target, heads) {
  if (heads.length < 1 || heads.length > 32 || new Set(heads).size !== heads.length) {
    throw new Error("Provide 1–32 distinct exact candidate commit SHAs.");
  }
  // Resolve every exact commit and common ancestor before reading any source blobs.
  const pairs = heads.map(head => ({ head, mergeBase: exactCommitMergeBase(target, head, { cwd }) }));
  const manifests = new Map(), blobs = new Map();
  function read(commit) {
    if (!manifests.has(commit)) {
      const result = validateMigrationFiles(readBaseFiles(cwd, commit, blobs), "Commit " + commit);
      if (result.errors.length) throw new Error(result.errors.join("; "));
      manifests.set(commit, result.manifest);
    }
    return manifests.get(commit);
  }
  return reviewMigrationAllocations({ head: target, manifest: read(target) },
    pairs.map(pair => ({ ...pair, baseManifest: read(pair.mergeBase), manifest: read(pair.head) })));
}

function readBaseFiles(cwd, commit, cache) {
  const tree = listGitTree(commit, `${migrationDirectory}/`, { cwd });
  const files = [];
  for (const { mode, type, objectId, path: filename } of tree) {
    if (path.posix.dirname(filename) !== migrationDirectory || !filename.endsWith(".sql")) continue;
    if (type !== "blob" || !["100644", "100755"].includes(mode)) {
      throw new Error(`Invalid base migration metadata: ${filename} must be a regular SQL file.`);
    }
    if (cache && !cache.has(objectId)) cache.set(objectId, readGitBlob(objectId, { cwd }));
    files.push({
      name: path.posix.basename(filename),
      content: cache ? cache.get(objectId) : readGitBlob(objectId, { cwd }),
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
    if (args[0] === "--review-candidates") {
      const result = reviewCommittedCandidates(process.cwd(), args[1], args.slice(2));
      console.log(JSON.stringify(result, null, 2));
      return result.conflicts.length ? 1 : 0;
    }
    let base;
    if (args[0] === "--base" && (args.length === 1 || !args[1].trim())) {
      throw new Error("Missing git ref after --base.");
    }
    if (args.length) {
      if (args.length !== 2 || args[0] !== "--base") {
        throw new Error("Usage: node scripts/check-migrations.mjs [--base <git-ref>] | --review-candidates <target-commit-sha> <candidate-commit-sha>...");
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
