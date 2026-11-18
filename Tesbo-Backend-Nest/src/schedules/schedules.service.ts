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

type Body = Record<string, any>;
type ScheduleType = "one_time" | "recurring";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const SCHEDULE_NAME_MAX = 255;
export const SCHEDULE_INTERVAL_MAX_MINUTES = 525_600; // one year
const CLAIM_LIMIT = 5;
const STUCK_AFTER_MINUTES = 15;
const LAST_ERROR_MAX = 500;

/** A schedule's first (or next) fire instant. Recurring schedules without a start fire one interval out. */
export function computeNextRunAt(
  input: { scheduleType: ScheduleType; runAt: Date | null; intervalMinutes: number | null },
  now: Date = new Date()
): Date {
  if (input.scheduleType === "one_time") {
    if (!input.runAt) throw new BadRequestException({ error: "Run At is required for a one-time schedule" });
    return input.runAt;
  }
  if (!input.intervalMinutes || input.intervalMinutes < 1) {
    throw new BadRequestException({ error: "Interval minutes must be at least 1" });
  }
  return input.runAt ?? new Date(now.getTime() + input.intervalMinutes * 60_000);
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
  if (value !== "one_time" && value !== "recurring") {
    throw new BadRequestException({ error: "Schedule type must be one_time or recurring" });
  }
  return value;
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
    if (scheduleType === "one_time") {
      runAt = parseScheduleRunAt(body?.runAt, now);
    } else {
      intervalMinutes = validateScheduleInterval(body?.intervalMinutes);
      if (body?.runAt !== undefined && body?.runAt !== null && body?.runAt !== "") {
        runAt = parseScheduleRunAt(body.runAt, now);
      }
    }
    const nextRunAt = computeNextRunAt({ scheduleType, runAt, intervalMinutes }, now);
    const enabled = body?.enabled !== false;
    const res = await this.db.query(
      `INSERT INTO cycle_run_schedules
         (project_id, cycle_id, name, enabled, schedule_type, run_at, interval_minutes, timezone, next_run_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [projectId, cycleId, name, enabled, scheduleType, runAt, intervalMinutes, timezone, nextRunAt, userId]
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
      body?.scheduleType !== undefined || body?.runAt !== undefined || body?.intervalMinutes !== undefined;
    const enabling = enabled && row.enabled !== true;

    let runAt: Date | null = row.run_at ? new Date(row.run_at) : null;
    let intervalMinutes: number | null = row.interval_minutes === null ? null : Number(row.interval_minutes);
    let nextRunAt: Date | null;

    if (scheduleType === "one_time") {
      if (body?.runAt !== undefined) runAt = parseScheduleRunAt(body.runAt, now);
      if (!runAt) throw new BadRequestException({ error: "Run At is required for a one-time schedule" });
      intervalMinutes = null;
      if (schedulingChanged || enabling) {
        if (runAt.getTime() <= now.getTime()) {
          throw new BadRequestException({ error: "Date and time must be in future" });
        }
        nextRunAt = runAt;
      } else {
        // A one-time schedule that already fired has next_run_at NULL; editing its name must not
        // make it due again.
        nextRunAt = row.next_run_at ? new Date(row.next_run_at) : null;
      }
      if (row.schedule_type !== "one_time" && !body?.runAt) {
        throw new BadRequestException({ error: "Run At is required for a one-time schedule" });
      }
    } else {
      if (body?.intervalMinutes !== undefined) intervalMinutes = validateScheduleInterval(body.intervalMinutes);
      if (!intervalMinutes) throw new BadRequestException({ error: "Interval minutes are required for a recurring schedule" });
      if (body?.runAt !== undefined) {
        runAt = body.runAt === null || body.runAt === "" ? null : parseScheduleRunAt(body.runAt, now);
      }
      nextRunAt =
        schedulingChanged || enabling
          ? computeNextRunAt({ scheduleType, runAt, intervalMinutes }, now)
          : row.next_run_at
            ? new Date(row.next_run_at)
            : computeNextRunAt({ scheduleType, runAt: null, intervalMinutes }, now);
    }

    const res = await this.db.query(
      `UPDATE cycle_run_schedules
       SET name = $2, enabled = $3, schedule_type = $4, run_at = $5, interval_minutes = $6,
           timezone = $7, next_run_at = $8, updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [scheduleId, name, enabled, scheduleType, runAt, intervalMinutes, timezone, nextRunAt]
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
    const res = await this.db.query(
      `UPDATE cycle_run_schedules
       SET is_running = false,
           last_status = 'error',
           last_error = 'The scheduled run was interrupted before it finished.',
           enabled = CASE WHEN schedule_type = 'one_time' THEN false ELSE enabled END,
           updated_at = now()
       WHERE is_running = true AND updated_at < now() - make_interval(mins => $1)`,
      [STUCK_AFTER_MINUTES]
    );
    if (res.rowCount) this.logger.warn(`Recovered ${res.rowCount} interrupted schedule run(s).`);
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
             updated_at = now()
         WHERE id = $1`,
        [row.id]
      );
    } catch (error) {
      const message = (error instanceof Error ? error.message : String(error)).slice(0, LAST_ERROR_MAX);
      this.logger.warn(`Scheduled run ${row.id} failed: ${message}`);
      await this.db.query(
        `UPDATE cycle_run_schedules
         SET is_running = false, last_run_at = now(), last_status = 'error', last_error = $2,
             enabled = CASE WHEN schedule_type = 'one_time' THEN false ELSE enabled END,
             updated_at = now()
         WHERE id = $1`,
        [row.id, message]
      );
    }
  }
}
