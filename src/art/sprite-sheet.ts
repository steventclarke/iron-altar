/**
 * Sprite-sheet format for Iron Altar characters.
 *
 * Placeholder art is generated procedurally today (see `@/ui/avatar`). When real
 * pixel art lands, it should follow this layout so the swap is drop-in:
 *
 *   - One PNG per character.
 *   - Frames are laid out as a grid: `columns` wide, `rows` tall.
 *   - Each row is a growth stage, top row = stage 0 (smallest) downward.
 *   - Each column is an animation frame within a looping idle animation.
 *   - Frames are `frameWidth` x `frameHeight` pixels, with no padding/margins.
 *   - Transparent background; nearest-neighbour scaling only.
 *
 * Example (4 idle frames x 10 stages):
 *   frameWidth: 32, frameHeight: 32, columns: 4, rows: 10
 */

export type SpriteSheetSpec = {
  /** Frames per row (idle animation length). */
  columns: number;
  /** Stage rows. */
  rows: number;
  frameWidth: number;
  frameHeight: number;
};

export type SpriteFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Pixel rect of a stage/idle frame within a sprite sheet. */
export function frameRect(
  spec: SpriteSheetSpec,
  stageIndex: number,
  animationFrame = 0,
): SpriteFrame {
  const row = Math.min(spec.rows - 1, Math.max(0, stageIndex));
  const col = Math.min(spec.columns - 1, Math.max(0, animationFrame));
  return {
    x: col * spec.frameWidth,
    y: row * spec.frameHeight,
    width: spec.frameWidth,
    height: spec.frameHeight,
  };
}
