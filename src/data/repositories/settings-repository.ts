import { getDatabase, mutate } from '@/data/db/database';
import { defaultSettings, type Settings } from '@/data/db/schema';

/** Persistent user preferences (rest timer length, and later UI prefs). */
export const settingsRepository = {
  get(): Settings {
    return { ...defaultSettings(), ...getDatabase().settings };
  },

  update(patch: Partial<Settings>): Settings {
    return mutate((db) => {
      db.settings = { ...defaultSettings(), ...db.settings, ...patch };
      return db.settings;
    });
  },
};
