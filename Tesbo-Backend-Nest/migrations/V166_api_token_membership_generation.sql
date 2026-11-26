-- Existing membership rows remain the sole authority. Store their identities,
-- not a second permission owner. No foreign key: removal must not erase token
-- provenance or cause a later membership to be mistaken for the old authority.
-- Existing unbound rows are deliberately NOT backfilled from today's membership.
-- Legacy disposition remains a release-blocking decision (CL-D1).
ALTER TABLE api_tokens
  ADD COLUMN project_membership_id UUID,
  ADD COLUMN organization_membership_id UUID,
  ADD CONSTRAINT api_tokens_membership_generation_pair
    CHECK ((project_membership_id IS NULL) = (organization_membership_id IS NULL));
