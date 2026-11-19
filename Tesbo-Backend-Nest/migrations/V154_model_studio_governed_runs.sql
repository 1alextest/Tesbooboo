-- Model Studio governed runs: dispatch an approved model revision into a native Test Run.
--
-- The model's latest revision is its active basis. Dispatching requires that revision to carry an
-- approval whose content hash matches — saving a new revision moves the basis and blocks dispatch
-- until that revision is approved. The run itself is an ordinary cycles row, owned by the native
-- run/execution code; this table is the immutable dispatch manifest, not a second execution store.
--
-- element_ids records which states/transitions a generated case was created from, so a dispatched
-- run can report observed case results per model element without re-deriving the path (the
-- generation options are not persisted). Existing rows keep an empty array: their path cannot be
-- reconstructed reliably, and they contribute no per-element rollup rather than a guessed one.
ALTER TABLE mbt_generated_cases
  ADD COLUMN IF NOT EXISTS element_ids TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS mbt_model_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  model_id UUID NOT NULL REFERENCES mbt_models(id) ON DELETE CASCADE,
  model_revision_id UUID NOT NULL REFERENCES mbt_model_revisions(id) ON DELETE CASCADE,
  -- The receipt this dispatch relied on. Both FKs cascade with the model/revision, and the unique
  -- cycle keeps one manifest per native run.
  approval_id UUID NOT NULL REFERENCES mbt_model_approvals(id) ON DELETE CASCADE,
  content_hash CHAR(64) NOT NULL,
  cycle_id UUID NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- The cases that were dispatched, their element coverage and their provenance (generated path
  -- digest or explicit link). Immutable: a later link/unlink does not rewrite a dispatched manifest.
  manifest JSONB NOT NULL,
  UNIQUE (cycle_id)
);

CREATE INDEX IF NOT EXISTS idx_mbt_model_runs_revision
  ON mbt_model_runs(model_revision_id, created_at DESC);
