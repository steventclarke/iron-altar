import { DB_VERSION, defaultSettings, emptyDatabase, type DatabaseShape } from '@/data/db/schema';
import { toCalendarDate } from '@/domain/date';

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
