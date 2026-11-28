-- Native QA allocation A / gate K, first (producer-closed) slice.
-- Keep the existing ai_generation_requests UUID/sequence and review payload.
-- These exact legacy provider markers already select the three governed
-- proposal producers in LegacyService. This maps their representation to an
-- immutable owner kind; it does not infer historical approval or provenance.
CREATE FUNCTION native_qa_task_kind_for_provider(provider_name TEXT) RETURNS TEXT
LANGUAGE SQL IMMUTABLE STRICT AS $$
  SELECT CASE
    WHEN provider_name IN ('external_proposal','external_requirement_proposal','external_document_proposal')
      THEN 'governed_proposal'
    WHEN provider_name = 'external_qa_work' THEN 'external_qa_work'
    ELSE 'legacy_generation_review'
  END;
$$;

ALTER TABLE ai_generation_requests ADD COLUMN task_kind TEXT;
UPDATE ai_generation_requests SET task_kind=native_qa_task_kind_for_provider(provider);

ALTER TABLE ai_generation_requests ALTER COLUMN task_kind SET NOT NULL,
  ADD CONSTRAINT native_qa_task_kind_values CHECK (
    task_kind IN ('legacy_generation_review','governed_proposal','external_qa_work')
  ),
  ADD CONSTRAINT native_qa_task_kind_matches_provider CHECK (
    task_kind=native_qa_task_kind_for_provider(provider)
  ),
  -- Deliberately no external-work producer, assignment or runtime admission
  -- yet. Keep this physical fence until all legacy consumers are kind-safe,
  -- the external payload schema and actual installation authority exist, and
  -- the separately admitted enablement gates have passed.
  ADD CONSTRAINT native_qa_external_producer_closed CHECK (task_kind<>'external_qa_work');

CREATE FUNCTION bind_native_qa_task_kind() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    -- Existing producers omit this field. The actual current provider lane
    -- supplies it at creation, without changing their prior wire contract.
    IF NEW.task_kind IS NULL THEN
      NEW.task_kind := native_qa_task_kind_for_provider(NEW.provider);
    END IF;
  ELSE
    IF NEW.task_kind IS DISTINCT FROM OLD.task_kind THEN
      RAISE EXCEPTION 'Native task kind is immutable'
        USING ERRCODE='23514', CONSTRAINT='native_qa_task_kind_immutable';
    END IF;
    IF OLD.task_kind='governed_proposal' AND NEW.provider IS DISTINCT FROM OLD.provider THEN
      RAISE EXCEPTION 'Governed task producer lane is immutable'
        USING ERRCODE='23514', CONSTRAINT='native_qa_governed_lane_immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER native_qa_task_kind_binding BEFORE INSERT OR UPDATE
ON ai_generation_requests FOR EACH ROW EXECUTE FUNCTION bind_native_qa_task_kind();

COMMENT ON COLUMN ai_generation_requests.task_kind IS
  'Immutable owning task kind, not execution status, approval, grant or producer provenance. External QA creation remains closed pending kind-safe consumers and admission.';
