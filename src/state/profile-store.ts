import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEFAULT_CHARACTER_ID } from '@/art/characters';
import { generateId } from '@/domain/id';
import type { Profile, UnitPreference } from '@/domain/types';
import { clampXp } from '@/domain/xp';

type ProfileState = {
  profile: Profile | null;
  createProfile: (name: string) => void;
  setUnitPref: (unit: UnitPreference) => void;
  addXp: (amount: number) => void;
  reset: () => void;
};

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      profile: null,
      createProfile: (name) =>
        set({
          profile: {
            id: generateId(),
            name: name.trim() || 'Athlete',
            characterId: DEFAULT_CHARACTER_ID,
            unitPref: 'kg',
            createdAt: new Date().toISOString(),
            xp: 0,
          },
        }),
      setUnitPref: (unitPref) =>
        set((state) => (state.profile ? { profile: { ...state.profile, unitPref } } : state)),
      addXp: (amount) =>
        set((state) =>
          state.profile
            ? { profile: { ...state.profile, xp: clampXp(state.profile.xp + amount) } }
            : state,
        ),
      reset: () => set({ profile: null }),
    }),
    {
      name: 'iron-altar/profile',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
