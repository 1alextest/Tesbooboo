-- Gate K correction slice, from the independent review of V170 on PR #333.
--
-- V170 left three gaps. This migration closes the representational ones and
-- states explicitly what Gate A still has to own. The external producer fence
-- (`native_qa_external_producer_closed`, V168) is untouched.
--
-- 1. External work could still acquire `chat_session_id` (V89/V116) or
--    `sweep_testcase_id` (V108). Those are legacy-chat and archive-sweep
--    owners with their own deletion lifecycles; an external task must not be
--    deleted or repointed by an unrelated legacy lifecycle.
-- 2. The remaining V8/V35/V36/V132 defaults were unclassified. Classification:
--      * generation-specific -> required NULL for external, required present
--        for every non-external kind: style, include_* flags, feedback,
--        context, language.
--      * deliberately neutral -> left at their honest empty default, never
--        constrained: source_summary ('[]' means no legacy source summary).
--      * genuinely shared -> may be used by external work later and are not
--        constrained: activity_log, jira_issue_keys, linear_issue_keys,
--        notion_page_ids (source links and task activity).
-- 3. The V170 trigger incremented the revision but did not require the caller
--    to present the expected current revision, and its prompt freeze could be
--    bypassed by a legal-looking rewind. This migration makes the revision a
--    real row-level compare-and-set and enforces the canonical §4.1 state
--    adjacency. Gate A still owns installation/attempt authority, binding the
--    exact prompt revision/digest to each attempt, and rejecting stale
--    commands inside the assignment transaction; a database rule is necessary
--    but not sufficient.

-- style was nullable-with-default from V8; restore the documented default on
-- legacy rows so the conditional requirement below cannot fail on old data.
UPDATE ai_generation_requests SET style = 'strict'
WHERE task_kind <> 'external_qa_work' AND style IS NULL;

ALTER TABLE ai_generation_requests
  ALTER COLUMN include_happy_flow DROP NOT NULL,
  ALTER COLUMN include_negative_flow DROP NOT NULL,
  ALTER COLUMN include_multi_tab DROP NOT NULL,
  ALTER COLUMN include_cross_browser DROP NOT NULL,
  ALTER COLUMN include_boundary DROP NOT NULL,
  ALTER COLUMN feedback DROP NOT NULL,
  ALTER COLUMN context DROP NOT NULL,
  ALTER COLUMN language DROP NOT NULL;

ALTER TABLE ai_generation_requests
  DROP CONSTRAINT native_qa_generation_fields_required,
  DROP CONSTRAINT native_qa_external_generation_inapplicable;

ALTER TABLE ai_generation_requests
  ADD CONSTRAINT native_qa_generation_fields_required CHECK (
    task_kind = 'external_qa_work' OR (
      agent_name IS NOT NULL
      AND task_status IS NOT NULL
      -- model is generation-specific but legitimately absent for non-model
      -- producers (chat staging, archive sweep); it is only forbidden for
      -- external work, not required of every legacy row.
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
      AND style IS NOT NULL
      AND include_happy_flow IS NOT NULL
      AND include_negative_flow IS NOT NULL
      AND include_multi_tab IS NOT NULL
      AND include_cross_browser IS NOT NULL
      AND include_boundary IS NOT NULL
      AND feedback IS NOT NULL
      AND context IS NOT NULL
      AND language IS NOT NULL
    )
  ),
  -- `model` is classified generation-specific: a legacy task must name a model.
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
      AND style IS NULL
      AND include_happy_flow IS NULL
      AND include_negative_flow IS NULL
      AND include_multi_tab IS NULL
      AND include_cross_browser IS NULL
      AND include_boundary IS NULL
      AND feedback IS NULL
      AND context IS NULL
      AND language IS NULL
      AND chat_session_id IS NULL
      AND sweep_testcase_id IS NULL
      AND skill_context = '{}'::JSONB
    )
  );

