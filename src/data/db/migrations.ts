import { DB_VERSION, defaultSettings, emptyDatabase, type DatabaseShape } from '@/data/db/schema';
import { toCalendarDate } from '@/domain/date';
import { clampXp } from '@/domain/xp';

type Migration = {
  /** Version this migration upgrades the document *to*. */
  version: number;
  migrate: (db: DatabaseShape) => DatabaseShape;
};

/**
 * Ordered, additive migrations. Each runs when the stored document version is
 * below its `version`. The v1 baseline normalizes any missing collections.
 */
const migrations: Migration[] = [
  {
    version: 1,
    migrate: (db) => ({ ...emptyDatabase(), ...db, version: 1 }),
  },
  {
    version: 2,
    // Session entry date: `date` becomes the performed calendar day while the
    // optional timestamps record a live session. Normalize legacy rows where
    // `date` mirrored the full `startedAt` timestamp.
    migrate: (db) => ({
      ...db,
      sessions: db.sessions.map((session) => ({
        ...session,
        date: toCalendarDate(session.date ?? session.startedAt),
      })),
      draft: db.draft
        ? { ...db.draft, date: toCalendarDate(db.draft.date ?? db.draft.startedAt) }
        : null,
      version: 2,
    }),
  },
  {
    version: 3,
    // User settings document (starts with the persisted rest timer).
    migrate: (db) => ({
      ...db,
      settings: { ...defaultSettings(), ...db.settings },
      version: 3,
    }),
  },
  {
    version: 4,
    // Gamification cursor: decay starts from the last training day, falling back
    // to profile creation only for profiles that have never logged a session.
    migrate: (db) => {
      const lastSessionDate = db.sessions
        .filter((session) => session.completed)
        .map((session) => session.date)
        .sort()
        .at(-1);

      return {
        ...db,
        profile: db.profile
          ? {
              ...db.profile,
              lastActivityDate:
                db.profile.lastActivityDate ??
                lastSessionDate ??
                toCalendarDate(db.profile.createdAt),
            }
          : null,
        version: 4,
      };
    },
  },
  {
    version: 5,
    // XP now comes from working-set count (1 each) instead of tonnage. Rewrite
    // stored session totals and rebuild profile XP from the same rule.
    migrate: (db) => {
      const sessionIds = new Set(db.sessions.map((session) => session.id));
      const workingSetsBySession = new Map<string, number>();
      let totalWorkingSets = 0;

      for (const set of db.sets) {
        if (set.isWarmup || !sessionIds.has(set.sessionId)) continue;
        totalWorkingSets += 1;
        workingSetsBySession.set(set.sessionId, (workingSetsBySession.get(set.sessionId) ?? 0) + 1);
      }

      return {
        ...db,
        sessions: db.sessions.map((session) => ({
          ...session,
          xpEarned: workingSetsBySession.get(session.id) ?? 0,
        })),
        profile: db.profile ? { ...db.profile, xp: clampXp(totalWorkingSets) } : null,
        version: 5,
      };
    },
  },
];

export function runMigrations(input: DatabaseShape): DatabaseShape {
  let db = { ...input };
  for (const migration of migrations) {
    if ((db.version ?? 0) < migration.version) {
      db = migration.migrate(db);
    }
  }
  if (db.version !== DB_VERSION) {
    db = { ...db, version: DB_VERSION };
  }
  return db;
}
