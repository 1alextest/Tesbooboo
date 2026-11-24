-- T-455: explicit, server-provisioned source binding; not a customer-editable
-- filesystem path and not a second requirements/testcase/graph store.
CREATE TABLE project_source_bindings (
  project_id UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  repository_id TEXT NOT NULL,
  checkout_key TEXT NOT NULL,
  ref_name TEXT NOT NULL,
  selection_prefixes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  configured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_source_binding_identity CHECK (
    length(trim(repository_id)) > 0 AND length(trim(checkout_key)) > 0
    AND length(trim(ref_name)) > 0
  ),
  CONSTRAINT project_source_binding_selection_size CHECK (
    cardinality(selection_prefixes) <= 32 AND array_position(selection_prefixes, NULL) IS NULL
  )
);
COMMENT ON TABLE project_source_bindings IS
  'Project-scoped reference to an externally configured, approved source checkout; stores no filesystem path or credentials';
