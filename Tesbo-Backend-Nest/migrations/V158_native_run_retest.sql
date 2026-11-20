-- A retest is another native Run, never a rewrite of the source execution. This immutable
-- creation receipt belongs to cycles; it is not a second attempt/result/correction journal.
ALTER TABLE cycles
  ADD COLUMN retest_source_cycle_id UUID,
  ADD COLUMN retest_request_key UUID,
  ADD COLUMN retest_request_digest CHAR(64),
  ADD COLUMN retest_manifest JSONB,
  ADD COLUMN retest_manifest_digest CHAR(64);

ALTER TABLE cycles ADD CONSTRAINT cycles_retest_source_fk
  FOREIGN KEY (project_id, retest_source_cycle_id) REFERENCES cycles(project_id, id) ON DELETE RESTRICT;
ALTER TABLE cycles ADD CONSTRAINT cycles_retest_receipt_complete CHECK ((
  (retest_source_cycle_id IS NULL AND retest_request_key IS NULL AND retest_request_digest IS NULL
   AND retest_manifest IS NULL AND retest_manifest_digest IS NULL) OR
  (retest_source_cycle_id IS NOT NULL AND retest_source_cycle_id <> id AND retest_request_key IS NOT NULL
   AND retest_request_digest ~ '^[a-f0-9]{64}$' AND retest_manifest_digest IS NOT NULL
   AND jsonb_typeof(retest_manifest) = 'object' AND retest_manifest->>'schemaVersion' = '1'
   AND retest_manifest->>'projectId' = project_id::text
   AND retest_manifest->>'sourceCycleId' = retest_source_cycle_id::text
   AND retest_manifest->>'cycleId' = id::text
   AND CASE WHEN jsonb_typeof(retest_manifest->'occurrences') = 'array'
     THEN jsonb_array_length(retest_manifest->'occurrences') BETWEEN 1 AND 100 ELSE false END
   AND retest_manifest_digest = encode(sha256(convert_to(retest_manifest::text, 'UTF8')), 'hex'))
) IS TRUE);
CREATE UNIQUE INDEX cycles_retest_request_unique ON cycles(project_id, retest_request_key)
  WHERE retest_request_key IS NOT NULL;
CREATE INDEX cycles_retest_source_idx ON cycles(project_id, retest_source_cycle_id)
  WHERE retest_source_cycle_id IS NOT NULL;

CREATE FUNCTION preserve_native_retest_receipt() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.retest_manifest IS NOT NULL AND
     ROW(NEW.project_id,NEW.retest_source_cycle_id,NEW.retest_request_key,NEW.retest_request_digest,
         NEW.retest_manifest,NEW.retest_manifest_digest) IS DISTINCT FROM
     ROW(OLD.project_id,OLD.retest_source_cycle_id,OLD.retest_request_key,OLD.retest_request_digest,
         OLD.retest_manifest,OLD.retest_manifest_digest) THEN
    RAISE EXCEPTION 'Retest creation receipts are immutable; create a new retest' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER native_retest_receipt_immutable BEFORE UPDATE ON cycles
FOR EACH ROW EXECUTE FUNCTION preserve_native_retest_receipt();

COMMENT ON COLUMN cycles.retest_manifest IS
  'Immutable source-at-retest observation and exact newly dispatched native occurrences. Prior evidence is referenced, never copied as new proof. Not a full result correction journal.';

-- The terminal command fact also covers an explicit noncommit decision when no destination
-- Run exists. It is a child of the native Run owner, not a task, attempt or result lifecycle.
CREATE TABLE cycle_retest_requests (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  request_key UUID NOT NULL,
  source_cycle_id UUID NOT NULL,
  request_digest CHAR(64) NOT NULL CHECK (request_digest ~ '^[a-f0-9]{64}$'),
  requested_by UUID NOT NULL,
  outcome VARCHAR(16) NOT NULL CHECK (outcome IN ('created','cancelled')),
  destination_cycle_id UUID,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (project_id,request_key),
  UNIQUE (project_id,destination_cycle_id),
  UNIQUE (project_id,request_key,source_cycle_id,request_digest,destination_cycle_id),
  FOREIGN KEY (project_id,source_cycle_id) REFERENCES cycles(project_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (project_id,destination_cycle_id) REFERENCES cycles(project_id,id) ON DELETE RESTRICT,
  CHECK ((outcome='created' AND destination_cycle_id IS NOT NULL AND destination_cycle_id<>source_cycle_id)
      OR (outcome='cancelled' AND destination_cycle_id IS NULL))
);
CREATE INDEX cycle_retest_requests_source_idx ON cycle_retest_requests(project_id,source_cycle_id);

-- Every successful creation receipt is pinned to its exact terminal command. Deferral permits
-- the existing native Run writer to insert and bind its receipt before the same transaction
-- inserts the terminal fact. A cancelled command has no destination and cannot satisfy this FK.
ALTER TABLE cycles ADD CONSTRAINT cycles_retest_request_binding_fk
  FOREIGN KEY (project_id,retest_request_key,retest_source_cycle_id,retest_request_digest,id)
  REFERENCES cycle_retest_requests(project_id,request_key,source_cycle_id,request_digest,destination_cycle_id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE FUNCTION preserve_native_retest_request() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Native retest request outcomes are immutable' USING ERRCODE='23514';
END;
$$;
CREATE TRIGGER native_retest_request_immutable BEFORE UPDATE OR DELETE ON cycle_retest_requests
FOR EACH ROW EXECUTE FUNCTION preserve_native_retest_request();

CREATE FUNCTION verify_native_retest_created_request() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.outcome='created' AND NOT EXISTS (
    SELECT 1 FROM cycles c WHERE c.id=NEW.destination_cycle_id AND c.project_id=NEW.project_id
      AND c.retest_source_cycle_id=NEW.source_cycle_id AND c.retest_request_key=NEW.request_key
      AND c.retest_request_digest=NEW.request_digest
      AND c.retest_manifest->>'createdBy'=NEW.requested_by::text
      AND c.retest_manifest->>'principalKind'='human_session'
  ) THEN
    RAISE EXCEPTION 'Created retest request must match its native Run receipt and human actor' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER native_retest_created_request_binding
  AFTER INSERT ON cycle_retest_requests DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION verify_native_retest_created_request();

COMMENT ON TABLE cycle_retest_requests IS
  'Immutable terminal native Run command dispositions: exact created receipt or explicit cancellation. No queued, attempt, result or approval state.';
COMMENT ON COLUMN cycle_retest_requests.requested_by IS
  'Historical authenticated human UUID, retained as exact command attribution without a new live-user deletion policy.';
