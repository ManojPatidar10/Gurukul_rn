import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { getSalaryHistory } from '../../api/employees';
import type { SalaryHistoryEntry } from '../../api/types';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'SalaryHistory'>;

export function SalaryHistoryScreen({ route, navigation }: Props) {
  const schoolId = useSchoolId();
  const employee = route.params.employee;
  const [history, setHistory] = useState<SalaryHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSalaryHistory(schoolId, employee.id)
      .then(setHistory)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [schoolId, employee.id]);

  return (
    <View style={styles.root}>
      <ScreenHeader title="Salary History" subtitle={employee.name} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        {loading && <ActivityIndicator style={styles.loading} />}
        {error && <Text style={styles.error}>{error}</Text>}
        {!loading && !error && history.length === 0 && (
          <Text style={styles.empty}>No payroll history yet for this employee.</Text>
        )}
        {history.map((entry) => (
          <View key={entry.payrollLineId} style={styles.row}>
            <View>
              <Text style={styles.rowTitle}>
                {entry.month}/{entry.year}
              </Text>
              <Text style={styles.rowNet}>₹{entry.net.toLocaleString('en-IN')}</Text>
            </View>
            <StatusChip label={entry.runStatus} variant="neutral" />
          </View>
        ))}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: 40 },
  error: { color: colors.error },
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
