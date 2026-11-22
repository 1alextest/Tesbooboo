-- WP-A staging: authoritative requirements remain KB documents/versions. This migration writes
-- only append-only operations beneath the existing ai_generation_requests review task owner.
CREATE FUNCTION valid_requirement_criteria(value JSONB) RETURNS BOOLEAN LANGUAGE SQL IMMUTABLE AS $$
 SELECT CASE WHEN jsonb_typeof(value)='array' THEN jsonb_array_length(value) BETWEEN 1 AND 100 AND
 (SELECT count(DISTINCT item->>'key')=count(*) AND bool_and(COALESCE(jsonb_typeof(item)='object'
 AND item-ARRAY['key','text']::TEXT[]='{}'::JSONB AND jsonb_typeof(item->'key')='string'
 AND item->>'key' ~ '^[A-Za-z][A-Za-z0-9_.-]{0,63}$' AND jsonb_typeof(item->'text')='string'
 AND length(btrim(item->>'text')) BETWEEN 1 AND 4000,FALSE)) FROM jsonb_array_elements(value) item) ELSE FALSE END;
$$;
CREATE FUNCTION valid_requirement_sources(value JSONB) RETURNS BOOLEAN LANGUAGE SQL IMMUTABLE AS $$
 SELECT CASE WHEN jsonb_typeof(value)='array' THEN jsonb_array_length(value)<=50 AND COALESCE((SELECT bool_and(COALESCE(
 jsonb_typeof(item)='object' AND item-ARRAY['label','url']::TEXT[]='{}'::JSONB AND jsonb_typeof(item->'label')='string'
 AND length(btrim(item->>'label')) BETWEEN 1 AND 200 AND jsonb_typeof(item->'url')='string' AND length(item->>'url') BETWEEN 1 AND 2048
 AND item->>'url' ~ '^https?://[^/?#[:space:]]+' AND item->>'url' !~ '^https?://[^/?#]*@',FALSE))
 FROM jsonb_array_elements(value) item),TRUE) ELSE FALSE END;
$$;
ALTER TABLE ai_generation_requests ADD COLUMN proposal_governance JSONB;
ALTER TABLE ai_generation_requests ADD COLUMN proposal_operation_sequence BIGINT NOT NULL DEFAULT 0;
ALTER TABLE ai_generation_requests ADD COLUMN proposal_current_requirement_operation_id UUID;
ALTER TABLE ai_generation_requests ADD CONSTRAINT proposal_task_project_unique UNIQUE(id,project_id);
ALTER TABLE ai_generation_requests ADD CONSTRAINT proposal_task_governance CHECK (proposal_governance IS NULL OR
 proposal_governance='{"policy":"unpublished_proposals_only","skillContext":{"status":"unavailable","resolvedAt":null}}'::JSONB);
