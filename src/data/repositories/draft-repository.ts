import { getDatabase, mutate } from '@/data/db/database';
import type { DraftSession } from '@/data/db/schema';

/**
 * Persists the single in-progress workout so it survives navigating away from
 * the session screen and app restarts (refinement #2).
 */
export const draftRepository = {
  get(): DraftSession | null {
    return getDatabase().draft;
  },

  save(draft: DraftSession | null): DraftSession | null {
    return mutate((db) => {
      db.draft = draft;
      return draft;
    });
  },

  clear(): void {
    mutate((db) => {
      db.draft = null;
    });
  },
};
