import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Modal, Platform, StyleSheet, View } from 'react-native';

import { Avatar } from '@/ui/avatar';
import { PixelButton } from '@/ui/button';
import { PixelText } from '@/ui/text';
import { Border, Palette, Radius, Spacing } from '@/constants/theme';
import { stageIndexForXp, stageInfoForXp } from '@/domain/xp';

type WorkoutCompleteOverlayProps = {
  visible: boolean;
  xpEarned: number;
  xpBefore: number;
  xpAfter: number;
  onDone: () => void;
};

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

/**
 * Full-screen workout-complete celebration. The avatar springs up to its new
 * growth stage, then the overlay closes automatically (or on Continue).
 */
export function WorkoutCompleteOverlay({
  visible,
  xpEarned,
  xpBefore,
  xpAfter,
  onDone,
}: WorkoutCompleteOverlayProps) {
  const [fade] = useState(() => new Animated.Value(0));
  const [lift] = useState(() => new Animated.Value(18));
  const [avatarScale] = useState(() => new Animated.Value(0.7));
  const fired = useRef(false);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  const finish = useCallback(() => {
    if (fired.current) return;
    fired.current = true;
    onDoneRef.current();
  }, []);

  useEffect(() => {
    if (!visible) return;
    fired.current = false;
    fade.setValue(0);
    lift.setValue(18);
    avatarScale.setValue(0.7);

    const animation = Animated.sequence([
      Animated.parallel([
        Animated.timing(fade, {
          toValue: 1,
          duration: 220,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.spring(lift, {
          toValue: 0,
          friction: 7,
          tension: 90,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.sequence([
          Animated.spring(avatarScale, {
            toValue: 1.08,
            friction: 4,
            tension: 110,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.spring(avatarScale, {
            toValue: 1,
            friction: 5,
            tension: 90,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ]),
      ]),
      Animated.delay(2600),
    ]);

    animation.start(({ finished }) => {
      if (finished) finish();
    });

    return () => animation.stop();
  }, [visible, fade, lift, avatarScale, finish]);

  const stage = stageInfoForXp(xpAfter);
  const previousStageIndex = stageIndexForXp(xpBefore);
  const stageUp = stage.index > previousStageIndex;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={finish}>
      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.card,
            {
              opacity: fade,
              transform: [{ translateY: lift }],
            },
          ]}
        >
          <PixelText variant="heading" color={Palette.gold}>
            WORKOUT COMPLETE
          </PixelText>

          <Animated.View style={{ transform: [{ scale: avatarScale }] }}>
            <Avatar stageIndex={stage.index} unit={9} />
          </Animated.View>

          <PixelText variant="subheading">{stage.name}</PixelText>
          <PixelText variant="body" color={Palette.gold}>
            +{xpEarned.toFixed(0)} XP
          </PixelText>

          {stageUp ? (
            <PixelText variant="label" color={Palette.success}>
              STAGE UP · STAGE {stage.index + 1} OF 10
            </PixelText>
          ) : (
            <PixelText variant="caption" color={Palette.textSecondary}>
              {stage.nextThreshold === null
                ? 'Peak form reached.'
                : `${Math.round(stage.withinStage * 100)}% to the next stage`}
            </PixelText>
          )}

          <PixelButton label="Continue" onPress={finish} />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    backgroundColor: 'rgba(12, 10, 18, 0.92)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
    backgroundColor: Palette.surface,
    borderWidth: Border.thick,
    borderColor: Palette.gold,
    borderRadius: Radius.md,
  },
});
