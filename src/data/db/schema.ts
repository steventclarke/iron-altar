import type {
  BodyWeightEntry,
  CalendarDate,
  Exercise,
  Profile,
  Session,
  SetEntry,
} from '@/domain/types';

/** Storage key for the persisted document. */
export const DB_KEY = 'iron-altar/db';
/** Current document schema version — bump when the shape changes. */
export const DB_VERSION = 3;

/** Default rest length (seconds) when the user has not chosen one. */
export const DEFAULT_REST_SECONDS = 60;

/** User preferences that outlive any single workout. */
export type Settings = {
  /** Preferred rest between sets, in seconds; drives the session rest timer. */
  restSeconds: number;
};

/** An in-progress workout that has not yet been saved as a completed Session. */
export type DraftSession = {
  id: string;
  /** Day the workout is performed — defaults to today, editable to backdate it. */
  date: CalendarDate;
  /** Wall-clock time logging began (independent of the performed `date`). */
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
  settings: Settings;
  exercises: Exercise[];
  sessions: Session[];
  sets: SetEntry[];
  bodyWeights: BodyWeightEntry[];
  draft: DraftSession | null;
};

export function defaultSettings(): Settings {
  return { restSeconds: DEFAULT_REST_SECONDS };
}

export function emptyDatabase(): DatabaseShape {
  return {
    version: DB_VERSION,
    profile: null,
    settings: defaultSettings(),
    exercises: [],
    sessions: [],
    sets: [],
    bodyWeights: [],
    draft: null,
  };
}
