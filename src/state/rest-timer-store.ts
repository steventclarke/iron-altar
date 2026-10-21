import { create } from 'zustand';

/** Default rest length when a set is logged. */
export const DEFAULT_REST_SECONDS = 90;

/** Quick-pick rest lengths offered on the session screen. */
export const REST_PRESETS = [60, 90, 120, 180] as const;

type RestTimerState = {
  /** Target rest length for the most recent start, used by presets + auto-start. */
  durationSeconds: number;
  /** Epoch ms when the current rest ends; null when idle. */
  endsAt: number | null;
  /** Whole seconds left, recomputed by `tick` (so it survives backgrounding). */
  remainingSeconds: number;
  /** True once a running rest has counted down to zero (until restarted/stopped). */
  finished: boolean;
  /** Begin (or restart) a rest of `seconds`, defaulting to the last duration. */
  start: (seconds?: number) => void;
  stop: () => void;
  reset: () => void;
  /** Recompute remaining time from the clock; stops at zero. */
  tick: () => void;
};

/**
 * Rest timer as store state (not component state) so the countdown survives
 * navigating away from the session screen. Purely ephemeral — nothing persists.
 */
export const useRestTimer = create<RestTimerState>((set, get) => ({
  durationSeconds: DEFAULT_REST_SECONDS,
  endsAt: null,
  remainingSeconds: 0,
  finished: false,

  start: (seconds) => {
    const duration = seconds ?? get().durationSeconds;
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
      durationSeconds: DEFAULT_REST_SECONDS,
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
