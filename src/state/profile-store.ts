import { create } from 'zustand';

import { DEFAULT_CHARACTER_ID } from '@/art/characters';
import { profileRepository } from '@/data/repositories/profile-repository';
import { todayCalendarDate } from '@/domain/date';
import { applyIdleDecay } from '@/domain/gamification';
import { generateId } from '@/domain/id';
import type { CalendarDate, Profile, UnitPreference } from '@/domain/types';
import { clampXp } from '@/domain/xp';

type ProfileState = {
  profile: Profile | null;
  /** Load the profile and charge any XP decay owed since the last session. */
  hydrate: () => void;
  createProfile: (name: string) => void;
  setUnitPref: (unit: UnitPreference) => void;
  /** Add workout XP and advance the last-activity cursor (never backwards). */
  recordWorkout: (xpEarned: number, date: CalendarDate) => void;
  reset: () => void;
};

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  hydrate: () => {
    const stored = profileRepository.get();
    if (!stored) {
      set({ profile: null });
      return;
    }

    // A v4 database written before this migration existed may lack the cursor;
    // start decay from today rather than punishing a legacy profile.
    const lastActivityDate = stored.lastActivityDate ?? todayCalendarDate();
    const decay = applyIdleDecay(stored.xp, lastActivityDate);
    if (decay.weeksDecayed > 0 || stored.lastActivityDate !== lastActivityDate) {
      set({
        profile: profileRepository.update({
          xp: decay.xp,
          lastActivityDate: decay.lastActivityDate,
        }),
      });
      return;
    }

    set({ profile: stored });
  },
  createProfile: (name) => {
    const profile: Profile = {
      id: generateId(),
      name: name.trim() || 'Athlete',
      characterId: DEFAULT_CHARACTER_ID,
      unitPref: 'kg',
      createdAt: new Date().toISOString(),
      xp: 0,
      lastActivityDate: todayCalendarDate(),
    };
    set({ profile: profileRepository.save(profile) });
  },
  setUnitPref: (unitPref) => set({ profile: profileRepository.update({ unitPref }) }),
  recordWorkout: (xpEarned, date) => {
    const current = get().profile;
    if (!current) return;
    const lastActivityDate = date > current.lastActivityDate ? date : current.lastActivityDate;
    set({
      profile: profileRepository.update({
        xp: clampXp(current.xp + xpEarned),
        lastActivityDate,
      }),
    });
  },
  reset: () => {
    profileRepository.clear();
    set({ profile: null });
  },
}));
