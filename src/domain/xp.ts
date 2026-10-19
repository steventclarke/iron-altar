import type { SetEntry } from '@/domain/types';

/** Hard cap on the XP / growth scale. */
export const MAX_XP = 1000;
/** Number of avatar growth stages across the XP range. */
export const STAGE_COUNT = 10;
/** Placeholder weekly decay — tuned once real progression is play-tested. */
export const X_PER_WEEK_DECAY = 50;
/** Length of a "training week" for streak / decay purposes, in days. */
export const TRAINING_WEEK_DAYS = 7;

export const STAGE_NAMES = [
  'Bones',
  'Wiry',
  'Lean',
  'Stocky',
  'Hewn',
  'Brawny',
  'Burly',
  'Titan',
  'Colossus',
  'Demigod',
] as const;

/** Total working-set volume (kg x reps) of a single set. Warmups count as 0. */
export function xpFromSet(set: SetEntry): number {
  if (set.isWarmup) return 0;
  return set.weightKg * set.reps;
}

/** Sum working-set XP across a set of entries. */
export function xpFromSets(sets: SetEntry[]): number {
  return sets.reduce((total, set) => total + xpFromSet(set), 0);
}

export function clampXp(xp: number): number {
  return Math.max(0, Math.min(MAX_XP, xp));
}

export function stageIndexForXp(xp: number): number {
  const clamped = clampXp(xp);
  const perStage = MAX_XP / STAGE_COUNT;
  return Math.min(STAGE_COUNT - 1, Math.floor(clamped / perStage));
}

export type StageInfo = {
  index: number;
  name: string;
  /** XP threshold at which this stage is reached. */
  threshold: number;
  /** XP threshold of the next stage, or null at max. */
  nextThreshold: number | null;
  /** Fraction (0-1) of progress within the current stage. */
  withinStage: number;
  /** Fraction (0-1) of progress through the whole scale. */
  overall: number;
};

export function stageInfoForXp(xp: number): StageInfo {
  const clamped = clampXp(xp);
  const perStage = MAX_XP / STAGE_COUNT;
  const index = stageIndexForXp(clamped);
  const threshold = index * perStage;
  const nextThreshold = index >= STAGE_COUNT - 1 ? null : (index + 1) * perStage;

  return {
    index,
    name: STAGE_NAMES[index],
    threshold,
    nextThreshold,
    withinStage: nextThreshold ? (clamped - threshold) / perStage : 1,
    overall: clamped / MAX_XP,
  };
}

/** Apply decay for `weeks` without training, never below zero. */
export function applyDecay(xp: number, weeks: number): number {
  if (weeks <= 0) return clampXp(xp);
  return clampXp(Math.round(xp - weeks * X_PER_WEEK_DECAY));
}

/** Whole weeks elapsed between two ISO dates. */
export function weeksSince(lastDateIso: string, now: Date = new Date()): number {
  const last = new Date(lastDateIso).getTime();
  const ms = now.getTime() - last;
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.floor(ms / (dayMs * TRAINING_WEEK_DAYS)));
}

export function isStreakAlive(lastDateIso: string | null, now: Date = new Date()): boolean {
  if (!lastDateIso) return false;
  return weeksSince(lastDateIso, now) === 0;
}

export type XpTrend = 'up' | 'down' | 'flat';

/**
 * Overall XP trend over the recent window: net weekly XP gained vs weekly decay.
 * Positive net => trending up (avatar growing); negative => trending down (decaying).
 */
export function xpTrend(recentXpGain: number): XpTrend {
  const net = recentXpGain - X_PER_WEEK_DECAY;
  if (net > 0) return 'up';
  if (net < 0) return 'down';
  return 'flat';
}
