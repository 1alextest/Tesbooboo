import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit
} from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { LegacyService } from "../legacy/legacy.service";
import { nextLocalRunAt } from "./local-time";

type Body = Record<string, any>;
type ScheduleType = "one_time" | "recurring" | "daily" | "weekly";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const SCHEDULE_NAME_MAX = 255;
export const SCHEDULE_INTERVAL_MAX_MINUTES = 525_600; // one year
const CLAIM_LIMIT = 5;
const STUCK_AFTER_MINUTES = 15;
const LAST_ERROR_MAX = 500;

/**
 * A schedule's first (or next) fire instant. Recurring schedules without a start fire one interval
 * out; daily/weekly rules are resolved in the schedule's own timezone (see local-time.ts).
 */
export function computeNextRunAt(
  input: {
    scheduleType: ScheduleType;
    runAt: Date | null;
    intervalMinutes: number | null;
    /** Only read for daily/weekly; the service validates it before calling. */
    timezone?: string;
    localTime?: string | null;
    daysOfWeek?: number[] | null;
  },
  now: Date = new Date()
): Date {
  if (input.scheduleType === "one_time") {
    if (!input.runAt) throw new BadRequestException({ error: "Run At is required for a one-time schedule" });
    return input.runAt;
  }
  if (input.scheduleType === "recurring") {
    if (!input.intervalMinutes || input.intervalMinutes < 1) {
      throw new BadRequestException({ error: "Interval minutes must be at least 1" });
    }
    return input.runAt ?? new Date(now.getTime() + input.intervalMinutes * 60_000);
  }
  if (!input.localTime) {
    throw new BadRequestException({ error: "Local time is required for a daily or weekly schedule" });
  }
  if (input.scheduleType === "weekly" && !input.daysOfWeek?.length) {
    throw new BadRequestException({ error: "Choose at least one day of the week" });
  }
  return nextLocalRunAt(
    {
      timezone: input.timezone ?? "UTC",
      localTime: input.localTime,
      daysOfWeek: input.scheduleType === "weekly" ? input.daysOfWeek ?? null : null
    },
    now
  );
}

export function validateScheduleName(value: unknown): string {
  const name = String(value ?? "").trim();
  if (!name) throw new BadRequestException({ error: "Schedule name is required" });
  if (name.length > SCHEDULE_NAME_MAX) {
    throw new BadRequestException({ error: `Schedule name must be at most ${SCHEDULE_NAME_MAX} characters` });
  }
  return name;
}

export function validateScheduleTimezone(value: unknown): string {
  const timezone = String(value ?? "UTC").trim() || "UTC";
  if (timezone.length > 64) throw new BadRequestException({ error: "Timezone must be at most 64 characters" });
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    throw new BadRequestException({ error: "Timezone must be a valid IANA time zone" });
  }
  return timezone;
}

/** A run time that has already passed would fire the moment it was saved, which is never what was meant. */
export function parseScheduleRunAt(value: unknown, now: Date = new Date()): Date {
  if (typeof value !== "string" || !value.trim()) {
    throw new BadRequestException({ error: "Run At is required" });
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException({ error: "Run At must be a valid date and time" });
  }
  if (parsed.getTime() <= now.getTime()) {
    throw new BadRequestException({ error: "Date and time must be in future" });
  }
  return parsed;
}

export function validateScheduleInterval(value: unknown): number {
  const interval = Number(value);
  if (!Number.isInteger(interval) || interval < 1 || interval > SCHEDULE_INTERVAL_MAX_MINUTES) {
    throw new BadRequestException({
      error: `Interval minutes must be an integer between 1 and ${SCHEDULE_INTERVAL_MAX_MINUTES}`
    });
  }
  return interval;
}

export function validateScheduleType(value: unknown): ScheduleType {
  if (value !== "one_time" && value !== "recurring" && value !== "daily" && value !== "weekly") {
    throw new BadRequestException({ error: "Schedule type must be one_time, recurring, daily or weekly" });
  }
  return value;
}

/** HH:MM in the schedule's timezone. The instant is resolved later; this only checks the wall clock. */
export function validateLocalTime(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(text)) {
    throw new BadRequestException({ error: "Local time must be HH:MM (24-hour)" });
  }
  return text;
}

