import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { listFeeStructures } from '../../api/feeStructures';
import type { FeeStructure } from '../../api/types';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'FeeStructuresList'>;

function totalOf(structure: FeeStructure) {
  return structure.lines.reduce((sum, line) => sum + line.amount, 0);
}

export function FeeStructuresListScreen({ navigation }: Props) {
  const schoolId = useSchoolId();
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    return listFeeStructures(schoolId)
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
      <ScreenHeader title="Fee Structures" onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <Pressable style={styles.addButton} onPress={() => navigation.navigate('FeeStructureForm')}>
          <Text style={styles.addButtonText}>+ New fee structure</Text>
        </Pressable>

        {error && <Text style={styles.error}>{error}</Text>}

        <FlatList
          data={structures}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            !loading ? (
              <Text style={styles.empty}>
                {error ? 'Could not load fee structures.' : '0 fee structures yet — create the first one.'}
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => navigation.navigate('FeeStructureDetail', { feeStructure: item })}
            >
              <View>
                <Text style={styles.rowName}>
                  {item.className} - {item.section} ({item.academicYear})
                </Text>
                <Text style={styles.rowMeta}>{item.lines.length} fee line(s)</Text>
              </View>
              <Text style={styles.rowTotal}>₹{totalOf(item).toLocaleString('en-IN')}</Text>
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
  rowName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  rowMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  rowTotal: { fontSize: 14, color: accents.fees.base, fontWeight: '800' },
});
