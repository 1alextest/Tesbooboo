-- Reuse native document versions for exact submitted/reviewed content. Ordinary autosave
-- snapshots keep their existing 15-minute coalescing; they are never promoted into approvals.
ALTER TABLE knowledge_document_versions
  ADD COLUMN snapshot_kind VARCHAR(16) NOT NULL DEFAULT 'autosave',
  ADD COLUMN snapshot_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN submission_key UUID,
  ADD CONSTRAINT knowledge_version_snapshot_kind_check
    CHECK (snapshot_kind IN ('autosave', 'submitted', 'approved', 'rejected'));

CREATE UNIQUE INDEX idx_knowledge_version_submission_key
  ON knowledge_document_versions(document_id, submission_key) WHERE submission_key IS NOT NULL;

ALTER TABLE knowledge_documents
  ADD COLUMN reviewed_version_id UUID REFERENCES knowledge_document_versions(id) ON DELETE SET NULL;

-- Existing approved rows are retained with a NULL binding (legacy/unverified provenance).
-- No migration invents a historical submission, review receipt, skill or active assignment.
CREATE FUNCTION protect_governed_knowledge_version() RETURNS trigger AS $$
BEGIN
  IF NEW.snapshot_kind IS DISTINCT FROM OLD.snapshot_kind OR
     (OLD.snapshot_kind <> 'autosave' AND
      ((to_jsonb(NEW) - 'created_by') IS DISTINCT FROM (to_jsonb(OLD) - 'created_by') OR
       (NEW.created_by IS DISTINCT FROM OLD.created_by AND NEW.created_by IS NOT NULL))) THEN
    RAISE EXCEPTION 'Submitted and reviewed document versions are immutable'
      USING ERRCODE = '23514';
  END IF;
  -- created_by may become NULL through the existing users FK. The immutable metadata retains
  -- the original actor reference; this does not grant disclosure rights to a deleted user.
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER knowledge_version_governance_immutable
  BEFORE UPDATE ON knowledge_document_versions
  FOR EACH ROW EXECUTE FUNCTION protect_governed_knowledge_version();

-- The native document is still the editable working copy. Every writer (including restore and
-- background consumers) invalidates an AI-memory review when relied-on content changes.
CREATE FUNCTION invalidate_changed_knowledge_review() RETURNS trigger AS $$
BEGIN
  IF OLD.document_type = 'ai_memory' AND NEW.document_type <> 'ai_memory' THEN
    RAISE EXCEPTION 'AI memory cannot bypass review by changing document type'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.document_type = 'ai_memory' AND
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

CREATE TRIGGER knowledge_document_review_invalidation
  BEFORE UPDATE ON knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION invalidate_changed_knowledge_review();
