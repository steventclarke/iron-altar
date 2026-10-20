import type { CalendarDate, IsoDate } from '@/domain/types';

const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** True when `value` is a `YYYY-MM-DD` calendar date. */
export function isCalendarDate(value: string): value is CalendarDate {
  return CALENDAR_DATE_PATTERN.test(value);
}

/**
 * Reduce an ISO timestamp (or `Date`) to a local-timezone calendar date
 * (`YYYY-MM-DD`). Calendar dates pass through unchanged so the conversion is
 * idempotent — re-running a migration never shifts a day.
 */
export function toCalendarDate(value: IsoDate | Date): CalendarDate {
  if (typeof value === 'string' && isCalendarDate(value)) return value;

  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return todayCalendarDate();

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Today's calendar date in the device's local timezone. */
export function todayCalendarDate(now: Date = new Date()): CalendarDate {
  return toCalendarDate(now);
}
