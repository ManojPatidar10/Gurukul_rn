import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { colors, radius, spacing } from '../../theme/colors';
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

        <Field label="Total due" value={`₹${assessment.totalDue.toLocaleString('en-IN')}`} />
        <Field label="Total paid" value={`₹${assessment.totalPaid.toLocaleString('en-IN')}`} />
        <Field label="Remaining due" value={`₹${assessment.remainingDue.toLocaleString('en-IN')}`} />
        <Field label="Due date" value={assessment.dueDate} />

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
  field: { marginBottom: spacing.md },
  fieldLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  fieldValue: { fontSize: 16, color: colors.textPrimary, marginTop: 2 },
  payButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  payButtonText: { color: colors.white, fontWeight: '700' },
});
