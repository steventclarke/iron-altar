import type { CalendarDate, Session } from '@/domain/types';
import { addCalendarDays, toCalendarDate } from '@/domain/date';
import { applyDecay, weeksSince, xpTrend, type XpTrend } from '@/domain/xp';

/** Monday of the calendar week containing `date`. */
export function weekStart(date: CalendarDate): CalendarDate {
  const [year, month, day] = date.split('-').map(Number);
  const weekday = new Date(year, month - 1, day).getDay();
  const daysSinceMonday = (weekday + 6) % 7;
  return addCalendarDays(date, -daysSinceMonday);
}

/**
 * Consecutive weeks in which at least one workout was logged. The streak stays
 * alive through the current week and resets once a full week passes without
 * training. Uses performed dates, so retroactive workouts count (#3).
 */
export function streakWeeks(dates: CalendarDate[], now: Date = new Date()): number {
  const weeks = [...new Set(dates.map(weekStart))].sort();
  if (weeks.length === 0) return 0;

  const currentWeek = weekStart(toCalendarDate(now));
  const lastWeek = weeks[weeks.length - 1];
  if (lastWeek < addCalendarDays(currentWeek, -7)) return 0;

  let streak = 0;
  let expected = lastWeek;
  for (let index = weeks.length - 1; index >= 0; index -= 1) {
    if (weeks[index] !== expected) break;
    streak += 1;
    expected = addCalendarDays(expected, -7);
  }
  return streak;
}

export type TrainingSummary = {
  streakWeeks: number;
  lastTrainingDate: CalendarDate | null;
  /** XP earned in the last seven days. */
  recentXpGain: number;
  trend: XpTrend;
};

/** Roll up completed sessions into the streak + trend shown on the Gym/Profile. */
export function trainingSummary(sessions: Session[], now: Date = new Date()): TrainingSummary {
  const completed = sessions.filter((session) => session.completed);
  const dates = completed.map((session) => session.date).sort();
  const lastTrainingDate = dates.length ? dates[dates.length - 1] : null;
  const windowStart = addCalendarDays(toCalendarDate(now), -6);
  const recentXpGain = completed
    .filter((session) => session.date >= windowStart)
    .reduce((total, session) => total + session.xpEarned, 0);

  return {
    streakWeeks: streakWeeks(dates, now),
    lastTrainingDate,
    recentXpGain,
    trend: completed.length === 0 ? 'flat' : xpTrend(recentXpGain),
  };
}

export type IdleDecayResult = {
  xp: number;
  lastActivityDate: CalendarDate;
  weeksDecayed: number;
  xpLost: number;
};

/**
 * Apply one week of XP decay for every full week since the last training day.
 * The activity cursor advances by the decayed weeks (not to today), so partial
 * weeks are preserved and decay is never charged twice.
 */
export function applyIdleDecay(
  xp: number,
  lastActivityDate: CalendarDate,
  now: Date = new Date(),
): IdleDecayResult {
  const weeks = weeksSince(lastActivityDate, now);
  if (weeks <= 0) {
    return { xp, lastActivityDate, weeksDecayed: 0, xpLost: 0 };
  }

  const decayedXp = applyDecay(xp, weeks);
  return {
    xp: decayedXp,
    lastActivityDate: addCalendarDays(lastActivityDate, weeks * 7),
    weeksDecayed: weeks,
    xpLost: xp - decayedXp,
  };
}

export type TrendDisplay = {
  symbol: string;
  label: string;
};

export function trendDisplay(trend: XpTrend): TrendDisplay {
  if (trend === 'up') return { symbol: '▲', label: 'GROWING' };
  if (trend === 'down') return { symbol: '▼', label: 'DECAYING' };
  return { symbol: '●', label: 'STEADY' };
}
