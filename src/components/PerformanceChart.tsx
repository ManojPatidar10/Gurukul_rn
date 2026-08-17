import { BarChart, LineChart, PieChart } from 'react-native-gifted-charts';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CATEGORICAL_PALETTE, SINGLE_SERIES_COLOR } from '../theme/chartPalette';
import { colors, radius, spacing } from '../theme/colors';

export type ChartType = 'bar' | 'line' | 'pie';

export interface ChartDatum {
  label: string;
  value: number;
  color?: string;
}

interface Props {
  data: ChartDatum[];
  type: ChartType;
  onTypeChange: (type: ChartType) => void;
  valueSuffix?: string;
  availableTypes?: ChartType[];
}

const CHART_HEIGHT = 180;

export function PerformanceChart({ data, type, onTypeChange, valueSuffix = '', availableTypes = ['bar', 'line', 'pie'] }: Props) {
  const { t } = useTranslation();

  const coloredData = data.map((d, i) => ({ ...d, color: d.color ?? CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length] }));

  return (
    <View>
      {availableTypes.length > 1 && (
        <View style={styles.switchRow}>
          {availableTypes.map((option) => (
            <Pressable
              key={option}
              style={[styles.switchButton, type === option && styles.switchButtonActive]}
              onPress={() => onTypeChange(option)}
            >
              <Text style={[styles.switchText, type === option && styles.switchTextActive]}>
                {t(`performance.chartType.${option}`)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {data.length === 0 ? (
        <Text style={styles.empty}>{t('performance.noData')}</Text>
      ) : (
        <View style={styles.chartArea}>
          {type === 'bar' && (
            <BarChart
              data={coloredData.map((d) => ({ value: d.value, label: d.label, frontColor: d.color }))}
              height={CHART_HEIGHT}
              barWidth={28}
              spacing={20}
              initialSpacing={16}
              roundedTop
              hideRules
              xAxisThickness={1}
              yAxisThickness={0}
              xAxisColor={colors.border}
              yAxisTextStyle={{ color: colors.textMuted, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: colors.textMuted, fontSize: 10 }}
              noOfSections={4}
            />
          )}

          {type === 'line' && (
            <LineChart
              data={coloredData.map((d) => ({ value: d.value, label: d.label, dataPointColor: d.color }))}
              height={CHART_HEIGHT}
              color={SINGLE_SERIES_COLOR}
              thickness={2}
              dataPointsRadius={4}
              hideRules
              xAxisThickness={1}
              yAxisThickness={0}
              xAxisColor={colors.border}
              yAxisTextStyle={{ color: colors.textMuted, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: colors.textMuted, fontSize: 10 }}
              noOfSections={4}
              initialSpacing={16}
            />
          )}

          {type === 'pie' && (
            <View style={styles.pieRow}>
              <PieChart
                data={coloredData.map((d) => ({ value: d.value, color: d.color }))}
                radius={70}
                donut
                innerRadius={40}
              />
              <View style={styles.legend}>
                {coloredData.map((d) => (
                  <View key={d.label} style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: d.color }]} />
                    <Text style={styles.legendText} numberOfLines={1}>
                      {d.label}: {d.value}
                      {valueSuffix}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  switchRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    padding: 3,
    marginBottom: spacing.md,
  },
  switchButton: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  switchButtonActive: {
    backgroundColor: colors.primary,
  },
  switchText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  switchTextActive: { color: colors.white },
  chartArea: { alignItems: 'center', paddingVertical: spacing.sm },
  empty: { color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.lg },
  pieRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  legend: { flex: 1, gap: spacing.xs },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: colors.textPrimary, flexShrink: 1 },
});
