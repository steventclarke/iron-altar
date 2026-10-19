import { create } from 'zustand';

import { generateId } from '@/domain/id';
import type { SetEntry } from '@/domain/types';
import { xpFromSets } from '@/domain/xp';

export type DraftSession = {
  id: string;
  startedAt: string;
  notes: string;
  sets: SetEntry[];
};

type SessionState = {
  active: DraftSession | null;
  start: () => void;
  discard: () => void;
  setNotes: (notes: string) => void;
  addSet: (set: Omit<SetEntry, 'id' | 'sessionId' | 'order'>) => void;
  removeSet: (setId: string) => void;
  /** Working-set volume in kg. */
  totalVolumeKg: () => number;
  xpEarned: () => number;
};

export const useSessionStore = create<SessionState>((set, get) => ({
  active: null,
  start: () =>
    set((state) =>
      state.active
        ? state
        : {
            active: { id: generateId(), startedAt: new Date().toISOString(), notes: '', sets: [] },
          },
    ),
  discard: () => set({ active: null }),
  setNotes: (notes) =>
    set((state) => (state.active ? { active: { ...state.active, notes } } : state)),
  addSet: (draft) =>
    set((state) => {
      if (!state.active) return state;
      const entry: SetEntry = {
        ...draft,
        id: generateId(),
        sessionId: state.active.id,
        order: state.active.sets.length,
      };
      return { active: { ...state.active, sets: [...state.active.sets, entry] } };
    }),
  removeSet: (setId) =>
    set((state) =>
      state.active
        ? {
            active: {
              ...state.active,
              sets: state.active.sets
                .filter((s) => s.id !== setId)
                .map((s, i) => ({ ...s, order: i })),
            },
          }
        : state,
    ),
  totalVolumeKg: () => {
    const sets = get().active?.sets ?? [];
    return sets.filter((s) => !s.isWarmup).reduce((sum, s) => sum + s.weightKg * s.reps, 0);
  },
  xpEarned: () => xpFromSets(get().active?.sets ?? []),
}));
