-- Skill candidate creation is a separate native write from its later submission. A client that loses
-- the creation response must be able to retry the same request without creating a second candidate.
-- The request identity is scoped to the authenticated project principal, and the digest binds the
-- exact candidate content. Null keys preserve the existing non-idempotent callers.
ALTER TABLE skill_profiles
  ADD COLUMN creation_principal TEXT,
  ADD COLUMN creation_request_key TEXT,
  ADD COLUMN creation_request_digest CHAR(64);

CREATE UNIQUE INDEX idx_skill_creation_request
  ON skill_profiles(project_id, creation_principal, creation_request_key)
  WHERE creation_request_key IS NOT NULL;

COMMENT ON COLUMN skill_profiles.creation_request_key IS
  'Optional producer-supplied retry identity for initial candidate creation; never approval or assignment authority.';
