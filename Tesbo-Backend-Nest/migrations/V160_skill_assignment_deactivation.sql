-- Existing active assignments must remain explicitly revocable after their dependencies become
-- hidden (for example, legacy Trash or document-type drift). Do not make those dependencies
-- eligible again or permit a new assignment. The separate history trigger still rejects any
-- identity/pinned-version change and inactive-to-active transition.
CREATE OR REPLACE FUNCTION validate_skill_assignment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE doc RECORD; version RECORD; profile RECORD;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = 'active' AND NEW.status = 'inactive' THEN
    RETURN NEW;
  END IF;
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
