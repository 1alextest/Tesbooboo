// Runs only against the disposable GitHub Actions PostgreSQL service.
// The backend's production migration runner is executed separately and twice.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");

// Exercise the actual migrated owner with rollback-only disposable fixtures.
async function verifyNativeQaTaskKinds(client) {
  // Assert the real installed boundary before creating fixtures. A fresh empty
  // database alone cannot demonstrate populated historical backfill.
  const constraints = await client.query(
    "SELECT conname, convalidated FROM pg_constraint WHERE conrelid = 'public.ai_generation_requests'::regclass AND conname IN ('native_qa_task_kind_values','native_qa_task_kind_matches_provider','native_qa_external_producer_closed')"
  );
  assert.deepEqual(constraints.rows.map(row => row.conname).sort(), [
    "native_qa_external_producer_closed", "native_qa_task_kind_matches_provider", "native_qa_task_kind_values"
  ]);
  assert.ok(constraints.rows.every(row => row.convalidated), "native task constraints must be validated");
  const binding = await client.query(
    "SELECT tgenabled FROM pg_trigger WHERE tgrelid = 'public.ai_generation_requests'::regclass AND tgname = 'native_qa_task_kind_binding' AND NOT tgisinternal"
  );
  assert.equal(binding.rowCount, 1, "native task kind binding trigger missing");
  assert.ok(["O", "A"].includes(binding.rows[0].tgenabled), "native task kind trigger must fire for ordinary writes");
  const columns = await client.query(
    "SELECT attname, attnotnull FROM pg_attribute WHERE attrelid = 'public.ai_generation_requests'::regclass AND attname IN ('provider','task_kind') AND NOT attisdropped"
  );
  assert.equal(columns.rowCount, 2);
  assert.ok(columns.rows.every(row => row.attnotnull), "provider and task kind must both be non-null");
  // Use an independently stated expected mapping rather than the migration's
  // classifier itself. Report the population so zero is not evidence of backfill.
  const population = await client.query(
    "SELECT count(*)::int AS total, count(*) FILTER (WHERE provider = 'external_qa_work' OR task_kind IS DISTINCT FROM CASE WHEN provider IN ('external_proposal','external_requirement_proposal','external_document_proposal') THEN 'governed_proposal' ELSE 'legacy_generation_review' END)::int AS violations FROM ai_generation_requests"
  );
  assert.equal(population.rows[0].violations, 0, "persisted native task kind population violates the closed producer contract");
  console.log("Native task population checked before fixtures:", population.rows[0].total);
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
    // Probes that must be refused *by the producer fence* are inserted with the
    // full coherent external shape, so `native_qa_external_generation_inapplicable`
    // cannot fire alongside it and the refusal is attributable to the fence.
    const insertCoherentExternal = (provider, explicitKind) => client.query(
      "INSERT INTO ai_generation_requests(" +
      "project_id,requested_by,provider," + (explicitKind ? "task_kind," : "") +
      "agent_name,task_status,model,user_story,acceptance_criteria,custom_prompt,requested_count," +
      "generated_count,generated_payload,saved_count,save_events," +
      "proposal_revision,proposal_request_key,proposal_request_digest,proposal_provenance," +
      "token_input,token_output,token_total," +
      "external_work_state,external_work_revision,external_prompt_revision,external_prompt_digest" +
      ") VALUES ($1,$2,'" + provider + "'," + (explicitKind ? "'external_qa_work'," : "") +
      "NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL," +
      "'DRAFT',0,1,$3)",
      [project, user, "a".repeat(64)]);
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

    // Compare the installed snapshot against the exact V159 SELECT on the
    // same persisted rows. No added kind field may change a review digest.
    const priorMigration = fs.readFileSync(path.resolve("migrations/V159_work_package_a_skills_publication.sql"), "utf8");
    const priorDefinition = priorMigration.match(/CREATE OR REPLACE FUNCTION testcase_proposal_review_snapshot\(request_id UUID\) RETURNS JSONB[\s\S]*?\$\$;/)?.[0];
    assert.ok(priorDefinition, "historical snapshot definition missing");
    const priorSelect = priorDefinition.split("AS $$")[1].split("$$;")[0].replace("WHERE r.id=request_id;", "WHERE r.id=$1");
    assert.ok(priorSelect.includes("WHERE r.id=$1"), "historical snapshot parameter missing");
    const installed = await client.query("SELECT pg_get_functiondef('testcase_proposal_review_snapshot(uuid)'::regprocedure) AS definition");
    assert.match(installed.rows[0].definition, /r\.task_kind IN \('legacy_generation_review','governed_proposal'\)/);
    for (const row of baseline) {
      const historical = (await client.query(priorSelect, [row.id])).rows[0].jsonb_build_object;
      const actual = (await client.query("SELECT testcase_proposal_review_snapshot($1) AS snapshot", [row.id])).rows[0].snapshot;
      assert.deepEqual(actual, historical, "snapshot basis must stay unchanged for " + row.id);
      assert.equal(actual.taskId, row.id);
      assert.equal(actual.projectId, project);
    }
    const absent = await client.query("SELECT testcase_proposal_review_snapshot($1) AS snapshot", [require("node:crypto").randomUUID()]);
    assert.equal(absent.rows[0].snapshot, null);
    console.log("Native task review snapshots: 10 existing-kind fixtures match historical V159 basis; missing identity returns null.");
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
    await reject("reserved external provider with omitted kind", () => insertCoherentExternal("external_qa_work", false),
      ["native_qa_external_producer_closed"]);
    await reject("explicit external kind", () => insertCoherentExternal("external_qa_work", true),
      ["native_qa_external_producer_closed"]);
    await reject("external kind disguised as legacy provider", () => insertCoherentExternal("openai", true),
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
    await reject("legacy provider switched to reserved external provider without changing kind", () => client.query(
      "UPDATE ai_generation_requests SET provider='external_qa_work' WHERE id=$1", [legacy.id]),
      ["native_qa_task_kind_matches_provider"]);
    await reject("multi-row update mixes permitted legacy and forbidden governed lane substitution", () => client.query(
      "UPDATE ai_generation_requests SET provider=CASE WHEN id=$1 THEN 'openai' ELSE 'external_document_proposal' END WHERE id IN ($1,$2)", [legacy.id, governed[0].id]),
      ["native_qa_governed_lane_immutable"]);
    await reject("combined provider and kind conversion", () => client.query(
      "UPDATE ai_generation_requests SET provider='external_qa_work',task_kind='external_qa_work' WHERE id=$1", [legacy.id]),
      ["native_qa_task_kind_immutable"]);
    console.log("Native task kinds: 10 legitimate fixture rows; 13 exact constraint refusals; all prior rows preserved; external producer closed.");
  } finally {
    await client.query("ROLLBACK");
  }
}


