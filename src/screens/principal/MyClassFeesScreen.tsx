import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getClassSectionFeeStatus } from '../../api/feeAssessments';
import type { FeeAssessment } from '../../api/types';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'MyClassFees'>;

function statusVariant(status: string): 'success' | 'error' | 'warning' | 'neutral' {
  if (status === 'PAID') return 'success';
  if (status === 'OVERDUE') return 'error';
  if (status === 'PARTIAL') return 'warning';
  return 'neutral';
}

export function MyClassFeesScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const classSection = route.params.classSection;
  const [assessments, setAssessments] = useState<FeeAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getClassSectionFeeStatus(schoolId, classSection.id)
      .then(setAssessments)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [schoolId, classSection.id]);

  const summary = useMemo(() => {
    const totalDue = assessments.reduce((sum, a) => sum + a.totalDue, 0);
    const totalRemaining = assessments.reduce((sum, a) => sum + a.remainingDue, 0);
    const paidCount = assessments.filter((a) => a.status === 'PAID').length;
    return { totalDue, totalRemaining, paidCount, total: assessments.length };
  }, [assessments]);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('fees.myClassFees.title')}
        subtitle={`${classSection.className} - ${classSection.section}`}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        {loading && <ActivityIndicator style={styles.loading} color={colors.primary} />}
        {error && <Text style={styles.error}>{error}</Text>}

        {!loading && assessments.length > 0 && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryValue}>
                {summary.paidCount}/{summary.total}
              </Text>
              <Text style={styles.summaryLabel}>{t('fees.myClassFees.fullyPaid')}</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryValue}>₹{summary.totalRemaining.toLocaleString('en-IN')}</Text>
              <Text style={styles.summaryLabel}>{t('fees.myClassFees.remaining')}</Text>
            </View>
          </View>
        )}

        {!loading && assessments.length === 0 && !error && (
          <Text style={styles.empty}>{t('fees.myClassFees.empty')}</Text>
        )}

        {assessments.map((assessment) => (
          <View key={assessment.id} style={styles.row}>
            <View style={styles.rowMain}>
              <Text style={styles.rowName}>{assessment.studentName}</Text>
              <Text style={styles.rowMeta}>
                {t('fees.myClassFees.rowSubtitle', {
                  roll: assessment.rollNumber,
                  due: assessment.remainingDue.toLocaleString('en-IN'),
                  total: assessment.totalDue.toLocaleString('en-IN'),
                })}
              </Text>
            </View>
            <StatusChip label={assessment.status} variant={statusVariant(assessment.status)} />
          </View>
        ))}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  error: { color: colors.error, marginBottom: spacing.md },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
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
});
