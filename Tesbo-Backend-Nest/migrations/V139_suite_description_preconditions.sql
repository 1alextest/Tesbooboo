-- Suites get a description and preconditions: the same two free-text fields a test case already has,
-- one level up ("what this folder covers" and "what must be true before running its cases").
--
-- NOT NULL DEFAULT '' rather than nullable, so every API response carries a string, matching
-- testcases.description / preconditions, and existing rows need no backfill.
ALTER TABLE suites
  ADD COLUMN description   TEXT NOT NULL DEFAULT '',
  ADD COLUMN preconditions TEXT NOT NULL DEFAULT '';

-- suites_active (V110) is a frozen `SELECT *`: a view expands * once, at creation, so it would silently
-- keep the old column list. Recreated so it exposes the new columns too. New columns land after the
-- existing ones, which is what CREATE OR REPLACE VIEW requires.
CREATE OR REPLACE VIEW suites_active AS SELECT * FROM suites WHERE deleted_at IS NULL;
