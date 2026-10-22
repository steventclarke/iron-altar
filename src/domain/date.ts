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

/** Shift a calendar date by whole days (local time; month/year overflow handled). */
export function addCalendarDays(date: CalendarDate, days: number): CalendarDate {
  const [year, month, day] = date.split('-').map(Number);
  return toCalendarDate(new Date(year, month - 1, day + days));
}

const WEEKDAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
const MONTH_LABELS = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
] as const;

/** Pixel-friendly display label, e.g. `TUE OCT 14 2026`. */
export function formatCalendarDate(date: CalendarDate): string {
  if (!isCalendarDate(date)) return date;
  const [year, month, day] = date.split('-').map(Number);
  const weekday = WEEKDAY_LABELS[new Date(year, month - 1, day).getDay()];
  return `${weekday} ${MONTH_LABELS[month - 1]} ${day} ${year}`;
}

/** Compact label for charts, e.g. `OCT 14`. */
export function formatShortCalendarDate(date: CalendarDate): string {
  if (!isCalendarDate(date)) return date;
  const [, month, day] = date.split('-').map(Number);
  return `${MONTH_LABELS[month - 1]} ${day}`;
}
