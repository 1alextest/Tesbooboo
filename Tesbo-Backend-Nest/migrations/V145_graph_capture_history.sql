-- T-455: internal project-scoped, append-only-by-application history of
-- authorized cached requirement/test-case graph observations.
-- Not a complete upstream behavior model, execution log, or approval store.
CREATE TABLE graph_capture_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  captured_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  contract_id TEXT NOT NULL,
  source_scope_fingerprint TEXT NOT NULL,
  revision TEXT NOT NULL,
  capture_json JSONB NOT NULL,
  review_receipt_json JSONB,
  CONSTRAINT graph_capture_nonblank CHECK (
    length(contract_id) > 0 AND length(source_scope_fingerprint) > 0 AND length(revision) > 0
  ),
  CONSTRAINT graph_capture_objects CHECK (
    jsonb_typeof(capture_json) = 'object'
    AND (review_receipt_json IS NULL OR jsonb_typeof(review_receipt_json) = 'object')
  )
);
CREATE INDEX graph_capture_history_project_order_idx
  ON graph_capture_history(project_id, id DESC);