// V170 prepares the conditional shape an external QA task must have once the
// producer is admitted. The producer stays physically closed, so every probe
// that needs an external row temporarily drops that one fence inside a
// savepoint and rolls the savepoint back. The fence is asserted closed again
// afterwards; nothing here can persist an external row.
async function verifyExternalWorkShape(client) {
  const names = [
    "native_qa_external_work_shape",
    "native_qa_external_work_state_values",
    "native_qa_external_work_revision_nonnegative",
    "native_qa_external_prompt_revision_positive",
    "native_qa_external_prompt_digest_format",
    "native_qa_generation_fields_required",
    "native_qa_external_generation_inapplicable"
  ];
  const constraints = await client.query(
    "SELECT conname, convalidated FROM pg_constraint WHERE conrelid = 'public.ai_generation_requests'::regclass AND conname = ANY($1::text[])",
    [names]
  );
  assert.deepEqual(constraints.rows.map((row) => row.conname).sort(), [...names].sort(),
    "external work shape constraints missing");
  assert.ok(constraints.rows.every((row) => row.convalidated), "external work shape constraints must be validated");
  const trigger = await client.query(
    "SELECT tgenabled FROM pg_trigger WHERE tgrelid = 'public.ai_generation_requests'::regclass AND tgname = 'native_qa_external_work_revision' AND NOT tgisinternal"
  );
  assert.equal(trigger.rowCount, 1, "external work revision trigger missing");
  const nullable = await client.query(
    "SELECT attname, attnotnull FROM pg_attribute WHERE attrelid = 'public.ai_generation_requests'::regclass AND attname = ANY($1::text[]) AND NOT attisdropped",
    [["agent_name", "task_status", "user_story", "requested_count", "generated_count",
      "generated_payload", "saved_count", "save_events", "proposal_revision",
      "token_input", "token_output", "token_total", "external_work_state",
      "external_work_revision", "external_prompt_revision", "external_prompt_digest"]]
  );
  assert.equal(nullable.rowCount, 16, "external work columns missing");
  assert.ok(nullable.rows.every((row) => !row.attnotnull), "external work columns must be kind-conditionally nullable");

  await client.query("BEGIN");
  try {
    const suffix = require("node:crypto").randomUUID();
    const user = (await client.query(
      "INSERT INTO users(email,name) VALUES ($1,'External shape QA') RETURNING id",
      ["external-shape-" + suffix + "@tesbo.invalid"]
    )).rows[0].id;
    const org = (await client.query(
      "INSERT INTO organizations(name,slug) VALUES ('External shape QA',$1) RETURNING id",
      ["external-shape-" + suffix]
    )).rows[0].id;
    const project = (await client.query(
      "INSERT INTO projects(organization_id,key,name) VALUES ($1,'EXQA','External shape QA') RETURNING id",
      [org]
    )).rows[0].id;
    const legacy = (await client.query(
      "INSERT INTO ai_generation_requests(project_id,requested_by,provider,user_story,task_status) VALUES ($1,$2,'openai','Legacy fixture','in_review') RETURNING id",
      [project, user]
    )).rows[0].id;

    // Every generation column default must be explicitly cleared: a coherent
    // external row may not inherit a plausible-looking zero or empty payload.
    const externalInsert =
      "INSERT INTO ai_generation_requests(" +
      "project_id,requested_by,provider,task_kind," +
      "agent_name,task_status,model,user_story,acceptance_criteria,custom_prompt,requested_count," +
      "generated_count,generated_payload,saved_count,save_events," +
      "proposal_revision,proposal_request_key,proposal_request_digest,proposal_provenance," +
      "token_input,token_output,token_total," +
      "external_work_state,external_work_revision,external_prompt_revision,external_prompt_digest" +
      ") VALUES ($1,$2,'external_qa_work','external_qa_work'," +
      "NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL," +
      "'DRAFT',0,1,$3) RETURNING id,external_work_state,external_work_revision,external_prompt_revision";

    const reject = async (label, operation, allowedConstraints) => {
      await client.query("SAVEPOINT external_shape_probe");
      let failure;
      try { await operation(); } catch (error) { failure = error; }
      await client.query("ROLLBACK TO SAVEPOINT external_shape_probe");
      await client.query("RELEASE SAVEPOINT external_shape_probe");
      assert.equal(failure?.code, "23514", label + " must be refused by the actual conditional shape");
      assert.ok(allowedConstraints.includes(failure?.constraint),
        label + " failed for an unrelated constraint: " + failure?.constraint);
    };

    // The shape constraints themselves do not open the producer.
    await reject("reserved external provider while the producer is closed", () => client.query(
      externalInsert, [project, user, "a".repeat(64)]),
      ["native_qa_external_producer_closed"]);

    await client.query("SAVEPOINT external_shape_open");
    await client.query("ALTER TABLE ai_generation_requests DROP CONSTRAINT native_qa_external_producer_closed");
    try {
      const external = (await client.query(
        externalInsert, [project, user, "a".repeat(64)]
      )).rows[0];
      assert.equal(external.external_work_state, "DRAFT");
      assert.equal(Number(external.external_work_revision), 0);
      assert.equal(Number(external.external_prompt_revision), 1);

      // A governed state change advances the server-owned revision by one.
      await client.query("UPDATE ai_generation_requests SET external_work_state='READY' WHERE id=$1", [external.id]);
      let row = (await client.query("SELECT external_work_state,external_work_revision FROM ai_generation_requests WHERE id=$1", [external.id])).rows[0];
      assert.equal(row.external_work_state, "READY");
      assert.equal(Number(row.external_work_revision), 1);

      // Supplying the exact next revision is accepted and not double-bumped.
      await client.query("UPDATE ai_generation_requests SET external_work_state='ASSIGNED',external_work_revision=2 WHERE id=$1", [external.id]);
      row = (await client.query("SELECT external_work_revision FROM ai_generation_requests WHERE id=$1", [external.id])).rows[0];
      assert.equal(Number(row.external_work_revision), 2);

      await reject("external row fabricating a generation counter", () => client.query(
        "UPDATE ai_generation_requests SET generated_count=0 WHERE id=$1", [external.id]),
        ["native_qa_external_generation_inapplicable"]);
      await reject("external row carrying a proposal status", () => client.query(
        "UPDATE ai_generation_requests SET task_status='in_review' WHERE id=$1", [external.id]),
        ["native_qa_external_generation_inapplicable"]);
      await reject("external row carrying a model", () => client.query(
        "UPDATE ai_generation_requests SET model='gpt' WHERE id=$1", [external.id]),
        ["native_qa_external_generation_inapplicable"]);
      await reject("external row carrying a proposal revision", () => client.query(
        "UPDATE ai_generation_requests SET proposal_revision=0 WHERE id=$1", [external.id]),
        ["native_qa_external_generation_inapplicable"]);
      await reject("external row carrying a generation agent", () => client.query(
        "UPDATE ai_generation_requests SET agent_name='Zyra the Test Generator' WHERE id=$1", [external.id]),
        ["native_qa_external_generation_inapplicable"]);
      await reject("external row carrying legacy token counters", () => client.query(
        "UPDATE ai_generation_requests SET token_total=0 WHERE id=$1", [external.id]),
        ["native_qa_external_generation_inapplicable"]);
      await reject("external row dropping its work state", () => client.query(
        "UPDATE ai_generation_requests SET external_work_state=NULL WHERE id=$1", [external.id]),
        ["native_qa_external_work_shape"]);
      await reject("external row with an unknown work state", () => client.query(
        "UPDATE ai_generation_requests SET external_work_state='DONE' WHERE id=$1", [external.id]),
        ["native_qa_external_work_state_values"]);
      await reject("external row with a non-digest prompt pointer", () => client.query(
        "UPDATE ai_generation_requests SET external_prompt_digest='not-a-digest' WHERE id=$1", [external.id]),
        ["native_qa_external_prompt_digest_format"]);
      await reject("external row forging its work revision", () => client.query(
        "UPDATE ai_generation_requests SET external_work_revision=7 WHERE id=$1", [external.id]),
        ["native_qa_external_work_revision_advance"]);
      await reject("legacy row acquiring external work fields", () => client.query(
        "UPDATE ai_generation_requests SET external_work_state='DRAFT' WHERE id=$1", [legacy]),
        ["native_qa_external_work_shape"]);

      // A reviewed prompt cannot be swapped once execution authority exists.
      await client.query("UPDATE ai_generation_requests SET external_work_state='CLAIMED' WHERE id=$1", [external.id]);
      await reject("prompt revision changed after claim", () => client.query(
        "UPDATE ai_generation_requests SET external_prompt_revision=2 WHERE id=$1", [external.id]),
        ["native_qa_external_prompt_immutable"]);
      await client.query("UPDATE ai_generation_requests SET external_work_state='CLOSED' WHERE id=$1", [external.id]);
      await reject("terminal external work rewound", () => client.query(
        "UPDATE ai_generation_requests SET external_work_state='DRAFT' WHERE id=$1", [external.id]),
        ["native_qa_external_work_terminal"]);

      // A non-external row must still carry every generation fact.
      await reject("legacy row omitting a generation fact", () => client.query(
        "UPDATE ai_generation_requests SET user_story=NULL WHERE id=$1", [legacy]),
        ["native_qa_generation_fields_required"]);
    } finally {
      await client.query("ROLLBACK TO SAVEPOINT external_shape_open");
      await client.query("RELEASE SAVEPOINT external_shape_open");
    }
    // The saved rollback must have restored the physical producer fence.
    const fence = await client.query(
      "SELECT convalidated FROM pg_constraint WHERE conrelid = 'public.ai_generation_requests'::regclass AND conname = 'native_qa_external_producer_closed'"
    );
    assert.equal(fence.rowCount, 1, "external producer fence must remain installed");
    assert.ok(fence.rows[0].convalidated, "external producer fence must remain validated");
    console.log("External work shape: 1 coherent DRAFT fixture, server-bumped revision, 14 exact conditional refusals; producer fence restored closed.");
  } finally {
    await client.query("ROLLBACK");
  }
}


