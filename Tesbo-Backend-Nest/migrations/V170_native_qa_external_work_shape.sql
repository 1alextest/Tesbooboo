-- Gate K, conditional-shape slice for the admitted external QA work kind.
--
-- V168 introduced the immutable three-kind root and deliberately closed the
-- external producer. This migration prepares the *conditional shape* those
-- external rows must have once admission opens; it does not open the producer.
-- `native_qa_external_producer_closed` from V168 is intentionally untouched.
--
-- Admitting allocation A requires that generation-only facts are inapplicable
-- for external work rather than fabricated as zero/empty values:
--   * no model, generator agent, proposal status or proposal revision
--   * no generation prompt, requested/generated/saved counters or payloads
--   * no provider token counters owned by the legacy generation workers
--   * external work carries its own state and revision (the canonical
--     02_WORKFLOW_AND_UX_SPEC §4.1 task lifecycle), never `task_status` or
--     `proposal_revision`
--
-- Existing rows all carry real values in the generation columns, so relaxing
-- NOT NULL and adding the conditional checks leaves the historical population
-- byte-identical apart from the new NULL external columns.

ALTER TABLE ai_generation_requests
  ADD COLUMN external_work_state VARCHAR(32),
  ADD COLUMN external_work_revision BIGINT,
  ADD COLUMN external_prompt_revision BIGINT,
  ADD COLUMN external_prompt_digest CHAR(64);

-- The legacy producers and readers assume these are present on generation
-- rows. That assumption is now stated as a kind-conditional constraint instead
-- of a table-wide NOT NULL, so an external row can honestly have no value
-- rather than a fabricated one.
ALTER TABLE ai_generation_requests
  ALTER COLUMN agent_name DROP NOT NULL,
  ALTER COLUMN task_status DROP NOT NULL,
  ALTER COLUMN user_story DROP NOT NULL,
  ALTER COLUMN requested_count DROP NOT NULL,
  ALTER COLUMN generated_count DROP NOT NULL,
  ALTER COLUMN generated_payload DROP NOT NULL,
  ALTER COLUMN saved_count DROP NOT NULL,
  ALTER COLUMN save_events DROP NOT NULL,
  ALTER COLUMN proposal_revision DROP NOT NULL,
  ALTER COLUMN token_input DROP NOT NULL,
  ALTER COLUMN token_output DROP NOT NULL,
  ALTER COLUMN token_total DROP NOT NULL;

ALTER TABLE ai_generation_requests
  -- Either all four external-work fields are present (external task) or all
  -- four are absent (legacy generation / governed proposal). Because
  -- task_kind is immutable, a legacy row can never acquire them and an
  -- external row can never lose them.
  ADD CONSTRAINT native_qa_external_work_shape CHECK (
    (task_kind = 'external_qa_work'
      AND external_work_state IS NOT NULL
      AND external_work_revision IS NOT NULL
      AND external_prompt_revision IS NOT NULL
      AND external_prompt_digest IS NOT NULL)
    OR
    (task_kind <> 'external_qa_work'
      AND external_work_state IS NULL
      AND external_work_revision IS NULL
      AND external_prompt_revision IS NULL
      AND external_prompt_digest IS NULL)
  ),
  -- Exact canonical task lifecycle (02_WORKFLOW_AND_UX_SPEC §4.1). Assignment,
  -- claim and attempt legality are owned by the Gate A authority model; this
  -- constraint keeps the vocabulary and the persisted value honest meanwhile.
  ADD CONSTRAINT native_qa_external_work_state_values CHECK (
    external_work_state IS NULL OR external_work_state IN (
      'DRAFT','READY','ASSIGNED','CLAIMED','IN_PROGRESS','REPORTED',
      'UNDER_ANALYSIS','CLOSED','CANCELLED','NEEDS_CLARIFICATION')
  ),
  ADD CONSTRAINT native_qa_external_work_revision_nonnegative CHECK (
    external_work_revision IS NULL OR external_work_revision >= 0
  ),
  ADD CONSTRAINT native_qa_external_prompt_revision_positive CHECK (
    external_prompt_revision IS NULL OR external_prompt_revision >= 1
  ),
  ADD CONSTRAINT native_qa_external_prompt_digest_format CHECK (
    external_prompt_digest IS NULL OR external_prompt_digest ~ '^[a-f0-9]{64}$'
  ),
  -- Non-external rows keep every legacy generation fact they had before.
  ADD CONSTRAINT native_qa_generation_fields_required CHECK (
    task_kind = 'external_qa_work' OR (
      agent_name IS NOT NULL
      AND task_status IS NOT NULL
      AND user_story IS NOT NULL
      AND requested_count IS NOT NULL
      AND generated_count IS NOT NULL
      AND generated_payload IS NOT NULL
      AND saved_count IS NOT NULL
      AND save_events IS NOT NULL
      AND proposal_revision IS NOT NULL
      AND token_input IS NOT NULL
      AND token_output IS NOT NULL
      AND token_total IS NOT NULL
    )
  ),
  -- External work must not present generation or proposal state as its own.
  ADD CONSTRAINT native_qa_external_generation_inapplicable CHECK (
    task_kind <> 'external_qa_work' OR (
      agent_name IS NULL
      AND task_status IS NULL
      AND model IS NULL
      AND user_story IS NULL
      AND acceptance_criteria IS NULL
      AND custom_prompt IS NULL
      AND requested_count IS NULL
      AND generated_count IS NULL
      AND generated_payload IS NULL
      AND saved_count IS NULL
      AND save_events IS NULL
      AND proposal_revision IS NULL
      AND proposal_request_key IS NULL
      AND proposal_request_digest IS NULL
      AND proposal_provenance IS NULL
      AND token_input IS NULL
      AND token_output IS NULL
      AND token_total IS NULL
      AND skill_context = '{}'::JSONB
    )
  );

