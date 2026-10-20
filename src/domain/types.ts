/**
 * Core domain types for Iron Altar.
 *
 * Weights are always stored canonically in kilograms; convert for display via
 * `@/domain/units`. All ids are strings (uuid or similar).
 */

export type UnitPreference = 'kg' | 'lb' | 'st';

export type ExerciseCategory = 'barbell' | 'dumbbell' | 'bodyweight' | 'machine' | 'other';

/** The five lifts surfaced in data visualization. */
export type MainLift = 'squat' | 'bench' | 'deadlift' | 'overhead_press' | 'power_clean';

/** ISO-8601 timestamp (full date + time). */
export type IsoDate = string;

/** ISO-8601 calendar date (`YYYY-MM-DD`), a day-level value with no time or zone. */
export type CalendarDate = string;

export type Character = {
  id: string;
  name: string;
  /** Key into the sprite-sheet registry in `@/art/sprite-sheet`. */
  spriteSheet: string;
  /** Number of growth stages rendered for this character. */
  stageCount: number;
};

export type Profile = {
  id: string;
  name: string;
  characterId: string;
  unitPref: UnitPreference;
  createdAt: IsoDate;
  xp: number;
};

export type Exercise = {
  id: string;
  name: string;
  category: ExerciseCategory;
  /** True for the five main lifts tracked in progress charts. */
  isMainLift: boolean;
  mainLift?: MainLift;
  muscleGroup: string;
};

export type Session = {
  id: string;
  /** Day the workout was performed. User-chosen; may be backdated. */
  date: CalendarDate;
  /**
   * Wall-clock start/end, present only for sessions logged live. Retroactively
   * dated sessions have no real timestamps and leave these undefined.
   */
  startedAt?: IsoDate;
  endedAt?: IsoDate;
  notes?: string;
  completed: boolean;
  /** Total working-set volume in kg (warmups excluded). */
  totalVolumeKg: number;
  xpEarned: number;
};

export type SetEntry = {
  id: string;
  sessionId: string;
  exerciseId: string;
  /** Working weight in kg. `0` for bodyweight-only sets. */
  weightKg: number;
  reps: number;
  /** Warmup sets are excluded from XP. */
  isWarmup: boolean;
  /** RPE/RIR, superset notes, etc. live here. */
  notes?: string;
  order: number;
};

export type BodyWeightEntry = {
  id: string;
  date: IsoDate;
  weightKg: number;
};