// Reproduce a populated V167 -> current upgrade on a separate disposable
// database using the actual built migration CLI, never by undoing migrations.
async function verifyPopulatedTaskKindUpgrade(admin, migrationFiles) {
  const url = new URL(process.env.DATABASE_URL);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
    url.pathname === "/tesbo_ci" && !url.search && !url.hash,
    "Populated upgrade requires the dedicated loopback CI database");
  const { randomUUID } = require("node:crypto");
  const { spawnSync } = require("node:child_process");
  const database = "tesbo_ci_upgrade_" + randomUUID().replaceAll("-", "");
  const directory = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "tesbo-pre-kind-"));
  let created = false;
  let upgrade;
  const fullDirectory = path.resolve("migrations");
  const expected = new Map([
    ["openai", "legacy_generation_review"],
    ["anthropic", "legacy_generation_review"],
    ["zyra_chat", "legacy_generation_review"],
    ["zyra_archive_sweep", "legacy_generation_review"],
    ["legacy", "legacy_generation_review"],
    ["external_proposal", "governed_proposal"],
    ["external_requirement_proposal", "governed_proposal"],
    ["external_document_proposal", "governed_proposal"]
  ]);
  const priorFiles = migrationFiles.filter(name => Number(name.match(/^V(\d+)_/)[1]) <= 167);
  assert.equal(priorFiles.length, 167, "Expected the exact pre-kind migration sequence");
  try {
    for (const name of priorFiles) fs.copyFileSync(path.join(fullDirectory, name), path.join(directory, name));
    await admin.query('CREATE DATABASE "' + database + '"');
    created = true;
    url.pathname = "/" + database;
    const migrate = (migrationDir, shouldFail = false) => {
      const env = { ...process.env, DATABASE_URL: url.toString(), MIGRATIONS_DIR: migrationDir };
      const result = spawnSync(process.execPath, [path.resolve("dist/database/migrate.js")],
        { env, encoding: "utf8", timeout: 180000, maxBuffer: 4 * 1024 * 1024 });
      if (result.error) throw result.error;
      if (shouldFail) {
        assert.notEqual(result.status, 0, "reserved historical provider must stop the real migrator");
        assert.match(result.stderr, /native_qa_external_producer_closed/);
      } else {
        assert.equal(result.status, 0, "migration CLI failed: " + result.stderr);
      }
      return result.stdout;
    };
    migrate(directory);
    upgrade = new Client({ connectionString: url.toString() });
    await upgrade.connect();
    const ledger = async () => (await upgrade.query("SELECT version, filename, checksum FROM schema_migrations ORDER BY version")).rows;
    const beforeLedger = await ledger();
    assert.equal(beforeLedger.length, 167);
    const suffix = randomUUID();
    const user = (await upgrade.query("INSERT INTO users(email,name) VALUES ($1,'Historical task QA') RETURNING id", ["historical-" + suffix + "@tesbo.invalid"])).rows[0].id;
    const org = (await upgrade.query("INSERT INTO organizations(name,slug) VALUES ('Historical task QA',$1) RETURNING id", ["historical-" + suffix])).rows[0].id;
    const project = (await upgrade.query("INSERT INTO projects(organization_id,key,name) VALUES ($1,'HTQA','Historical task QA') RETURNING id", [org])).rows[0].id;
    for (const [provider, kind] of expected) {
      const governed = kind === "governed_proposal";
      await upgrade.query(
        "INSERT INTO ai_generation_requests(project_id,requested_by,provider,user_story,task_status,generated_payload,generated_count,proposal_request_key,proposal_request_digest,proposal_provenance,save_events) VALUES ($1,$2,$3,$4,$5,$6::jsonb,1,$7,$8,$9::jsonb,$10::jsonb)",
        [project, provider === "zyra_archive_sweep" ? null : user, provider,
          "Historical " + provider, governed ? "done" : "in_review",
          JSON.stringify([{ title: "Retained " + provider }]),
          governed ? "historical-" + provider : null, governed ? "a".repeat(64) : null,
          governed ? JSON.stringify({ principalKey: "synthetic:" + user, issuerId: user }) : null,
          governed ? JSON.stringify([{ decisionKey: "synthetic-" + provider, proposalRevision: "b".repeat(64) }]) : "[]"]
      );
    }
    const retained = async () => (await upgrade.query(
      "SELECT to_jsonb(r) AS row, testcase_proposal_review_snapshot(r.id) AS snapshot FROM ai_generation_requests r WHERE r.project_id=$1 ORDER BY r.id",
      [project]
    )).rows;
    const before = await retained();
    assert.equal(before.length, expected.size);
    assert.ok(before.every(x => !Object.hasOwn(x.row, "task_kind") && x.snapshot !== null));

    // An unexpected reserved historical lane must fail the transaction, not
    // quietly acquire a new ownership classification or migration receipt.
    const bad = (await upgrade.query(
      "INSERT INTO ai_generation_requests(project_id,requested_by,provider,user_story,task_status) VALUES ($1,$2,'external_qa_work','Invalid historical reserved lane','in_review') RETURNING id",
      [project, user]
    )).rows[0].id;
    migrate(fullDirectory, true);
    assert.deepEqual(await ledger(), beforeLedger, "failed upgrade must not advance migration ledger");
    assert.equal((await upgrade.query("SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ai_generation_requests' AND column_name='task_kind'")).rowCount, 0);
    assert.equal((await upgrade.query("SELECT to_regprocedure('native_qa_task_kind_for_provider(text)') AS function")).rows[0].function, null);
    assert.equal((await upgrade.query("SELECT id FROM ai_generation_requests WHERE id=$1", [bad])).rowCount, 1);
    await upgrade.query("DELETE FROM ai_generation_requests WHERE id=$1", [bad]);
    assert.deepEqual(await retained(), before, "failure must preserve all valid historical rows and snapshots");

    migrate(fullDirectory);
    const afterLedger = await ledger();
    assert.equal(afterLedger.length, migrationFiles.length);
    assert.deepEqual(afterLedger.slice(0, 167), beforeLedger);
    const after = await retained();
    assert.equal(after.length, before.length);
    for (let i = 0; i < after.length; i++) {
      const {
        task_kind, external_work_state, external_work_revision,
        external_prompt_revision, external_prompt_digest, ...original
      } = after[i].row;
      assert.equal(task_kind, expected.get(original.provider));
      // V170 adds the external-work columns as NULL for every historical row.
      assert.equal(external_work_state, null);
      assert.equal(external_work_revision, null);
      assert.equal(external_prompt_revision, null);
      assert.equal(external_prompt_digest, null);
      assert.deepEqual(original, before[i].row, "upgrade changed historical row " + original.id);
      assert.deepEqual(after[i].snapshot, before[i].snapshot, "upgrade changed review basis " + original.id);
    }
    assert.match(migrate(fullDirectory), /Database schema is up to date/);
    assert.deepEqual(await ledger(), afterLedger);
    assert.deepEqual(await retained(), after);
    console.log("Populated native task upgrade: 8 historical rows, original IDs/sequence/payloads/receipts/snapshots preserved, reserved history rejected atomically, second migration idempotent.");
  } finally {
    try {
      if (upgrade) await upgrade.end();
      if (created) await admin.query('DROP DATABASE "' + database + '"');
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
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
    await verifyExternalWorkShape(client);
    await verifyPopulatedTaskKindUpgrade(client, migrationFiles);
    console.log(`Database integrity passed: ${tracked.rowCount} migrations, pgvector, unique run membership, immutable audit rows, native task kinds and external work conditional shape.`);
  } finally {
    await client.end();
  }
}
main().catch((err) => { console.error(err); process.exitCode = 1; });
