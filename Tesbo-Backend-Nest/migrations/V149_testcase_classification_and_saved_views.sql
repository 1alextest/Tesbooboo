-- Test-case authoring classification and reusable repository views.
--
-- `technique` is the authoring technique the case was designed with (the same vocabulary Zyra
-- tags its drafts with). `review_views` are the cross-cutting review lenses a case belongs to.
-- Both are authoring metadata, not execution status or coverage: a case in the "negative" view
-- has not necessarily been run, and a link is not verified coverage.
ALTER TABLE testcases
  ADD COLUMN technique VARCHAR(32),
  ADD COLUMN review_views TEXT[] NOT NULL DEFAULT '{}';

-- Named filter presets, per project. A view stores the repository's existing filter query, not a
-- copy of any case, so applying one cannot diverge from the rows it names.
CREATE TABLE saved_testcase_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_saved_testcase_views_project ON saved_testcase_views(project_id, created_at DESC);
