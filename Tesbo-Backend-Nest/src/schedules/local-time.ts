/**
 * The next instant a local wall-clock rule fires.
 *
 * "Daily at 09:00 in America/New_York" is not a fixed interval: the UTC instant follows DST. The
 * rule is evaluated against the zone's own calendar, and the resulting instant is verified by
 * formatting it back in that zone:
 *
 *  - a local time that does not exist that day (spring forward) is skipped to the next allowed day;
 *  - an ambiguous local time (fall back) resolves to the first matching instant — it fires once.
 *
 * Pure and timezone-driven through Intl only; no fixed-offset assumptions.
 */
export type LocalRule = {
  timezone: string;
  /** HH:MM, already validated by the caller. */
  localTime: string;
  /** 0=Sunday .. 6=Saturday. null means every day (daily). */
  daysOfWeek: number[] | null;
};

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function partsInZone(instant: Date, timeZone: string): Parts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
  const parts = formatter.formatToParts(instant);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second")
  };
}

/** Milliseconds the zone is ahead of UTC at that instant (positive east of Greenwich). */
function offsetMs(instant: Date, timeZone: string): number {
  const parts = partsInZone(instant, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

export function nextLocalRunAt(rule: LocalRule, from: Date = new Date()): Date {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(rule.localTime);
  if (!match) throw new Error("localTime must be HH:MM");
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const days = rule.daysOfWeek ? new Set(rule.daysOfWeek) : null;
  const start = partsInZone(from, rule.timezone);

  // Eight days covers a weekly rule plus a DST gap that can consume a day.
  for (let offset = 0; offset <= 8; offset++) {
    const localDay = new Date(Date.UTC(start.year, start.month - 1, start.day + offset));
    const year = localDay.getUTCFullYear();
    const month = localDay.getUTCMonth() + 1;
    const day = localDay.getUTCDate();
    if (days && !days.has(localDay.getUTCDay())) continue;

    const guess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
    // Resolve the zone offset for the guessed wall-clock instant, then re-resolve at the result:
    // the offset can differ across a DST boundary between guessing and landing.
    const first = new Date(guess - offsetMs(new Date(guess), rule.timezone));
    const second = new Date(guess - offsetMs(first, rule.timezone));
    const actual = partsInZone(second, rule.timezone);
    const exists =
      actual.year === year &&
      actual.month === month &&
      actual.day === day &&
      actual.hour === hour &&
      actual.minute === minute;
    if (!exists) continue; // spring-forward gap: no such local time today
    if (second.getTime() > from.getTime()) return second;
  }
  throw new Error("No valid local occurrence in the next 8 days");
}
