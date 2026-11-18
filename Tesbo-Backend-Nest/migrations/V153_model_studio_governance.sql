-- Model Studio governance: a human approval receipt bound to the exact reviewed revision, and the
-- provenance for cases created from that revision's path proposals.
--
-- Approval is deliberately separate from the revision content: revisions stay immutable, and the
-- receipt records which content hash a person approved and when. Case generation from proposals is
-- only allowed against an approved revision, and each generated case is linked to the exact path
-- digest so a second request cannot silently duplicate it.

CREATE TABLE IF NOT EXISTS mbt_model_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  model_id UUID NOT NULL REFERENCES mbt_models(id) ON DELETE CASCADE,
  model_revision_id UUID NOT NULL REFERENCES mbt_model_revisions(id) ON DELETE CASCADE,
  content_hash CHAR(64) NOT NULL,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (model_revision_id)
);

CREATE INDEX IF NOT EXISTS idx_mbt_model_approvals_model ON mbt_model_approvals(model_id, created_at DESC);

CREATE TABLE IF NOT EXISTS mbt_generated_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  model_id UUID NOT NULL REFERENCES mbt_models(id) ON DELETE CASCADE,
  model_revision_id UUID NOT NULL REFERENCES mbt_model_revisions(id) ON DELETE CASCADE,
  path_digest CHAR(64) NOT NULL,
  testcase_id UUID NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (model_revision_id, path_digest),
  FOREIGN KEY (testcase_id, project_id) REFERENCES testcases(id, project_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mbt_generated_cases_revision ON mbt_generated_cases(model_revision_id, created_at);
