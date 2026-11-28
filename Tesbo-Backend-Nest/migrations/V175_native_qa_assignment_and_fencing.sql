-- Gate A slice 2: assignment ownership, fenced attempts, idempotent receipts,
-- and the canonical authorized manual-primary REPORTED transition. Non-exposing:
-- no route, MCP tool, producer or feature flag. The V168 fence remains closed,
-- so no external task can exist until Gate K/Gate A admission.

CREATE TABLE native_qa_assignments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id         UUID NOT NULL REFERENCES ai_generation_requests(id) ON DELETE RESTRICT,
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
    installation_id UUID NOT NULL REFERENCES agent_installations(id) ON DELETE RESTRICT,
    -- Pins the exact approved grant generation; a later regrant does not
    -- silently widen or revive this assignment.
    grant_id        UUID NOT NULL REFERENCES agent_installation_project_grants(id) ON DELETE RESTRICT,
    prompt_revision BIGINT NOT NULL,
    prompt_digest   CHAR(64) NOT NULL,
    assigned_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    state           VARCHAR(16) NOT NULL DEFAULT 'assigned'
      CHECK (state IN ('assigned','claimed','completed','cancelled','expired','superseded')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at       TIMESTAMPTZ,
    close_reason    TEXT,
    CONSTRAINT native_qa_assignments_prompt_fk
      FOREIGN KEY (task_id, prompt_revision, prompt_digest)
      REFERENCES native_qa_task_prompt_revisions(task_id, revision, digest)
);

-- Multiple historical assignments are allowed; only one may be current.
CREATE UNIQUE INDEX native_qa_assignments_current_task
  ON native_qa_assignments(task_id) WHERE state IN ('assigned','claimed');
CREATE INDEX native_qa_assignments_installation_idx
  ON native_qa_assignments(installation_id, created_at DESC);

CREATE TABLE native_qa_attempts (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id                UUID NOT NULL REFERENCES ai_generation_requests(id) ON DELETE RESTRICT,
    assignment_id          UUID NOT NULL REFERENCES native_qa_assignments(id) ON DELETE RESTRICT,
    installation_id        UUID NOT NULL REFERENCES agent_installations(id) ON DELETE RESTRICT,
    -- Server-assigned, immutable, monotonically increasing per task. The lease
    -- secret itself is never stored: only its SHA-256 hash.
    fence                  BIGINT NOT NULL CHECK (fence >= 1),
    lease_hash             CHAR(64) NOT NULL CHECK (lease_hash ~ '^[a-f0-9]{64}$'),
    state                  VARCHAR(16) NOT NULL DEFAULT 'claimed'
      CHECK (state IN ('claimed','in_progress','reported','expired','cancelled','superseded')),
    prompt_revision        BIGINT NOT NULL,
    prompt_digest          CHAR(64) NOT NULL,
    expected_task_revision BIGINT NOT NULL CHECK (expected_task_revision >= 0),
    claimed_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    lease_expires_at       TIMESTAMPTZ NOT NULL,
    heartbeat_at           TIMESTAMPTZ,
    ended_at               TIMESTAMPTZ,
    end_reason             TEXT,
    CONSTRAINT native_qa_attempts_prompt_fk
      FOREIGN KEY (task_id, prompt_revision, prompt_digest)
      REFERENCES native_qa_task_prompt_revisions(task_id, revision, digest),
    CONSTRAINT native_qa_attempts_lease_positive CHECK (lease_expires_at > claimed_at),
    CONSTRAINT native_qa_attempts_assignment_fence UNIQUE (assignment_id, fence),
    CONSTRAINT native_qa_attempts_task_fence UNIQUE (task_id, fence)
);

-- Durable one-active-authority: no second executor and no second attempt on
-- the same assignment can hold current authority.
CREATE UNIQUE INDEX native_qa_attempts_active_task
  ON native_qa_attempts(task_id) WHERE state IN ('claimed','in_progress');
