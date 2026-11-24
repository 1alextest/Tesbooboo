import {
  computeNextRunAt,
  parseScheduleRunAt,
  SCHEDULE_INTERVAL_MAX_MINUTES,
  SCHEDULE_NAME_MAX,
  validateDaysOfWeek,
  validateLocalTime,
  validateScheduleInterval,
  validateScheduleName,
  validateScheduleTimezone,
  validateScheduleType
} from "./schedules.service";
import { nextLocalRunAt } from "./local-time";

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

  it("accepts only the four schedule types", () => {
    expect(validateScheduleType("one_time")).toBe("one_time");
    expect(validateScheduleType("recurring")).toBe("recurring");
    expect(validateScheduleType("daily")).toBe("daily");
    expect(validateScheduleType("weekly")).toBe("weekly");
    expect(reasonOf(() => validateScheduleType("cron"))).toContain("one_time, recurring, daily or weekly");
  });

  it("requires a 24-hour local time for daily/weekly rules", () => {
    expect(validateLocalTime("09:00")).toBe("09:00");
    expect(validateLocalTime("00:00")).toBe("00:00");
    expect(validateLocalTime("23:59")).toBe("23:59");
    for (const value of ["24:00", "9:00", "09:60", "", undefined, "09:00:00"]) {
      expect(reasonOf(() => validateLocalTime(value))).toContain("HH:MM");
    }
  });

  it("normalizes weekly days to unique sorted 0..6 values", () => {
    expect(validateDaysOfWeek([5, 1, 5, 0])).toEqual([0, 1, 5]);
    for (const value of [[], [-1], [7], ["x"], 3, undefined]) {
      expect(reasonOf(() => validateDaysOfWeek(value)).toLowerCase()).toContain("week");
    }
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

describe("nextLocalRunAt", () => {
  const from = new Date("2026-11-18T12:00:00.000Z"); // 07:00 in America/New_York (EST)

  it("fires later today when the wall-clock time has not passed", () => {
    expect(
      nextLocalRunAt({ timezone: "America/New_York", localTime: "09:00", daysOfWeek: null }, from).toISOString()
    ).toBe("2026-11-18T14:00:00.000Z"); // 09:00 EST
  });

  it("moves to tomorrow when the local time is exactly now", () => {
    expect(
      nextLocalRunAt({ timezone: "America/New_York", localTime: "07:00", daysOfWeek: null }, from).toISOString()
    ).toBe("2026-11-19T12:00:00.000Z");
  });

  it("honours the zone's DST rules instead of a fixed offset", () => {
    // 2026-07-01 is EDT (UTC-4) for the same 09:00 local time that is UTC-5 in November.
    expect(
      nextLocalRunAt(
        { timezone: "America/New_York", localTime: "09:00", daysOfWeek: null },
        new Date("2026-07-01T00:00:00.000Z")
      ).toISOString()
    ).toBe("2026-07-01T13:00:00.000Z");
  });

  it("skips a local time that does not exist on the spring-forward day", () => {
    // 2026-03-08 02:00 America/New_York jumps to 03:00, so 02:30 never happens that day.
    expect(
      nextLocalRunAt(
        { timezone: "America/New_York", localTime: "02:30", daysOfWeek: null },
        new Date("2026-03-08T05:00:00.000Z")
      ).toISOString()
    ).toBe("2026-03-09T06:30:00.000Z"); // 02:30 EDT
  });

  it("picks the first instant when a local time repeats at fall-back", () => {
    // 2026-11-01 01:30 happens twice in New York: 05:30Z (EDT) then 06:30Z (EST).
    expect(
      nextLocalRunAt(
        { timezone: "America/New_York", localTime: "01:30", daysOfWeek: null },
        new Date("2026-11-01T04:00:00.000Z")
      ).toISOString()
    ).toBe("2026-11-01T05:30:00.000Z");
  });

  it("finds the next allowed weekday", () => {
    // Wednesday 2026-11-18; the next Monday is 2026-11-23, 09:00 EST.
    expect(
      nextLocalRunAt({ timezone: "America/New_York", localTime: "09:00", daysOfWeek: [1] }, from).toISOString()
    ).toBe("2026-11-23T14:00:00.000Z");
  });

  it("supports zones east of UTC", () => {
    // 2026-11-19 09:00 Asia/Tokyo (UTC+9) is 00:00Z that day.
    expect(
      nextLocalRunAt(
        { timezone: "Asia/Tokyo", localTime: "09:00", daysOfWeek: null },
        new Date("2026-11-18T12:00:00.000Z")
      ).toISOString()
    ).toBe("2026-11-19T00:00:00.000Z");
  });
});

describe("computeNextRunAt local rules", () => {
  it("requires the pieces a local rule needs", () => {
    expect(
      reasonOf(() =>
        computeNextRunAt(
          { scheduleType: "daily", runAt: null, intervalMinutes: null, timezone: "UTC", localTime: null, daysOfWeek: null },
          NOW
        )
      )
    ).toContain("Local time");
    expect(
      reasonOf(() =>
        computeNextRunAt(
          { scheduleType: "weekly", runAt: null, intervalMinutes: null, timezone: "UTC", localTime: "09:00", daysOfWeek: [] },
          NOW
        )
      )
    ).toContain("day of the week");
  });

  it("computes the next UTC daily occurrence", () => {
    expect(
      computeNextRunAt(
        { scheduleType: "daily", runAt: null, intervalMinutes: null, timezone: "UTC", localTime: "13:00", daysOfWeek: null },
        NOW
      ).toISOString()
    ).toBe("2026-11-18T13:00:00.000Z");
  });
});
