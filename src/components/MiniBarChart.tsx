import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../theme/colors';

interface MiniBarChartProps {
  data: number[];
  labels?: string[];
}

const DEFAULT_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function MiniBarChart({ data, labels = DEFAULT_LABELS }: MiniBarChartProps) {
  const max = Math.max(...data, 1);

  return (
    <View style={styles.container}>
      <View style={styles.bars}>
        {data.map((value, index) => (
          <View key={`${labels[index]}-${index}`} style={styles.barColumn}>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { height: (value / max) * 80 }]} />
            </View>
            <Text style={styles.label}>{labels[index]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 100,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
  },
  barTrack: {
    width: 24,
    height: 80,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.sm,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
  },
  label: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