CREATE UNIQUE INDEX requirement_proposal_create_request ON ai_generation_requests(project_id,proposal_request_key) WHERE proposal_governance IS NOT NULL;
CREATE TABLE proposal_operations (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), task_id UUID NOT NULL, project_id UUID NOT NULL,
 operation_sequence BIGINT NOT NULL CHECK(operation_sequence>0),
 operation_kind TEXT NOT NULL CHECK(operation_kind IN ('requirement_revision','testcase_revision','requirement_case_link','withdraw_requirement','withdraw_link')),
 parent_operation_id UUID, requirement_operation_id UUID, target_operation_id UUID,
 payload JSONB NOT NULL CHECK(jsonb_typeof(payload)='object'), content_digest CHAR(64) NOT NULL CHECK(content_digest ~ '^[a-f0-9]{64}$'),
 submission_key TEXT NOT NULL CHECK(length(submission_key) BETWEEN 1 AND 256), request_digest CHAR(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
 provenance JSONB NOT NULL CHECK(jsonb_typeof(provenance)='object'), created_by UUID REFERENCES actors(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(id,task_id,project_id), UNIQUE(task_id,operation_sequence), UNIQUE(task_id,submission_key),
 FOREIGN KEY(task_id,project_id) REFERENCES ai_generation_requests(id,project_id) ON DELETE CASCADE,
 FOREIGN KEY(parent_operation_id,task_id,project_id) REFERENCES proposal_operations(id,task_id,project_id),
 FOREIGN KEY(requirement_operation_id,task_id,project_id) REFERENCES proposal_operations(id,task_id,project_id),
 FOREIGN KEY(target_operation_id,task_id,project_id) REFERENCES proposal_operations(id,task_id,project_id)
);
ALTER TABLE ai_generation_requests ADD CONSTRAINT proposal_current_requirement_scope FOREIGN KEY(proposal_current_requirement_operation_id,id,project_id)
 REFERENCES proposal_operations(id,task_id,project_id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX proposal_operations_history ON proposal_operations(task_id,operation_sequence);
CREATE UNIQUE INDEX proposal_link_withdrawal_once ON proposal_operations(task_id,target_operation_id)
 WHERE operation_kind='withdraw_link';
CREATE FUNCTION validate_native_proposal_operation() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE task ai_generation_requests%ROWTYPE; basis proposal_operations%ROWTYPE; keys TEXT[]; selected_criteria JSONB; target proposal_operations%ROWTYPE;
BEGIN
 SELECT * INTO task FROM ai_generation_requests WHERE id=NEW.task_id AND project_id=NEW.project_id FOR UPDATE;
 IF NOT FOUND OR task.proposal_governance IS NULL THEN RAISE EXCEPTION 'An operation requires its governed staging task'; END IF;
 IF task.task_status<>'in_review' THEN RAISE EXCEPTION 'A withdrawn staging task cannot be changed'; END IF;
 IF NEW.operation_sequence<>task.proposal_operation_sequence+1 THEN RAISE EXCEPTION 'Proposal operation sequence must advance exactly once'; END IF;
 NEW.content_digest:=encode(sha256(convert_to(NEW.payload::TEXT,'UTF8')),'hex');
 IF (NEW.provenance->>'kind' IN ('human_session','api_token') AND jsonb_typeof(NEW.provenance->'principalKey')='string'
 AND jsonb_typeof(NEW.provenance->'issuerId')='string') IS NOT TRUE THEN RAISE EXCEPTION 'Proposal provenance must identify its real producer'; END IF;
 IF NEW.operation_kind='requirement_revision' THEN
  IF NEW.parent_operation_id IS DISTINCT FROM task.proposal_current_requirement_operation_id OR NEW.requirement_operation_id IS NOT NULL OR NEW.target_operation_id IS NOT NULL
  THEN RAISE EXCEPTION 'Requirement proposal iteration must extend its exact current operation'; END IF;
  IF (NEW.payload-ARRAY['title','description','criteria','rationale','sourceRefs']::TEXT[]='{}'::JSONB
   AND jsonb_typeof(NEW.payload->'title')='string' AND length(btrim(NEW.payload->>'title')) BETWEEN 1 AND 512
   AND jsonb_typeof(NEW.payload->'description')='string' AND length(NEW.payload->>'description')<=20000
   AND jsonb_typeof(NEW.payload->'rationale')='string' AND length(NEW.payload->>'rationale')<=4000
   AND valid_requirement_criteria(NEW.payload->'criteria') AND valid_requirement_sources(NEW.payload->'sourceRefs')) IS NOT TRUE
  THEN RAISE EXCEPTION 'Malformed requirement proposal content'; END IF;
 ELSIF NEW.operation_kind IN ('testcase_revision','requirement_case_link') THEN
  SELECT * INTO basis FROM proposal_operations WHERE id=NEW.requirement_operation_id AND task_id=NEW.task_id AND project_id=NEW.project_id AND operation_kind='requirement_revision';
  IF NOT FOUND THEN RAISE EXCEPTION 'Requirement lineage mismatch in staged operation'; END IF;
  IF NEW.operation_kind='testcase_revision' THEN
   IF (jsonb_typeof(NEW.payload->'operations')='array' AND jsonb_array_length(NEW.payload->'operations')<=100
    AND NEW.payload->'requirement'->>'id'=NEW.task_id::TEXT AND NEW.payload->'requirement'->>'versionId'=basis.id::TEXT
    AND NEW.payload->'requirement'->>'contentDigest'=basis.content_digest) IS NOT TRUE THEN RAISE EXCEPTION 'Case iteration must preserve its exact requirement proposal basis'; END IF;
   SELECT array_agg(value) INTO keys FROM jsonb_array_elements_text(NEW.payload->'requirement'->'criterionKeys');
  ELSE
   IF NEW.requirement_operation_id IS DISTINCT FROM task.proposal_current_requirement_operation_id
   THEN RAISE EXCEPTION 'Association proposal must use the current requirement iteration'; END IF;
   IF (NEW.payload->>'requirementVersionId'=basis.id::TEXT AND NEW.payload->>'requirementContentDigest'=basis.content_digest
    AND NEW.payload->'caseSnapshot'->>'id'=NEW.payload->>'testcaseId' AND NEW.payload->'caseSnapshot'->>'editRevision'=NEW.payload->>'testcaseRevision'
    AND NEW.payload->>'testcaseRevision' ~ '^[a-f0-9]{64}$') IS NOT TRUE THEN RAISE EXCEPTION 'Association proposal must pin exact requirement and case revisions'; END IF;
   IF NOT EXISTS(SELECT 1 FROM testcases WHERE id=(NEW.payload->>'testcaseId')::UUID AND project_id=NEW.project_id)
   THEN RAISE EXCEPTION 'Association proposal case must belong to the same project'; END IF;
   SELECT array_agg(value) INTO keys FROM jsonb_array_elements_text(NEW.payload->'criterionKeys');
  END IF;
  IF COALESCE(cardinality(keys),0) NOT BETWEEN 1 AND 100 OR cardinality(keys)<>(SELECT count(DISTINCT key) FROM unnest(keys) key)
  THEN RAISE EXCEPTION 'Proposed criterion keys must be nonempty and unique'; END IF;
  IF keys IS DISTINCT FROM (SELECT array_agg(key ORDER BY key COLLATE "C") FROM unnest(keys) key)
  THEN RAISE EXCEPTION 'Proposed criterion keys must be canonical'; END IF;
  SELECT jsonb_agg(criterion ORDER BY ordinality) INTO selected_criteria FROM jsonb_array_elements(basis.payload->'criteria') WITH ORDINALITY AS entry(criterion,ordinality)
   WHERE criterion->>'key'=ANY(keys);
  IF jsonb_array_length(selected_criteria) IS DISTINCT FROM cardinality(keys) THEN RAISE EXCEPTION 'Criterion keys must belong to the exact requirement iteration'; END IF;
  IF NEW.operation_kind='testcase_revision' AND NEW.payload->'requirement'->'criteria' IS DISTINCT FROM selected_criteria
  THEN RAISE EXCEPTION 'Case proposal criterion content must match its immutable requirement iteration'; END IF;
  IF NEW.operation_kind='requirement_case_link' AND EXISTS(SELECT 1 FROM proposal_operations l
    WHERE l.task_id=NEW.task_id AND l.operation_kind='requirement_case_link' AND l.requirement_operation_id=NEW.requirement_operation_id
    AND l.payload->>'testcaseId'=NEW.payload->>'testcaseId' AND l.payload->'criterionKeys'=NEW.payload->'criterionKeys'
    AND NOT EXISTS(SELECT 1 FROM proposal_operations w WHERE w.target_operation_id=l.id AND w.operation_kind='withdraw_link'))
  THEN RAISE EXCEPTION 'Equivalent association is already proposed'; END IF;
 ELSE
  IF NEW.operation_kind='withdraw_link' THEN
   SELECT * INTO target FROM proposal_operations WHERE id=NEW.target_operation_id AND task_id=NEW.task_id AND project_id=NEW.project_id AND operation_kind='requirement_case_link';
   IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal must name its own proposed association'; END IF;
   IF NEW.provenance->>'kind'<>'human_session' AND NEW.provenance->>'principalKey' IS DISTINCT FROM target.provenance->>'principalKey'
   THEN RAISE EXCEPTION 'A machine principal may only withdraw its own proposed association'; END IF;
  ELSIF NEW.target_operation_id IS NOT NULL THEN RAISE EXCEPTION 'Requirement withdrawal applies to its staging task';
  ELSIF NEW.provenance->>'kind'<>'human_session' AND NEW.provenance->>'principalKey' IS DISTINCT FROM task.proposal_provenance->>'principalKey'
  THEN RAISE EXCEPTION 'A machine principal may only withdraw its own staged requirement'; END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER native_proposal_operation_valid BEFORE INSERT ON proposal_operations FOR EACH ROW EXECUTE FUNCTION validate_native_proposal_operation();
CREATE FUNCTION preserve_native_proposal_operation() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF EXISTS(SELECT 1 FROM projects WHERE id=OLD.project_id) THEN RAISE EXCEPTION 'Proposal operations are immutable; withdraw instead'; END IF;
  RETURN OLD;
 END IF;
 IF to_jsonb(NEW)-'created_by' IS DISTINCT FROM to_jsonb(OLD)-'created_by' OR (NEW.created_by IS DISTINCT FROM OLD.created_by AND NEW.created_by IS NOT NULL)
 THEN RAISE EXCEPTION 'Proposal operations are immutable'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER native_proposal_operation_immutable BEFORE UPDATE OR DELETE ON proposal_operations FOR EACH ROW EXECUTE FUNCTION preserve_native_proposal_operation();
CREATE FUNCTION project_native_proposal_operation() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 UPDATE ai_generation_requests SET proposal_operation_sequence=NEW.operation_sequence,
 proposal_current_requirement_operation_id=CASE WHEN NEW.operation_kind='requirement_revision' THEN NEW.id ELSE proposal_current_requirement_operation_id END,
 generated_payload=CASE WHEN NEW.operation_kind='testcase_revision' THEN NEW.payload->'operations' ELSE generated_payload END,
 generated_count=CASE WHEN NEW.operation_kind='testcase_revision' THEN GREATEST(generated_count,jsonb_array_length(NEW.payload->'operations')) ELSE generated_count END,
 task_status=CASE WHEN NEW.operation_kind='withdraw_requirement' THEN 'done' ELSE task_status END,
 user_story=CASE WHEN NEW.operation_kind='requirement_revision' THEN NEW.payload->>'title' ELSE user_story END,updated_at=now()
 WHERE id=NEW.task_id AND project_id=NEW.project_id;
 RETURN NEW;
END;
$$;
CREATE TRIGGER native_proposal_operation_project AFTER INSERT ON proposal_operations FOR EACH ROW EXECUTE FUNCTION project_native_proposal_operation();
CREATE OR REPLACE FUNCTION bump_native_proposal_revision() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.generated_payload IS DISTINCT FROM OLD.generated_payload OR NEW.task_status IS DISTINCT FROM OLD.task_status OR NEW.proposal_operation_sequence IS DISTINCT FROM OLD.proposal_operation_sequence
 THEN NEW.proposal_revision:=OLD.proposal_revision+1; END IF;
 RETURN NEW;
END;
$$;
CREATE FUNCTION preserve_requirement_task_context() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE latest_requirement proposal_operations%ROWTYPE; latest_cases proposal_operations%ROWTYPE; withdrawn BOOLEAN; last_sequence BIGINT;
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.proposal_governance IS NOT NULL AND EXISTS(SELECT 1 FROM projects WHERE id=OLD.project_id) THEN RAISE EXCEPTION 'Governed staging tasks preserve immutable operations; withdraw instead'; END IF;
  RETURN OLD;
 END IF;
 IF NEW.proposal_governance IS DISTINCT FROM OLD.proposal_governance THEN RAISE EXCEPTION 'Requirement proposal governance is immutable'; END IF;
 IF OLD.proposal_governance IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO latest_requirement FROM proposal_operations WHERE task_id=OLD.id AND operation_kind='requirement_revision' ORDER BY operation_sequence DESC LIMIT 1;
 SELECT * INTO latest_cases FROM proposal_operations WHERE task_id=OLD.id AND operation_kind='testcase_revision' ORDER BY operation_sequence DESC LIMIT 1;
 SELECT EXISTS(SELECT 1 FROM proposal_operations WHERE task_id=OLD.id AND operation_kind='withdraw_requirement') INTO withdrawn;
 SELECT MAX(operation_sequence) INTO last_sequence FROM proposal_operations WHERE task_id=OLD.id;
 IF NEW.proposal_operation_sequence IS DISTINCT FROM last_sequence OR NEW.proposal_current_requirement_operation_id IS DISTINCT FROM latest_requirement.id
 OR NEW.user_story IS DISTINCT FROM latest_requirement.payload->>'title' OR NEW.generated_payload IS DISTINCT FROM COALESCE(latest_cases.payload->'operations','[]'::JSONB)
 OR NEW.task_status IS DISTINCT FROM CASE WHEN withdrawn THEN 'done' ELSE 'in_review' END OR NEW.saved_count<>0 OR NEW.save_events<>'[]'::JSONB
 THEN RAISE EXCEPTION 'Governed task projections must follow immutable proposal operations; publication is blocked'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER requirement_task_context_immutable BEFORE UPDATE OR DELETE ON ai_generation_requests FOR EACH ROW EXECUTE FUNCTION preserve_requirement_task_context();
CREATE FUNCTION ensure_requirement_proposal_head() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM ai_generation_requests WHERE id=NEW.id AND proposal_governance IS NOT NULL AND (proposal_current_requirement_operation_id IS NULL OR proposal_operation_sequence=0))
 THEN RAISE EXCEPTION 'A requirement proposal task must contain its first immutable operation'; END IF;
 RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER requirement_proposal_head AFTER INSERT ON ai_generation_requests DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ensure_requirement_proposal_head();
-- One coherent read binds requirement, case and link operations into the existing review digest.
ALTER FUNCTION testcase_proposal_review_snapshot(UUID) RENAME TO testcase_proposal_review_snapshot_v157;
CREATE FUNCTION testcase_proposal_review_snapshot(request_id UUID) RETURNS JSONB LANGUAGE SQL STABLE AS $$
 SELECT testcase_proposal_review_snapshot_v157(request_id)||CASE WHEN r.proposal_governance IS NULL THEN '{}'::JSONB ELSE
 jsonb_build_object('governance',r.proposal_governance,'stagedOperations',COALESCE((SELECT jsonb_agg(jsonb_build_object(
 'id',o.id,'operationId',o.id,'identityKind','proposal_operation','operationKind',o.operation_kind,'sequence',o.operation_sequence,
 'parentOperationId',o.parent_operation_id,'requirementOperationId',o.requirement_operation_id,'targetOperationId',o.target_operation_id,
 'payload',o.payload,'contentDigest',o.content_digest,'provenance',o.provenance,'createdAt',o.created_at) ORDER BY o.operation_sequence)
 FROM proposal_operations o WHERE o.task_id=r.id),'[]'::JSONB),'requirement',(SELECT jsonb_build_object(
 'id',r.id,'taskId',r.id,'identityKind','proposal_task','nativeDocumentId',NULL,'operationId',o.id,'versionId',o.id,'nativeVersionId',NULL,
 'contentDigest',o.content_digest,'payload',o.payload) FROM proposal_operations o WHERE o.id=r.proposal_current_requirement_operation_id)) END
 FROM ai_generation_requests r WHERE r.id=request_id;
$$;
