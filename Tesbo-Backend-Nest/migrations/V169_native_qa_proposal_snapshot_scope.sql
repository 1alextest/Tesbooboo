-- Retain V159's review snapshot bytes and digest basis for the existing kinds.
-- The shared snapshot must not reinterpret future external QA work as a proposal.
CREATE OR REPLACE FUNCTION testcase_proposal_review_snapshot(request_id UUID) RETURNS JSONB
LANGUAGE SQL STABLE AS $$
 SELECT jsonb_build_object(
   'taskId',r.id,'projectId',r.project_id,'taskStatus',r.task_status,'version',r.proposal_revision,
   'targetBinding','coherent_review_read','operations',r.generated_payload,
   'skillContext',r.skill_context,
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
 ) FROM ai_generation_requests r JOIN projects p ON p.id=r.project_id WHERE r.id=request_id AND r.task_kind IN ('legacy_generation_review','governed_proposal');
$$;
