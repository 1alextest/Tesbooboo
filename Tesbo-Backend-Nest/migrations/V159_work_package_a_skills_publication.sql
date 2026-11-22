-- Work Package A Slice 2: minimum governed Skills resolution and protected publication.
--
-- Skills reuse the native Knowledge Base identity/version owner instead of introducing a second
-- content or version store. A skill is a knowledge_documents row with document_type='skill'; its
-- approved instruction revisions are knowledge_document_versions rows written by the same governed
-- snapshot path. Separate typed records carry the skill identity metadata and the human-only project
-- assignments. Requirement rules and typed requirement-case links are additive tables over KB/case
-- identity. Nothing here backfills or promotes an existing document, and no skill is auto-assigned.

DO $$ BEGIN
  ALTER TABLE knowledge_documents DROP CONSTRAINT knowledge_documents_document_type_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
ALTER TABLE knowledge_documents ADD CONSTRAINT knowledge_documents_document_type_check
  CHECK (document_type IN ('general', 'requirement_note', 'test_data_note', 'api_note', 'release_note', 'ai_memory', 'skill'));

-- A native requirement approval is bound to the exact submitted content, exactly like AI memory.
-- Any later content/criteria or source-metadata edit clears that binding and status. Skills keep
-- their own approved version pointers and do not enter the authoring-document review path.
CREATE OR REPLACE FUNCTION invalidate_changed_knowledge_review() RETURNS trigger AS $$
BEGIN
  IF OLD.document_type IN ('ai_memory','requirement_note') AND NEW.document_type <> OLD.document_type THEN
    RAISE EXCEPTION 'A reviewed document cannot bypass review by changing document type'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.document_type IN ('ai_memory','requirement_note') AND
     (ROW(NEW.folder_id, NEW.title, NEW.content_json, NEW.content_html, NEW.content_text,
          NEW.document_type, NEW.source_provider, NEW.source_external_id, NEW.source_url,
          NEW.source_role, NEW.is_read_only)
      IS DISTINCT FROM
      ROW(OLD.folder_id, OLD.title, OLD.content_json, OLD.content_html, OLD.content_text,
          OLD.document_type, OLD.source_provider, OLD.source_external_id, OLD.source_url,
          OLD.source_role, OLD.is_read_only)) THEN
    NEW.status := 'draft';
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    NEW.reviewed_version_id := NULL;
  END IF;
  IF NEW.status NOT IN ('approved', 'rejected') THEN
    NEW.reviewed_version_id := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Composite identities required by the lineage foreign keys below.
CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_documents_id_project
  ON knowledge_documents(id, project_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_versions_id_document
  ON knowledge_document_versions(id, document_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_generation_requests_id_project
  ON ai_generation_requests(id, project_id);

-- The reviewed-payload snapshot must carry the pinned effective skill basis, so a changed
-- assignment set changes the revision a human reviewed instead of silently reusing it.
ALTER TABLE ai_generation_requests ADD COLUMN skill_context JSONB NOT NULL DEFAULT '{}'::jsonb;

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
 ) FROM ai_generation_requests r JOIN projects p ON p.id=r.project_id WHERE r.id=request_id;
$$;

-- ─── Skills: identity metadata, human assignments, effective resolution ─────────────────────

CREATE TABLE skill_profiles (
  document_id UUID PRIMARY KEY,
  project_id  UUID NOT NULL,
  skill_key   VARCHAR(64) NOT NULL,
  module      VARCHAR(32) NOT NULL
    CHECK (module IN ('requirements','test_cases','user_manuals','policies','tasks_issues','files_evidence','skills')),
  subtype     VARCHAR(32) NOT NULL DEFAULT '*',
  state       VARCHAR(16) NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','active','retired')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, skill_key),
  FOREIGN KEY (document_id, project_id) REFERENCES knowledge_documents(id, project_id) ON DELETE CASCADE
);

CREATE TABLE skill_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  module VARCHAR(32) NOT NULL,
  subtype VARCHAR(32) NOT NULL DEFAULT '*',   -- '*' matches any subtype
  operation VARCHAR(64) NOT NULL DEFAULT '*', -- '*' matches any operation
  skill_document_id UUID NOT NULL,
  skill_version_id UUID NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  precedence INTEGER NOT NULL DEFAULT 0,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deactivated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  deactivated_at TIMESTAMPTZ,
  CHECK (status <> 'active' OR (assigned_by IS NOT NULL AND deactivated_at IS NULL)),
  FOREIGN KEY (skill_document_id, project_id) REFERENCES knowledge_documents(id, project_id) ON DELETE CASCADE,
  FOREIGN KEY (skill_version_id, skill_document_id) REFERENCES knowledge_document_versions(id, document_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX idx_skill_assignments_active_exact
  ON skill_assignments(project_id, module, subtype, operation) WHERE status = 'active';
CREATE INDEX idx_skill_assignments_resolution
  ON skill_assignments(project_id, module, subtype, operation) WHERE status = 'active';

CREATE FUNCTION validate_skill_assignment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE doc RECORD; version RECORD; profile RECORD;
BEGIN
  SELECT document_type, project_id, is_deleted INTO doc FROM knowledge_documents WHERE id=NEW.skill_document_id;
  IF doc IS NULL OR doc.document_type <> 'skill' OR doc.project_id <> NEW.project_id OR doc.is_deleted THEN
    RAISE EXCEPTION 'A skill assignment must target a non-deleted skill document in the same project' USING ERRCODE='23514';
  END IF;
  SELECT snapshot_kind, snapshot_metadata, document_id INTO version
    FROM knowledge_document_versions WHERE id=NEW.skill_version_id;
  IF version IS NULL OR version.document_id <> NEW.skill_document_id OR version.snapshot_kind <> 'approved' THEN
    RAISE EXCEPTION 'A skill assignment must pin an approved immutable version of its skill' USING ERRCODE='23514';
  END IF;
  SELECT module, subtype INTO profile FROM skill_profiles WHERE document_id=NEW.skill_document_id;
  IF profile IS NULL OR profile.module <> NEW.module THEN
    RAISE EXCEPTION 'A skill assignment module must match its skill profile' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER skill_assignment_valid BEFORE INSERT OR UPDATE ON skill_assignments
FOR EACH ROW EXECUTE FUNCTION validate_skill_assignment();

CREATE FUNCTION preserve_skill_assignment_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.project_id IS DISTINCT FROM OLD.project_id OR NEW.module IS DISTINCT FROM OLD.module
     OR NEW.subtype IS DISTINCT FROM OLD.subtype OR NEW.operation IS DISTINCT FROM OLD.operation
     OR NEW.skill_document_id IS DISTINCT FROM OLD.skill_document_id
     OR NEW.skill_version_id IS DISTINCT FROM OLD.skill_version_id
     OR NEW.assigned_by IS DISTINCT FROM OLD.assigned_by OR NEW.assigned_at IS DISTINCT FROM OLD.assigned_at
     OR NEW.precedence IS DISTINCT FROM OLD.precedence THEN
    RAISE EXCEPTION 'Skill assignment identity and pinned version are immutable; create a new assignment generation' USING ERRCODE='23514';
  END IF;
  IF OLD.status='inactive' AND NEW.status='active' THEN
    RAISE EXCEPTION 'An inactive skill assignment cannot be reactivated; create a new assignment' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER skill_assignment_history BEFORE UPDATE ON skill_assignments
FOR EACH ROW EXECUTE FUNCTION preserve_skill_assignment_history();

-- ─── Requirement profile, typed links and review lineage ─────────────────────────────────────

CREATE TABLE requirement_profiles (
  document_id UUID PRIMARY KEY,
  project_id  UUID NOT NULL,
  requirement_key VARCHAR(32) NOT NULL,
  state VARCHAR(16) NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','active','retired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, requirement_key),
  FOREIGN KEY (document_id, project_id) REFERENCES knowledge_documents(id, project_id) ON DELETE CASCADE
);

CREATE TABLE requirement_case_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  requirement_id UUID NOT NULL,
  requirement_version_id UUID NOT NULL,
  criterion_keys TEXT[] NOT NULL CHECK (cardinality(criterion_keys) > 0),
  testcase_id UUID NOT NULL,
  testcase_revision CHAR(64) NOT NULL,
  testcase_approval_revision CHAR(64),
  state VARCHAR(16) NOT NULL DEFAULT 'proposed'
    CHECK (state IN ('proposed','active','retired','withdrawn')),
  proposed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  proposed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_by UUID REFERENCES users(id) ON DELETE SET NULL,
  applied_at TIMESTAMPTZ,
  retired_by UUID REFERENCES users(id) ON DELETE SET NULL,
  retired_at TIMESTAMPTZ,
  CHECK (state <> 'active' OR (applied_at IS NOT NULL AND applied_by IS NOT NULL)),
  FOREIGN KEY (requirement_id, project_id)
    REFERENCES knowledge_documents(id, project_id) ON DELETE CASCADE,
  FOREIGN KEY (requirement_version_id, requirement_id)
    REFERENCES knowledge_document_versions(id, document_id) ON DELETE CASCADE,
  FOREIGN KEY (testcase_id, project_id)
    REFERENCES testcases(id, project_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX idx_requirement_case_link_live
  ON requirement_case_links(requirement_version_id, testcase_id, criterion_keys)
  WHERE state IN ('proposed','active');
CREATE INDEX idx_requirement_case_link_requirement
  ON requirement_case_links(project_id, requirement_id, requirement_version_id, state);

CREATE FUNCTION validate_requirement_case_link() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE doc RECORD; version RECORD; version_keys TEXT[];
BEGIN
  SELECT document_type, source_provider, project_id, is_deleted INTO doc FROM knowledge_documents WHERE id=NEW.requirement_id;
  IF doc IS NULL OR doc.document_type <> 'requirement_note' OR doc.source_provider IS NOT NULL
     OR doc.project_id <> NEW.project_id OR doc.is_deleted THEN
    RAISE EXCEPTION 'A requirement link must target a native, non-mirror requirement in the same project' USING ERRCODE='23514';
  END IF;
  SELECT snapshot_kind, snapshot_metadata, document_id INTO version
    FROM knowledge_document_versions WHERE id=NEW.requirement_version_id;
  IF version IS NULL OR version.document_id <> NEW.requirement_id
     OR version.snapshot_kind NOT IN ('submitted','approved') THEN
    RAISE EXCEPTION 'A requirement link must name a submitted or approved version of its requirement' USING ERRCODE='23514';
  END IF;
  SELECT array_agg(value->>'key') INTO version_keys
    FROM jsonb_array_elements(COALESCE(version.snapshot_metadata->'criteria','[]'::jsonb));
  IF version_keys IS NULL OR NOT (NEW.criterion_keys <@ version_keys) THEN
    RAISE EXCEPTION 'Linked criterion keys must exist in the reviewed requirement version' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER requirement_case_link_valid BEFORE INSERT OR UPDATE ON requirement_case_links
FOR EACH ROW EXECUTE FUNCTION validate_requirement_case_link();

CREATE FUNCTION preserve_requirement_case_link_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.project_id IS DISTINCT FROM OLD.project_id
     OR NEW.requirement_id IS DISTINCT FROM OLD.requirement_id
     OR NEW.requirement_version_id IS DISTINCT FROM OLD.requirement_version_id
     OR NEW.criterion_keys IS DISTINCT FROM OLD.criterion_keys
     OR NEW.testcase_id IS DISTINCT FROM OLD.testcase_id
     OR NEW.testcase_revision IS DISTINCT FROM OLD.testcase_revision
     OR NEW.testcase_approval_revision IS DISTINCT FROM OLD.testcase_approval_revision
     OR NEW.proposed_by IS DISTINCT FROM OLD.proposed_by OR NEW.proposed_at IS DISTINCT FROM OLD.proposed_at THEN
    RAISE EXCEPTION 'Requirement case link identity is immutable; retire it and propose a new link' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER requirement_case_link_history BEFORE UPDATE ON requirement_case_links
FOR EACH ROW EXECUTE FUNCTION preserve_requirement_case_link_history();

-- The current approved pointer can only name a version of its own document. MATCH SIMPLE permits
-- an unreviewed document's NULL pointer; deleting a referenced version is refused rather than
-- silently clearing the approval.
ALTER TABLE knowledge_documents ADD CONSTRAINT knowledge_documents_reviewed_version_lineage
  FOREIGN KEY (reviewed_version_id, id)
  REFERENCES knowledge_document_versions(id, document_id)
  ON DELETE NO ACTION;
