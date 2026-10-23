import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';

import { PixelText } from '@/ui/text';
import { Border, Palette, Radius, Spacing } from '@/constants/theme';

type SetCompleteFlashProps = {
  xp: number;
  label?: string;
  /** Called after the congratulatory flash finishes so the parent can clear it. */
  onDone?: () => void;
};

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

/**
 * Small celebratory banner shown after logging a set. Floats up and fades out;
 * warmups still celebrate but show no XP (they are excluded from progression).
 */
export function SetCompleteFlash({ xp, label = 'SET LOGGED', onDone }: SetCompleteFlashProps) {
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(8));
  const [scale] = useState(() => new Animated.Value(0.92));
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 140,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.delay(650),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 320,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
      Animated.timing(translateY, {
        toValue: -14,
        duration: 1100,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 4,
        tension: 120,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]);

    animation.start(({ finished }) => {
      if (finished) onDoneRef.current?.();
    });

    return () => animation.stop();
  }, [opacity, translateY, scale]);

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.flash, { opacity, transform: [{ translateY }, { scale }] }]}
    >
      <PixelText variant="label" color={Palette.void}>
        {label}
      </PixelText>
      {xp > 0 && (
        <View style={styles.xpRow}>
          <PixelText variant="caption" color={Palette.void}>
            +{xp.toFixed(0)} XP
          </PixelText>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flash: {
    alignSelf: 'center',
    alignItems: 'center',
    backgroundColor: Palette.gold,
    borderWidth: Border.thick,
    borderColor: Palette.goldDim,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    gap: Spacing.half,
  },
  xpRow: {
    flexDirection: 'row',
  },
});
