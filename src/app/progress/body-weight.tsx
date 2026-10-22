import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { PixelButton } from '@/ui/button';
import { NavBar } from '@/ui/nav-bar';
import { Panel } from '@/ui/panel';
import { PixelLineChart } from '@/ui/pixel-chart';
import { Screen } from '@/ui/screen';
import { PixelText } from '@/ui/text';
import { Fonts, FontSizes, Palette, Spacing } from '@/constants/theme';
import { bodyWeightRepository } from '@/data/repositories/body-weight-repository';
import { formatCalendarDate, formatShortCalendarDate, toCalendarDate } from '@/domain/date';
import { bodyWeightProgress } from '@/domain/progress';
import { formatWeight, fromDisplay, toDisplay, UNIT_LABEL } from '@/domain/units';
import type { BodyWeightEntry } from '@/domain/types';
import { useProfileStore } from '@/state/profile-store';

export default function BodyWeightScreen() {
  const unitPref = useProfileStore((s) => s.profile?.unitPref ?? 'kg');
  const [entries, setEntries] = useState<BodyWeightEntry[]>(bodyWeightRepository.all);
  const [weight, setWeight] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setEntries(bodyWeightRepository.all());
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const points = bodyWeightProgress(entries);
  const latest = points[points.length - 1];
  const first = points[0];
  const overallDeltaKg = latest && first ? latest.weightKg - first.weightKg : null;

  const submit = () => {
    const parsed = Number.parseFloat(weight);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError(`Enter a weight above 0 ${UNIT_LABEL[unitPref]}.`);
      return;
    }
    setError(null);
    bodyWeightRepository.add(fromDisplay(parsed, unitPref));
    setWeight('');
    refresh();
  };

  const remove = (id: string) => {
    bodyWeightRepository.remove(id);
    refresh();
  };

  const formatChartWeight = (value: number) => `${Number(value.toFixed(1))}${UNIT_LABEL[unitPref]}`;

  return (
    <Screen>
      <NavBar />

      <View style={styles.header}>
        <PixelText variant="heading">BODY WEIGHT</PixelText>
        {latest && (
          <PixelText variant="caption" color={Palette.textSecondary}>
            Latest {formatWeight(latest.weightKg, unitPref)}
            {overallDeltaKg !== null
              ? ` · ${overallDeltaKg > 0 ? '+' : ''}${Number(
                  toDisplay(overallDeltaKg, unitPref).toFixed(1),
                )}${UNIT_LABEL[unitPref]} overall`
              : ''}
          </PixelText>
        )}
      </View>

      <Panel>
        <PixelText variant="label" color={Palette.textSecondary}>
          Weight Trend
        </PixelText>
        <PixelLineChart
          data={points.map((point) => ({
            label: formatShortCalendarDate(point.date),
            value: toDisplay(point.weightKg, unitPref),
          }))}
          color={Palette.arcane}
          formatValue={formatChartWeight}
          emptyLabel="Log a weigh-in to start the graph."
        />
      </Panel>

      <Panel>
        <PixelText variant="label" color={Palette.textSecondary}>
          Log Weigh-in ({UNIT_LABEL[unitPref]})
        </PixelText>
        <TextInput
          value={weight}
          onChangeText={setWeight}
          onSubmitEditing={submit}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={Palette.textMuted}
          style={styles.input}
        />
        {error && (
          <PixelText variant="caption" color={Palette.danger}>
            {error}
          </PixelText>
        )}
        <PixelButton label="Add Entry" onPress={submit} />
      </Panel>

      {entries.length > 0 && (
        <Panel>
          <PixelText variant="label" color={Palette.textSecondary}>
            Recent Entries
          </PixelText>
          {[...entries].reverse().map((entry) => (
            <View key={entry.id} style={styles.row}>
              <PixelText variant="caption" style={styles.rowDate}>
                {formatCalendarDate(toCalendarDate(entry.date))}
              </PixelText>
              <PixelText variant="caption" color={Palette.textSecondary}>
                {formatWeight(entry.weightKg, unitPref)}
              </PixelText>
              <Pressable onPress={() => remove(entry.id)} hitSlop={Spacing.two}>
                <PixelText variant="label" color={Palette.danger}>
                  X
                </PixelText>
              </Pressable>
            </View>
          ))}
        </Panel>
      )}

      <PixelButton label="Back to Progress" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
  },
  rowDate: {
    flex: 1,
  },
});
