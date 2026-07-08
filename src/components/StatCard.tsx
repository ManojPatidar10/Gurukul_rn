import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../theme/colors';
import type { DashboardStat } from '../types/principal';

interface StatCardProps {
  stat: DashboardStat;
}

export function StatCard({ stat }: StatCardProps) {
  const trendColor =
    stat.trendType === 'up'
      ? colors.success
      : stat.trendType === 'down'
        ? colors.error
        : colors.textMuted;

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{stat.label}</Text>
      <Text style={styles.value}>{stat.value}</Text>
      {stat.trend ? (
        <Text style={[styles.trend, { color: trendColor }]}>{stat.trend}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    minWidth: '46%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  value: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  trend: {
    fontSize: 11,
    marginTop: spacing.xs,
  },
});