CREATE OR REPLACE FUNCTION bump_native_external_work_revision() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  legal_transition BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- A producer always creates a fresh DRAFT with a first prompt revision.
    -- Starting elsewhere would let a caller skip review or manufacture history.
    -- Resolve the effective kind here: this trigger sorts before the V168
    -- kind-binding trigger, so an insert that omits task_kind would otherwise
    -- bypass the initial-state requirement.
    IF COALESCE(NEW.task_kind, native_qa_task_kind_for_provider(NEW.provider)) = 'external_qa_work' THEN
      IF NEW.external_work_state IS DISTINCT FROM 'DRAFT'
         OR NEW.external_work_revision IS DISTINCT FROM 0
         OR NEW.external_prompt_revision IS DISTINCT FROM 1 THEN
        RAISE EXCEPTION 'External work must start DRAFT at revision 0 with prompt revision 1'
          USING ERRCODE='23514', CONSTRAINT='native_qa_external_work_initial_state';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.task_kind <> 'external_qa_work' THEN
    RETURN NEW;
  END IF;

  IF OLD.external_work_state IN ('CLOSED','CANCELLED')
     AND NEW.external_work_state IS DISTINCT FROM OLD.external_work_state THEN
    RAISE EXCEPTION 'Terminal external work state cannot change'
      USING ERRCODE='23514', CONSTRAINT='native_qa_external_work_terminal';
  END IF;

  -- Canonical 02_WORKFLOW_AND_UX_SPEC §4.1 adjacency. Expired-lease returns to
  -- ASSIGNED are allowed; every other rewind is refused, which also removes the
  -- "legal-looking rewind then edit the prompt" bypass.
  IF NEW.external_work_state IS DISTINCT FROM OLD.external_work_state THEN
    legal_transition := CASE OLD.external_work_state
      WHEN 'DRAFT' THEN NEW.external_work_state IN ('READY','CANCELLED')
      WHEN 'READY' THEN NEW.external_work_state IN ('ASSIGNED','NEEDS_CLARIFICATION','CANCELLED')
      WHEN 'ASSIGNED' THEN NEW.external_work_state IN ('CLAIMED','NEEDS_CLARIFICATION','CANCELLED')
      WHEN 'CLAIMED' THEN NEW.external_work_state IN ('IN_PROGRESS','REPORTED','ASSIGNED','NEEDS_CLARIFICATION','CANCELLED')
      WHEN 'IN_PROGRESS' THEN NEW.external_work_state IN ('REPORTED','ASSIGNED','NEEDS_CLARIFICATION','CANCELLED')
      WHEN 'REPORTED' THEN NEW.external_work_state IN ('UNDER_ANALYSIS','CANCELLED')
      WHEN 'UNDER_ANALYSIS' THEN NEW.external_work_state IN ('CLOSED','CANCELLED')
      WHEN 'NEEDS_CLARIFICATION' THEN NEW.external_work_state IN ('ASSIGNED','CANCELLED')
      ELSE FALSE
    END;
    IF NOT legal_transition THEN
      RAISE EXCEPTION 'External work state cannot move from % to %', OLD.external_work_state, NEW.external_work_state
        USING ERRCODE='23514', CONSTRAINT='native_qa_external_work_transition';
    END IF;
  END IF;

  -- The reviewed prompt is fixed from assignment onward. It may change only
  -- while the task is still pre-assignment; clarification may revise it and
  -- then resume through a new assignment/attempt (Gate A).
  IF NEW.external_prompt_revision IS DISTINCT FROM OLD.external_prompt_revision
     OR NEW.external_prompt_digest IS DISTINCT FROM OLD.external_prompt_digest THEN
    IF OLD.external_work_state NOT IN ('DRAFT','READY','NEEDS_CLARIFICATION')
       OR NEW.external_work_state NOT IN ('DRAFT','READY','NEEDS_CLARIFICATION') THEN
      RAISE EXCEPTION 'Reviewed external prompt is immutable from assignment onward'
        USING ERRCODE='23514', CONSTRAINT='native_qa_external_prompt_immutable';
    END IF;
  END IF;

  -- Row-level compare-and-set. A governed change must present exactly the next
  -- revision; a stale writer that read an older revision presents a value that
  -- no longer equals OLD+1 and is refused under the row lock.
  IF NEW.external_work_state IS DISTINCT FROM OLD.external_work_state
     OR NEW.external_prompt_revision IS DISTINCT FROM OLD.external_prompt_revision
     OR NEW.external_prompt_digest IS DISTINCT FROM OLD.external_prompt_digest THEN
    IF NEW.external_work_revision IS DISTINCT FROM OLD.external_work_revision + 1 THEN
      RAISE EXCEPTION 'External work revision must present the exact expected next revision'
        USING ERRCODE='23514', CONSTRAINT='native_qa_external_work_revision_stale';
    END IF;
  ELSIF NEW.external_work_revision IS DISTINCT FROM OLD.external_work_revision THEN
    RAISE EXCEPTION 'External work revision advances only with a governed work change'
      USING ERRCODE='23514', CONSTRAINT='native_qa_external_work_revision_advance';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER native_qa_external_work_revision ON ai_generation_requests;
CREATE TRIGGER native_qa_external_work_revision BEFORE INSERT OR UPDATE
ON ai_generation_requests FOR EACH ROW EXECUTE FUNCTION bump_native_external_work_revision();

COMMENT ON CONSTRAINT native_qa_external_generation_inapplicable ON ai_generation_requests IS
  'External work cannot carry generation-only fields or the legacy chat/sweep owners. source_summary is neutral-empty; activity_log and issue/page key arrays are shared.';
