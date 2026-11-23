-- V161 hashed an automatically generated skillKey when the optional key was omitted, so an identical
-- retry produced a different digest. New requests hash the requested content (null when omitted).
-- Mark the basis version so only pre-marker rows use the legacy generated-key fallback; a new explicit
-- key can never be silently treated as an omitted retry.
ALTER TABLE skill_profiles ADD COLUMN creation_basis_version SMALLINT NOT NULL DEFAULT 1
  CHECK (creation_basis_version IN (1, 2));

COMMENT ON COLUMN skill_profiles.creation_basis_version IS
  '1 = original V161 digest basis (hashed stored key); 2 = requested-content basis (omitted key hashes null).';
