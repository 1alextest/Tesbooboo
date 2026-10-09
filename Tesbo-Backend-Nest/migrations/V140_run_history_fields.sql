-- Run and result history carried over from another test tool (Qase), kept on the same cycles and
-- executions rows the rest of the product reads, not in a parallel model.
--
-- cycles.started_at / ended_at / closed_at / close_status and executions.executed_at / duration_ms /
-- error_message / error_stack / reported_by already exist (V3, V84). What was missing:
--   time_spent_ms  the work time people spent, which is not wall clock (elapsed_ms) and not
--                  ended_at - started_at: a run that stays open for a week was worked on for hours.
--   elapsed_ms     the wall-clock length the source tool reported.
--   tags           free labels on a run.
--   step_results   per-step outcome of one result: [{position, status, comment?}].
--   history        earlier results of the same case in the same run, oldest first. The row's own
--                  columns hold the latest one, so every existing screen and count is unchanged.

ALTER TABLE cycles
  ADD COLUMN time_spent_ms BIGINT,
  ADD COLUMN elapsed_ms BIGINT,
  ADD COLUMN tags TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE cycles
  ADD CONSTRAINT cycles_time_spent_ms_check CHECK (time_spent_ms IS NULL OR time_spent_ms >= 0),
  ADD CONSTRAINT cycles_elapsed_ms_check CHECK (elapsed_ms IS NULL OR elapsed_ms >= 0);

ALTER TABLE executions
  ADD COLUMN step_results JSONB,
  ADD COLUMN history JSONB;

-- executions_active (V64) is `SELECT * FROM executions` frozen at creation, so these columns are not
-- visible through it. Its only caller is a status COUNT, which does not need them.