CREATE UNIQUE INDEX native_qa_attempts_active_assignment
  ON native_qa_attempts(assignment_id) WHERE state IN ('claimed','in_progress');
CREATE INDEX native_qa_attempts_lease_idx
  ON native_qa_attempts(state, lease_expires_at);

-- ── Assignment integrity ───────────────────────────────────────────────────
CREATE FUNCTION assert_native_assignment() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  v_task_kind TEXT;
  v_task_project UUID;
  v_task_prompt BIGINT;
  v_task_digest CHAR(64);
  installation_org UUID;
  project_org UUID;
  grant_row RECORD;
  prompt_row RECORD;
BEGIN
  SELECT r.task_kind, r.project_id, r.external_prompt_revision, r.external_prompt_digest
    INTO v_task_kind, v_task_project, v_task_prompt, v_task_digest
    FROM ai_generation_requests r WHERE r.id = NEW.task_id FOR SHARE;
  IF v_task_kind IS DISTINCT FROM 'external_qa_work' THEN
    RAISE EXCEPTION 'Assignments require an external QA task'
      USING ERRCODE='23514', CONSTRAINT='native_qa_assignments_task_kind';
  END IF;
  IF v_task_project IS DISTINCT FROM NEW.project_id THEN
    RAISE EXCEPTION 'Assignment project must match the task project'
      USING ERRCODE='23514', CONSTRAINT='native_qa_assignments_project_mismatch';
  END IF;
  IF v_task_prompt IS DISTINCT FROM NEW.prompt_revision OR v_task_digest IS DISTINCT FROM NEW.prompt_digest THEN
    RAISE EXCEPTION 'Assignment must pin the task current reviewed prompt'
      USING ERRCODE='23514', CONSTRAINT='native_qa_assignments_prompt_mismatch';
  END IF;
  SELECT * INTO prompt_row FROM native_qa_task_prompt_revisions
   WHERE task_id = NEW.task_id AND revision = NEW.prompt_revision;
  IF prompt_row.reviewed_by IS NULL OR prompt_row.reviewed_at IS NULL THEN
    RAISE EXCEPTION 'Prompt revision must be reviewed before assignment'
      USING ERRCODE='23514', CONSTRAINT='native_qa_assignments_prompt_reviewed';
  END IF;

  SELECT organization_id INTO project_org FROM projects WHERE id = NEW.project_id;
  SELECT organization_id INTO installation_org FROM agent_installations WHERE id = NEW.installation_id;
  IF project_org IS DISTINCT FROM installation_org THEN
    RAISE EXCEPTION 'Assignment cannot cross organizations'
      USING ERRCODE='23514', CONSTRAINT='native_qa_assignments_same_organization';
  END IF;

  SELECT * INTO grant_row FROM agent_installation_project_grants WHERE id = NEW.grant_id;
  IF grant_row.installation_id IS DISTINCT FROM NEW.installation_id
     OR grant_row.project_id IS DISTINCT FROM NEW.project_id THEN
    RAISE EXCEPTION 'Assignment grant does not belong to this installation/project'
      USING ERRCODE='23514', CONSTRAINT='native_qa_assignments_grant_scope';
  END IF;
  IF grant_row.revoked_at IS NOT NULL
     OR (grant_row.expires_at IS NOT NULL AND grant_row.expires_at <= now()) THEN
    RAISE EXCEPTION 'Assignment requires a live grant'
      USING ERRCODE='23514', CONSTRAINT='native_qa_assignments_grant_live';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER native_qa_assignments_assert
  BEFORE INSERT ON native_qa_assignments
  FOR EACH ROW EXECUTE FUNCTION assert_native_assignment();

