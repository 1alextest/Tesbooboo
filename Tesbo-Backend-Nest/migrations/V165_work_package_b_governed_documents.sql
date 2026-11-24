-- Work Package B first slice: governed manuals and policies on the existing KB identity/version owner.
--
-- Adds the two native document types and one typed, queryable metadata projection. The exact
-- metadata is copied into every governed version snapshot and participates in the content digest,
-- so approval binds the exact audience/authority/effectivity representation as well as the body.
-- Legacy rows default to an empty object and keep their existing source/provenance/review state.

DO $$ BEGIN
  ALTER TABLE knowledge_documents DROP CONSTRAINT knowledge_documents_document_type_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE knowledge_documents ADD CONSTRAINT knowledge_documents_document_type_check
  CHECK (document_type IN ('general', 'requirement_note', 'test_data_note', 'api_note', 'release_note',
                           'ai_memory', 'skill', 'user_manual', 'policy'));

ALTER TABLE knowledge_documents
  ADD COLUMN IF NOT EXISTS governed_metadata JSONB NOT NULL DEFAULT '{}'::jsonb
  CHECK (jsonb_typeof(governed_metadata) = 'object');

COMMENT ON COLUMN knowledge_documents.governed_metadata IS
  'Typed audience/subtype/confidentiality/distribution/source-authority/effectivity/enforcement metadata for user_manual and policy. Empty for other document types.';

-- Extend the existing review-invalidation owner. A content, source or governed-metadata edit clears
-- the exact human review; a reviewed governed document cannot change type to bypass review.
CREATE OR REPLACE FUNCTION invalidate_changed_knowledge_review() RETURNS trigger AS $$
BEGIN
  IF OLD.document_type IN ('ai_memory','requirement_note','user_manual','policy') AND NEW.document_type <> OLD.document_type THEN
    RAISE EXCEPTION 'A reviewed document cannot bypass review by changing document type'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.document_type IN ('ai_memory','requirement_note','user_manual','policy') AND
     (ROW(NEW.folder_id, NEW.title, NEW.content_json, NEW.content_html, NEW.content_text,
          NEW.document_type, NEW.source_provider, NEW.source_external_id, NEW.source_url,
          NEW.source_role, NEW.is_read_only, NEW.governed_metadata)
      IS DISTINCT FROM
      ROW(OLD.folder_id, OLD.title, OLD.content_json, OLD.content_html, OLD.content_text,
          OLD.document_type, OLD.source_provider, OLD.source_external_id, OLD.source_url,
          OLD.source_role, OLD.is_read_only, OLD.governed_metadata)) THEN
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
