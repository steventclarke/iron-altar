import { exerciseRepository } from '@/data/repositories/exercise-repository';
import { SEED_EXERCISES } from '@/data/seed/exercises';

/**
 * Ensure the built-in exercise catalogue is present. Upserting by id means new
 * seed exercises added in later releases show up without clobbering the user's
 * other data.
 */
export function seedDatabase(): void {
  exerciseRepository.upsertMany(SEED_EXERCISES);
}
