-- A new test case with no priority is stored as "Not set" rather than being silently labelled P2.
--
-- testcases.priority is a free-text VARCHAR(8) NOT NULL with no CHECK constraint (V2), so the new
-- value needs no schema change; only the column default moves. Existing rows are NOT rewritten:
-- a P2 already on a case may have been chosen on purpose, and nothing here can tell the two apart.
-- cycle_items.snapshot_priority has no default and keeps whatever the case held when it was added.
ALTER TABLE testcases ALTER COLUMN priority SET DEFAULT 'Not set';
