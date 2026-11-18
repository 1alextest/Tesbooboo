import {
  computeNextRunAt,
  parseScheduleRunAt,
  SCHEDULE_INTERVAL_MAX_MINUTES,
  SCHEDULE_NAME_MAX,
  validateScheduleInterval,
  validateScheduleName,
  validateScheduleTimezone,
  validateScheduleType
} from "./schedules.service";

const NOW = new Date("2026-11-18T12:00:00.000Z");

/** Nest's HttpException.message is the status text; the useful text is in its response body. */
function reasonOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    const response = (error as { getResponse?: () => unknown }).getResponse?.();
    return JSON.stringify(response ?? String(error));
  }
  throw new Error("Expected the call to throw");
}

describe("schedule input validation", () => {
  it("requires a bounded, non-blank name", () => {
    expect(validateScheduleName("  Nightly  ")).toBe("Nightly");
    expect(reasonOf(() => validateScheduleName("   "))).toContain("required");
    expect(reasonOf(() => validateScheduleName(undefined))).toContain("required");
    expect(reasonOf(() => validateScheduleName("x".repeat(SCHEDULE_NAME_MAX + 1)))).toContain("at most");
  });

  it("accepts only one_time or recurring", () => {
    expect(validateScheduleType("one_time")).toBe("one_time");
    expect(validateScheduleType("recurring")).toBe("recurring");
    expect(reasonOf(() => validateScheduleType("cron"))).toContain("one_time or recurring");
  });

  it("validates the timezone as an IANA zone, defaulting to UTC", () => {
    expect(validateScheduleTimezone(undefined)).toBe("UTC");
    expect(validateScheduleTimezone("Europe/London")).toBe("Europe/London");
    expect(reasonOf(() => validateScheduleTimezone("Mars/Olympus"))).toContain("IANA");
    expect(reasonOf(() => validateScheduleTimezone("x".repeat(65)))).toContain("64");
  });

  it("refuses a run time that is past or malformed", () => {
    expect(parseScheduleRunAt("2026-11-19T12:00:00.000Z", NOW).toISOString()).toBe("2026-11-19T12:00:00.000Z");
    expect(reasonOf(() => parseScheduleRunAt("2026-11-17T12:00:00.000Z", NOW))).toContain("future");
    expect(reasonOf(() => parseScheduleRunAt("not a date", NOW))).toContain("valid date");
    expect(reasonOf(() => parseScheduleRunAt("", NOW))).toContain("required");
  });

  it("bounds the recurring interval to whole minutes", () => {
    expect(validateScheduleInterval(1)).toBe(1);
    expect(validateScheduleInterval(SCHEDULE_INTERVAL_MAX_MINUTES)).toBe(SCHEDULE_INTERVAL_MAX_MINUTES);
    // Numeric strings are coerced like the other bounded numeric inputs in this codebase ("60" is a
    // minute count); anything that is not a whole positive number is refused.
    expect(validateScheduleInterval("60")).toBe(60);
    for (const value of [0, -5, 1.5, SCHEDULE_INTERVAL_MAX_MINUTES + 1, "", undefined]) {
      expect(reasonOf(() => validateScheduleInterval(value))).toContain("integer between");
    }
  });
});

describe("computeNextRunAt", () => {
  it("fires a one-time schedule at its run time", () => {
    const runAt = new Date("2026-11-19T00:00:00.000Z");
    expect(computeNextRunAt({ scheduleType: "one_time", runAt, intervalMinutes: null }, NOW)).toEqual(runAt);
    expect(reasonOf(() => computeNextRunAt({ scheduleType: "one_time", runAt: null, intervalMinutes: null }, NOW))).toContain(
      "required"
    );
  });

  it("starts a recurring schedule one interval out unless a start is given", () => {
    expect(computeNextRunAt({ scheduleType: "recurring", runAt: null, intervalMinutes: 60 }, NOW).toISOString()).toBe(
      "2026-11-18T13:00:00.000Z"
    );
    const start = new Date("2026-11-20T00:00:00.000Z");
    expect(computeNextRunAt({ scheduleType: "recurring", runAt: start, intervalMinutes: 60 }, NOW)).toEqual(start);
    expect(reasonOf(() => computeNextRunAt({ scheduleType: "recurring", runAt: null, intervalMinutes: null }, NOW))).toContain(
      "Interval"
    );
  });
});
