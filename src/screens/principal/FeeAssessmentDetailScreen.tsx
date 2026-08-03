import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'FeeAssessmentDetail'>;

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value || '—'}</Text>
    </View>
  );
}

export function FeeAssessmentDetailScreen({ route, navigation }: Props) {
  const assessment = route.params.assessment;
  const fullyPaid = assessment.remainingDue <= 0;
  const paidPercent = assessment.totalDue > 0
    ? Math.min(100, Math.round((assessment.totalPaid / assessment.totalDue) * 100))
    : 0;

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={assessment.studentName}
        subtitle={`Roll ${assessment.rollNumber} · ${assessment.academicYear}`}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        <View style={styles.statusRow}>
          <StatusChip label={assessment.status} variant={fullyPaid ? 'success' : 'warning'} />
        </View>

        <View style={styles.card}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Paid</Text>
            <Text style={styles.progressPercent}>{paidPercent}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${paidPercent}%` }, fullyPaid && styles.progressFillComplete]} />
          </View>

          <Field label="Total due" value={`₹${assessment.totalDue.toLocaleString('en-IN')}`} />
          <Field label="Total paid" value={`₹${assessment.totalPaid.toLocaleString('en-IN')}`} />
          <Field label="Remaining due" value={`₹${assessment.remainingDue.toLocaleString('en-IN')}`} />
          <Field label="Due date" value={assessment.dueDate} />
        </View>

        {!fullyPaid && (
          <Pressable
            style={styles.payButton}
            onPress={() => navigation.navigate('FeePaymentForm', { assessment })}
          >
            <Text style={styles.payButtonText}>Record payment</Text>
          </Pressable>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  statusRow: { marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...softShadow,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  progressLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '700' },
  progressPercent: { fontSize: 12, color: colors.textPrimary, fontWeight: '800' },
  progressTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  progressFillComplete: { backgroundColor: colors.success },
  field: { marginBottom: spacing.md },
  fieldLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '700' },
  fieldValue: { fontSize: 16, color: colors.textPrimary, marginTop: 2 },
  payButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    ...softShadow,
  },
  payButtonText: { color: colors.white, fontWeight: '700' },
});
