-- OAuth consent provenance is subordinate to the existing revisioned project
-- externalMcpAccess owner. It grants no authority independently.
-- Revocation permanently tombstones bindings with the owner settings write;
-- later approval of the same client id cannot resurrect an earlier token family.
CREATE TABLE mcp_oauth_grant_approval_bindings (
  grant_fingerprint CHAR(64) PRIMARY KEY CHECK (grant_fingerprint ~ '^[a-f0-9]{64}$'),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL CHECK (length(account_id) BETWEEN 1 AND 256),
  client_id TEXT NOT NULL CHECK (length(client_id) BETWEEN 1 AND 2048),
  resource TEXT NOT NULL CHECK (length(resource) BETWEEN 1 AND 2048),
  approval_revision BIGINT NOT NULL CHECK (approval_revision >= 0),
  -- Snapshot the actual membership row identities at positive human consent.
  -- No FK: member removal must not erase immutable evidence/tombstones.
  project_membership_id UUID NOT NULL,
  organization_membership_id UUID NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX mcp_oauth_grant_approval_project_idx
  ON mcp_oauth_grant_approval_bindings(project_id, approval_revision);
COMMENT ON TABLE mcp_oauth_grant_approval_bindings IS
  'Evidence of exact human OAuth consent under the revisioned existing project MCP owner. Not a second permission source. Old bindings are permanently tombstoned on owner policy revision; membership row IDs are bound at consent, so deleting and re-adding a member cannot revive an old token family.';
