import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { listStudentFeeAssessments } from '../../api/feeAssessments';
import type { FeeAssessment } from '../../api/types';
import { FeePaymentHistory } from '../../components/FeePaymentHistory';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { formatRupees } from '../../utils/money';

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
  const { showToast } = useToast();
  const schoolId = useSchoolId();
  // The bill from the list is the first render; each time the screen is focused (e.g. back from
  // recording or reversing a payment) it's fetched again so the totals are current.
  const [assessment, setAssessment] = useState<FeeAssessment>(route.params.assessment);
  const billId = route.params.assessment.id;
  const studentId = route.params.assessment.studentId;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      listStudentFeeAssessments(schoolId, studentId)
        .then((bills) => {
          const fresh = bills.find((bill) => bill.id === billId);
          if (active && fresh) setAssessment(fresh);
        })
        // Keep showing the bill we have; the payment history below reports its own load errors.
        .catch(() => {});
      return () => {
        active = false;
      };
    }, [schoolId, studentId, billId])
  );

  const fullyPaid = assessment.remainingDue <= 0;
  const paidPercent = assessment.totalDue > 0
    ? Math.min(100, Math.round((assessment.totalPaid / assessment.totalDue) * 100))
    : 0;
  const canPayFees = session.ownerType === 'STUDENT';
  const canRecordPayment = session.role === 'ADMIN' && assessment.remainingDue > 0;
  // The API shows payments to an admin and to the student's own family; teachers get a 403.
  const canSeePayments =
    session.role === 'ADMIN' || session.ownerType === 'STUDENT' || session.ownerType === 'PARENT';

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
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>{t('fees.assessmentDetail.totalPaid')}</Text>
            <Text style={styles.progressPercent}>{paidPercent}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${paidPercent}%` }, fullyPaid && styles.progressFillComplete]} />
          </View>

          <Field label={t('fees.assessmentDetail.totalDue')} value={formatRupees(assessment.totalDue)} />
          <Field label={t('fees.assessmentDetail.totalPaid')} value={formatRupees(assessment.totalPaid)} />
          <Field label={t('fees.assessmentDetail.remainingDue')} value={formatRupees(assessment.remainingDue)} />
          <Field label={t('fees.assessmentDetail.dueDate')} value={assessment.dueDate} />
        </View>

        {canRecordPayment && (
          <Pressable
            style={styles.payButton}
            onPress={() => navigation.navigate('RecordPayment', { assessment })}
            accessibilityRole="button"
          >
            <Text style={styles.payButtonText}>{t('fees.recordPayment.button')}</Text>
          </Pressable>
        )}

        {!fullyPaid && canPayFees && (
          <Pressable
            style={styles.payButton}
            onPress={() => showToast(t('fees.assessmentDetail.payFeesComingSoon'), 'info')}
          >
            <Text style={styles.payButtonText}>{t('fees.assessmentDetail.payFees')}</Text>
          </Pressable>
        )}

        {canSeePayments && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('fees.paymentHistory.title')}</Text>
              <Pressable
                onPress={() =>
                  navigation.navigate('StudentFeePayments', {
                    student: { id: assessment.studentId, name: assessment.studentName },
                  })
                }
                accessibilityRole="link"
              >
                <Text style={styles.sectionLink}>{t('fees.paymentHistory.allPayments')}</Text>
              </Pressable>
            </View>
            <FeePaymentHistory
              assessmentId={assessment.id}
              onOpen={(payment) => navigation.navigate('PaymentReceipt', { payment })}
            />
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  sectionLink: { fontSize: 13, fontWeight: '700', color: colors.primary },
});
