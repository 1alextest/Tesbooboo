-- Gate A foundation, bounded slice 1: installation identity and its
-- project-scoped capability grants. No runtime admission, route, MCP tool or
-- feature flag is enabled here, and the external producer fence from V168
-- remains installed.
--
-- Why a separate owner rather than new columns on `agents`:
--   * V58/V65/V84 already seed shared machine actors (`zyra`, `tesbo-mcp`,
--     `tesbo-automation`). Those are transport/label identities, not physical
--     executors; attributing a task attempt to `tesbo-mcp` cannot distinguish
--     two workstations or two rotated credentials.
--   * One installation therefore gets exactly one `agents`/`actors` row
--     (V58's trigger materialises the actor), and this table binds that
--     identity to an organization and a stable installation key.
--   * A credential may rotate without changing the installation identity;
--     deactivation preserves historical attribution (status, not deletion).
--
-- Deferred to later Gate A slices: assignments, fenced attempts, lease
-- heartbeat/expiry, executor capability enforcement at command time, and the
-- prompt↔attempt binding. `api_tokens.project_membership_id` /
-- `organization_membership_id` are owned by the unmerged delegated-token
-- branch (PR #292); this migration deliberately does not add them.

CREATE TABLE agent_installations (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    -- Exactly one actor identity per installation. A rotated credential keeps
    -- this row; a second installation needs its own agent/actor.
    agent_id          UUID NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
    installation_key  VARCHAR(128) NOT NULL
      CHECK (installation_key ~ '^[a-z0-9][a-z0-9._:-]{0,127}$'),
    display_name      VARCHAR(255) NOT NULL
      CHECK (length(btrim(display_name)) BETWEEN 1 AND 255),
    status            VARCHAR(16) NOT NULL DEFAULT 'active'
      CHECK (status IN ('active','paused','deactivated')),
    created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT agent_installations_key_unique UNIQUE (organization_id, installation_key),
    CONSTRAINT agent_installations_agent_unique UNIQUE (agent_id)
);

CREATE INDEX agent_installations_org_status_idx
  ON agent_installations(organization_id, status);

-- Built-in actors are shared transport/runtime labels. None of them is a
-- physical installation, so an installation cannot claim one. This is an
-- identity rule, not a second agent registry: new installation agents are
-- ordinary `agents` rows created through the existing owner.
CREATE FUNCTION assert_installation_agent() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM agents
     WHERE id = NEW.agent_id AND slug IN ('zyra','tesbo-mcp','tesbo-automation')
  ) THEN
    RAISE EXCEPTION 'Shared agent % cannot be an installation identity', NEW.agent_id
      USING ERRCODE='23514', CONSTRAINT='agent_installations_not_shared_actor';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER agent_installations_assert_agent
  BEFORE INSERT OR UPDATE ON agent_installations
  FOR EACH ROW EXECUTE FUNCTION assert_installation_agent();

CREATE TABLE agent_installation_project_grants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    installation_id UUID NOT NULL REFERENCES agent_installations(id) ON DELETE RESTRICT,
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
    -- Explicit action ceiling. Unknown capabilities are refused at the
    -- database, so a later feature cannot silently widen an existing grant.
    capabilities    TEXT[] NOT NULL
      CHECK (cardinality(capabilities) BETWEEN 1 AND 32)
      CHECK (capabilities <@ ARRAY[
        'task.create','task.submit','task.assign','task.claim.assigned',
        'task.progress.assigned','report.submit.assigned','report.supplement',
        'report.import.manual','analysis.create','task.cancel'
      ]::TEXT[]),
    expires_at      TIMESTAMPTZ,
    revoked_at      TIMESTAMPTZ,
    granted_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT agent_installation_project_grants_unique UNIQUE (installation_id, project_id)
);

CREATE INDEX agent_installation_project_grants_project_idx
  ON agent_installation_project_grants(project_id);

-- A grant may never cross an organization boundary. The project's owning
-- organization must be the installation's organization.
CREATE FUNCTION assert_installation_grant_scope() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  project_org UUID;
  installation_org UUID;
BEGIN
  SELECT organization_id INTO project_org FROM projects WHERE id = NEW.project_id;
  SELECT organization_id INTO installation_org FROM agent_installations WHERE id = NEW.installation_id;
  IF project_org IS DISTINCT FROM installation_org THEN
    RAISE EXCEPTION 'Installation grants cannot cross organization boundaries'
      USING ERRCODE='23514', CONSTRAINT='agent_installation_grants_same_organization';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER agent_installation_grants_assert_scope
  BEFORE INSERT OR UPDATE ON agent_installation_project_grants
  FOR EACH ROW EXECUTE FUNCTION assert_installation_grant_scope();

-- Bind a project credential to the installation that may use it. Existing
-- tokens keep installation_id NULL and retain today's meaning; there is no
-- backfill, and a NULL installation is not evidence of any specific executor.
-- Revocation/rotation is a token-row lifecycle at the existing api_tokens
-- owner; the installation identity survives it.
ALTER TABLE api_tokens
  ADD COLUMN installation_id UUID REFERENCES agent_installations(id) ON DELETE RESTRICT;

CREATE INDEX api_tokens_installation_idx
  ON api_tokens(installation_id) WHERE installation_id IS NOT NULL;

COMMENT ON TABLE agent_installations IS
  'Gate A installation identity: one physical executor with one agents/actors identity. Shared transport actors (tesbo-mcp), Zyra and the automation actor are not installations.';
COMMENT ON TABLE agent_installation_project_grants IS
  'Project-scoped action ceiling for an installation. Capability enforcement at command time is Gate A application work; this table refuses unknown capabilities and cross-organization grants.';
COMMENT ON COLUMN api_tokens.installation_id IS
  'Installation this credential acts as. NULL for legacy/unbound tokens; never inferred or backfilled.';
