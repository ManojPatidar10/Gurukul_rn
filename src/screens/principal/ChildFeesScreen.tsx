import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { listStudentFeeAssessments } from '../../api/feeAssessments';
import type { FeeAssessment } from '../../api/types';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useSchoolId } from '../../context/SchoolContext';
import { useBottomInset } from '../../hooks/useBottomInset';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { formatRupees } from '../../utils/money';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'ChildFees'>;

export function ChildFeesScreen({ route, navigation }: Props) {
  const listBottom = useBottomInset();
  const { t } = useTranslation();
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
      .catch((e) => setError(getErrorMessage(e)));
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
      <ScreenHeader title={t('childFees.title', { name: student.name })} onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <Pressable
          style={styles.historyButton}
          onPress={() => navigation.navigate('StudentFeePayments', { student })}
          accessibilityRole="button"
        >
          <Text style={styles.historyButtonText}>{t('fees.paymentHistory.title')}</Text>
        </Pressable>
        {error && <ErrorNotice message={error} />}
        {loading && <ActivityIndicator color={colors.primary} style={styles.loading} />}

        <FlatList
          contentContainerStyle={{ paddingBottom: listBottom }}
          data={assessments}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            !loading ? (
              <Text style={styles.empty}>{error ? t('childFees.loadError') : t('childFees.empty')}</Text>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => navigation.navigate('FeeAssessmentDetail', { assessment: item })}
              accessibilityRole="button"
            >
              <View style={styles.rowMain}>
                <Text style={styles.rowName}>{item.academicYear}</Text>
                <Text style={styles.rowMeta}>
                  {t('myFees.due', {
                    remaining: formatRupees(item.remainingDue, { symbol: false }),
                    total: formatRupees(item.totalDue, { symbol: false }),
                  })}
                </Text>
              </View>
              <StatusChip label={item.status} variant={item.remainingDue <= 0 ? 'success' : 'warning'} />
            </Pressable>
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
  historyButton: { alignSelf: 'flex-end', paddingVertical: spacing.xs, marginBottom: spacing.sm },
  historyButtonText: { color: colors.primary, fontWeight: '700' },
});
