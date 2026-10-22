import type { SetEntry } from '@/domain/types';

/** Sets of one exercise, in log order, with identical weights collapsed. */
export type ExerciseGroup = {
  exerciseId: string;
  /** Every set for this exercise, in order (used for actions + totals). */
  sets: SetEntry[];
  /** One row per distinct weight, in first-seen order, listing its reps. */
  rows: WeightRow[];
  /** Working-set count (warmups excluded). */
  workingSetCount: number;
};

export type WeightRow = {
  weightKg: number;
  isWarmup: boolean;
  /** Reps for each set at this weight, e.g. `[5, 5, 4]`. */
  reps: number[];
  /** Ids of the underlying sets, aligned with `reps`. */
  setIds: string[];
};

/**
 * Group a flat, ordered set log into per-exercise sections (refinement #11),
 * collapsing sets that share a weight into one row of comma-separated reps
 * (refinement #13). The first-seen order of exercises and weights is preserved
 * so the log reads top-to-bottom the way it was entered.
 */
export function groupSetsByExercise(sets: SetEntry[]): ExerciseGroup[] {
  const groups: ExerciseGroup[] = [];
  const byExercise = new Map<string, ExerciseGroup>();

  for (const set of sets) {
    let group = byExercise.get(set.exerciseId);
    if (!group) {
      group = { exerciseId: set.exerciseId, sets: [], rows: [], workingSetCount: 0 };
      byExercise.set(set.exerciseId, group);
      groups.push(group);
    }

    group.sets.push(set);
    if (!set.isWarmup) group.workingSetCount += 1;

    const row = group.rows.find((r) => r.weightKg === set.weightKg && r.isWarmup === set.isWarmup);
    if (row) {
      row.reps.push(set.reps);
      row.setIds.push(set.id);
    } else {
      group.rows.push({
        weightKg: set.weightKg,
        isWarmup: set.isWarmup,
        reps: [set.reps],
        setIds: [set.id],
      });
    }
  }

  return groups;
}
