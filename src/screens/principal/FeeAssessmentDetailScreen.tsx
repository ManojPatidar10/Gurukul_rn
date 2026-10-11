import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getErrorMessage } from '../../api/errorMessage';
import { getFeeAssessment } from '../../api/feeAssessments';
import type { FeeAssessment } from '../../api/types';
import { ErrorNotice } from '../../components/ErrorNotice';
import { FeePaymentHistory } from '../../components/FeePaymentHistory';
import { FeeBillAdjustmentsCard } from '../../components/fees/FeeBillAdjustmentsCard';
import { FeeBillAdminActions } from '../../components/fees/FeeBillAdminActions';
import { HowToPayCard } from '../../components/fees/HowToPayCard';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import {
  billDetailActions,
  billDueNote,
  feeStatusLabel,
  feeStatusVariant,
  formatDueDate,
  formatInstantDate,
  isBillCancelled,
} from '../../utils/feeBills';
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

/**
 * One bill. Everyone who may open it sees its status, due date, amounts and adjustments. An admin
 * records payments on it and corrects it (adjustment, due date, cancel); a student or parent is
 * told how to pay. The admin and the family see its payments, reversed ones included.
 */
export function FeeAssessmentDetailScreen({ route, navigation }: Props) {
  const { session } = useAuth();
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  // The route param is only the first paint. Each time the screen is focused (e.g. back from
  // recording or reversing a payment) the bill, with its adjustments, is fetched again so the totals
  // and status are current. If that fails, the bill we have stays on screen with a notice that its
  // amounts may be out of date.
  const [assessment, setAssessment] = useState<FeeAssessment>(route.params.assessment);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const billId = route.params.assessment.id;
  // Bumped by every refetch and every bill a correction hands back, so a slower refetch that started
  // earlier can't overwrite a newer bill when it lands.
  const latestBill = useRef(0);

  const refresh = useCallback(() => {
    let active = true;
    const request = ++latestBill.current;
    const current = () => active && request === latestBill.current;
    getFeeAssessment(schoolId, billId)
      .then((bill) => {
        if (!current()) return;
        setAssessment(bill);
        setRefreshError(null);
      })
      .catch((e) => {
        if (current()) setRefreshError(`${t('fees.paymentHistory.billRefreshError')} ${getErrorMessage(e)}`);
      });
    return () => {
      active = false;
    };
  }, [schoolId, billId, t]);

  useFocusEffect(refresh);

  // The server just sent this bill (after a correction, or reloaded after a 409), so it is current:
  // it replaces what's shown and clears any "could not refresh" notice.
  const billUpdated = useCallback((bill: FeeAssessment) => {
    latestBill.current += 1;
    setAssessment(bill);
    setRefreshError(null);
  }, []);

  const fullyPaid = assessment.remainingDue <= 0;
  const paidPercent = assessment.totalDue > 0
    ? Math.min(100, Math.round((assessment.totalPaid / assessment.totalDue) * 100))
    : 0;
  const cancelled = isBillCancelled(assessment);
  const dueNote = billDueNote(assessment, t);
  const actions = billDetailActions(assessment, session);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={assessment.studentName}
        subtitle={t('fees.assessmentDetail.subtitle', { roll: assessment.rollNumber, academicYear: assessment.academicYear })}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        <View style={styles.statusRow}>
          <StatusChip label={feeStatusLabel(assessment.status, t)} variant={feeStatusVariant(assessment.status)} />
          {dueNote && !cancelled && (
            <Text style={[styles.dueNote, dueNote.tone === 'error' && styles.dueNoteError]}>{dueNote.text}</Text>
          )}
        </View>

        {refreshError && (
          <View style={styles.refreshError}>
            <ErrorNotice message={refreshError} />
            <Pressable
              style={styles.retry}
              onPress={() => {
                refresh();
              }}
              accessibilityRole="button"
            >
              <Text style={styles.retryText}>{t('common.retry')}</Text>
            </Pressable>
          </View>
        )}

        {cancelled && (
          <View style={styles.cancelledBanner}>
            <Text style={styles.cancelledText}>
              {t('fees.bill.cancelledBanner', { date: formatInstantDate(assessment.cancelledAt ?? assessment.updatedAt, t) })}
            </Text>
            {assessment.cancelReason ? (
              <Text style={styles.cancelledDetail}>{t('fees.bill.cancelledReason', { reason: assessment.cancelReason })}</Text>
            ) : null}
            {assessment.cancelledByName ? (
              <Text style={styles.cancelledDetail}>{t('fees.bill.cancelledBy', { name: assessment.cancelledByName })}</Text>
            ) : null}
          </View>
        )}

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
          <Field label={t('fees.assessmentDetail.dueDate')} value={assessment.dueDate ? formatDueDate(assessment.dueDate, t) : ''} />
        </View>

        <FeeBillAdjustmentsCard bill={assessment} />

        {actions.recordPayment && (
          <Pressable
            style={styles.payButton}
            onPress={() => navigation.navigate('RecordPayment', { assessment })}
            accessibilityRole="button"
          >
            <Text style={styles.payButtonText}>{t('fees.recordPayment.button')}</Text>
          </Pressable>
        )}

        {actions.howToPay && <HowToPayCard />}
        {actions.nothingOwed && <Text style={styles.nothingOwed}>{t('fees.bill.noFeeToPay')}</Text>}

        {actions.paymentHistory && (
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

        {/* After the payments: cancelling needs every payment reversed first, from its receipt above. */}
        {actions.adminActions && (
          <FeeBillAdminActions schoolId={schoolId} bill={assessment} cancel={actions} onUpdated={billUpdated} />
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  statusRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  dueNote: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  dueNoteError: { color: colors.error },
  refreshError: { marginBottom: spacing.md },
  retry: { alignSelf: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  retryText: { color: colors.primary, fontWeight: '700' },
  cancelledBanner: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  cancelledText: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  cancelledDetail: { fontSize: 13, color: colors.textSecondary, marginTop: spacing.xs },
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
  nothingOwed: { fontSize: 14, color: colors.success, fontWeight: '600', textAlign: 'center', marginTop: spacing.lg },
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
