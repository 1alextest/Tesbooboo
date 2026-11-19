-- Exact native case approval. Old receipts remain historical, with unknown semantic binding.
ALTER TABLE testcases ADD COLUMN review_dependency_revision BIGINT NOT NULL DEFAULT 0;
ALTER TABLE testcase_approval_receipts ADD COLUMN semantic_revision CHAR(64);
ALTER TABLE testcase_approval_receipts ADD COLUMN reviewed_snapshot JSONB;
ALTER TABLE testcase_approval_receipts ADD COLUMN principal_kind TEXT
  CHECK (principal_kind IS NULL OR principal_kind = 'human_session');
ALTER TABLE testcase_approval_receipts ADD CONSTRAINT testcase_approval_snapshot_binding CHECK (
  (semantic_revision IS NULL AND reviewed_snapshot IS NULL AND principal_kind IS NULL) OR
  (semantic_revision IS NOT NULL AND reviewed_snapshot IS NOT NULL AND principal_kind IS NOT NULL AND principal_kind='human_session' AND
   semantic_revision=encode(sha256(convert_to(reviewed_snapshot::text,'UTF8')),'hex'))
);

-- A relied-on snapshot includes native content and the definitions behind displayed values/tags.
-- Workflow bookkeeping is excluded: approving, indexing or recording an actor is not new content.
CREATE FUNCTION testcase_review_content(row_value JSONB) RETURNS JSONB
LANGUAGE SQL IMMUTABLE STRICT AS $$
  SELECT row_value - ARRAY['status','updated_at','updated_by','created_at','created_by',
    'embedding_status','embedding_content_hash','embedding_queued_at','search_vector']::TEXT[];
$$;

CREATE FUNCTION testcase_approval_snapshot(case_id UUID) RETURNS JSONB
LANGUAGE SQL STABLE AS $$
  SELECT jsonb_build_object(
    'case', testcase_review_content(to_jsonb(t)),
    'customFields', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'definition', to_jsonb(d) - ARRAY['created_at','updated_at','created_by','updated_by']::TEXT[],
        'value', v.value) ORDER BY d.id)
      FROM custom_field_definitions d
      LEFT JOIN custom_field_values v ON v.definition_id=d.id AND v.testcase_id=t.id
      WHERE d.project_id=t.project_id AND (d.status <> 'archived' OR v.id IS NOT NULL)
    ), '[]'::JSONB),
    'customTags', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', ct.id, 'name', ct.name) ORDER BY ct.id)
      FROM testcase_custom_tags ctj JOIN custom_tags ct ON ct.id=ctj.tag_id
      WHERE ctj.testcase_id=t.id
    ), '[]'::JSONB)
  ) FROM testcases t WHERE t.id=case_id;
$$;

-- Reuse the case row as the serialization point for approvals, run admission and dependencies.
-- BEFORE dependency writes is essential: an approval holding the row lock must not race an
-- already-visible child write. Case ids are locked in stable order for multi-case definitions.
CREATE FUNCTION invalidate_testcase_review_dependencies() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE case_ids UUID[]; old_json JSONB; new_json JSONB; case_id UUID;
BEGIN
  old_json := CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  new_json := CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  IF TG_OP='UPDATE' AND
     old_json - ARRAY['created_at','updated_at','created_by','updated_by']::TEXT[] =
     new_json - ARRAY['created_at','updated_at','created_by','updated_by']::TEXT[] THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME IN ('custom_field_values', 'testcase_custom_tags') THEN
    case_ids := ARRAY[(old_json->>'testcase_id')::UUID, (new_json->>'testcase_id')::UUID];
  ELSIF TG_TABLE_NAME='custom_field_definitions' THEN
    SELECT array_agg(id ORDER BY id) INTO case_ids FROM testcases
      WHERE project_id IN ((old_json->>'project_id')::UUID, (new_json->>'project_id')::UUID);
  ELSE
    SELECT array_agg(testcase_id ORDER BY testcase_id) INTO case_ids FROM testcase_custom_tags
      WHERE tag_id IN ((old_json->>'id')::UUID, (new_json->>'id')::UUID);
  END IF;
  FOR case_id IN SELECT DISTINCT id FROM unnest(case_ids) id WHERE id IS NOT NULL ORDER BY id LOOP
    UPDATE testcases SET review_dependency_revision=review_dependency_revision+1,
      status=CASE WHEN status='Approved' THEN 'In Review' ELSE status END,
      updated_at=now() WHERE id=case_id;
  END LOOP;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER testcase_review_custom_values BEFORE INSERT OR UPDATE OR DELETE ON custom_field_values
FOR EACH ROW EXECUTE FUNCTION invalidate_testcase_review_dependencies();
CREATE TRIGGER testcase_review_custom_tags BEFORE INSERT OR UPDATE OR DELETE ON testcase_custom_tags
FOR EACH ROW EXECUTE FUNCTION invalidate_testcase_review_dependencies();
CREATE TRIGGER testcase_review_field_definitions BEFORE INSERT OR UPDATE OR DELETE ON custom_field_definitions
FOR EACH ROW EXECUTE FUNCTION invalidate_testcase_review_dependencies();
CREATE TRIGGER testcase_review_tag_definitions BEFORE UPDATE OR DELETE ON custom_tags
FOR EACH ROW EXECUTE FUNCTION invalidate_testcase_review_dependencies();

-- All native content writers (including imports, batch updates, review-board and housekeeping)
-- invalidate an existing approval. Derived indexing fields do not churn it.
CREATE FUNCTION invalidate_testcase_review_content() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Content A -> B -> A is still a new revision. A digest alone cannot detect this ABA race.
  IF (testcase_review_content(to_jsonb(NEW)) - 'review_dependency_revision') IS DISTINCT FROM
     (testcase_review_content(to_jsonb(OLD)) - 'review_dependency_revision') THEN
    NEW.review_dependency_revision := GREATEST(NEW.review_dependency_revision, OLD.review_dependency_revision+1);
  END IF;
  IF OLD.status='Approved' AND NEW.status='Approved' AND
     testcase_review_content(to_jsonb(NEW)) IS DISTINCT FROM testcase_review_content(to_jsonb(OLD)) THEN
    NEW.status := 'In Review';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER testcase_review_content_guard BEFORE UPDATE ON testcases
FOR EACH ROW EXECUTE FUNCTION invalidate_testcase_review_content();

CREATE FUNCTION prevent_testcase_approval_receipt_rewrite() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Testcase approval receipts are immutable; record a new decision' USING ERRCODE='23514';
END;
$$;
CREATE TRIGGER testcase_approval_receipt_immutable BEFORE UPDATE ON testcase_approval_receipts
FOR EACH ROW EXECUTE FUNCTION prevent_testcase_approval_receipt_rewrite();

CREATE INDEX idx_testcase_approval_semantic ON testcase_approval_receipts(testcase_id,semantic_revision)
  WHERE principal_kind='human_session' AND semantic_revision IS NOT NULL;

-- New run memberships retain the exact approved dependency snapshot. Historical memberships
-- stay NULL/unknown; their present-day case is not fabricated as a historical approved version.
ALTER TABLE cycle_items ADD COLUMN snapshot_approval_revision CHAR(64);
ALTER TABLE cycle_items ADD COLUMN snapshot_reviewed_content JSONB;
