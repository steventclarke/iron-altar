import { getDatabase, mutate } from '@/data/db/database';
import type { Exercise, MainLift } from '@/domain/types';

export const exerciseRepository = {
  all(): Exercise[] {
    return getDatabase().exercises;
  },

  byId(id: string): Exercise | null {
    return getDatabase().exercises.find((e) => e.id === id) ?? null;
  },

  mainLifts(): Exercise[] {
    return getDatabase().exercises.filter((e) => e.isMainLift);
  },

  byMainLift(mainLift: MainLift): Exercise | null {
    return getDatabase().exercises.find((e) => e.mainLift === mainLift) ?? null;
  },

  /** Insert or update exercises by id (used for seeding and edits). */
  upsertMany(exercises: Exercise[]): void {
    mutate((db) => {
      for (const exercise of exercises) {
        const index = db.exercises.findIndex((e) => e.id === exercise.id);
        if (index >= 0) db.exercises[index] = exercise;
        else db.exercises.push(exercise);
      }
    });
  },
};
