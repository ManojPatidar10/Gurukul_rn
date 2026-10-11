import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getClassSectionFeeStatus } from '../../api/feeAssessments';
import type { FeeAssessment } from '../../api/types';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';
import { billDueNote, feeStatusLabel, feeStatusVariant, formatAmount } from '../../utils/feeBills';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'MyClassFees'>;

/**
 * A class teacher's view of their section's fees: the server sends only active students' bills for
 * the section's own academic year, never cancelled ones.
 */
export function MyClassFeesScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const classSection = route.params.classSection;
  const [assessments, setAssessments] = useState<FeeAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    return getClassSectionFeeStatus(schoolId, classSection.id)
      .then(setAssessments)
      .catch((e) => setError(getErrorMessage(e)));
  }, [schoolId, classSection.id]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  };

  const handleRetry = () => {
    setLoading(true);
    load().finally(() => setLoading(false));
  };

  const summary = useMemo(() => {
    const totalRemaining = assessments.reduce((sum, a) => sum + a.remainingDue, 0);
    const paidCount = assessments.filter((a) => a.status === 'PAID').length;
    return { totalRemaining, paidCount, total: assessments.length };
  }, [assessments]);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('fees.myClassFees.title')}
        subtitle={`${classSection.className} - ${classSection.section}`}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
        {loading && <ActivityIndicator style={styles.loading} color={colors.primary} />}
        {error && !loading && (
          <>
            <ErrorNotice message={error} />
            <Pressable style={styles.retry} onPress={handleRetry} accessibilityRole="button">
              <Text style={styles.retryText}>{t('common.retry')}</Text>
            </Pressable>
          </>
        )}

        {!loading && assessments.length > 0 && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryValue}>
                {summary.paidCount}/{summary.total}
              </Text>
              <Text style={styles.summaryLabel}>{t('fees.myClassFees.fullyPaid')}</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryValue}>₹{formatAmount(summary.totalRemaining)}</Text>
              <Text style={styles.summaryLabel}>{t('fees.myClassFees.remaining')}</Text>
            </View>
          </View>
        )}

        {!loading && assessments.length === 0 && !error && (
          <Text style={styles.empty}>{t('fees.myClassFees.empty')}</Text>
        )}

        {assessments.map((assessment) => {
          const dueNote = billDueNote(assessment, t);
          return (
            <View key={assessment.id} style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.rowName}>{assessment.studentName}</Text>
                <Text style={styles.rowMeta}>
                  {t('fees.myClassFees.rowSubtitle', {
                    roll: assessment.rollNumber,
                    due: formatAmount(assessment.remainingDue),
                    total: formatAmount(assessment.totalDue),
                  })}
                </Text>
                {dueNote?.tone === 'error' && <Text style={[styles.rowMeta, styles.overdue]}>{dueNote.text}</Text>}
              </View>
              <StatusChip label={feeStatusLabel(assessment.status, t)} variant={feeStatusVariant(assessment.status)} />
            </View>
          );
        })}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  retry: {
    alignSelf: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  retryText: { color: colors.primary, fontWeight: '700' },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...softShadow,
  },
  summaryStat: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  summaryLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  rowMain: { flex: 1, marginRight: spacing.sm },
  rowName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  rowMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  overdue: { color: colors.error, fontWeight: '600' },
});
