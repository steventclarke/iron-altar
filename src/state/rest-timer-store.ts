import { create } from 'zustand';

import { DEFAULT_REST_SECONDS } from '@/data/db/schema';
import { settingsRepository } from '@/data/repositories/settings-repository';

export { DEFAULT_REST_SECONDS };

/** Clamp a chosen rest length to a sane range (0:05 - 60:00). */
export const MIN_REST_SECONDS = 5;
export const MAX_REST_SECONDS = 60 * 60;

type RestTimerState = {
  /**
   * User's preferred rest length, in seconds. Persisted via the settings
   * repository so it survives app restarts (refinement #8); the default is
   * 1:00 until the user changes it.
   */
  durationSeconds: number;
  /** Epoch ms when the current rest ends; null when idle. */
  endsAt: number | null;
  /** Whole seconds left, recomputed by `tick` (so it survives backgrounding). */
  remainingSeconds: number;
  /** True once a running rest has counted down to zero (until restarted/stopped). */
  finished: boolean;
  /** Load the persisted rest length from the database. */
  hydrate: () => void;
  /** Set (and persist) the preferred rest length in seconds. */
  setDuration: (seconds: number) => void;
  /** Begin (or restart) a rest of `seconds`, defaulting to the preferred length. */
  start: (seconds?: number) => void;
  stop: () => void;
  reset: () => void;
  /** Recompute remaining time from the clock; stops at zero. */
  tick: () => void;
};

function clampRest(seconds: number): number {
  if (!Number.isFinite(seconds)) return DEFAULT_REST_SECONDS;
  return Math.max(MIN_REST_SECONDS, Math.min(MAX_REST_SECONDS, Math.round(seconds)));
}

/**
 * Rest timer as store state (not component state) so the countdown survives
 * navigating away from the session screen. The chosen duration is persisted;
 * the live countdown is ephemeral.
 */
export const useRestTimer = create<RestTimerState>((set, get) => ({
  durationSeconds: DEFAULT_REST_SECONDS,
  endsAt: null,
  remainingSeconds: 0,
  finished: false,

  hydrate: () => set({ durationSeconds: settingsRepository.get().restSeconds }),

  setDuration: (seconds) => {
    const duration = clampRest(seconds);
    settingsRepository.update({ restSeconds: duration });
    set({ durationSeconds: duration });
  },

  start: (seconds) => {
    const duration = clampRest(seconds ?? get().durationSeconds);
    set({
      durationSeconds: duration,
      endsAt: Date.now() + duration * 1000,
      remainingSeconds: duration,
      finished: false,
    });
  },

  stop: () => set({ endsAt: null, remainingSeconds: 0, finished: false }),

  reset: () =>
    set({
      endsAt: null,
      remainingSeconds: 0,
      finished: false,
    }),

  tick: () => {
    const { endsAt } = get();
    if (endsAt === null) return;
    const remaining = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
    if (remaining === 0) set({ remainingSeconds: 0, endsAt: null, finished: true });
    else set({ remainingSeconds: remaining });
  },
}));
