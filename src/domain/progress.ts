import type { BodyWeightEntry, CalendarDate, MainLift, Session, SetEntry } from '@/domain/types';
import { toCalendarDate } from '@/domain/date';
import { estimateOneRepMax } from '@/domain/units';

/** The five lifts graphed on the progress screen, in display order. */
export const MAIN_LIFTS: MainLift[] = [
  'squat',
  'bench',
  'deadlift',
  'overhead_press',
  'power_clean',
];

export function isMainLift(value: string): value is MainLift {
  return MAIN_LIFTS.includes(value as MainLift);
}

/**
 * Count working (non-warmup) sets per exercise (refinement #6). Warmups are
 * excluded everywhere so progress and XP share the same definition of effort.
 */
export function workingSetsByExercise(sets: SetEntry[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const set of sets) {
    if (set.isWarmup) continue;
    counts[set.exerciseId] = (counts[set.exerciseId] ?? 0) + 1;
  }
  return counts;
}

/** One workout's performance for a single exercise, ready to chart. */
export type LiftPoint = {
  sessionId: string;
  date: CalendarDate;
  /** Heaviest working set, in kg. */
  topWeightKg: number;
  /** Best estimated one-rep max across working sets, in kg. */
  bestE1RmKg: number;
  workingSets: number;
  volumeKg: number;
};

/**
 * Build an ascending-by-date series of a lift's performance across completed
 * sessions. Sessions with no working sets for the exercise are skipped so the
 * chart only shows days the lift was actually trained.
 */
export function liftProgress(
  sessions: Session[],
  sets: SetEntry[],
  exerciseId: string,
): LiftPoint[] {
  const setsBySession = new Map<string, SetEntry[]>();
  for (const set of sets) {
    if (set.exerciseId !== exerciseId || set.isWarmup) continue;
    const list = setsBySession.get(set.sessionId);
    if (list) list.push(set);
    else setsBySession.set(set.sessionId, [set]);
  }

  return sessions
    .filter((session) => setsBySession.has(session.id))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((session) => {
      const workingSets = setsBySession.get(session.id) ?? [];
      return {
        sessionId: session.id,
        date: session.date,
        topWeightKg: Math.max(...workingSets.map((set) => set.weightKg)),
        bestE1RmKg: Math.max(
          ...workingSets.map((set) => estimateOneRepMax(set.weightKg, set.reps)),
        ),
        workingSets: workingSets.length,
        volumeKg: workingSets.reduce((sum, set) => sum + set.weightKg * set.reps, 0),
      };
    });
}

export type BodyWeightPoint = {
  date: CalendarDate;
  weightKg: number;
};

/** Body-weight entries normalised to calendar dates and sorted ascending. */
export function bodyWeightProgress(entries: BodyWeightEntry[]): BodyWeightPoint[] {
  return entries
    .map((entry) => ({ date: toCalendarDate(entry.date), weightKg: entry.weightKg }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
