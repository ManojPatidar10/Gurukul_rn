import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getPayrollOverview } from '../../api/feeAssessments';
import type { PayrollOverview } from '../../api/types';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'PayrollOverview'>;

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function PayrollOverviewScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const [overview, setOverview] = useState<PayrollOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPayrollOverview(schoolId)
      .then(setOverview)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [schoolId]);

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('payroll.overview.title')} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        {loading && <ActivityIndicator style={styles.loading} color={colors.primary} />}
        {error && <Text style={styles.error}>{error}</Text>}

        {overview && (
          <>
            <View style={styles.statRow}>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: colors.success }]}>{overview.paidEmployeeCount}</Text>
                <Text style={styles.statLabel}>{t('payroll.overview.paidCount')}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: colors.warning }]}>{overview.pendingEmployeeCount}</Text>
                <Text style={styles.statLabel}>{t('payroll.overview.pendingCount')}</Text>
              </View>
            </View>
            <View style={styles.statRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>₹{overview.paidAmount.toLocaleString('en-IN')}</Text>
                <Text style={styles.statLabel}>{t('payroll.overview.paidAmount')}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>₹{overview.pendingAmount.toLocaleString('en-IN')}</Text>
                <Text style={styles.statLabel}>{t('payroll.overview.pendingAmount')}</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>{t('payroll.overview.runsTitle')}</Text>
            {overview.runs.length === 0 && <Text style={styles.empty}>{t('payroll.overview.empty')}</Text>}
            {overview.runs.map((run) => (
              <View key={`${run.year}-${run.month}`} style={styles.row}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowName}>
                    {MONTH_NAMES[run.month - 1] ?? run.month} {run.year}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {t('payroll.overview.runSubtitle', { count: run.employeeCount })} · ₹{run.totalNet.toLocaleString('en-IN')}
                  </Text>
                </View>
                <StatusChip label={run.status} variant={run.status === 'PAID' ? 'success' : 'warning'} />
              </View>
            ))}
          </>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  error: { color: colors.error, marginBottom: spacing.md },
  statRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    ...softShadow,
  },
  statValue: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  statLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2, textAlign: 'center' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.sm },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
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
