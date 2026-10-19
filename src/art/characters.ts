import type { Character } from '@/domain/types';

/**
 * Character registry. Plumbing supports multiple selectable characters; only
 * one is implemented for now (see `placeholderPalette` in `@/ui/avatar`).
 *
 * `spriteSheet` currently keys into the procedural placeholder, and will later
 * key into a real sprite-sheet asset described in `@/art/sprite-sheet`.
 */
export const CHARACTERS: Record<string, Character> = {
  milo: {
    id: 'milo',
    name: 'Milo',
    spriteSheet: 'milo-default',
    stageCount: 10,
  },
};

export const DEFAULT_CHARACTER_ID = 'milo';

export function getCharacter(id: string): Character {
  return CHARACTERS[id] ?? CHARACTERS[DEFAULT_CHARACTER_ID];
}
