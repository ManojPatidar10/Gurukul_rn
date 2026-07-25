import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SectionTitle } from '../../components/SectionTitle';
import { SegmentTabs } from '../../components/SegmentTabs';
import { StatusChip } from '../../components/StatusChip';
import {
  classCollections,
  formatCurrency,
  paymentSummary,
} from '../../data/mockPrincipalDashboard';
import { colors, radius, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'Payments'>;

export function PaymentsScreen({ navigation }: Props) {
  const [tabIndex, setTabIndex] = useState(0);
  const { currency } = paymentSummary;

  return (
    <View style={styles.root}>
      <ScreenHeader title="Payments" onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <SegmentTabs tabs={['Fee Collection', 'Salary']} activeIndex={tabIndex} onChange={setTabIndex} />

        {tabIndex === 0 ? (
          <>
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Collected</Text>
                <Text style={[styles.summaryValue, { color: colors.success }]}>
                  {formatCurrency(paymentSummary.collected, currency)}
                </Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Pending</Text>
                <Text style={[styles.summaryValue, { color: colors.warning }]}>
                  {formatCurrency(paymentSummary.pending, currency)}
                </Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Overdue</Text>
                <Text style={[styles.summaryValue, { color: colors.error }]}>
                  {formatCurrency(paymentSummary.overdue, currency)}
                </Text>
              </View>
            </View>

            <SectionTitle title="Class-wise Collection" />
            {classCollections.map((item) => {
              const pct = Math.round((item.collected / item.target) * 100);
              return (
                <View key={item.className} style={styles.collectionRow}>
                  <View style={styles.collectionHeader}>
                    <Text style={styles.collectionTitle}>{item.className}</Text>
                    <Text style={styles.collectionPct}>{pct}%</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${pct}%` }]} />
                  </View>
                  <Text style={styles.collectionSub}>
                    {formatCurrency(item.collected, currency)} /{' '}
                    {formatCurrency(item.target, currency)}
                  </Text>
                </View>
              );
            })}

            <View style={styles.reminderCard}>
              <View style={styles.reminderHeader}>
                <Text style={styles.reminderTitle}>Automated Reminders</Text>
                <StatusChip label="Enabled" variant="success" />
              </View>
              <Text style={styles.reminderSub}>
                12 reminders scheduled for overdue accounts today.
              </Text>
              <TouchableOpacity style={styles.ctaButton} accessibilityRole="button">
                <Text style={styles.ctaText}>Send Reminders Now</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.salaryCard}>
            <Text style={styles.salaryTitle}>Salary Processing</Text>
            <Text style={styles.salaryAmount}>{formatCurrency(485000, currency)}</Text>
            <Text style={styles.salarySub}>Total payroll for July 2026</Text>
            <View style={styles.salaryStats}>
              <StatusChip label="48 processed" variant="success" />
              <StatusChip label="4 pending" variant="warning" />
            </View>
            <Text style={styles.salaryNote}>
              Next salary cycle runs on the 1st of each month with automated bank transfers.
            </Text>
          </View>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  collectionRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  collectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  collectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  collectionPct: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  progressTrack: {
    height: 8,
    backgroundColor: colors.primaryLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 4,
  },
  collectionSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  reminderCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  reminderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  reminderSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  ctaButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  ctaText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  salaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.xl,
    alignItems: 'center',
  },
  salaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  salaryAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary,
    marginVertical: spacing.sm,
  },
  salarySub: {
    fontSize: 13,
    color: colors.textMuted,
  },
  salaryStats: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginVertical: spacing.lg,
  },
  salaryNote: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
