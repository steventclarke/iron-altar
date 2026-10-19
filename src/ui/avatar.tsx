import { StyleSheet, View } from 'react-native';

import { STAGE_COUNT } from '@/domain/xp';
import { Palette } from '@/constants/theme';

/**
 * Procedural placeholder avatar. Grows with stage index to sell the "Milo of
 * Croton" progression until real sprite art is dropped in via
 * `@/art/sprite-sheet`.
 */

type AvatarProps = {
  stageIndex: number;
  /** Size of one pixel block, in dp. */
  unit?: number;
};

export function Avatar({ stageIndex, unit = 8 }: AvatarProps) {
  const bulk = Math.max(0, Math.min(1, stageIndex / (STAGE_COUNT - 1)));

  const head = 3 + Math.round(bulk * 1);
  const torsoW = 5 + Math.round(bulk * 5);
  const torsoH = 6 + Math.round(bulk * 3);
  const armW = 1 + Math.round(bulk * 2);
  const armL = 5 + Math.round(bulk * 3);
  const legW = 2 + Math.round(bulk * 2);
  const legL = 5 + Math.round(bulk * 2);

  const block = (w: number, h: number, color: string) => ({
    width: w * unit,
    height: h * unit,
    backgroundColor: color,
  });

  return (
    <View style={styles.figure}>
      {/* Head */}
      <View style={block(head, head, Palette.gold)} />
      {/* Shoulders / torso with arms */}
      <View style={styles.row}>
        <View style={block(armW, armL, Palette.arcane)} />
        <View style={block(torsoW, torsoH, Palette.crimson)} />
        <View style={block(armW, armL, Palette.arcane)} />
      </View>
      {/* Legs */}
      <View style={styles.row}>
        <View style={block(legW, legL, Palette.borderBright)} />
        <View style={{ width: unit }} />
        <View style={block(legW, legL, Palette.borderBright)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  figure: {
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
});
