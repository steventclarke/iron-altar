import type { BodyWeightEntry, Exercise, Profile, Session, SetEntry } from '@/domain/types';

/** Storage key for the persisted document. */
export const DB_KEY = 'iron-altar/db';
/** Current document schema version — bump when the shape changes. */
export const DB_VERSION = 1;

/** An in-progress workout that has not yet been saved as a completed Session. */
export type DraftSession = {
  id: string;
  startedAt: string;
  notes: string;
  sets: SetEntry[];
};

/**
 * The entire local-first database is a single versioned JSON document. It is
 * small enough (a personal training log) that an in-memory document with
 * write-through persistence is simpler and more portable than SQL, and adds no
 * platform-specific bundle/runtime requirements on web.
 */
export type DatabaseShape = {
  version: number;
  profile: Profile | null;
  exercises: Exercise[];
  sessions: Session[];
  sets: SetEntry[];
  bodyWeights: BodyWeightEntry[];
  draft: DraftSession | null;
};

export function emptyDatabase(): DatabaseShape {
  return {
    version: DB_VERSION,
    profile: null,
    exercises: [],
    sessions: [],
    sets: [],
    bodyWeights: [],
    draft: null,
  };
}
