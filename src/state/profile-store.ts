import { create } from 'zustand';

import { DEFAULT_CHARACTER_ID } from '@/art/characters';
import { profileRepository } from '@/data/repositories/profile-repository';
import { generateId } from '@/domain/id';
import type { Profile, UnitPreference } from '@/domain/types';

type ProfileState = {
  profile: Profile | null;
  /** Load the profile from the database into the store. */
  hydrate: () => void;
  createProfile: (name: string) => void;
  setUnitPref: (unit: UnitPreference) => void;
  addXp: (amount: number) => void;
  reset: () => void;
};

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  hydrate: () => set({ profile: profileRepository.get() }),
  createProfile: (name) => {
    const profile: Profile = {
      id: generateId(),
      name: name.trim() || 'Athlete',
      characterId: DEFAULT_CHARACTER_ID,
      unitPref: 'kg',
      createdAt: new Date().toISOString(),
      xp: 0,
    };
    set({ profile: profileRepository.save(profile) });
  },
  setUnitPref: (unitPref) => set({ profile: profileRepository.update({ unitPref }) }),
  addXp: (amount) => set({ profile: profileRepository.addXp(amount) }),
  reset: () => {
    profileRepository.clear();
    set({ profile: null });
  },
}));
