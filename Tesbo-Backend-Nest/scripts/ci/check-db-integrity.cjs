// Runs only against the disposable GitHub Actions PostgreSQL service.
// The backend's production migration runner is executed separately and twice.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");

// Exercise the actual migrated owner with rollback-only disposable fixtures.
async function verifyNativeQaTaskKinds(client) {
  await client.query("BEGIN");
  try {
    const suffix = require("node:crypto").randomUUID();
    const user = (await client.query(
      "INSERT INTO users(email,name) VALUES ($1,'Task kind QA') RETURNING id",
      ["task-kind-" + suffix + "@tesbo.invalid"]
    )).rows[0].id;
    const org = (await client.query(
      "INSERT INTO organizations(name,slug) VALUES ('Task kind QA',$1) RETURNING id",
      ["task-kind-" + suffix]
    )).rows[0].id;
    const project = (await client.query(
      "INSERT INTO projects(organization_id,key,name) VALUES ($1,'TKQA','Task kind QA') RETURNING id",
      [org]
    )).rows[0].id;
    const read = async () => (await client.query(
      "SELECT * FROM ai_generation_requests WHERE project_id=$1 ORDER BY id", [project]
    )).rows;
    const insert = async (provider, kind, requestedBy = user) => {
      const result = kind === undefined
        ? await client.query(
          "INSERT INTO ai_generation_requests(project_id,requested_by,provider,user_story,task_status) VALUES ($1,$2,$3,'Disposable kind fixture','in_review') RETURNING id,task_kind,provider,proposal_provenance",
          [project, requestedBy, provider])
        : await client.query(
          "INSERT INTO ai_generation_requests(project_id,requested_by,provider,user_story,task_status,task_kind) VALUES ($1,$2,$3,'Disposable kind fixture','in_review',$4) RETURNING id,task_kind,provider,proposal_provenance",
          [project, requestedBy, provider, kind]);
      return result.rows[0];
    };
    const legacy = await insert("openai");
    assert.equal(legacy.task_kind, "legacy_generation_review");
    assert.equal((await insert("anthropic")).task_kind, "legacy_generation_review");
    assert.equal((await insert("zyra_chat")).task_kind, "legacy_generation_review");
    assert.equal((await insert("zyra_archive_sweep", undefined, null)).task_kind, "legacy_generation_review");
    assert.equal((await insert("legacy")).task_kind, "legacy_generation_review");
    assert.equal((await insert("openai", "legacy_generation_review")).task_kind, "legacy_generation_review");
    const governed = [];
    for (const provider of ["external_proposal", "external_requirement_proposal", "external_document_proposal"]) {
      const row = await insert(provider);
      assert.equal(row.task_kind, "governed_proposal");
      // A historical missing producer receipt must not be manufactured by
      // classification. Actual governed staging/approval is tested elsewhere.
      assert.equal(row.proposal_provenance, null);
      governed.push(row);
    }
    assert.equal((await insert("external_proposal", "governed_proposal")).task_kind, "governed_proposal");

    // Ordinary same-lane provider and proposal review writes are legitimate;
    // neither should rewrite the stable kind or prevent existing state updates.
    await client.query("UPDATE ai_generation_requests SET provider='anthropic',task_status='todo' WHERE id=$1", [legacy.id]);
    await client.query("UPDATE ai_generation_requests SET generated_payload='[]'::jsonb,task_status='done' WHERE id=$1", [governed[0].id]);
    const baseline = await read();
    assert.equal(baseline.length, 10);
    assert.equal(baseline.find(row => row.id === legacy.id).task_kind, "legacy_generation_review");
    assert.equal(baseline.find(row => row.id === legacy.id).provider, "anthropic");
    assert.equal(baseline.find(row => row.id === governed[0].id).task_kind, "governed_proposal");
    assert.equal(baseline.find(row => row.id === governed[0].id).task_status, "done");

    const reject = async (label, operation, allowedConstraints) => {
      await client.query("SAVEPOINT task_kind_probe");
      let failure;
      try { await operation(); } catch (error) { failure = error; }
      await client.query("ROLLBACK TO SAVEPOINT task_kind_probe");
      await client.query("RELEASE SAVEPOINT task_kind_probe");
      assert.equal(failure?.code, "23514", label + " must be refused by the actual kind boundary");
      assert.ok(allowedConstraints.includes(failure?.constraint),
        label + " failed for an unrelated constraint: " + failure?.constraint);
      assert.deepEqual(await read(), baseline, label + " must preserve the entire fixture population");
    };
    await reject("reserved external provider with omitted kind", () => insert("external_qa_work"),
      ["native_qa_external_producer_closed"]);
    await reject("explicit external kind", () => insert("external_qa_work", "external_qa_work"),
      ["native_qa_external_producer_closed"]);
    await reject("external kind disguised as legacy provider", () => insert("openai", "external_qa_work"),
      ["native_qa_external_producer_closed", "native_qa_task_kind_matches_provider"]);
    await reject("governed kind with legacy provider", () => insert("openai", "governed_proposal"),
      ["native_qa_task_kind_matches_provider"]);
    await reject("legacy kind with governed provider", () => insert("external_proposal", "legacy_generation_review"),
      ["native_qa_task_kind_matches_provider"]);
    await reject("unknown kind", () => insert("openai", "unknown"),
      ["native_qa_task_kind_values", "native_qa_task_kind_matches_provider"]);
    await reject("change stored kind", () => client.query(
      "UPDATE ai_generation_requests SET task_kind='governed_proposal' WHERE id=$1", [legacy.id]),
      ["native_qa_task_kind_immutable"]);
    await reject("erase stored kind", () => client.query(
      "UPDATE ai_generation_requests SET task_kind=NULL WHERE id=$1", [legacy.id]),
      ["native_qa_task_kind_immutable"]);
    await reject("legacy provider switched to governed", () => client.query(
      "UPDATE ai_generation_requests SET provider='external_proposal' WHERE id=$1", [legacy.id]),
      ["native_qa_task_kind_matches_provider"]);
    await reject("governed subtype substituted", () => client.query(
      "UPDATE ai_generation_requests SET provider='external_document_proposal' WHERE id=$1", [governed[0].id]),
      ["native_qa_governed_lane_immutable"]);
    await reject("combined provider and kind conversion", () => client.query(
      "UPDATE ai_generation_requests SET provider='external_qa_work',task_kind='external_qa_work' WHERE id=$1", [legacy.id]),
      ["native_qa_task_kind_immutable"]);
    console.log("Native task kinds: 10 legitimate fixture rows; 11 exact constraint refusals; all prior rows preserved; external producer closed.");
  } finally {
    await client.query("ROLLBACK");
  }
}

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
    await verifyNativeQaTaskKinds(client);
    console.log(`Database integrity passed: ${tracked.rowCount} migrations, pgvector, unique run membership, immutable audit rows and native task kinds.`);
  } finally {
    await client.end();
  }
}
main().catch((err) => { console.error(err); process.exitCode = 1; });
