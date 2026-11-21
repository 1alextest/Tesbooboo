-- Extend the existing unpublished proposal owner. No new case/proposal/approval store.
ALTER TABLE ai_generation_requests ADD COLUMN proposal_revision BIGINT NOT NULL DEFAULT 0;
ALTER TABLE ai_generation_requests ADD COLUMN proposal_request_key TEXT;
ALTER TABLE ai_generation_requests ADD COLUMN proposal_request_digest CHAR(64);
ALTER TABLE ai_generation_requests ADD COLUMN proposal_provenance JSONB;
CREATE UNIQUE INDEX idx_native_proposal_request ON ai_generation_requests
  (project_id,(proposal_provenance->>'principalKey'),proposal_request_key)
  WHERE proposal_request_key IS NOT NULL;

CREATE FUNCTION bump_native_proposal_revision() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.generated_payload IS DISTINCT FROM OLD.generated_payload OR NEW.task_status IS DISTINCT FROM OLD.task_status THEN
    NEW.proposal_revision := OLD.proposal_revision+1;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER native_proposal_revision BEFORE UPDATE ON ai_generation_requests
FOR EACH ROW EXECUTE FUNCTION bump_native_proposal_revision();

-- Existing legacy rows keep their original, possibly unobserved producer identity. New staged
-- identity is set only at INSERT; neither path can retroactively manufacture or rewrite it.
-- The new human publication receipts are append-only at their original array positions. This
-- leaves legacy bookkeeping entries readable without upgrading them to review evidence.
CREATE FUNCTION preserve_native_proposal_history() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE receipt RECORD;
BEGIN
  IF NEW.proposal_provenance IS DISTINCT FROM OLD.proposal_provenance
     OR NEW.proposal_request_key IS DISTINCT FROM OLD.proposal_request_key
     OR NEW.proposal_request_digest IS DISTINCT FROM OLD.proposal_request_digest THEN
    RAISE EXCEPTION 'Native proposal producer and request identity are immutable';
  END IF;
  IF OLD.proposal_provenance IS NOT NULL AND
     (NEW.project_id IS DISTINCT FROM OLD.project_id OR NEW.requested_by IS DISTINCT FROM OLD.requested_by
      OR NEW.provider IS DISTINCT FROM OLD.provider) THEN
    RAISE EXCEPTION 'Native proposal producer and project identity are immutable';
  END IF;
  FOR receipt IN SELECT value,ordinality FROM jsonb_array_elements(OLD.save_events) WITH ORDINALITY
                 WHERE value ? 'decisionKey' AND value ? 'proposalRevision' LOOP
    IF (NEW.save_events->((receipt.ordinality-1)::INT)) IS DISTINCT FROM receipt.value THEN
      RAISE EXCEPTION 'Committed human proposal publication receipts are immutable';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
CREATE TRIGGER native_proposal_history BEFORE UPDATE ON ai_generation_requests
FOR EACH ROW EXECUTE FUNCTION preserve_native_proposal_history();

-- A new case has no parent testcase row to lock yet. Serialize changes to the definitions
-- displayed in its proposal review through the native project row, before V154's case locks.
ALTER TABLE projects ADD COLUMN testcase_proposal_dependency_revision BIGINT NOT NULL DEFAULT 0;
CREATE FUNCTION bump_testcase_proposal_dependencies() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE before_row JSONB; after_row JSONB; project UUID;
BEGIN
  before_row := CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  after_row := CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  IF TG_OP='UPDATE' AND before_row - ARRAY['created_at','updated_at','created_by','updated_by']::TEXT[] =
                       after_row - ARRAY['created_at','updated_at','created_by','updated_by']::TEXT[] THEN RETURN NEW; END IF;
  FOR project IN SELECT DISTINCT id FROM unnest(ARRAY[(before_row->>'project_id')::UUID,(after_row->>'project_id')::UUID]) id
                 WHERE id IS NOT NULL ORDER BY id LOOP
    UPDATE projects SET testcase_proposal_dependency_revision=testcase_proposal_dependency_revision+1 WHERE id=project;
  END LOOP;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER proposal_dependencies_fields BEFORE INSERT OR UPDATE OR DELETE ON custom_field_definitions
