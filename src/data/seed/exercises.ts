import type { Exercise } from '@/domain/types';

/**
 * Seed exercise catalogue: the five main lifts plus common accessories.
 * Stored in the database on first run (P1); ids are stable so they can be
 * referenced safely.
 */
export const SEED_EXERCISES: Exercise[] = [
  // Main lifts
  {
    id: 'barbell-back-squat',
    name: 'Back Squat',
    category: 'barbell',
    isMainLift: true,
    mainLift: 'squat',
    muscleGroup: 'legs',
  },
  {
    id: 'barbell-bench-press',
    name: 'Bench Press',
    category: 'barbell',
    isMainLift: true,
    mainLift: 'bench',
    muscleGroup: 'chest',
  },
  {
    id: 'barbell-deadlift',
    name: 'Deadlift',
    category: 'barbell',
    isMainLift: true,
    mainLift: 'deadlift',
    muscleGroup: 'back',
  },
  {
    id: 'barbell-overhead-press',
    name: 'Overhead Press',
    category: 'barbell',
    isMainLift: true,
    mainLift: 'overhead_press',
    muscleGroup: 'shoulders',
  },
  {
    id: 'barbell-power-clean',
    name: 'Power Clean',
    category: 'barbell',
    isMainLift: true,
    mainLift: 'power_clean',
    muscleGroup: 'full_body',
  },

  // Accessories
  {
    id: 'barbell-row',
    name: 'Barbell Row',
    category: 'barbell',
    isMainLift: false,
    muscleGroup: 'back',
  },
  {
    id: 'pull-up',
    name: 'Pull-up',
    category: 'bodyweight',
    isMainLift: false,
    muscleGroup: 'back',
  },
  {
    id: 'dip',
    name: 'Dip',
    category: 'bodyweight',
    isMainLift: false,
    muscleGroup: 'chest',
  },
  {
    id: 'dumbbell-curl',
    name: 'Dumbbell Curl',
    category: 'dumbbell',
    isMainLift: false,
    muscleGroup: 'arms',
  },
  {
    id: 'romanian-deadlift',
    name: 'Romanian Deadlift',
    category: 'barbell',
    isMainLift: false,
    muscleGroup: 'hamstrings',
  },
  {
    id: 'walking-lunge',
    name: 'Walking Lunge',
    category: 'dumbbell',
    isMainLift: false,
    muscleGroup: 'legs',
  },
  {
    id: 'plank',
    name: 'Plank',
    category: 'bodyweight',
    isMainLift: false,
    muscleGroup: 'core',
  },
];