CREATE FUNCTION preserve_native_assignment() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.task_id IS DISTINCT FROM OLD.task_id
     OR NEW.project_id IS DISTINCT FROM OLD.project_id
     OR NEW.installation_id IS DISTINCT FROM OLD.installation_id
     OR NEW.grant_id IS DISTINCT FROM OLD.grant_id
     OR NEW.prompt_revision IS DISTINCT FROM OLD.prompt_revision
     OR NEW.prompt_digest IS DISTINCT FROM OLD.prompt_digest
     OR NEW.assigned_by IS DISTINCT FROM OLD.assigned_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Assignment authority identity is immutable'
      USING ERRCODE='23514', CONSTRAINT='native_qa_assignments_identity_immutable';
  END IF;
  IF OLD.state IN ('completed','cancelled','expired','superseded')
     AND NEW.state IS DISTINCT FROM OLD.state THEN
    RAISE EXCEPTION 'Terminal assignment cannot change state'
      USING ERRCODE='23514', CONSTRAINT='native_qa_assignments_terminal';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER native_qa_assignments_preserve
  BEFORE UPDATE ON native_qa_assignments
  FOR EACH ROW EXECUTE FUNCTION preserve_native_assignment();

-- ── Attempt integrity, server fence and lease discipline ───────────────────
CREATE FUNCTION assert_native_attempt() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  assignment_row RECORD;
  grant_row RECORD;
  task_revision BIGINT;
  task_state TEXT;
  installation_status TEXT;
BEGIN
  NEW.fence := COALESCE((
    SELECT max(fence) FROM native_qa_attempts WHERE task_id = NEW.task_id
  ), 0) + 1;

  SELECT r.external_work_revision, r.external_work_state
    INTO task_revision, task_state
    FROM ai_generation_requests r WHERE r.id = NEW.task_id FOR SHARE;
  IF task_state IS DISTINCT FROM 'ASSIGNED' THEN
    RAISE EXCEPTION 'Claim requires the task to be assigned'
      USING ERRCODE='23514', CONSTRAINT='native_qa_attempts_task_state';
  END IF;
  IF task_revision IS DISTINCT FROM NEW.expected_task_revision THEN
    RAISE EXCEPTION 'Claim expected task revision % but task is at %', NEW.expected_task_revision, task_revision
      USING ERRCODE='23514', CONSTRAINT='native_qa_attempts_task_stale';
  END IF;

  SELECT * INTO assignment_row FROM native_qa_assignments WHERE id = NEW.assignment_id FOR SHARE;
  IF assignment_row.task_id IS DISTINCT FROM NEW.task_id
     OR assignment_row.installation_id IS DISTINCT FROM NEW.installation_id THEN
    RAISE EXCEPTION 'Attempt must match its assignment task and installation'
      USING ERRCODE='23514', CONSTRAINT='native_qa_attempts_assignment_mismatch';
  END IF;
  IF assignment_row.state NOT IN ('assigned','claimed') THEN
    RAISE EXCEPTION 'Attempt requires a current assignment'
      USING ERRCODE='23514', CONSTRAINT='native_qa_attempts_assignment_current';
  END IF;
  IF assignment_row.prompt_revision IS DISTINCT FROM NEW.prompt_revision
     OR assignment_row.prompt_digest IS DISTINCT FROM NEW.prompt_digest THEN
    RAISE EXCEPTION 'Attempt must use the assignment exact prompt basis'
      USING ERRCODE='23514', CONSTRAINT='native_qa_attempts_prompt_mismatch';
  END IF;

  SELECT * INTO grant_row FROM agent_installation_project_grants WHERE id = assignment_row.grant_id;
  IF grant_row.revoked_at IS NOT NULL
     OR (grant_row.expires_at IS NOT NULL AND grant_row.expires_at <= now()) THEN
    RAISE EXCEPTION 'Claim requires a live grant'
      USING ERRCODE='23514', CONSTRAINT='native_qa_attempts_grant_live';
  END IF;
  IF NOT ('task.claim.assigned' = ANY(grant_row.capabilities)) THEN
    RAISE EXCEPTION 'Grant does not permit claiming'
      USING ERRCODE='23514', CONSTRAINT='native_qa_attempts_capability';
  END IF;
  IF NEW.state <> 'claimed' THEN
    RAISE EXCEPTION 'A new attempt starts claimed'
      USING ERRCODE='23514', CONSTRAINT='native_qa_attempts_initial_state';
  END IF;
  SELECT status INTO installation_status FROM agent_installations WHERE id = NEW.installation_id;
  IF installation_status <> 'active' THEN
    RAISE EXCEPTION 'Attempt requires an active installation'
      USING ERRCODE='23514', CONSTRAINT='native_qa_attempts_installation_active';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER native_qa_attempts_assert
  BEFORE INSERT ON native_qa_attempts
  FOR EACH ROW EXECUTE FUNCTION assert_native_attempt();

