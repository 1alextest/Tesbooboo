-- Gate A slice 2 corrections to V172, from the independent review of 5efd5f5e.
-- Non-exposing: no producer, route or feature flag is enabled, and the V168
-- external producer fence remains installed.

-- ── B. Installation identity is immutable and actor-typed ──────────────────
CREATE OR REPLACE FUNCTION assert_installation_agent() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM agents
     WHERE id = NEW.agent_id AND slug IN ('zyra','tesbo-mcp','tesbo-automation')
  ) THEN
    RAISE EXCEPTION 'Shared agent % cannot be an installation identity', NEW.agent_id
      USING ERRCODE='23514', CONSTRAINT='agent_installations_not_shared_actor';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM actors WHERE id = NEW.agent_id AND actor_type = 'agent'
  ) THEN
    RAISE EXCEPTION 'Installation identity % must be an agent actor', NEW.agent_id
      USING ERRCODE='23514', CONSTRAINT='agent_installations_actor_type';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION preserve_installation_identity() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.agent_id IS DISTINCT FROM OLD.agent_id
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.installation_key IS DISTINCT FROM OLD.installation_key THEN
    RAISE EXCEPTION 'Installation identity (agent, organization, key) is immutable'
      USING ERRCODE='23514', CONSTRAINT='agent_installations_identity_immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER agent_installations_preserve_identity
  BEFORE UPDATE ON agent_installations
  FOR EACH ROW EXECUTE FUNCTION preserve_installation_identity();

-- ── C. Grants are append-only authority generations ────────────────────────
ALTER TABLE agent_installation_project_grants ADD COLUMN generation BIGINT;
UPDATE agent_installation_project_grants SET generation = 1 WHERE generation IS NULL;
ALTER TABLE agent_installation_project_grants
  ALTER COLUMN generation SET NOT NULL,
  ADD CONSTRAINT agent_installation_project_grants_generation_positive CHECK (generation >= 1),
  DROP CONSTRAINT agent_installation_project_grants_unique,
  ADD CONSTRAINT agent_installation_project_grants_generation_unique
    UNIQUE (installation_id, project_id, generation);

-- At most one live authority per installation/project; a regrant is a new
-- generation row, never a rewrite of the revoked one.
CREATE UNIQUE INDEX agent_installation_project_grants_active_unique
  ON agent_installation_project_grants(installation_id, project_id)
  WHERE revoked_at IS NULL;

CREATE FUNCTION assign_installation_grant_generation() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.generation := COALESCE((
    SELECT max(generation) FROM agent_installation_project_grants
     WHERE installation_id = NEW.installation_id AND project_id = NEW.project_id
  ), 0) + 1;
  RETURN NEW;
END;
$$;

CREATE TRIGGER agent_installation_grants_assign_generation
  BEFORE INSERT ON agent_installation_project_grants
  FOR EACH ROW EXECUTE FUNCTION assign_installation_grant_generation();

CREATE FUNCTION preserve_installation_grant_authority() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.installation_id IS DISTINCT FROM OLD.installation_id
     OR NEW.project_id IS DISTINCT FROM OLD.project_id
     OR NEW.capabilities IS DISTINCT FROM OLD.capabilities
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
     OR NEW.granted_by IS DISTINCT FROM OLD.granted_by
     OR NEW.generation IS DISTINCT FROM OLD.generation
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Grant authority is immutable; issue a new generation'
      USING ERRCODE='23514', CONSTRAINT='agent_installation_grants_authority_immutable';
  END IF;
  -- Revocation is a one-way terminal fact. A later regrant is a new row.
  IF OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at THEN
    RAISE EXCEPTION 'Revoked grant cannot be resurrected'
      USING ERRCODE='23514', CONSTRAINT='agent_installation_grants_revoked_immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER agent_installation_grants_preserve_authority
  BEFORE UPDATE ON agent_installation_project_grants
  FOR EACH ROW EXECUTE FUNCTION preserve_installation_grant_authority();

-- Executor-scoped ceiling. Human-only actions (manual report import, native
-- publication approval) are never installation capabilities; a grant label is
-- vocabulary, not human authority.
ALTER TABLE agent_installation_project_grants
  ADD CONSTRAINT agent_installation_grants_executor_capabilities CHECK (
    capabilities <@ ARRAY[
      'task.claim.assigned','task.progress.assigned','task.release.assigned',
      'report.submit.assigned','analysis.create'
    ]::TEXT[]);

-- ── C. Credential binding is immutable and organization-scoped ─────────────
CREATE FUNCTION preserve_token_installation_binding() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  project_org UUID;
  installation_org UUID;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.installation_id IS DISTINCT FROM OLD.installation_id THEN
    RAISE EXCEPTION 'A credential cannot be rebound to another installation'
      USING ERRCODE='23514', CONSTRAINT='api_tokens_installation_immutable';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.installation_id IS NOT NULL
     AND NEW.project_id IS DISTINCT FROM OLD.project_id THEN
    RAISE EXCEPTION 'An installation-bound credential cannot change project'
      USING ERRCODE='23514', CONSTRAINT='api_tokens_installation_project_immutable';
  END IF;
  IF NEW.installation_id IS NOT NULL THEN
    IF NEW.project_id IS NULL THEN
      RAISE EXCEPTION 'Installation-bound credentials require a project'
        USING ERRCODE='23514', CONSTRAINT='api_tokens_installation_scope';
    END IF;
    SELECT organization_id INTO project_org FROM projects WHERE id = NEW.project_id;
    SELECT organization_id INTO installation_org FROM agent_installations WHERE id = NEW.installation_id;
    IF project_org IS DISTINCT FROM installation_org THEN
      RAISE EXCEPTION 'Installation-bound credential must be in the installation organization'
        USING ERRCODE='23514', CONSTRAINT='api_tokens_installation_scope';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER api_tokens_preserve_installation_binding
  BEFORE INSERT OR UPDATE ON api_tokens
  FOR EACH ROW EXECUTE FUNCTION preserve_token_installation_binding();

-- ── D. Preserve unknown historical style; enforce neutral source_summary ───
-- V171 normalised unknown historical NULL style to 'strict'. That value is not
-- recoverable from any authoritative source, so this migration stops requiring
-- a style for legacy rows rather than fabricating one again. Rows already set
-- to 'strict' by V171 remain indistinguishable from genuinely observed values.
ALTER TABLE ai_generation_requests DROP CONSTRAINT native_qa_generation_fields_required;
ALTER TABLE ai_generation_requests
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
      AND include_happy_flow IS NOT NULL
      AND include_negative_flow IS NOT NULL
      AND include_multi_tab IS NOT NULL
      AND include_cross_browser IS NOT NULL
      AND include_boundary IS NOT NULL
      AND feedback IS NOT NULL
      AND context IS NOT NULL
      AND language IS NOT NULL
    )
  );

COMMENT ON COLUMN ai_generation_requests.style IS
  'Legacy generation style. NULL means unknown. V171 converted historical NULL to ''strict''; original NULLs are not recoverable, and new rows never fabricate a value.';
COMMENT ON COLUMN ai_generation_requests.model IS
  'Generation model when one was actually used. Forbidden for external QA work; optional for legacy non-model producers (chat staging, archive sweep).';

ALTER TABLE ai_generation_requests DROP CONSTRAINT native_qa_external_generation_inapplicable;
ALTER TABLE ai_generation_requests
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
      AND source_summary = '[]'::JSONB
      AND skill_context = '{}'::JSONB
    )
  );
