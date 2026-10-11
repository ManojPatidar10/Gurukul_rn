import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { listClassSections } from '../../api/classSections';
import { getFeeAssessmentSummary, listFeeAssessments } from '../../api/feeAssessments';
import type { ClassSection, FeeAssessment, FeeAssessmentFilters, FeeAssessmentSummary, FeeBillStatus } from '../../api/types';
import Dropdown from '../../components/Dropdown';
import { ErrorNotice } from '../../components/ErrorNotice';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SearchBar } from '../../components/SearchBar';
import { StatusChip } from '../../components/StatusChip';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { useBottomInset } from '../../hooks/useBottomInset';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import {
  academicYearOptions,
  ALL_ACADEMIC_YEARS,
  assessmentsEmptyText,
  billDueNote,
  FEE_BILL_STATUSES,
  feeStatusLabel,
  feeStatusVariant,
  sectionsForYear,
  studentLeftTagKey,
} from '../../utils/feeBills';
import { formatRupees } from '../../utils/money';
import { getErrorMessage } from '../../api/errorMessage';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'FeeAssessmentsList'>;

const PAGE_SIZE = 50;

type StatusFilter = 'ALL' | FeeBillStatus;
const STATUS_FILTERS: readonly StatusFilter[] = ['ALL', ...FEE_BILL_STATUSES];

/**
 * The admin's bills. Filters (academic year, class, status, name/roll search, withdrawn students)
 * all run on the server, and the summary card is the server's totals for the same year, class and
 * withdrawn setting - never sums of the rows loaded so far. By default: the current academic year,
 * active students, no cancelled bills.
 */
