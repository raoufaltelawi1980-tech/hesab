/**
 * Calendar helpers for `BudgetPeriod.periodStart|periodEnd`, both `@db.Date`
 * columns. Every computation is done in UTC because the columns carry no
 * timezone, so a local-time calculation would shift a period by one day for
 * users east or west of Greenwich.
 */

export type PeriodWindow = { start: Date; end: Date };

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDay(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

export function startOfUtcDay(value: Date): Date {
  return utcDay(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

/**
 * The window `periodType` covers around `reference`. `CUSTOM` returns `null`
 * because a custom window is supplied by the caller and cannot be inferred.
 */
export function windowForPeriodType(
  periodType: string,
  reference: Date,
): PeriodWindow | null {
  const day = startOfUtcDay(reference);
  const year = day.getUTCFullYear();
  const month = day.getUTCMonth();

  switch (periodType) {
    case 'DAILY':
      return { start: day, end: day };
    case 'WEEKLY': {
      // ISO weeks start on Monday, so the offset is 0..6.
      const weekday = (day.getUTCDay() + 6) % 7;
      const start = new Date(day.getTime() - weekday * DAY_MS);
      return { start, end: new Date(start.getTime() + 6 * DAY_MS) };
    }
    case 'MONTHLY':
      return { start: utcDay(year, month, 1), end: utcDay(year, month + 1, 0) };
    case 'YEARLY':
      return { start: utcDay(year, 0, 1), end: utcDay(year, 11, 31) };
    default:
      return null;
  }
}

/** Accepts `YYYY-MM-DD` or a full ISO string; returns UTC midnight either way. */
export function parseCalendarDate(raw: unknown, field: string): Date {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new TypeError(`${field} مطلوب`);
  }
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw.trim()) ? `${raw.trim()}T00:00:00Z` : raw.trim();
  const parsed = new Date(dateOnly);
  if (Number.isNaN(parsed.getTime())) throw new TypeError(`${field} ليس تاريخًا صالحًا`);
  return startOfUtcDay(parsed);
}