CREATE FUNCTION preserve_native_attempt() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.task_id IS DISTINCT FROM OLD.task_id
     OR NEW.assignment_id IS DISTINCT FROM OLD.assignment_id
     OR NEW.installation_id IS DISTINCT FROM OLD.installation_id
     OR NEW.fence IS DISTINCT FROM OLD.fence
     OR NEW.lease_hash IS DISTINCT FROM OLD.lease_hash
     OR NEW.prompt_revision IS DISTINCT FROM OLD.prompt_revision
     OR NEW.prompt_digest IS DISTINCT FROM OLD.prompt_digest
     OR NEW.expected_task_revision IS DISTINCT FROM OLD.expected_task_revision
     OR NEW.claimed_at IS DISTINCT FROM OLD.claimed_at THEN
    RAISE EXCEPTION 'Attempt identity, fence, lease and prompt basis are immutable'
      USING ERRCODE='23514', CONSTRAINT='native_qa_attempts_identity_immutable';
  END IF;

  IF OLD.state IN ('reported','expired','cancelled','superseded') THEN
    RAISE EXCEPTION 'Terminal or expired attempt cannot regain authority'
      USING ERRCODE='23514', CONSTRAINT='native_qa_attempts_terminal';
  END IF;
  -- An attempt whose lease has already elapsed cannot renew or report.
  IF OLD.lease_expires_at <= now() AND NEW.state IN ('claimed','in_progress') THEN
    RAISE EXCEPTION 'Expired attempt cannot renew authority'
      USING ERRCODE='23514', CONSTRAINT='native_qa_attempts_lease_expired';
  END IF;
  IF NEW.state IS DISTINCT FROM OLD.state AND NOT (
       (OLD.state = 'claimed' AND NEW.state IN ('in_progress','reported','expired','cancelled','superseded'))
    OR (OLD.state = 'in_progress' AND NEW.state IN ('reported','expired','cancelled','superseded'))
  ) THEN
    RAISE EXCEPTION 'Illegal attempt transition'
      USING ERRCODE='23514', CONSTRAINT='native_qa_attempts_transition';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER native_qa_attempts_preserve
  BEFORE UPDATE ON native_qa_attempts
  FOR EACH ROW EXECUTE FUNCTION preserve_native_attempt();

-- ── Idempotent command receipts ────────────────────────────────────────────
CREATE TABLE native_qa_execution_receipts (
    project_id     UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
    command        VARCHAR(32) NOT NULL
      CHECK (command IN ('claim','start','progress','heartbeat','report','cancel','reassign','clarify','resume')),
    request_key    TEXT NOT NULL CHECK (length(request_key) BETWEEN 1 AND 200),
    request_digest CHAR(64) NOT NULL CHECK (request_digest ~ '^[a-f0-9]{64}$'),
    attempt_id     UUID REFERENCES native_qa_attempts(id) ON DELETE RESTRICT,
    assignment_id  UUID REFERENCES native_qa_assignments(id) ON DELETE RESTRICT,
    receipt        JSONB NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, command, request_key)
);

