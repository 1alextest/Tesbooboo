-- Local wall-clock recurrence for run schedules.
--
-- The original schedule types were one_time and recurring (an absolute minute interval). "Nightly at
-- 09:00 New York time" is not expressible as an interval: the UTC instant moves with DST. These two
-- columns extend the same table rather than introducing a second scheduler:
--
--   daily  — every day at local_time in the schedule's timezone
--   weekly — on the listed days (0=Sunday .. 6=Saturday) at local_time
--
-- Existing rows are untouched: local_time and days_of_week stay NULL for one_time/recurring rows.
ALTER TABLE cycle_run_schedules DROP CONSTRAINT IF EXISTS cycle_run_schedules_type_check;
ALTER TABLE cycle_run_schedules ADD CONSTRAINT cycle_run_schedules_type_check
    CHECK (schedule_type IN ('one_time', 'recurring', 'daily', 'weekly'));

ALTER TABLE cycle_run_schedules ADD COLUMN IF NOT EXISTS local_time TIME;
ALTER TABLE cycle_run_schedules ADD COLUMN IF NOT EXISTS days_of_week SMALLINT[];

-- V21's one-time/recurring shape check rejects the new types outright; widen the same constraint
-- rather than leaving two contradictory rules on the table.
ALTER TABLE cycle_run_schedules DROP CONSTRAINT IF EXISTS cycle_run_schedules_one_time_check;
ALTER TABLE cycle_run_schedules ADD CONSTRAINT cycle_run_schedules_one_time_check CHECK (
    (schedule_type = 'one_time' AND run_at IS NOT NULL)
    OR (schedule_type = 'recurring' AND interval_minutes IS NOT NULL AND interval_minutes > 0)
    OR (
        schedule_type IN ('daily', 'weekly')
        AND local_time IS NOT NULL
        AND run_at IS NULL
        AND interval_minutes IS NULL
    )
);

ALTER TABLE cycle_run_schedules DROP CONSTRAINT IF EXISTS cycle_run_schedules_local_time_check;
ALTER TABLE cycle_run_schedules ADD CONSTRAINT cycle_run_schedules_local_time_check CHECK (
    (schedule_type IN ('daily', 'weekly') AND local_time IS NOT NULL)
    OR (schedule_type NOT IN ('daily', 'weekly') AND local_time IS NULL AND days_of_week IS NULL)
);

ALTER TABLE cycle_run_schedules DROP CONSTRAINT IF EXISTS cycle_run_schedules_weekly_days_check;
ALTER TABLE cycle_run_schedules ADD CONSTRAINT cycle_run_schedules_weekly_days_check CHECK (
    schedule_type <> 'weekly'
    OR (
        days_of_week IS NOT NULL
        AND array_length(days_of_week, 1) BETWEEN 1 AND 7
        AND days_of_week <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::smallint[]
    )
);
