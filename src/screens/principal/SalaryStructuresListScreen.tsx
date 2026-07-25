import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { listSalaryStructures } from '../../api/salaryStructures';
import type { SalaryStructure } from '../../api/types';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'SalaryStructuresList'>;

function netOf(s: SalaryStructure) {
  return s.basic + s.allowances - s.deductions;
}

export function SalaryStructuresListScreen({ navigation }: Props) {
  const schoolId = useSchoolId();
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    return listSalaryStructures(schoolId)
      .then(setStructures)
      .catch((e) => setError(e.message));
  }, [schoolId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setLoading(true);
      load().finally(() => setLoading(false));
    });
    return unsubscribe;
  }, [navigation, load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Salary Structures" onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <Pressable style={styles.addButton} onPress={() => navigation.navigate('SalaryStructureForm')}>
          <Text style={styles.addButtonText}>+ Add salary structure</Text>
        </Pressable>

        {error && <Text style={styles.error}>{error}</Text>}

        <FlatList
          data={structures}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            !loading ? (
              <Text style={styles.empty}>
                {error ? 'Could not load salary structures.' : '0 salary structures yet — add the first one.'}
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View>
                <Text style={styles.rowName}>{item.employeeName}</Text>
                <Text style={styles.rowMeta}>
                  Basic ₹{item.basic.toLocaleString('en-IN')} + Allowances ₹
                  {item.allowances.toLocaleString('en-IN')} − Deductions ₹
                  {item.deductions.toLocaleString('en-IN')}
                </Text>
                <Text style={styles.rowMeta}>Effective from {item.effectiveFrom}</Text>
              </View>
              <Text style={styles.rowNet}>₹{netOf(item).toLocaleString('en-IN')}</Text>
            </View>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, paddingHorizontal: spacing.lg },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  addButtonText: { color: colors.white, fontWeight: '700' },
  error: { color: colors.error, marginBottom: spacing.md },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowName: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  rowMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  rowNet: { fontSize: 14, color: colors.accent, fontWeight: '700' },
});
