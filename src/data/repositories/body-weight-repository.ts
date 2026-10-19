import { getDatabase, mutate } from '@/data/db/database';
import { generateId } from '@/domain/id';
import type { BodyWeightEntry } from '@/domain/types';

function byDateAsc(a: BodyWeightEntry, b: BodyWeightEntry): number {
  return new Date(a.date).getTime() - new Date(b.date).getTime();
}

export const bodyWeightRepository = {
  all(): BodyWeightEntry[] {
    return [...getDatabase().bodyWeights].sort(byDateAsc);
  },

  latest(): BodyWeightEntry | null {
    const entries = this.all();
    return entries.length ? entries[entries.length - 1] : null;
  },

  add(weightKg: number, date: string = new Date().toISOString()): BodyWeightEntry {
    const entry: BodyWeightEntry = { id: generateId(), date, weightKg };
    return mutate((db) => {
      db.bodyWeights.push(entry);
      return entry;
    });
  },

  remove(id: string): void {
    mutate((db) => {
      db.bodyWeights = db.bodyWeights.filter((e) => e.id !== id);
    });
  },
};
