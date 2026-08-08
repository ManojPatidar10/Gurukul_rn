import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useAuth } from '../../context/AuthContext';
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
  const { session } = useAuth();
  const { t } = useTranslation();
  const assessment = route.params.assessment;
  const fullyPaid = assessment.remainingDue <= 0;
  const canRecordPayment = session.ownerType === 'EMPLOYEE';

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={assessment.studentName}
        subtitle={t('fees.assessmentDetail.subtitle', { roll: assessment.rollNumber, academicYear: assessment.academicYear })}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        <View style={styles.statusRow}>
          <StatusChip label={assessment.status} variant={fullyPaid ? 'success' : 'warning'} />
        </View>

        <View style={styles.card}>
          <Field label={t('fees.assessmentDetail.totalDue')} value={`₹${assessment.totalDue.toLocaleString('en-IN')}`} />
          <Field label={t('fees.assessmentDetail.totalPaid')} value={`₹${assessment.totalPaid.toLocaleString('en-IN')}`} />
          <Field label={t('fees.assessmentDetail.remainingDue')} value={`₹${assessment.remainingDue.toLocaleString('en-IN')}`} />
          <Field label={t('fees.assessmentDetail.dueDate')} value={assessment.dueDate} />
        </View>

        {!fullyPaid && canRecordPayment && (
          <>
            <Pressable
              style={styles.payButton}
              onPress={() => navigation.navigate('UpiQrPayment', { assessment })}
            >
              <Text style={styles.payButtonText}>{t('fees.assessmentDetail.payViaUpiQr')}</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('FeePaymentForm', { assessment })}
            >
              <Text style={styles.secondaryButtonText}>{t('fees.assessmentDetail.recordPayment')}</Text>
            </Pressable>
          </>
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
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  secondaryButtonText: { color: colors.primary, fontWeight: '700' },
});
