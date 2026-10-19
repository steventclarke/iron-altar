import { create } from 'zustand';

import type { DraftSession } from '@/data/db/schema';
import { draftRepository } from '@/data/repositories/draft-repository';
import { generateId } from '@/domain/id';
import type { SetEntry } from '@/domain/types';
import { xpFromSets } from '@/domain/xp';

export type { DraftSession };

type SessionState = {
  active: DraftSession | null;
  /** Load any in-progress draft from the database. */
  hydrate: () => void;
  start: () => void;
  discard: () => void;
  setNotes: (notes: string) => void;
  addSet: (set: Omit<SetEntry, 'id' | 'sessionId' | 'order'>) => void;
  removeSet: (setId: string) => void;
  /** Working-set volume in kg. */
  totalVolumeKg: () => number;
  xpEarned: () => number;
};

export const useSessionStore = create<SessionState>((set, get) => {
  const commit = (active: DraftSession | null) => {
    draftRepository.save(active);
    set({ active });
  };

  return {
    active: null,
    hydrate: () => set({ active: draftRepository.get() }),
    start: () => {
      if (get().active) return;
      commit({ id: generateId(), startedAt: new Date().toISOString(), notes: '', sets: [] });
    },
    discard: () => {
      draftRepository.clear();
      set({ active: null });
    },
    setNotes: (notes) => {
      const active = get().active;
      if (active) commit({ ...active, notes });
    },
    addSet: (draft) => {
      const active = get().active;
      if (!active) return;
      const entry: SetEntry = {
        ...draft,
        id: generateId(),
        sessionId: active.id,
        order: active.sets.length,
      };
      commit({ ...active, sets: [...active.sets, entry] });
    },
    removeSet: (setId) => {
      const active = get().active;
      if (!active) return;
      commit({
        ...active,
        sets: active.sets.filter((s) => s.id !== setId).map((s, index) => ({ ...s, order: index })),
      });
    },
    totalVolumeKg: () =>
      (get().active?.sets ?? [])
        .filter((s) => !s.isWarmup)
        .reduce((sum, s) => sum + s.weightKg * s.reps, 0),
    xpEarned: () => xpFromSets(get().active?.sets ?? []),
  };
});
