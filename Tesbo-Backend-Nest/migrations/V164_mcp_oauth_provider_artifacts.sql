-- Feature-OFF storage only for a future vetted OAuth authorization-server adapter.
-- Tesbo users, sessions, project MCP grants, Skills, approval and Test Cases
-- retain their existing owners. This table grants NO new access or token issuer.
-- Every opaque reference is a domain-separated HMAC; the provider JSON payload
-- is encrypted with Tesbo's existing AES-GCM secret infrastructure.
CREATE TABLE mcp_oauth_provider_artifacts (
  model VARCHAR(64) NOT NULL CHECK (model ~ '^[A-Za-z][A-Za-z0-9]*$'),
  id_fingerprint CHAR(64) NOT NULL CHECK (id_fingerprint ~ '^[a-f0-9]{64}$'),
  encrypted_payload TEXT NOT NULL CHECK (encrypted_payload LIKE 'enc:v1:%'),
  expires_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  grant_fingerprint CHAR(64) CHECK (grant_fingerprint ~ '^[a-f0-9]{64}$'),
  uid_fingerprint CHAR(64) CHECK (uid_fingerprint ~ '^[a-f0-9]{64}$'),
  user_code_fingerprint CHAR(64) CHECK (user_code_fingerprint ~ '^[a-f0-9]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (model, id_fingerprint)
);

CREATE INDEX mcp_oauth_provider_artifacts_grant_idx
  ON mcp_oauth_provider_artifacts (model, grant_fingerprint)
  WHERE grant_fingerprint IS NOT NULL;

CREATE UNIQUE INDEX mcp_oauth_provider_artifacts_uid_idx
  ON mcp_oauth_provider_artifacts (model, uid_fingerprint)
  WHERE uid_fingerprint IS NOT NULL;

CREATE UNIQUE INDEX mcp_oauth_provider_artifacts_user_code_idx
  ON mcp_oauth_provider_artifacts (model, user_code_fingerprint)
  WHERE user_code_fingerprint IS NOT NULL;

CREATE INDEX mcp_oauth_provider_artifacts_expiry_idx
  ON mcp_oauth_provider_artifacts (expires_at)
  WHERE expires_at IS NOT NULL;

COMMENT ON TABLE mcp_oauth_provider_artifacts IS
  'Encrypted, shared OAuth protocol state for a future embedded AS. Does not create Tesbo user, MCP consent, role or publish authority. No live AS is mounted.';
COMMENT ON COLUMN mcp_oauth_provider_artifacts.id_fingerprint IS
  'Domain-separated HMAC reference, not a bearer/token/authorization-code plaintext ID.';
COMMENT ON COLUMN mcp_oauth_provider_artifacts.encrypted_payload IS
  'Existing AES-256-GCM encrypted provider state. Rotation must re-encrypt payloads and recompute blind indexes before changing the secret key.';
