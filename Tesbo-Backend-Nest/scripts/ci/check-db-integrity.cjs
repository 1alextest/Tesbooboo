// Runs only against the disposable GitHub Actions PostgreSQL service.
// The backend's production migration runner is executed separately and twice.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");

async function main() {
  assert.match(process.env.DATABASE_URL || "", /\/tesbo_ci(?:\?|$)/, "Refusing to run outside the isolated tesbo_ci database");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const migrationFiles = fs.readdirSync(path.resolve("migrations")).filter((name) => /^V\d+_.+\.sql$/.test(name));
    const tracked = await client.query("SELECT version, filename, checksum FROM schema_migrations ORDER BY version");
    assert.equal(tracked.rowCount, migrationFiles.length, "all migrations must be recorded exactly once");
    assert.equal(new Set(tracked.rows.map((r) => r.version)).size, migrationFiles.length);
    assert.equal(new Set(tracked.rows.map((r) => r.filename)).size, migrationFiles.length);
    assert.ok(tracked.rows.every((r) => /^[a-f0-9]{64}$/.test(r.checksum)), "migrations require SHA-256 checksums");

    const vector = await client.query("SELECT extname FROM pg_extension WHERE extname = 'vector'");
    assert.equal(vector.rowCount, 1, "pgvector migration not installed");

    // Soft-delete changed this from a table constraint to a partial unique
    // index: only active cycle membership must be unique. Deleted rows are
    // intentionally permitted so a case can be re-added after soft deletion.
    const indexes = await client.query(
      "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'cycle_items' AND indexname = 'cycle_items_cycle_id_testcase_id_key'"
    );
    assert.equal(indexes.rowCount, 1, "active run/test-case unique index missing");
    const definition = indexes.rows[0].indexdef;
    assert.match(definition, /^CREATE UNIQUE INDEX /i, "cycle membership index must be UNIQUE");
    assert.match(definition, /\(cycle_id, testcase_id\)/, "cycle membership index has incorrect columns");
    assert.match(definition, /WHERE \(deleted_at IS NULL\)/, "cycle membership uniqueness must only cover active items");

    const auditTriggers = await client.query(
      "SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid = 'public.audit_logs'::regclass AND NOT tgisinternal AND tgname IN ('audit_logs_immutable', 'audit_logs_no_truncate')"
    );
    assert.deepEqual(auditTriggers.rows.map((r) => r.tgname).sort(), ["audit_logs_immutable", "audit_logs_no_truncate"]);
    assert.ok(auditTriggers.rows.every((r) => r.tgenabled !== "D"), "audit immutability trigger disabled");

    // Behavioral check: a real audit row must be append-only, not just carry a named trigger.
    await client.query("BEGIN");
    try {
      const inserted = await client.query(
        "INSERT INTO audit_logs (action, entity_type, entity_id) VALUES ('ci_audit_probe', 'ci_probe', 'ci') RETURNING id"
      );
      const id = inserted.rows[0].id;
      for (const [kind, sql] of [
        ["update", "UPDATE audit_logs SET action = 'tampered' WHERE id = $1"],
        ["delete", "DELETE FROM audit_logs WHERE id = $1"],
      ]) {
        await client.query("SAVEPOINT ci_probe");
        let rejected = false;
        try { await client.query(sql, [id]); }
        catch (e) { rejected = true; }
        await client.query("ROLLBACK TO SAVEPOINT ci_probe");
        assert.ok(rejected, `audit row ${kind} must be rejected by database`);
      }
    } finally {
      await client.query("ROLLBACK");
    }
    console.log(`Database integrity passed: ${tracked.rowCount} migrations, pgvector, unique run membership and immutable audit rows.`);
  } finally {
    await client.end();
  }
}
main().catch((err) => { console.error(err); process.exitCode = 1; });
