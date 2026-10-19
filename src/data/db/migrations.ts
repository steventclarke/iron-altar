import { DB_VERSION, emptyDatabase, type DatabaseShape } from '@/data/db/schema';

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
