-- The V63 snapshot trigger copies the pre-change row into testcase_versions on every UPDATE, and
-- skips a save only when the row is identical apart from `updated_at` / `search_vector`. The RAG
-- pipeline writes `embedding_status` / `embedding_content_hash` (and now `embedding_queued_at`) on
-- the same row (queued -> ready/pending), so one authored edit could produce two history rows: the
-- real pre-edit snapshot and an embedding-bookkeeping one. That breaks the
-- one-action-one-snapshot contract the ID-history tests pin, and pollutes the drawer with saves no
-- author made.
--
-- Embedding progress is derived/operational state, not authored content: exclude it from the no-op
-- comparison exactly like `updated_at` and `search_vector`. Authored edits still snapshot once.
--
-- `embedding_queued_at` is added here because the Zyra review-close test used the transient
-- `queued` snapshot as its "the enqueue happened" signal. Once embedding updates stop snapshotting,
-- the durable equivalent is this column: set by the enqueue, never cleared by the worker, so
-- `embedding_queued_at IS NOT NULL AND embedding_status = 'pending'` proves the round trip without
-- relying on a state that may be missed between polls.
ALTER TABLE testcases ADD COLUMN embedding_queued_at TIMESTAMPTZ;

COMMENT ON COLUMN testcases.embedding_queued_at IS
  'Last time enqueueTestcaseEmbedding marked this row queued. Operational bookkeeping; excluded from testcase_versions.';

CREATE OR REPLACE FUNCTION testcases_snapshot_before_update() RETURNS trigger AS $$
DECLARE
  next_version INT;
BEGIN
  IF (to_jsonb(NEW) - 'updated_at' - 'search_vector' - 'embedding_status' - 'embedding_content_hash' - 'embedding_queued_at')
     IS NOT DISTINCT FROM
     (to_jsonb(OLD) - 'updated_at' - 'search_vector' - 'embedding_status' - 'embedding_content_hash' - 'embedding_queued_at') THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(MAX(version), 0) + 1 INTO next_version FROM testcase_versions WHERE testcase_id = OLD.id;

  INSERT INTO testcase_versions (testcase_id, version, snapshot, changed_by, change_type, created_at)
  VALUES (
    OLD.id,
    next_version,
    to_jsonb(OLD),
    NEW.updated_by,
    CASE WHEN NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN 'delete' ELSE 'update' END,
    now()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
