import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Avatar } from '@/ui/avatar';
import { PixelButton } from '@/ui/button';
import { Panel } from '@/ui/panel';
import { Screen } from '@/ui/screen';
import { PixelText } from '@/ui/text';
import { Fonts, FontSizes, Palette, Spacing } from '@/constants/theme';
import type { UnitPreference } from '@/domain/types';
import { stageInfoForXp } from '@/domain/xp';
import { useProfileStore } from '@/state/profile-store';

const UNITS: UnitPreference[] = ['kg', 'lb', 'st'];

export default function ProfileScreen() {
  const profile = useProfileStore((s) => s.profile);
  const createProfile = useProfileStore((s) => s.createProfile);
  const setUnitPref = useProfileStore((s) => s.setUnitPref);
  const reset = useProfileStore((s) => s.reset);
  const [name, setName] = useState('');

  if (!profile) {
    return (
      <Screen>
        <PixelText variant="heading">FORGE YOUR PROFILE</PixelText>
        <Panel>
          <PixelText variant="label" color={Palette.textSecondary}>
            Name
          </PixelText>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Enter name"
            placeholderTextColor={Palette.textMuted}
            style={styles.input}
          />
          <PixelButton label="Create" onPress={() => createProfile(name)} />
        </Panel>
      </Screen>
    );
  }

  const stage = stageInfoForXp(profile.xp);

  return (
    <Screen>
      <PixelText variant="heading">PROFILE</PixelText>

      <Panel highlight style={styles.avatarPanel}>
        <Avatar stageIndex={stage.index} unit={6} />
        <PixelText variant="subheading">{profile.name}</PixelText>
        <PixelText variant="caption" color={Palette.gold}>
          {stage.name} · {profile.xp} XP
        </PixelText>
      </Panel>

      <Panel>
        <PixelText variant="label" color={Palette.textSecondary}>
          Units
        </PixelText>
        <View style={styles.unitRow}>
          {UNITS.map((unit) => (
            <PixelButton
              key={unit}
              label={unit.toUpperCase()}
              variant={profile.unitPref === unit ? 'primary' : 'secondary'}
              onPress={() => setUnitPref(unit)}
              style={styles.unitButton}
            />
          ))}
        </View>
      </Panel>

      <PixelButton label="Reset Profile" variant="danger" onPress={reset} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatarPanel: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
  },
  input: {
    backgroundColor: Palette.void,
    borderColor: Palette.border,
    borderWidth: 3,
    borderRadius: 2,
    color: Palette.text,
    fontFamily: Fonts.body,
    fontSize: FontSizes.lg,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  unitRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  unitButton: {
    flex: 1,
  },
});