FOR EACH ROW EXECUTE FUNCTION bump_testcase_proposal_dependencies();
CREATE TRIGGER proposal_dependencies_tags BEFORE INSERT OR UPDATE OR DELETE ON custom_tags
FOR EACH ROW EXECUTE FUNCTION bump_testcase_proposal_dependencies();
CREATE TRIGGER proposal_dependencies_suites BEFORE INSERT OR UPDATE OR DELETE ON suites
FOR EACH ROW EXECUTE FUNCTION bump_testcase_proposal_dependencies();

-- One statement supplies both the rendered proposal and its native target/dependency context.
-- Legacy/internal proposals bind targets at this explicit review read. External proposals also
-- carry their staging-time target revisions in generated_payload; Save verifies both bindings.
CREATE FUNCTION testcase_proposal_review_snapshot(request_id UUID) RETURNS JSONB
LANGUAGE SQL STABLE AS $$
 SELECT jsonb_build_object(
   'taskId',r.id,'projectId',r.project_id,'taskStatus',r.task_status,'version',r.proposal_revision,
   'targetBinding','coherent_review_read','operations',r.generated_payload,
   'sourceLinks',jsonb_build_object(
     'jiraIssueKeys',r.jira_issue_keys,'linearIssueKeys',r.linear_issue_keys,'notionPageIds',r.notion_page_ids,
     'jira',COALESCE((SELECT jsonb_agg(jsonb_build_object('key',j.jira_issue_key,'url',j.jira_url) ORDER BY j.jira_issue_key)
       FROM jira_tickets j WHERE j.project_id=r.project_id AND j.jira_issue_key IN (SELECT jsonb_array_elements_text(r.jira_issue_keys))),'[]'::JSONB),
     'linear',COALESCE((SELECT jsonb_agg(jsonb_build_object('key',j.linear_issue_key,'url',j.linear_url) ORDER BY j.linear_issue_key)
       FROM linear_tickets j WHERE j.project_id=r.project_id AND j.linear_issue_key IN (SELECT jsonb_array_elements_text(r.linear_issue_keys))),'[]'::JSONB),
     'notion',COALESCE((SELECT jsonb_agg(jsonb_build_object('key',j.notion_page_id,'url',j.notion_url) ORDER BY j.notion_page_id)
       FROM notion_pages j WHERE j.project_id=r.project_id AND j.notion_page_id IN (SELECT jsonb_array_elements_text(r.notion_page_ids))),'[]'::JSONB)
   ),
   'targets',COALESCE((SELECT jsonb_agg(jsonb_build_object(
     'testcaseId',t.id,'testcase',to_jsonb(t)-ARRAY['updated_at','embedding_status','embedding_content_hash','embedding_queued_at','search_vector']::TEXT[],
     'editRevision',encode(sha256(convert_to((to_jsonb(t)-'embedding_status'-'embedding_content_hash'-'embedding_queued_at'-'updated_at')::text,'UTF8')),'hex'),
     'approvalRevision',encode(sha256(convert_to(testcase_approval_snapshot(t.id)::text,'UTF8')),'hex'),
     'snapshot',testcase_approval_snapshot(t.id)) ORDER BY t.id)
     FROM testcases t WHERE t.project_id=r.project_id AND t.deleted_at IS NULL AND t.id IN
       (SELECT CASE WHEN e->>'testcaseId' ~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
                    THEN (e->>'testcaseId')::UUID ELSE NULL END
          FROM jsonb_array_elements(r.generated_payload) e WHERE e->>'opType' IN ('update','archive'))),'[]'::JSONB),
   'dependencies',jsonb_build_object(
     'revision',p.testcase_proposal_dependency_revision,
     'customFields',COALESCE((SELECT jsonb_agg(to_jsonb(d)-ARRAY['created_at','updated_at','created_by','updated_by']::TEXT[] ORDER BY d.id)
                              FROM custom_field_definitions d WHERE d.project_id=r.project_id),'[]'::JSONB),
     'customTags',COALESCE((SELECT jsonb_agg(to_jsonb(ct)-ARRAY['created_at','updated_at']::TEXT[] ORDER BY ct.id)
                            FROM custom_tags ct WHERE ct.project_id=r.project_id),'[]'::JSONB),
     'suites',COALESCE((SELECT jsonb_agg(to_jsonb(s)-ARRAY['created_at','updated_at']::TEXT[] ORDER BY s.id)
                        FROM suites s WHERE s.project_id=r.project_id AND s.deleted_at IS NULL),'[]'::JSONB)
   )
 ) FROM ai_generation_requests r JOIN projects p ON p.id=r.project_id WHERE r.id=request_id;
$$;
