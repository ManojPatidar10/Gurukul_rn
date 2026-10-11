import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { FeeAssessment } from '../../api/types';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import { adjustmentByLine, formatAdjustmentLine, formatAmount } from '../../utils/feeBills';

/**
 * How a bill's total was reached: the structure's fee, then each concession, waiver, late fee or
 * correction with its reason (oldest first), then the total. Only shown when there are adjustments.
 * Families see the same lines; the server leaves out who added each one for them.
 */
export function FeeBillAdjustmentsCard({ bill }: { bill: Pick<FeeAssessment, 'baseAmount' | 'totalDue' | 'adjustments'> }) {
  const { t } = useTranslation();
  const adjustments = bill.adjustments ?? [];
  if (adjustments.length === 0) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('fees.adjustment.title')}</Text>
      <View style={styles.row}>
        <Text style={styles.label}>{t('fees.bill.baseAmount')}</Text>
        <Text style={styles.amount}>₹{formatAmount(bill.baseAmount)}</Text>
      </View>
      {adjustments.map((adjustment) => (
        <View key={adjustment.id} style={styles.adjustment}>
          <Text style={styles.line}>{formatAdjustmentLine(adjustment, t)}</Text>
          <Text style={styles.by}>{adjustmentByLine(adjustment, t)}</Text>
        </View>
      ))}
      <View style={[styles.row, styles.totalRow]}>
        <Text style={styles.totalLabel}>{t('fees.assessmentDetail.totalDue')}</Text>
        <Text style={styles.totalAmount}>₹{formatAmount(bill.totalDue)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.lg,
    ...softShadow,
  },
  title: { fontSize: 13, fontWeight: '800', color: colors.textSecondary, marginBottom: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  label: { fontSize: 14, color: colors.textSecondary },
  amount: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  adjustment: { marginBottom: spacing.sm },
  line: { fontSize: 14, color: colors.textPrimary },
  by: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginBottom: 0 },
  totalLabel: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  totalAmount: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
});
