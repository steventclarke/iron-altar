import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PixelButton } from '@/ui/button';
import { NavBar } from '@/ui/nav-bar';
import { Panel } from '@/ui/panel';
import { PixelBarChart, PixelLineChart } from '@/ui/pixel-chart';
import { Screen } from '@/ui/screen';
import { PixelText } from '@/ui/text';
import { Palette, Spacing } from '@/constants/theme';
import { exerciseRepository } from '@/data/repositories/exercise-repository';
import { sessionRepository } from '@/data/repositories/session-repository';
import { formatCalendarDate, formatShortCalendarDate } from '@/domain/date';
import { isMainLift, liftProgress, type LiftPoint } from '@/domain/progress';
import { formatWeight, toDisplay, UNIT_LABEL } from '@/domain/units';
import { useProfileStore } from '@/state/profile-store';

type LiftDetail = {
  name: string;
  points: LiftPoint[];
};

function loadDetail(lift: string): LiftDetail | null {
  if (!isMainLift(lift)) return null;
  const exercise = exerciseRepository.byMainLift(lift);
  if (!exercise) return null;

  return {
    name: exercise.name,
    points: liftProgress(sessionRepository.all(), sessionRepository.allSets(), exercise.id),
  };
}

export default function LiftProgressScreen() {
  const { lift } = useLocalSearchParams<{ lift: string }>();
  const unitPref = useProfileStore((s) => s.profile?.unitPref ?? 'kg');
  const [detail, setDetail] = useState<LiftDetail | null>(() => loadDetail(lift));

  useFocusEffect(
    useCallback(() => {
      setDetail(loadDetail(lift));
    }, [lift]),
  );

  if (!detail) {
    return (
      <Screen>
        <NavBar />
        <PixelText variant="heading">LIFT NOT FOUND</PixelText>
        <PixelButton label="Back to Progress" onPress={() => router.back()} />
      </Screen>
    );
  }

  const { name, points } = detail;
  const latest = points[points.length - 1];
  const bestTopKg = points.length ? Math.max(...points.map((point) => point.topWeightKg)) : 0;
  const bestE1RmKg = points.length ? Math.max(...points.map((point) => point.bestE1RmKg)) : 0;
  const totalWorkingSets = points.reduce((sum, point) => sum + point.workingSets, 0);
  const totalVolumeKg = points.reduce((sum, point) => sum + point.volumeKg, 0);

  const formatChartWeight = (value: number) => `${Number(value.toFixed(1))}${UNIT_LABEL[unitPref]}`;

  const weightData = points.map((point) => ({
    label: formatShortCalendarDate(point.date),
    value: toDisplay(point.topWeightKg, unitPref),
  }));

  const setData = points.map((point) => ({
    label: formatShortCalendarDate(point.date),
    value: point.workingSets,
  }));

  return (
    <Screen>
      <NavBar />

      <View style={styles.header}>
        <PixelText variant="heading">{name.toUpperCase()}</PixelText>
        <PixelText variant="caption" color={Palette.textSecondary}>
          {points.length} {points.length === 1 ? 'session' : 'sessions'} ·{' '}
          {formatWeight(totalVolumeKg, unitPref)} lifetime tonnage
        </PixelText>
      </View>

      <Panel>
        <PixelText variant="label" color={Palette.textSecondary}>
          Top working set
        </PixelText>
        <PixelLineChart
          data={weightData}
          formatValue={formatChartWeight}
          emptyLabel="Log a working set to start the graph."
        />
      </Panel>

      <Panel>
        <PixelText variant="label" color={Palette.textSecondary}>
          Working sets per session
        </PixelText>
        <PixelBarChart
          data={setData}
          formatValue={(value) => `${value}`}
          emptyLabel="No working sets logged yet."
        />
      </Panel>

      <Panel>
        <StatRow
          label="Latest top set"
          value={latest ? formatWeight(latest.topWeightKg, unitPref) : '—'}
        />
        <StatRow label="Best top set" value={formatWeight(bestTopKg, unitPref)} />
        <StatRow label="Best est. 1RM" value={formatWeight(bestE1RmKg, unitPref)} />
        <StatRow label="Working sets" value={`${totalWorkingSets}`} />
      </Panel>

      {points.length > 0 && (
        <Panel>
          <PixelText variant="label" color={Palette.textSecondary}>
            Session Breakdown
          </PixelText>
          {[...points].reverse().map((point) => (
            <View key={point.sessionId} style={styles.row}>
              <PixelText variant="caption" color={Palette.text} style={styles.rowDate}>
                {formatCalendarDate(point.date)}
              </PixelText>
              <PixelText variant="caption" color={Palette.textSecondary}>
                {formatWeight(point.topWeightKg, unitPref)} · {point.workingSets} sets ·{' '}
                {formatWeight(point.volumeKg, unitPref)}
              </PixelText>
            </View>
          ))}
        </Panel>
      )}

      <PixelButton label="Back to Progress" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <PixelText variant="caption" color={Palette.textSecondary}>
        {label}
      </PixelText>
      <PixelText variant="caption">{value}</PixelText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rowDate: {
    flex: 1,
  },
});
