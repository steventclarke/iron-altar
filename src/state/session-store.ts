import { create } from 'zustand';

import type { DraftSession } from '@/data/db/schema';
import { draftRepository } from '@/data/repositories/draft-repository';
import { isCalendarDate, todayCalendarDate } from '@/domain/date';
import { generateId } from '@/domain/id';
import type { CalendarDate, SetEntry } from '@/domain/types';
import { xpFromSets } from '@/domain/xp';

export type { DraftSession };

type SessionState = {
  active: DraftSession | null;
  /** Load any in-progress draft from the database. */
  hydrate: () => void;
  /** Begin a draft; `date` defaults to today for live workouts. */
  start: (date?: CalendarDate) => void;
  /** Change the performed day (used to log retroactive workouts). */
  setEntryDate: (date: CalendarDate) => void;
  discard: () => void;
  setNotes: (notes: string) => void;
  addSet: (set: Omit<SetEntry, 'id' | 'sessionId' | 'order'>) => void;
  removeSet: (setId: string) => void;
  /** Copy an existing set to the end of the log (duplicate-set button). */
  duplicateSet: (setId: string) => void;
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
    start: (date) => {
      if (get().active) return;
      commit({
        id: generateId(),
        date: date && isCalendarDate(date) ? date : todayCalendarDate(),
        startedAt: new Date().toISOString(),
        notes: '',
        sets: [],
      });
    },
    setEntryDate: (date) => {
      const active = get().active;
      if (!active || !isCalendarDate(date)) return;
      commit({ ...active, date });
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
    duplicateSet: (setId) => {
      const active = get().active;
      const source = active?.sets.find((s) => s.id === setId);
      if (!active || !source) return;
      const entry: SetEntry = { ...source, id: generateId(), order: active.sets.length };
      commit({ ...active, sets: [...active.sets, entry] });
    },
    totalVolumeKg: () =>
      (get().active?.sets ?? [])
        .filter((s) => !s.isWarmup)
        .reduce((sum, s) => sum + s.weightKg * s.reps, 0),
    xpEarned: () => xpFromSets(get().active?.sets ?? []),
  };
});
