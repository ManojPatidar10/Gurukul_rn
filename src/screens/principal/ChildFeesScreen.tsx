import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { listStudentFeeAssessments } from '../../api/feeAssessments';
import type { FeeAssessment } from '../../api/types';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'ChildFees'>;

export function ChildFeesScreen({ route, navigation }: Props) {
  const schoolId = useSchoolId();
  const student = route.params.student;
  const [assessments, setAssessments] = useState<FeeAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    return listStudentFeeAssessments(schoolId, student.id)
      .then(setAssessments)
      .catch((e) => setError((e as Error).message));
  }, [schoolId, student.id]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={`${student.name}'s Fees`} onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        {error && <Text style={styles.error}>{error}</Text>}
        {loading && <ActivityIndicator color={colors.primary} style={styles.loading} />}

        <FlatList
          data={assessments}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            !loading ? (
              <Text style={styles.empty}>{error ? 'Could not load fee dues.' : 'No fee assessments yet.'}</Text>
            ) : null
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.rowName}>{item.academicYear}</Text>
                <Text style={styles.rowMeta}>
                  Due ₹{item.remainingDue.toLocaleString('en-IN')} of ₹{item.totalDue.toLocaleString('en-IN')}
                </Text>
              </View>
              <StatusChip label={item.status} variant={item.remainingDue <= 0 ? 'success' : 'warning'} />
            </View>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  loading: { marginTop: spacing.xl },
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
