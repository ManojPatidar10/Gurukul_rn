import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { listFeeAssessments } from '../../api/feeAssessments';
import type { FeeAssessment } from '../../api/types';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SearchBar } from '../../components/SearchBar';
import { StatusChip } from '../../components/StatusChip';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'FeeAssessmentsList'>;

const STATUS_FILTERS = ['ALL', 'UNPAID', 'PARTIAL', 'OVERDUE', 'PAID'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function statusVariant(status: string): 'success' | 'error' | 'warning' | 'neutral' {
  if (status === 'PAID') return 'success';
  if (status === 'OVERDUE') return 'error';
  if (status === 'PARTIAL') return 'warning';
  return 'neutral';
}

export function FeeAssessmentsListScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const [assessments, setAssessments] = useState<FeeAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [query, setQuery] = useState('');
  const { showToast } = useToast();

  const load = useCallback(() => {
    setError(null);
    return listFeeAssessments(schoolId)
      .then(setAssessments)
      .catch((e) => {
        setError(e.message);
        showToast(e.message, 'error');
      });
  }, [schoolId, showToast]);

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

  const summary = useMemo(() => {
    const unpaid = assessments.filter((a) => a.remainingDue > 0);
    const totalUnpaid = unpaid.reduce((sum, a) => sum + a.remainingDue, 0);
    return { unpaidCount: unpaid.length, totalUnpaid, total: assessments.length };
  }, [assessments]);

  const visible = useMemo(() => {
    const trimmedQuery = query.trim().toLowerCase();
    return assessments.filter((a) => {
      if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
      if (!trimmedQuery) return true;
      return (
        a.studentName.toLowerCase().includes(trimmedQuery) ||
        a.rollNumber.toLowerCase().includes(trimmedQuery)
      );
    });
  }, [assessments, statusFilter, query]);

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('fees.assessmentsList.title')} onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        {!loading && assessments.length > 0 && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryValue}>{summary.total}</Text>
              <Text style={styles.summaryLabel}>{t('fees.assessmentsList.summaryTotal')}</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={[styles.summaryValue, { color: colors.warning }]}>{summary.unpaidCount}</Text>
              <Text style={styles.summaryLabel}>{t('fees.assessmentsList.summaryUnpaidCount')}</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={[styles.summaryValue, { color: colors.error }]}>₹{summary.totalUnpaid.toLocaleString('en-IN')}</Text>
              <Text style={styles.summaryLabel}>{t('fees.assessmentsList.summaryUnpaidAmount')}</Text>
            </View>
          </View>
        )}

        <SearchBar value={query} onChangeText={setQuery} placeholder={t('fees.assessmentsList.searchPlaceholder')} />

        <View style={styles.filterRow}>
          {STATUS_FILTERS.map((status) => {
            const selected = statusFilter === status;
            return (
              <Pressable
                key={status}
                style={[styles.filterChip, selected && styles.filterChipSelected]}
                onPress={() => setStatusFilter(status)}
              >
                <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>{status}</Text>
              </Pressable>
            );
          })}
        </View>

        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            !loading ? (
              <Text style={styles.empty}>
                {error ? t('fees.assessmentsList.loadError') : t('fees.assessmentsList.empty')}
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => navigation.navigate('FeeAssessmentDetail', { assessment: item })}
            >
              <View style={styles.rowMain}>
                <Text style={styles.rowName}>{item.studentName}</Text>
                <Text style={styles.rowMeta}>
                  {t('fees.assessmentsList.rowSubtitle', {
                    roll: item.rollNumber,
                    due: item.remainingDue.toLocaleString('en-IN'),
                    total: item.totalDue.toLocaleString('en-IN'),
                  })}
                </Text>
              </View>
              <StatusChip label={item.status} variant={statusVariant(item.status)} />
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
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...softShadow,
  },
  summaryStat: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  summaryLabel: { fontSize: 10.5, color: colors.textMuted, marginTop: 2, textAlign: 'center' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
  filterChip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  filterChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  filterChipTextSelected: { color: colors.white },
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