CREATE FUNCTION preserve_execution_receipt() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Execution receipts are immutable'
    USING ERRCODE='23514', CONSTRAINT='native_qa_execution_receipts_immutable';
END;
$$;

CREATE TRIGGER native_qa_execution_receipts_immutable
  BEFORE UPDATE OR DELETE ON native_qa_execution_receipts
  FOR EACH ROW EXECUTE FUNCTION preserve_execution_receipt();

-- ── Canonical manual-primary REPORTED transition (finding A) ───────────────
-- DRAFT/READY/ASSIGNED -> REPORTED is the authorized manual path. It is only
-- legal when no executor attempt holds current authority; the unclaimed
-- assignment disposition, human authority, manual-adoption policy, expected
-- task revision and finalized original evidence are enforced by the command
-- service and Gate E custody. The executor path (CLAIMED/IN_PROGRESS ->
-- REPORTED) requires an active attempt.
CREATE OR REPLACE FUNCTION bump_native_external_work_revision() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  legal_transition BOOLEAN;
  latest_attempt_state TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
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

  SELECT state INTO latest_attempt_state FROM native_qa_attempts
   WHERE task_id = OLD.id ORDER BY fence DESC LIMIT 1;

  IF NEW.external_work_state IS DISTINCT FROM OLD.external_work_state THEN
    legal_transition := CASE OLD.external_work_state
      WHEN 'DRAFT' THEN NEW.external_work_state IN ('READY','REPORTED','CANCELLED')
      WHEN 'READY' THEN NEW.external_work_state IN ('ASSIGNED','REPORTED','NEEDS_CLARIFICATION','CANCELLED')
      WHEN 'ASSIGNED' THEN NEW.external_work_state IN ('CLAIMED','REPORTED','NEEDS_CLARIFICATION','CANCELLED')
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

    IF NEW.external_work_state = 'REPORTED' THEN
      IF OLD.external_work_state IN ('DRAFT','READY','ASSIGNED')
         AND latest_attempt_state IN ('claimed','in_progress') THEN
        RAISE EXCEPTION 'Manual primary finalization is blocked by an active attempt'
          USING ERRCODE='23514', CONSTRAINT='native_qa_external_manual_blocked';
      END IF;
      IF OLD.external_work_state IN ('CLAIMED','IN_PROGRESS')
         AND (latest_attempt_state IS NULL OR latest_attempt_state NOT IN ('claimed','in_progress','reported')) THEN
        RAISE EXCEPTION 'Executor finalization requires a current attempt'
          USING ERRCODE='23514', CONSTRAINT='native_qa_external_report_requires_attempt';
      END IF;
    END IF;
  END IF;

  IF NEW.external_prompt_revision IS DISTINCT FROM OLD.external_prompt_revision
     OR NEW.external_prompt_digest IS DISTINCT FROM OLD.external_prompt_digest THEN
    IF OLD.external_work_state NOT IN ('DRAFT','READY','NEEDS_CLARIFICATION')
       OR NEW.external_work_state NOT IN ('DRAFT','READY','NEEDS_CLARIFICATION') THEN
      RAISE EXCEPTION 'Reviewed external prompt is immutable from assignment onward'
        USING ERRCODE='23514', CONSTRAINT='native_qa_external_prompt_immutable';
    END IF;
  END IF;

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

COMMENT ON TABLE native_qa_assignments IS
  'One executor installation bound to an exact reviewed prompt revision and grant generation. Distinct from execution; multiple historical assignments, one current.';
COMMENT ON TABLE native_qa_attempts IS
  'Sequential fenced execution attempts. One active authority per task and per assignment; fence is server-assigned and immutable; only a lease hash is stored.';
COMMENT ON TABLE native_qa_execution_receipts IS
  'Append-only idempotency receipts keyed by project, command and caller request key. Same key with a different digest is a conflict.';
