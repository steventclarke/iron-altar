import { create } from 'zustand';

import { exerciseRepository } from '@/data/repositories/exercise-repository';
import { sessionRepository } from '@/data/repositories/session-repository';
import type { Session, SetEntry } from '@/domain/types';

/** A completed session plus the data needed to render a history card. */
export type SessionSummary = {
  session: Session;
  sets: SetEntry[];
  /** Distinct exercise names in log order. */
  exerciseNames: string[];
  /** Working-set count (warmups excluded). */
  workingSetCount: number;
};

type HistoryState = {
  /** Completed sessions, newest first, with their sets. */
  summaries: SessionSummary[];
  /** Reload from the repository (call on focus; cheap in-memory read). */
  refresh: () => void;
};

function summarise(session: Session, sets: SetEntry[]): SessionSummary {
  const names: string[] = [];
  for (const set of sets) {
    const name = exerciseRepository.byId(set.exerciseId)?.name ?? 'Unknown';
    if (!names.includes(name)) names.push(name);
  }
  return {
    session,
    sets,
    exerciseNames: names,
    workingSetCount: sets.filter((s) => !s.isWarmup).length,
  };
}

/**
 * Read-only view over completed sessions for the History screens. State lives
 * in the store so the list and detail screens re-render when a workout is
 * finished; data is still sourced from the repository (source of truth).
 */
export const useHistoryStore = create<HistoryState>((set) => ({
  summaries: [],
  refresh: () =>
    set({
      summaries: sessionRepository
        .all()
        .map((session) => summarise(session, sessionRepository.setsForSession(session.id))),
    }),
}));
