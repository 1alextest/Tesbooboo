-- Review Board: a second, separate fingerprint per side of a finding, for REVIEW FRESHNESS.
--
-- V141's fingerprint_a/b hash only the compared CONTENT (title, preconditions, steps, expected results, test
-- data, postconditions). That is what duplicate detection and "did a reviewer's decision stop applying" are
-- built on, so it must not change: two cases in different suites, or with different statuses, are still exact
-- duplicates.
--
-- state_fingerprint_a/b hash the details a reviewer weighs before keeping, editing or deleting a case — description,
-- status, suite, priority, severity, type, component, owner and the Jira/Linear/Notion links. If any of them changes
-- after the analysis, a PENDING finding no longer describes reality and is refused (409) by keep/edit/remove until
-- the analysis is re-run. Decisions already made (kept / edited) are NOT reopened by a state-only change.
--
-- Additive and nullable on purpose: existing rows are not touched or rewritten. A NULL state fingerprint means
-- "created before freshness tracking" — such a finding stays visible and keeps its status, but is reported stale
-- ("unverified") until the next analysis, which fills it in on the SAME row.
ALTER TABLE review_recommendations
    ADD COLUMN IF NOT EXISTS state_fingerprint_a TEXT,
    ADD COLUMN IF NOT EXISTS state_fingerprint_b TEXT;