/** 0=Sunday .. 6=Saturday, deduplicated and sorted. */
export function validateDaysOfWeek(value: unknown): number[] {
  if (!Array.isArray(value) || !value.length) {
    throw new BadRequestException({ error: "Choose at least one day of the week" });
  }
  const days = [...new Set(value.map(Number))];
  if (days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
    throw new BadRequestException({ error: "Days of the week must be integers from 0 (Sunday) to 6 (Saturday)" });
  }
  return days.sort((a, b) => a - b);
}

/**
 * Persisted run schedules and the worker that fires them.
 *
 * A due schedule creates a new Test Run cloned from the run it points at (see
 * LegacyService.createCycleFromScheduledRun) — it never rewrites that run's own executions. Claiming
 * advances next_run_at in the same statement that marks the row running, so a crash cannot fire the
 * same occurrence twice; a claim older than STUCK_AFTER_MINUTES is recovered as an interrupted run.
 */
@Injectable()
export class SchedulesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulesService.name);
  private timer: NodeJS.Timeout | null = null;
  private sweeping = false;

  constructor(private readonly db: DatabaseService, private readonly legacy: LegacyService) {}

  onModuleInit(): void {
    if (process.env.SCHEDULES_WORKER_DISABLED === "1") return;
    const interval = Number(process.env.SCHEDULE_SWEEP_INTERVAL_MS ?? 30_000);
    this.timer = setInterval(() => void this.sweep(), Math.max(1_000, Number.isFinite(interval) ? interval : 30_000));
    // Never hold the process open in tests or a short-lived command.
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async requireProject(userId: string | null | undefined, projectId: string) {
    if (!userId) throw new ForbiddenException({ error: "Project membership required" });
    await this.legacy.requireProjectAccess(userId, projectId);
  }

  private async requireSchedule(userId: string | null | undefined, scheduleId: string) {
    if (!UUID.test(scheduleId)) throw new NotFoundException({ error: "Schedule not found" });
    const res = await this.db.query("SELECT * FROM cycle_run_schedules WHERE id = $1", [scheduleId]);
    const row = res.rows[0];
    if (!row) throw new NotFoundException({ error: "Schedule not found" });
    await this.requireProject(userId, row.project_id);
    return row;
  }

  private view(row: Body) {
    const iso = (value: unknown) => (value ? new Date(value as string).toISOString() : null);
    return {
      id: row.id,
      projectId: row.project_id,
      cycleId: row.cycle_id,
      cycleName: row.cycle_name ?? null,
      cycleAvailable: row.cycle_deleted === undefined ? true : row.cycle_deleted !== true,
      name: row.name,
      enabled: row.enabled === true,
      scheduleType: row.schedule_type,
      runAt: iso(row.run_at),
      intervalMinutes: row.interval_minutes === null || row.interval_minutes === undefined ? null : Number(row.interval_minutes),
      timezone: row.timezone,
      localTime: row.local_time ? String(row.local_time).slice(0, 5) : null,
      daysOfWeek: Array.isArray(row.days_of_week) ? row.days_of_week.map(Number) : null,
      nextRunAt: iso(row.next_run_at),
      lastRunAt: iso(row.last_run_at),
      lastStatus: row.last_status ?? null,
      lastError: row.last_error ?? null,
      isRunning: row.is_running === true,
      createdAt: iso(row.created_at),
      updatedAt: iso(row.updated_at)
    };
  }

  async listForUser(userId: string | null | undefined, projectId: string) {
    await this.requireProject(userId, projectId);
    const res = await this.db.query(
      `SELECT s.*, c.name AS cycle_name, (c.deleted_at IS NOT NULL) AS cycle_deleted
       FROM cycle_run_schedules s
       LEFT JOIN cycles c ON c.id = s.cycle_id
       WHERE s.project_id = $1
       ORDER BY s.created_at DESC`,
      [projectId]
    );
    return res.rows.map((row) => this.view(row));
  }

  async createForUser(userId: string | null | undefined, projectId: string, body: Body) {
    await this.requireProject(userId, projectId);
    const name = validateScheduleName(body?.name);
    const cycleId = String(body?.cycleId ?? "");
    if (!UUID.test(cycleId)) throw new BadRequestException({ error: "cycleId must be a test run id" });
    const cycle = await this.db.query("SELECT id FROM cycles WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL", [
      cycleId,
      projectId
    ]);
    if (!cycle.rows[0]) throw new NotFoundException({ error: "Test run not found" });
    const scheduleType = validateScheduleType(body?.scheduleType);
    const timezone = validateScheduleTimezone(body?.timezone);
    const now = new Date();
    let runAt: Date | null = null;
    let intervalMinutes: number | null = null;
    let localTime: string | null = null;
    let daysOfWeek: number[] | null = null;
    if (scheduleType === "one_time") {
      runAt = parseScheduleRunAt(body?.runAt, now);
    } else if (scheduleType === "recurring") {
      intervalMinutes = validateScheduleInterval(body?.intervalMinutes);
      if (body?.runAt !== undefined && body?.runAt !== null && body?.runAt !== "") {
        runAt = parseScheduleRunAt(body.runAt, now);
      }
    } else {
      localTime = validateLocalTime(body?.localTime);
      daysOfWeek = scheduleType === "weekly" ? validateDaysOfWeek(body?.daysOfWeek) : null;
    }
    const nextRunAt = computeNextRunAt({ scheduleType, runAt, intervalMinutes, timezone, localTime, daysOfWeek }, now);
    const enabled = body?.enabled !== false;
    const res = await this.db.query(
      `INSERT INTO cycle_run_schedules
         (project_id, cycle_id, name, enabled, schedule_type, run_at, interval_minutes, timezone,
          local_time, days_of_week, next_run_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [projectId, cycleId, name, enabled, scheduleType, runAt, intervalMinutes, timezone, localTime, daysOfWeek, nextRunAt, userId]
    );
    const cycleRow = await this.db.query("SELECT name FROM cycles WHERE id = $1", [cycleId]);
    return this.view({ ...res.rows[0], cycle_name: cycleRow.rows[0]?.name ?? null, cycle_deleted: false });
  }

  async updateForUser(userId: string | null | undefined, scheduleId: string, body: Body) {
    const row = await this.requireSchedule(userId, scheduleId);
    if (row.is_running === true) {
      throw new ConflictException({ error: "This schedule is running; try again when it finishes" });
    }
    const now = new Date();
    const name = body?.name === undefined ? row.name : validateScheduleName(body.name);
    const timezone = body?.timezone === undefined ? row.timezone : validateScheduleTimezone(body.timezone);
    const scheduleType: ScheduleType = body?.scheduleType === undefined ? row.schedule_type : validateScheduleType(body.scheduleType);
    const enabled = body?.enabled === undefined ? row.enabled === true : body.enabled !== false;
    const schedulingChanged =
      body?.scheduleType !== undefined ||
      body?.runAt !== undefined ||
      body?.intervalMinutes !== undefined ||
      body?.localTime !== undefined ||
      body?.daysOfWeek !== undefined;
    const enabling = enabled && row.enabled !== true;

    let runAt: Date | null = row.run_at ? new Date(row.run_at) : null;
    let intervalMinutes: number | null = row.interval_minutes === null ? null : Number(row.interval_minutes);
    let localTime: string | null = row.local_time ? String(row.local_time).slice(0, 5) : null;
    let daysOfWeek: number[] | null = Array.isArray(row.days_of_week) ? row.days_of_week.map(Number) : null;
    let nextRunAt: Date | null;
    // A timezone edit changes the next instant for a local rule, but not for a fixed minute interval.
    const mustRecompute =
      schedulingChanged ||
      enabling ||
      (timezone !== row.timezone && (scheduleType === "daily" || scheduleType === "weekly"));
    const recompute = () =>
      computeNextRunAt({ scheduleType, runAt, intervalMinutes, timezone, localTime, daysOfWeek }, now);

    if (scheduleType === "one_time") {
      if (body?.runAt !== undefined) runAt = parseScheduleRunAt(body.runAt, now);
      if (!runAt) throw new BadRequestException({ error: "Run At is required for a one-time schedule" });
      intervalMinutes = null;
      localTime = null;
      daysOfWeek = null;
      if (mustRecompute) {
        if (runAt.getTime() <= now.getTime()) {
          throw new BadRequestException({ error: "Date and time must be in future" });
        }
        nextRunAt = runAt;
      } else {
        // A one-time schedule that already fired has next_run_at NULL; editing its name must not
        // make it due again.
        nextRunAt = row.next_run_at ? new Date(row.next_run_at) : null;
      }
    } else if (scheduleType === "recurring") {
      if (body?.intervalMinutes !== undefined) intervalMinutes = validateScheduleInterval(body.intervalMinutes);
      if (!intervalMinutes) throw new BadRequestException({ error: "Interval minutes are required for a recurring schedule" });
      if (body?.runAt !== undefined) {
        runAt = body.runAt === null || body.runAt === "" ? null : parseScheduleRunAt(body.runAt, now);
      }
      localTime = null;
      daysOfWeek = null;
      nextRunAt = mustRecompute
        ? recompute()
        : row.next_run_at
          ? new Date(row.next_run_at)
          : recompute();
    } else {
      if (body?.localTime !== undefined) localTime = validateLocalTime(body.localTime);
      if (!localTime) throw new BadRequestException({ error: "Local time is required for a daily or weekly schedule" });
      if (scheduleType === "weekly") {
        if (body?.daysOfWeek !== undefined) daysOfWeek = validateDaysOfWeek(body.daysOfWeek);
        if (!daysOfWeek?.length) throw new BadRequestException({ error: "Choose at least one day of the week" });
      } else {
        daysOfWeek = null;
      }
      runAt = null;
      intervalMinutes = null;
      nextRunAt = mustRecompute
        ? recompute()
        : row.next_run_at
          ? new Date(row.next_run_at)
          : recompute();
    }

    const res = await this.db.query(
      `UPDATE cycle_run_schedules
       SET name = $2, enabled = $3, schedule_type = $4, run_at = $5, interval_minutes = $6,
           timezone = $7, local_time = $8, days_of_week = $9, next_run_at = $10, updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [scheduleId, name, enabled, scheduleType, runAt, intervalMinutes, timezone, localTime, daysOfWeek, nextRunAt]
    );
    const cycleRow = await this.db.query("SELECT name, (deleted_at IS NOT NULL) AS deleted FROM cycles WHERE id = $1", [
      res.rows[0].cycle_id
    ]);
    return this.view({ ...res.rows[0], cycle_name: cycleRow.rows[0]?.name ?? null, cycle_deleted: cycleRow.rows[0]?.deleted === true });
  }

  async deleteForUser(userId: string | null | undefined, scheduleId: string) {
    const row = await this.requireSchedule(userId, scheduleId);
    await this.db.query("DELETE FROM cycle_run_schedules WHERE id = $1", [row.id]);
    return { success: true };
  }

  /**
   * Fires due schedules. Public only so the worker loop and a test can share one implementation;
   * nothing else calls it.
   */
  async sweep(now: Date = new Date()): Promise<number> {
    if (this.sweeping) return 0;
    this.sweeping = true;
    try {
      await this.recoverInterrupted();
      const claimed = await this.claimDue(now);
      for (const row of claimed) await this.runClaimed(row);
      return claimed.length;
    } catch (error) {
      this.logger.error(`Schedule sweep failed: ${error instanceof Error ? error.message : error}`);
      return 0;
    } finally {
      this.sweeping = false;
    }
  }

  private async recoverInterrupted() {
    const stuck = await this.db.query<Body>(
      `SELECT id, schedule_type, timezone, local_time, days_of_week
       FROM cycle_run_schedules
       WHERE is_running = true AND updated_at < now() - make_interval(mins => $1)`,
      [STUCK_AFTER_MINUTES]
    );
    for (const row of stuck.rows) {
      await this.db.query(
        `UPDATE cycle_run_schedules
         SET is_running = false,
             last_status = 'error',
             last_error = 'The scheduled run was interrupted before it finished.',
             enabled = CASE WHEN schedule_type = 'one_time' THEN false ELSE enabled END,
             next_run_at = COALESCE($2::timestamptz, next_run_at),
             updated_at = now()
         WHERE id = $1`,
        [row.id, this.nextLocalFor(row)]
      );
    }
    if (stuck.rowCount) this.logger.warn(`Recovered ${stuck.rowCount} interrupted schedule run(s).`);
  }

  /**
   * The next local occurrence for a daily/weekly row, or null for other types and on a rule error.
   * Local rules cannot be advanced in the claim statement (the next instant needs the zone's
   * calendar), so the claim parks a guard window and this fills in the real instant afterwards.
   */
  private nextLocalFor(row: Body): Date | null {
    if (row.schedule_type !== "daily" && row.schedule_type !== "weekly") return null;
    try {
      return nextLocalRunAt(
        {
          timezone: String(row.timezone),
          localTime: String(row.local_time).slice(0, 5),
          daysOfWeek:
            row.schedule_type === "weekly" && Array.isArray(row.days_of_week)
              ? row.days_of_week.map(Number)
              : null
        },
        new Date()
      );
    } catch (error) {
      this.logger.warn(
        `Could not compute the next local occurrence for schedule ${row.id}: ${error instanceof Error ? error.message : error}`
      );
      return null;
    }
  }

  /**
   * One statement claims and advances: the row is marked running and its next occurrence is moved
   * forward before any work begins, so a crash after this point cannot fire the same instant twice.
   */
  private async claimDue(now: Date) {
    const res = await this.db.query(
      `WITH due AS (
         SELECT s.id, s.next_run_at AS due_at
         FROM cycle_run_schedules s
         JOIN cycles c ON c.id = s.cycle_id AND c.deleted_at IS NULL
         WHERE s.enabled = true AND s.is_running = false
           AND s.next_run_at IS NOT NULL AND s.next_run_at <= $1
         ORDER BY s.next_run_at
         LIMIT ${CLAIM_LIMIT}
         FOR UPDATE OF s SKIP LOCKED
       )
       UPDATE cycle_run_schedules s
       SET is_running = true,
           updated_at = now(),
           next_run_at = CASE
             WHEN s.schedule_type = 'recurring' THEN $1::timestamptz + make_interval(mins => s.interval_minutes)
             -- Guard windows longer than the rule's maximum gap: the real local occurrence is
             -- written after the attempt, and a crash cannot make the row due again in between.
             WHEN s.schedule_type = 'daily' THEN $1::timestamptz + interval '25 hours'
             WHEN s.schedule_type = 'weekly' THEN $1::timestamptz + interval '8 days'
             ELSE NULL
           END
       FROM due
       WHERE s.id = due.id
       RETURNING s.*, due.due_at`,
      [now]
    );
    return res.rows;
  }

  private async runClaimed(row: Body) {
    const scheduledFor = row.due_at ? new Date(row.due_at) : new Date();
    // The claim parked a guard window for local rules; write the real next occurrence for both the
    // success and failure paths. Null (non-local types) leaves the claim's advancement untouched.
    const nextLocal = this.nextLocalFor(row);
    try {
      await this.legacy.createCycleFromScheduledRun({
        projectId: row.project_id,
        cycleId: row.cycle_id,
        scheduledFor
      });
      await this.db.query(
        `UPDATE cycle_run_schedules
         SET is_running = false, last_run_at = now(), last_status = 'success', last_error = NULL,
             enabled = CASE WHEN schedule_type = 'one_time' THEN false ELSE enabled END,
             next_run_at = COALESCE($2::timestamptz, next_run_at),
             updated_at = now()
         WHERE id = $1`,
        [row.id, nextLocal]
      );
    } catch (error) {
      const message = (error instanceof Error ? error.message : String(error)).slice(0, LAST_ERROR_MAX);
      this.logger.warn(`Scheduled run ${row.id} failed: ${message}`);
      await this.db.query(
        `UPDATE cycle_run_schedules
         SET is_running = false, last_run_at = now(), last_status = 'error', last_error = $2,
             enabled = CASE WHEN schedule_type = 'one_time' THEN false ELSE enabled END,
             next_run_at = COALESCE($3::timestamptz, next_run_at),
             updated_at = now()
         WHERE id = $1`,
        [row.id, message, nextLocal]
      );
    }
  }
}
