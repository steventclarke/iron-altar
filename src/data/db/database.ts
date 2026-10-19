import AsyncStorage from '@react-native-async-storage/async-storage';

import { runMigrations } from '@/data/db/migrations';
import { DB_KEY, emptyDatabase, type DatabaseShape } from '@/data/db/schema';

let db: DatabaseShape = emptyDatabase();
let initialized = false;

/**
 * Load the persisted document, run migrations, and persist any changes.
 * Safe to call multiple times; only the first call does work.
 */
export async function initializeDatabase(): Promise<DatabaseShape> {
  if (initialized) return db;

  try {
    const raw = await AsyncStorage.getItem(DB_KEY);
    const parsed = raw ? (JSON.parse(raw) as DatabaseShape) : emptyDatabase();
    db = runMigrations(parsed);
  } catch {
    db = emptyDatabase();
  }

  initialized = true;
  await persist();
  return db;
}

export function isDatabaseReady(): boolean {
  return initialized;
}

export function getDatabase(): DatabaseShape {
  if (!initialized) {
    throw new Error('Database is not initialized. Call initializeDatabase() during app bootstrap.');
  }
  return db;
}

/**
 * Apply a synchronous mutation to the in-memory document, then persist.
 * Returns whatever the mutation returns.
 */
export function mutate<T>(fn: (database: DatabaseShape) => T): T {
  const result = fn(db);
  void persist();
  return result;
}

export async function persist(): Promise<void> {
  await AsyncStorage.setItem(DB_KEY, JSON.stringify(db));
}

/** Test/reset helper — clears the in-memory document and persisted data. */
export async function resetDatabase(): Promise<void> {
  db = emptyDatabase();
  initialized = true;
  await persist();
}
