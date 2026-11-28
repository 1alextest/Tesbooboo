-- Gate A slice 2: the admitted task-owned immutable prompt revision relation.
-- V170's external_prompt_revision/digest are pointers; this table is the
-- retained content they point at. Non-exposing: no producer or route.

CREATE TABLE native_qa_task_prompt_revisions (
    task_id                UUID NOT NULL
      REFERENCES ai_generation_requests(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
    project_id             UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
    revision               BIGINT NOT NULL CHECK (revision >= 1),
    digest                 CHAR(64) NOT NULL CHECK (digest ~ '^[a-f0-9]{64}$'),
    investigation_objective TEXT NOT NULL
      CHECK (length(btrim(investigation_objective)) BETWEEN 1 AND 8000),
    target_application     TEXT NOT NULL
      CHECK (length(btrim(target_application)) BETWEEN 1 AND 2048),
    target_environment     TEXT,
    repository             TEXT,
    repository_revision    TEXT,
    permitted_actions      JSONB NOT NULL DEFAULT '[]'::JSONB
      CHECK (jsonb_typeof(permitted_actions) = 'array'),
    exclusions             JSONB NOT NULL DEFAULT '[]'::JSONB
      CHECK (jsonb_typeof(exclusions) = 'array'),
    expected_observations  TEXT,
    required_evidence      JSONB NOT NULL DEFAULT '[]'::JSONB
      CHECK (jsonb_typeof(required_evidence) = 'array'),
    constraints            JSONB NOT NULL DEFAULT '[]'::JSONB
      CHECK (jsonb_typeof(constraints) = 'array'),
    source_references      JSONB NOT NULL DEFAULT '[]'::JSONB
      CHECK (jsonb_typeof(source_references) = 'array'),
    authored_by            UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_by            UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at            TIMESTAMPTZ,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (task_id, revision),
    -- Assignment/attempt can pin all three at once.
    CONSTRAINT native_qa_prompt_revision_identity UNIQUE (task_id, revision, digest)
);

CREATE INDEX native_qa_prompt_revisions_project_idx
  ON native_qa_task_prompt_revisions(project_id, created_at DESC);

-- Prompt content is append-only evidence: corrections are a new revision.
CREATE FUNCTION preserve_native_prompt_revision() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Prompt revisions are immutable; author a new revision'
    USING ERRCODE='23514', CONSTRAINT='native_qa_prompt_revision_immutable';
END;
$$;

CREATE TRIGGER native_qa_prompt_revisions_immutable
  BEFORE UPDATE OR DELETE ON native_qa_task_prompt_revisions
  FOR EACH ROW EXECUTE FUNCTION preserve_native_prompt_revision();

-- A task pointer must always reference retained content for the same project.
-- On update the pointer is monotonic (a material change is a new revision; it
-- can never silently rewind to older reviewed content).
-- Pointer changes are bound to retained content. The initial pointer is bound
-- at the first update/assignment; no execution can exist without an assignment,
-- and assignment/attempt rows carry an FK to this exact (task, revision, digest).
-- This trigger is deliberately UPDATE-only so a fenced INSERT probe is not
-- evaluated as if it were an authorized prompt change.
CREATE FUNCTION assert_external_prompt_content() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.task_kind <> 'external_qa_work' THEN
    RETURN NEW;
  END IF;

  IF NEW.external_prompt_revision IS DISTINCT FROM OLD.external_prompt_revision
     AND NEW.external_prompt_revision <= OLD.external_prompt_revision THEN
    RAISE EXCEPTION 'External prompt revision must advance monotonically'
      USING ERRCODE='23514', CONSTRAINT='native_qa_external_prompt_monotonic';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM native_qa_task_prompt_revisions p
     WHERE p.task_id = NEW.id
       AND p.project_id = NEW.project_id
       AND p.revision = NEW.external_prompt_revision
       AND p.digest = NEW.external_prompt_digest
  ) THEN
    RAISE EXCEPTION 'External prompt pointer has no retained content revision'
      USING ERRCODE='23514', CONSTRAINT='native_qa_external_prompt_content_missing';
  END IF;
  RETURN NEW;
END;
$$;

-- Sorts after native_qa_external_work_revision (alphabetical trigger order) so
-- the prompt-immutability check reports first for an unauthorized swap.
CREATE TRIGGER native_qa_task_prompt_content_binding
  BEFORE UPDATE ON ai_generation_requests
  FOR EACH ROW EXECUTE FUNCTION assert_external_prompt_content();

COMMENT ON TABLE native_qa_task_prompt_revisions IS
  'Immutable exact prompt content for external QA work. The task pointer (external_prompt_revision/digest) must reference a row here; assignments and attempts pin the same (task, revision, digest).';