-- The work revision is a server-owned optimistic-concurrency token, not a
-- caller assertion. It advances by exactly one when the governed work state or
-- the reviewed prompt pointer changes; any other revision edit is refused.
-- Transition legality beyond terminal immutability and prompt freezing remains
-- at the Gate A application owner, which must recheck authority under its lock.
CREATE FUNCTION bump_native_external_work_revision() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.task_kind <> 'external_qa_work' THEN
    RETURN NEW;
  END IF;

  IF OLD.external_work_state IN ('CLOSED','CANCELLED')
     AND NEW.external_work_state IS DISTINCT FROM OLD.external_work_state THEN
    RAISE EXCEPTION 'Terminal external work state cannot change'
      USING ERRCODE='23514', CONSTRAINT='native_qa_external_work_terminal';
  END IF;

  -- A reviewed prompt is the thing the executor was authorized to run. Once
  -- authority exists it cannot be swapped underneath an attempt.
  IF OLD.external_work_state IN ('CLAIMED','IN_PROGRESS','REPORTED','UNDER_ANALYSIS','CLOSED','CANCELLED')
     AND (NEW.external_prompt_revision IS DISTINCT FROM OLD.external_prompt_revision
          OR NEW.external_prompt_digest IS DISTINCT FROM OLD.external_prompt_digest) THEN
    RAISE EXCEPTION 'Reviewed external prompt is immutable once execution authority exists'
      USING ERRCODE='23514', CONSTRAINT='native_qa_external_prompt_immutable';
  END IF;

  IF NEW.external_work_state IS DISTINCT FROM OLD.external_work_state
     OR NEW.external_prompt_revision IS DISTINCT FROM OLD.external_prompt_revision
     OR NEW.external_prompt_digest IS DISTINCT FROM OLD.external_prompt_digest THEN
    IF NEW.external_work_revision IS DISTINCT FROM OLD.external_work_revision
       AND NEW.external_work_revision IS DISTINCT FROM OLD.external_work_revision + 1 THEN
      RAISE EXCEPTION 'External work revision must advance by exactly one'
        USING ERRCODE='23514', CONSTRAINT='native_qa_external_work_revision_advance';
    END IF;
    NEW.external_work_revision := OLD.external_work_revision + 1;
  ELSIF NEW.external_work_revision IS DISTINCT FROM OLD.external_work_revision THEN
    RAISE EXCEPTION 'External work revision advances only with a governed work change'
      USING ERRCODE='23514', CONSTRAINT='native_qa_external_work_revision_advance';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER native_qa_external_work_revision BEFORE UPDATE
ON ai_generation_requests FOR EACH ROW EXECUTE FUNCTION bump_native_external_work_revision();

COMMENT ON COLUMN ai_generation_requests.external_work_state IS
  'Canonical external QA work state (02_WORKFLOW_AND_UX_SPEC §4.1); NULL for legacy generation and governed proposals. Not task_status.';
COMMENT ON COLUMN ai_generation_requests.external_work_revision IS
  'Server-bumped optimistic-concurrency revision for external work; not proposal_revision.';
COMMENT ON COLUMN ai_generation_requests.external_prompt_revision IS
  'Current reviewed prompt revision pointer for external work. Immutable content revisions remain with the task-owned prompt owner.';
COMMENT ON COLUMN ai_generation_requests.external_prompt_digest IS
  'SHA-256 of the exact reviewed prompt revision; non-secret. Never a bearer credential.';