export function FeeAssessmentsListScreen({ navigation }: Props) {
  const listBottom = useBottomInset();
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const [assessments, setAssessments] = useState<FeeAssessment[]>([]);
  const [summary, setSummary] = useState<FeeAssessmentSummary | null>(null);
  const [sections, setSections] = useState<ClassSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  // null: the server's default (the current academic year), which the summary then names.
  const [yearFilter, setYearFilter] = useState<string | null>(null);
  const [classSectionId, setClassSectionId] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [summaryFailed, setSummaryFailed] = useState(false);
  const { showToast } = useToast();
  // Each request takes the next number; a reply to an older one (a filter changed meanwhile) is
  // dropped, and only the latest request clears the loading flags. So Load more stays off until a
  // new filter's first page is in, and can't add that filter's next page to another filter's rows.
  const listRequest = useRef(0);
  const summaryRequest = useRef(0);
  // The filters the rows on screen belong to; null while none are shown.
  const rowsFilters = useRef<FeeAssessmentFilters | null>(null);

  const summaryFilters = useMemo<FeeAssessmentFilters>(
    () => ({ academicYear: yearFilter ?? undefined, classSectionId: classSectionId || undefined, includeInactive }),
    [yearFilter, classSectionId, includeInactive]
  );
  const filters = useMemo<FeeAssessmentFilters>(
    () => ({
      ...summaryFilters,
      status: statusFilter === 'ALL' ? undefined : statusFilter,
      q: debouncedQuery || undefined,
    }),
    [summaryFilters, statusFilter, debouncedQuery]
  );

  /** Page 0 replaces the rows; a later page adds to them. */
  const load = useCallback(
    (pageToLoad: number) => {
      const id = ++listRequest.current;
      const append = pageToLoad > 0;
      setError(null);
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setLoadingMore(false);
      }
      return listFeeAssessments(schoolId, filters, pageToLoad, PAGE_SIZE)
        .then((res) => {
          if (id !== listRequest.current) return;
          setAssessments((prev) => (append ? [...prev, ...res.content] : res.content));
          setHasNext(res.hasNext);
          setPage(pageToLoad);
          rowsFilters.current = filters;
        })
        .catch((e) => {
          if (id !== listRequest.current) return;
          setError(getErrorMessage(e));
          showToast(getErrorMessage(e), 'error');
          // Rows from other filters mustn't stay on screen under these ones (or be added to).
          if (rowsFilters.current !== filters) {
            setAssessments([]);
            setHasNext(false);
            setPage(0);
            rowsFilters.current = null;
          }
        })
        .finally(() => {
          if (id !== listRequest.current) return;
          setLoading(false);
          setLoadingMore(false);
        });
    },
    [schoolId, filters, showToast]
  );

  const loadSummary = useCallback(() => {
    const id = ++summaryRequest.current;
    return getFeeAssessmentSummary(schoolId, summaryFilters)
      .then((result) => {
        if (id !== summaryRequest.current) return;
        setSummary(result);
        setSummaryFailed(false);
      })
      .catch(() => {
        // The card's totals may be for other filters now, so a notice takes its place. The year
        // picker keeps the last summary's years (every year with bills, whatever the filters).
        if (id === summaryRequest.current) setSummaryFailed(true);
      });
  }, [schoolId, summaryFilters]);

  useEffect(() => {
    load(0);
  }, [load]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    listClassSections(schoolId)
      .then(setSections)
      .catch(() => setSections([]));
  }, [schoolId]);

  const hasMounted = useRef(false);
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (!hasMounted.current) {
        hasMounted.current = true;
        return;
      }
      // Back from a bill (an adjustment, a new due date, a cancel): refresh the rows and the totals.
      load(0);
      loadSummary();
    });
    return unsubscribe;
  }, [navigation, load, loadSummary]);

  const handleRefresh = () => {
    setRefreshing(true);
    Promise.all([load(0), loadSummary()]).finally(() => setRefreshing(false));
  };

  const handleLoadMore = () => {
    if (!hasNext || loadingMore || loading) return;
    load(page + 1);
  };

  const shownYear = yearFilter ?? summary?.academicYear ?? null;
  const yearSections = sectionsForYear(sections, shownYear);

  const handleYearSelect = (year: string) => {
    setYearFilter(year);
    // A class from another year would match nothing.
    if (classSectionId && !sectionsForYear(sections, year).some((section) => section.id === classSectionId)) {
      setClassSectionId('');
    }
  };

  const yearOptions = [
    ...academicYearOptions(summary).map((year) => ({ label: year, value: year })),
    { label: t('fees.assessmentsList.allYears'), value: ALL_ACADEMIC_YEARS },
  ];
  const classOptions = [
    { label: t('fees.assessmentsList.allClasses'), value: '' },
    ...yearSections.map((section) => ({ label: section.displayLabel, value: section.id })),
  ];
  const emptyText = assessmentsEmptyText(
    {
      loadFailed: !!error,
      filtered: statusFilter !== 'ALL' || !!debouncedQuery || !!classSectionId,
      shownYear,
      availableYears: summary?.availableAcademicYears ?? null,
    },
    t
  );

  const header = (
    <View>
      {summaryFailed ? (
        <View style={styles.summaryError}>
          <ErrorNotice message={t('fees.assessmentsList.summaryError')} />
          <Pressable style={styles.retry} onPress={loadSummary} accessibilityRole="button">
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      ) : summary && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryValue}>{summary.billCount}</Text>
            <Text style={styles.summaryLabel}>{t('fees.assessmentsList.summaryBills')}</Text>
          </View>
          <View style={styles.summaryStat}>
            <Text style={[styles.summaryValue, { color: colors.warning }]}>{summary.unpaidCount}</Text>
            <Text style={styles.summaryLabel}>{t('fees.assessmentsList.summaryUnpaidCount')}</Text>
          </View>
          <View style={styles.summaryStat}>
            <Text style={[styles.summaryValue, { color: colors.error }]}>{summary.overdueCount}</Text>
            <Text style={styles.summaryLabel}>{t('fees.assessmentsList.summaryOverdue')}</Text>
          </View>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryValue}>{formatRupees(summary.totalRemaining)}</Text>
            <Text style={styles.summaryLabel}>{t('fees.assessmentsList.summaryUnpaidAmount')}</Text>
          </View>
        </View>
      )}

      <View style={styles.dropdownRow}>
        <View style={styles.dropdown}>
          <Dropdown
            label={t('fees.assessmentsList.academicYear')}
            value={shownYear ?? ''}
            options={yearOptions}
            onSelect={handleYearSelect}
          />
        </View>
        <View style={styles.dropdown}>
          <Dropdown
            label={t('fees.assessmentsList.classFilter')}
            value={classSectionId}
            options={classOptions}
            onSelect={setClassSectionId}
          />
        </View>
      </View>

      <SearchBar value={query} onChangeText={setQuery} placeholder={t('fees.assessmentsList.searchPlaceholder')} />

      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((status) => {
          const selected = statusFilter === status;
          return (
            <Pressable
              key={status}
              style={[styles.filterChip, selected && styles.filterChipSelected]}
              onPress={() => setStatusFilter(status)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>{feeStatusLabel(status, t)}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>{t('fees.assessmentsList.showWithdrawn')}</Text>
        <Switch
          value={includeInactive}
          onValueChange={setIncludeInactive}
          accessibilityLabel={t('fees.assessmentsList.showWithdrawn')}
        />
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('fees.assessmentsList.title')} onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <FlatList
          contentContainerStyle={{ paddingBottom: listBottom }}
          data={assessments}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={header}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footerLoader} color={colors.primary} /> : null}
          ListEmptyComponent={
            // While pulling to refresh, the refresh spinner is enough.
            loading && !refreshing ? (
              <ActivityIndicator style={styles.loader} color={colors.primary} />
            ) : (
              <Text style={styles.empty}>{emptyText}</Text>
            )
          }
          renderItem={({ item }) => {
            const leftTag = studentLeftTagKey(item.studentStatus);
            const dueNote = billDueNote(item, t);
            return (
              <Pressable
                style={styles.row}
                onPress={() => navigation.navigate('FeeAssessmentDetail', { assessment: item })}
              >
                <View style={styles.rowMain}>
                  <View style={styles.nameRow}>
                    <Text style={styles.rowName}>{item.studentName}</Text>
                    {leftTag && (
                      <View style={styles.leftTag}>
                        <Text style={styles.leftTagText}>{t(leftTag)}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.rowMeta}>
                    {t('fees.assessmentsList.rowSubtitle', {
                      roll: item.rollNumber,
                      due: formatRupees(item.remainingDue, { symbol: false }),
                      total: formatRupees(item.totalDue, { symbol: false }),
                    })}
                  </Text>
                  {(!!item.classSectionLabel || !!dueNote) && (
                    <Text style={styles.rowMeta}>
                      {item.classSectionLabel}
                      {item.classSectionLabel && dueNote ? ' · ' : ''}
                      {dueNote && (
                        <Text style={dueNote.tone === 'error' ? styles.overdue : undefined}>{dueNote.text}</Text>
                      )}
                    </Text>
                  )}
                </View>
                <StatusChip label={feeStatusLabel(item.status, t)} variant={feeStatusVariant(item.status)} />
              </Pressable>
            );
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  footerLoader: { marginVertical: spacing.md },
  loader: { marginTop: 40 },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...softShadow,
  },
  summaryError: { marginBottom: spacing.sm },
  retry: { alignSelf: 'flex-start', paddingVertical: spacing.xs },
  retryText: { color: colors.primary, fontWeight: '700' },
  summaryStat: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  summaryLabel: { fontSize: 10.5, color: colors.textMuted, marginTop: 2, textAlign: 'center' },
  dropdownRow: { flexDirection: 'row', gap: spacing.sm },
  dropdown: { flex: 1 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
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
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  switchLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.textSecondary },
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
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs },
  rowName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  leftTag: { backgroundColor: colors.surfaceMuted, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  leftTagText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  rowMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  overdue: { color: colors.error, fontWeight: '600' },
});
