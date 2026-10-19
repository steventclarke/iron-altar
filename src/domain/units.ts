import type { UnitPreference } from '@/domain/types';

const LB_PER_KG = 2.2046226218;
const KG_PER_ST = 6.35029318;

/** Multiplier to convert a value in kg into the given unit. */
const KG_TO_UNIT: Record<UnitPreference, number> = {
  kg: 1,
  lb: LB_PER_KG,
  st: 1 / KG_PER_ST,
};

/** Short suffix shown next to a value, e.g. "kg", "lb", "st". */
export const UNIT_LABEL: Record<UnitPreference, string> = {
  kg: 'kg',
  lb: 'lb',
  st: 'st',
};

export function toDisplay(weightKg: number, unit: UnitPreference): number {
  return weightKg * KG_TO_UNIT[unit];
}

export function fromDisplay(value: number, unit: UnitPreference): number {
  return value / KG_TO_UNIT[unit];
}

/** Format a kg value into a trimmed string in the target unit. */
export function formatWeight(weightKg: number, unit: UnitPreference): string {
  const value = toDisplay(weightKg, unit);
  const decimals = unit === 'kg' ? 1 : 1;
  const rounded = Number(value.toFixed(decimals));
  return `${rounded}${UNIT_LABEL[unit]}`;
}

/** Estimated one-rep max (Epley) in kg. */
export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (reps <= 1) return weightKg;
  return weightKg * (1 + reps / 30);
}
