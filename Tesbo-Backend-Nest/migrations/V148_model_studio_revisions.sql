-- Persisted Model Studio identity and immutable revisions (MBT-001-C, Phase A).
--
-- Expected behavior is a separate authority from observed source declarations and actual execution
-- evidence. These tables store expected drafts only: approval, activation, path generation and
-- target execution are later phases and have no route here. A model link is not coverage.
CREATE TABLE mbt_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ,
  UNIQUE (id, project_id)
);
CREATE INDEX idx_mbt_models_project ON mbt_models(project_id, created_at DESC);

CREATE TABLE mbt_model_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL,
  project_id UUID NOT NULL,
  revision_number INT NOT NULL CHECK (revision_number >= 1),
  parent_revision_id UUID,
  content JSONB NOT NULL,
  content_hash CHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'retired')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, project_id),
  UNIQUE (model_id, revision_number),
  FOREIGN KEY (model_id, project_id) REFERENCES mbt_models(id, project_id) ON DELETE CASCADE,
  FOREIGN KEY (parent_revision_id, project_id) REFERENCES mbt_model_revisions(id, project_id) ON DELETE CASCADE
);
CREATE INDEX idx_mbt_model_revisions_model ON mbt_model_revisions(model_id, revision_number DESC);

-- Required by the composite foreign key below. `id` alone is already unique; the pair lets the
-- link table prove the test case and the model revision belong to the same project at the DB layer.
CREATE UNIQUE INDEX IF NOT EXISTS idx_testcases_id_project ON testcases(id, project_id);

CREATE TABLE mbt_model_case_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  model_id UUID NOT NULL,
  model_revision_id UUID NOT NULL,
  testcase_id UUID NOT NULL,
  testcase_revision CHAR(64),
  element_ids TEXT[] NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (model_revision_id, testcase_id, element_ids),
  FOREIGN KEY (model_id, project_id) REFERENCES mbt_models(id, project_id) ON DELETE CASCADE,
  FOREIGN KEY (model_revision_id, project_id) REFERENCES mbt_model_revisions(id, project_id) ON DELETE CASCADE,
  FOREIGN KEY (testcase_id, project_id) REFERENCES testcases(id, project_id) ON DELETE CASCADE
);
CREATE INDEX idx_mbt_model_case_links_model ON mbt_model_case_links(model_revision_id);
