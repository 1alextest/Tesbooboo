-- A bounded assignment command has one immutable outcome over the existing native
-- skill_assignments owner. This is a recovery receipt, not another assignment or approval store.
-- Skill/version/actor UUIDs remain historical attribution after live dependencies disappear.
-- Native project deletion archives the project; current access checks deny archived-project reads.
CREATE TABLE skill_assignment_requests (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  request_key UUID NOT NULL,
  request_digest CHAR(64) NOT NULL CHECK (request_digest ~ '^[a-f0-9]{64}$'),
  requested_by UUID NOT NULL,
  skill_document_id UUID NOT NULL,
  skill_version_id UUID NOT NULL,
  content_digest CHAR(64) NOT NULL CHECK (content_digest ~ '^[a-f0-9]{64}$'),
  committed_at TIMESTAMPTZ NOT NULL,
  receipt JSONB NOT NULL,
  UNIQUE (project_id, request_key),
  CHECK ((
    jsonb_typeof(receipt) = 'object'
    AND receipt->>'schemaVersion' = '1'
    AND receipt->>'id' = id::text
    AND receipt->>'projectId' = project_id::text
    AND receipt->>'requestKey' = request_key::text
    AND receipt->>'requestDigest' = request_digest
    AND receipt->>'actorId' = requested_by::text
    AND receipt->>'principalKind' = 'human_session'
    AND receipt->>'skillDocumentId' = skill_document_id::text
    AND receipt->>'skillVersionId' = skill_version_id::text
    AND receipt->>'contentDigest' = content_digest
    AND (receipt->>'committedAt')::timestamptz = committed_at
    AND CASE WHEN jsonb_typeof(receipt->'targets') = 'array'
      THEN jsonb_array_length(receipt->'targets') BETWEEN 1 AND 50 ELSE false END
  ) IS TRUE)
);

CREATE FUNCTION preserve_skill_assignment_request() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Skill assignment command receipts are immutable' USING ERRCODE='23514';
END;
$$;
CREATE TRIGGER skill_assignment_request_immutable BEFORE UPDATE OR DELETE ON skill_assignment_requests
FOR EACH ROW EXECUTE FUNCTION preserve_skill_assignment_request();
CREATE TRIGGER skill_assignment_request_no_truncate BEFORE TRUNCATE ON skill_assignment_requests
FOR EACH STATEMENT EXECUTE FUNCTION preserve_skill_assignment_request();

REVOKE UPDATE, DELETE, TRUNCATE ON skill_assignment_requests FROM tesbo_app;
REVOKE UPDATE, DELETE, TRUNCATE ON skill_assignment_requests FROM PUBLIC;

COMMENT ON TABLE skill_assignment_requests IS
  'Immutable exact assignment command commitments for actor-scoped retry recovery. Current assignment state remains in skill_assignments and the shared resolver.';
COMMENT ON COLUMN skill_assignment_requests.requested_by IS
  'Historical authenticated human UUID; no live-user foreign key or new user-deletion policy.';
