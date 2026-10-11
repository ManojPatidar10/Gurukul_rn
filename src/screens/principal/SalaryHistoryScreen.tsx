import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getSalaryHistory } from '../../api/employees';
import type { SalaryHistoryEntry } from '../../api/types';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';
import { formatInr, lineStatusLabel, lineStatusVariant, runMonthLabel } from '../../utils/payroll';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'SalaryHistory'>;

export function SalaryHistoryScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const employee = route.params.employee;
  const [history, setHistory] = useState<SalaryHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSalaryHistory(schoolId, employee.id)
      .then(setHistory)
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [schoolId, employee.id]);

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('payroll.salaryHistory.title')} subtitle={employee.name} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        {loading && <ActivityIndicator style={styles.loading} />}
        {error && <ErrorNotice message={error} />}
        {!loading && !error && history.length === 0 && (
          <Text style={styles.empty}>{t('payroll.salaryHistory.empty')}</Text>
        )}
        {history.map((entry) => (
          <Pressable
            key={entry.payrollLineId}
            style={styles.row}
            onPress={() =>
              navigation.navigate('PayslipDetail', { payrollLineId: entry.payrollLineId, employeeName: employee.name })
            }
          >
            <View>
              <Text style={styles.rowTitle}>{runMonthLabel(entry.month, entry.year, t)}</Text>
              <Text style={styles.rowNet}>{formatInr(entry.net)}</Text>
            </View>
            {/* Held or not, an unpaid month here is simply "Not paid yet". */}
            <StatusChip label={lineStatusLabel(entry.status, t, false)} variant={lineStatusVariant(entry.status, false)} />
          </Pressable>
        ))}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: 40 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
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
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  rowNet: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
});
