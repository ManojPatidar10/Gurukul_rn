import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getErrorMessage } from '../../api/errorMessage';
import { getFeeAssessment } from '../../api/feeAssessments';
import { ErrorNotice } from '../../components/ErrorNotice';
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
  billDueNote,
  feeStatusLabel,
  feeStatusVariant,
  formatAmount,
  formatDueDate,
  formatInstantDate,
  isBillCancelled,
} from '../../utils/feeBills';

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
  const schoolId = useSchoolId();
  // The route param is only the first paint: the bill (with its adjustments) is fetched on focus.
  const [assessment, setAssessment] = useState(route.params.assessment);
  const [loadError, setLoadError] = useState<string | null>(null);
  const assessmentId = route.params.assessment.id;
  const fullyPaid = assessment.remainingDue <= 0;
  const paidPercent = assessment.totalDue > 0
    ? Math.min(100, Math.round((assessment.totalPaid / assessment.totalDue) * 100))
    : 0;
  const isAdmin = session.role === 'ADMIN';
  const isFamily = session.ownerType === 'STUDENT' || session.ownerType === 'PARENT';
  const cancelled = isBillCancelled(assessment);
  const dueNote = billDueNote(assessment, t);

  useEffect(
    () =>
      navigation.addListener('focus', () => {
        getFeeAssessment(schoolId, assessmentId)
          .then((bill) => {
            setAssessment(bill);
            setLoadError(null);
          })
          .catch((e) => setLoadError(getErrorMessage(e)));
      }),
    [navigation, schoolId, assessmentId]
  );

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={assessment.studentName}
        subtitle={t('fees.assessmentDetail.subtitle', { roll: assessment.rollNumber, academicYear: assessment.academicYear })}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        {loadError && <ErrorNotice message={loadError} />}
        <View style={styles.statusRow}>
          <StatusChip label={feeStatusLabel(assessment.status, t)} variant={feeStatusVariant(assessment.status)} />
          {dueNote && !cancelled && (
            <Text style={[styles.dueNote, dueNote.tone === 'error' && styles.dueNoteError]}>{dueNote.text}</Text>
          )}
        </View>

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

          <Field label={t('fees.assessmentDetail.totalDue')} value={`₹${formatAmount(assessment.totalDue)}`} />
          <Field label={t('fees.assessmentDetail.totalPaid')} value={`₹${formatAmount(assessment.totalPaid)}`} />
          <Field label={t('fees.assessmentDetail.remainingDue')} value={`₹${formatAmount(assessment.remainingDue)}`} />
          <Field label={t('fees.assessmentDetail.dueDate')} value={assessment.dueDate ? formatDueDate(assessment.dueDate, t) : ''} />
        </View>

        <FeeBillAdjustmentsCard bill={assessment} />

        {isAdmin && <FeeBillAdminActions schoolId={schoolId} bill={assessment} onUpdated={setAssessment} />}

        {isFamily && !cancelled && assessment.remainingDue > 0 && <HowToPayCard />}
        {isFamily && !cancelled && assessment.remainingDue <= 0 && (
          <Text style={styles.nothingOwed}>{t('fees.bill.noFeeToPay')}</Text>
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
  nothingOwed: { fontSize: 14, color: colors.success, fontWeight: '600', textAlign: 'center', marginTop: spacing.lg },
});
