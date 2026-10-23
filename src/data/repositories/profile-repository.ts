import { getDatabase, mutate } from '@/data/db/database';
import type { Profile } from '@/domain/types';

export const profileRepository = {
  get(): Profile | null {
    return getDatabase().profile;
  },

  save(profile: Profile): Profile {
    return mutate((db) => {
      db.profile = profile;
      return profile;
    });
  },

  update(patch: Partial<Profile>): Profile | null {
    return mutate((db) => {
      if (!db.profile) return null;
      db.profile = { ...db.profile, ...patch };
      return db.profile;
    });
  },

  clear(): void {
    mutate((db) => {
      db.profile = null;
    });
  },
};
