import { useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Line, Polyline, Rect } from 'react-native-svg';

import { PixelText } from '@/ui/text';
import { Palette, Spacing } from '@/constants/theme';

export type ChartDatum = {
  /** Axis label for this point (usually a short date). */
  label: string;
  /** Already converted into the user's display unit. */
  value: number;
};

type ChartProps = {
  data: ChartDatum[];
  /** Chart drawing height in px (axis labels live below it). */
  height?: number;
  color?: string;
  formatValue: (value: number) => string;
  emptyLabel?: string;
};

function useChartWidth() {
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    setWidth((current) => (Math.abs(current - next) < 1 ? current : next));
  };
  return { width, onLayout };
}

function ChartAxis({ data, formatValue }: Pick<ChartProps, 'data' | 'formatValue'>) {
  const max = Math.max(...data.map((datum) => datum.value));
  return (
    <View style={styles.axis}>
      <PixelText variant="caption" color={Palette.textMuted}>
        {data[0].label}
      </PixelText>
      <PixelText variant="caption" color={Palette.textSecondary}>
        {formatValue(max)}
      </PixelText>
      <PixelText variant="caption" color={Palette.textMuted}>
        {data[data.length - 1].label}
      </PixelText>
    </View>
  );
}

/** Stepped line chart with square markers, tuned for the 8-bit look. */
export function PixelLineChart({
  data,
  height = 140,
  color = Palette.gold,
  formatValue,
  emptyLabel = 'Not enough data yet.',
}: ChartProps) {
  const { width, onLayout } = useChartWidth();

  if (data.length === 0) {
    return (
      <PixelText variant="caption" color={Palette.textMuted}>
        {emptyLabel}
      </PixelText>
    );
  }

  const values = data.map((datum) => datum.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = rawMax - rawMin;
  const padding = span > 0 ? span * 0.15 : Math.max(1, rawMax * 0.05);
  const min = Math.max(0, rawMin - padding);
  const max = Math.max(rawMax + padding, min + 1);

  const top = Spacing.two;
  const bottom = height - Spacing.two;
  const left = Spacing.one;
  const right = Math.max(left, width - Spacing.one);
  const xFor = (index: number) =>
    data.length === 1 ? width / 2 : left + (index / (data.length - 1)) * (right - left);
  const yFor = (value: number) => bottom - ((value - min) / (max - min)) * (bottom - top);
  const linePoints = data.map((datum, index) => `${xFor(index)},${yFor(datum.value)}`).join(' ');

  return (
    <View>
      <View onLayout={onLayout} style={{ height }}>
        {width > 0 && (
          <Svg width={width} height={height}>
            {[0, 0.5, 1].map((fraction) => {
              const y = top + fraction * (bottom - top);
              return (
                <Line
                  key={fraction}
                  x1={0}
                  x2={width}
                  y1={y}
                  y2={y}
                  stroke={Palette.border}
                  strokeWidth={1}
                />
              );
            })}

            {data.length > 1 && (
              <Polyline
                points={linePoints}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinejoin="miter"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {data.map((datum, index) => (
              <Rect
                key={`${datum.label}-${index}`}
                x={xFor(index) - 2}
                y={yFor(datum.value) - 2}
                width={4}
                height={4}
                fill={color}
              />
            ))}
          </Svg>
        )}
      </View>
      <ChartAxis data={data} formatValue={formatValue} />
    </View>
  );
}

/** Vertical bar chart for counts (e.g. working sets per workout). */
export function PixelBarChart({
  data,
  height = 120,
  color = Palette.arcane,
  formatValue,
  emptyLabel = 'Not enough data yet.',
}: ChartProps) {
  const { width, onLayout } = useChartWidth();

  if (data.length === 0) {
    return (
      <PixelText variant="caption" color={Palette.textMuted}>
        {emptyLabel}
      </PixelText>
    );
  }

  const max = Math.max(...data.map((datum) => datum.value), 1);
  const bottom = height - Spacing.two;
  const top = Spacing.two;
  const slot = width / data.length;
  const gap = Math.min(6, slot * 0.25);
  const barWidth = Math.max(1, slot - gap);

  return (
    <View>
      <View onLayout={onLayout} style={{ height }}>
        {width > 0 && (
          <Svg width={width} height={height}>
            <Line
              x1={0}
              x2={width}
              y1={bottom}
              y2={bottom}
              stroke={Palette.border}
              strokeWidth={1}
            />
            {data.map((datum, index) => {
              const barHeight = (datum.value / max) * (bottom - top);
              return (
                <Rect
                  key={`${datum.label}-${index}`}
                  x={index * slot + gap / 2}
                  y={bottom - barHeight}
                  width={barWidth}
                  height={barHeight}
                  fill={color}
                />
              );
            })}
          </Svg>
        )}
      </View>
      <ChartAxis data={data} formatValue={formatValue} />
    </View>
  );
}

const styles = StyleSheet.create({
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
