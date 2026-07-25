import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { listInfraExpenseRequests } from '../../api/infraExpenseRequests';
import type { InfraExpenseRequest } from '../../api/types';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'InfraExpensesList'>;

export function InfraExpensesListScreen({ navigation }: Props) {
  const schoolId = useSchoolId();
  const [requests, setRequests] = useState<InfraExpenseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    return listInfraExpenseRequests(schoolId)
      .then(setRequests)
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
      <ScreenHeader title="Infrastructure Expenses" onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <Pressable style={styles.addButton} onPress={() => navigation.navigate('InfraExpenseForm')}>
          <Text style={styles.addButtonText}>+ New request</Text>
        </Pressable>

        {error && <Text style={styles.error}>{error}</Text>}

        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            !loading ? (
              <Text style={styles.empty}>
                {error ? 'Could not load requests.' : '0 requests yet — create the first one.'}
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => navigation.navigate('InfraExpenseDetail', { request: item })}
            >
              <View style={styles.rowMain}>
                <Text style={styles.rowName}>{item.description}</Text>
                <Text style={styles.rowMeta}>
                  {item.categoryCode} · ₹{item.estimatedAmount.toLocaleString('en-IN')}
                </Text>
              </View>
              <StatusChip label={item.status} variant="neutral" />
            </Pressable>
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
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    ...softShadow,
  },
  addButtonText: { color: colors.white, fontWeight: '700' },
  error: { color: colors.error, marginBottom: spacing.md },
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
  rowMain: { flex: 1, marginRight: spacing.sm },
  rowName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  rowMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
});
