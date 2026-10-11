import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { ApiError } from '../../api/client';
import { getErrorMessage } from '../../api/errorMessage';
import { findReceipt, getDayBook, getFundSummary, ledgerChangeCount, listLedger } from '../../api/ledger';
import type { DayBook, DayBookBucket, FundSummary, LedgerTransaction } from '../../api/types';
import { DatePickerField, parseIsoDate } from '../../components/DatePickerField';
import Dropdown from '../../components/Dropdown';
import { ErrorNotice } from '../../components/ErrorNotice';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SearchBar } from '../../components/SearchBar';
import { StatusChip } from '../../components/StatusChip';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { useBottomInset } from '../../hooks/useBottomInset';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { shiftIsoDate } from '../../utils/feeBills';
import {
  ALL_OPTION,
  appendPage,
  buildEntriesFilter,
  buildLedgerQuery,
  categoryOptions,
  customRangeError,
  displayNumber,
  entriesView,
  entryChips,
  entryLabel,
  formatLedgerDate,
  formatLedgerRupees,
  formatSignedLedgerRupees,
  isZeroBucket,
  methodOptions,
  normalizeReceiptQuery,
  paymentMethodLabel,
  periodRange,
  signedAmount,
  type LedgerPeriodChoice,
} from '../../utils/ledger';
import { istToday } from '../../utils/quizInsights';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'Ledger'>;

type Tab = 'dayBook' | 'entries';

const accent = accents.fees;

const PERIODS: LedgerPeriodChoice[] = ['thisMonth', 'thisYear', 'lastYear', 'custom'];

/** One ledger entry in a list: date, label, notes and number on the left; the amount and method on the right. */
function LedgerRow({ tx, t, onPress }: { tx: LedgerTransaction; t: TFunction; onPress: () => void }) {
  const number = displayNumber(tx);
  const inflow = tx.direction === 'INFLOW';
  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityRole="button">
      <View style={styles.rowMain}>
        <Text style={styles.rowDate}>{formatLedgerDate(tx.transactionDate, t)}</Text>
        <Text style={styles.rowLabel} numberOfLines={1}>
          {entryLabel(tx, t)}
        </Text>
        {tx.notes ? (
          <Text style={styles.rowNotes} numberOfLines={1}>
            {tx.notes}
          </Text>
        ) : null}
        <View style={styles.rowMeta}>
          {number ? (
            <Text style={[styles.rowNumber, tx.reversed && styles.struck]} numberOfLines={1}>
              {number}
            </Text>
          ) : null}
          {entryChips(tx).map((chip) => (
            <StatusChip key={chip.key} label={t(chip.key)} variant={chip.variant} />
          ))}
        </View>
      </View>
      <View style={styles.rowSide}>
        <Text style={[styles.rowAmount, { color: inflow ? colors.success : colors.error }]}>
          {formatSignedLedgerRupees(signedAmount(tx))}
        </Text>
        <View style={styles.methodChip}>
          <Text style={styles.methodChipText}>{paymentMethodLabel(tx.paymentMethod, t)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

/** A labelled rupee amount: a card of its own, or `flat` inside another card. */
function MoneyStat({ label, value, tone, flat }: { label: string; value: number; tone?: 'in' | 'out'; flat?: boolean }) {
  const color = tone === 'in' ? colors.success : tone === 'out' ? colors.error : colors.textPrimary;
  return (
    <View style={[styles.stat, !flat && styles.statCard]}>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.statValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {formatLedgerRupees(value)}
      </Text>
    </View>
  );
}

export function LedgerScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { showToast } = useToast();
  const listBottom = useBottomInset();

  // Fixed for the screen's life: "today" in IST and the clock the period chips are worked out from.
  const [now] = useState(() => new Date());
  const today = istToday(now);

  const [tab, setTab] = useState<Tab>('dayBook');
  const [refreshing, setRefreshing] = useState(false);

  // Find a receipt or voucher.
  const [query, setQuery] = useState('');
  const [finding, setFinding] = useState(false);

  // Day book.
  const [date, setDate] = useState(today);
  const [dayBook, setDayBook] = useState<DayBook | null>(null);
  const [dayLoading, setDayLoading] = useState(true);
  const [dayError, setDayError] = useState<string | null>(null);
  const dayRequest = useRef(0);

  // Entries.
  const thisMonth = periodRange('thisMonth', now);
  const [period, setPeriod] = useState<LedgerPeriodChoice>('thisMonth');
  const [customFrom, setCustomFrom] = useState(thisMonth.from ?? today);
  const [customTo, setCustomTo] = useState(thisMonth.to ?? today);
  const [category, setCategory] = useState(ALL_OPTION);
  const [method, setMethod] = useState(ALL_OPTION);
  const [summary, setSummary] = useState<FundSummary | null>(null);
  const [entries, setEntries] = useState<LedgerTransaction[]>([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [totalEntries, setTotalEntries] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [entriesError, setEntriesError] = useState<string | null>(null);
  // The query the totals and rows on hand were loaded for; they show only while it matches the filter.
  const [shownEntriesKey, setShownEntriesKey] = useState<string | null>(null);
  const entriesRequest = useRef(0);
  // The query last loaded or being loaded, so switching tabs doesn't load it again.
  const requestedEntriesKey = useRef<string | null>(null);

  const filter = useMemo(
    () => buildEntriesFilter({ period, customFrom, customTo, category, method }, now),
    [period, customFrom, customTo, category, method, now]
  );
  const filterKey = buildLedgerQuery(filter);
  const rangeErrorKey = period === 'custom' ? customRangeError(customFrom, customTo) : null;
  const entriesState = entriesView({
    filterKey,
    loadedKey: shownEntriesKey,
    rangeInvalid: rangeErrorKey !== null,
    failed: entriesError !== null,
  });
  const entriesReady = entriesState === 'ready';

  const loadDayBook = useCallback(
    async (day: string) => {
      const id = ++dayRequest.current;
      try {
        const result = await getDayBook(schoolId, day);
        if (id === dayRequest.current) {
          setDayBook(result);
          setDayError(null);
        }
      } catch (e) {
        if (id === dayRequest.current) {
          setDayBook(null);
          setDayError(getErrorMessage(e));
        }
      }
    },
    [schoolId]
  );

  const loadEntries = useCallback(async () => {
    const id = ++entriesRequest.current;
    setEntriesError(null);
    requestedEntriesKey.current = filterKey;
    try {
      const [totals, first] = await Promise.all([getFundSummary(schoolId, filter), listLedger(schoolId, filter, 0)]);
      if (id !== entriesRequest.current) return;
      setSummary(totals);
      setEntries(first.content);
      setHasNext(first.hasNext);
      setTotalEntries(first.totalElements);
      setPage(0);
      setShownEntriesKey(filterKey);
    } catch (e) {
      if (id !== entriesRequest.current) return;
      requestedEntriesKey.current = null;
      setShownEntriesKey(null);
      setSummary(null);
      setEntries([]);
      setHasNext(false);
      setEntriesError(getErrorMessage(e));
    }
  }, [schoolId, filter, filterKey]);

  useEffect(() => {
    let active = true;
    loadDayBook(date).finally(() => {
      if (active) setDayLoading(false);
    });
    return () => {
      active = false;
    };
  }, [date, loadDayBook]);

  // No loading flag to clear: the spinner shows until rows for this filter land (see entriesView),
  // so a load that finishes while the Day book tab is open still shows on coming back.
  useEffect(() => {
    if (tab !== 'entries' || rangeErrorKey || requestedEntriesKey.current === filterKey) return;
    loadEntries();
  }, [tab, filterKey, rangeErrorKey, loadEntries]);

  // Coming back from an entry that was reversed: reload what's on screen.
  const seenChanges = useRef(ledgerChangeCount());
  useFocusEffect(
    useCallback(() => {
      if (ledgerChangeCount() === seenChanges.current) return;
      seenChanges.current = ledgerChangeCount();
      loadDayBook(date);
      if (requestedEntriesKey.current !== null) loadEntries();
    }, [date, loadDayBook, loadEntries])
  );

  /** Another day: the old day's figures go at once, so they're never shown under the new date. */
  const changeDate = (next: string) => {
    const day = next > today ? today : next;
    if (day === date) return;
    setDayBook(null);
    setDayError(null);
    setDayLoading(true);
    setDate(day);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    const work = tab === 'dayBook' ? loadDayBook(date) : rangeErrorKey ? Promise.resolve() : loadEntries();
    work.finally(() => setRefreshing(false));
  };

  const handleLoadMore = () => {
    if (!hasNext || loadingMore) return;
    const id = entriesRequest.current;
    const nextPage = page + 1;
    setLoadingMore(true);
    listLedger(schoolId, filter, nextPage)
      .then((res) => {
        if (id !== entriesRequest.current) return;
        setEntries((shown) => appendPage(shown, res.content));
        setHasNext(res.hasNext);
        setPage(nextPage);
      })
      .catch((e) => showToast(getErrorMessage(e), 'error'))
      .finally(() => setLoadingMore(false));
  };

  const handleFind = async () => {
    const number = normalizeReceiptQuery(query);
    if (!number || finding) return;
    setFinding(true);
    try {
      const receipt = await findReceipt(schoolId, number);
      navigation.push('LedgerEntryDetail', { transaction: receipt.transaction });
    } catch (e) {
      const notFound = e instanceof ApiError && e.status === 404;
      showToast(notFound ? t('ledger.find.notFound') : getErrorMessage(e), 'error');
    } finally {
      setFinding(false);
    }
  };

  const openEntry = (tx: LedgerTransaction) => navigation.push('LedgerEntryDetail', { transaction: tx });

  const bucketRows: { key: string; label: string; bucket: DayBookBucket }[] = dayBook
    ? [
        { key: 'cash', label: t('ledger.dayBook.bucket.cash'), bucket: dayBook.cash },
        { key: 'bank', label: t('ledger.dayBook.bucket.bank'), bucket: dayBook.bank },
        ...(isZeroBucket(dayBook.unspecified)
          ? []
          : [{ key: 'unspecified', label: t('ledger.dayBook.bucket.unspecified'), bucket: dayBook.unspecified }]),
      ]
    : [];

  const periodLabel = (p: LedgerPeriodChoice) => {
    if (p === 'thisYear' || p === 'lastYear') {
      return t(`ledger.entries.period.${p}`, { year: periodRange(p, now).academicYear });
    }
    return t(`ledger.entries.period.${p}`);
  };

  const dayBookHeader = (
    <>
      <View style={styles.dateRow}>
        <Pressable
          style={styles.dayButton}
          onPress={() => changeDate(shiftIsoDate(date, { days: -1 }))}
          accessibilityRole="button"
          accessibilityLabel={t('ledger.dayBook.previousDay')}
        >
          <Text style={styles.dayButtonText}>‹</Text>
        </Pressable>
        <View style={styles.datePicker}>
          <DatePickerField
            label={t('ledger.dayBook.date')}
            value={date}
            onChange={changeDate}
            maximumDate={parseIsoDate(today)}
          />
        </View>
        <Pressable
          style={[styles.dayButton, date >= today && styles.disabled]}
          onPress={() => changeDate(shiftIsoDate(date, { days: 1 }))}
          disabled={date >= today}
          accessibilityRole="button"
          accessibilityLabel={t('ledger.dayBook.nextDay')}
        >
          <Text style={styles.dayButtonText}>›</Text>
        </Pressable>
      </View>

      {dayError ? <ErrorNotice message={dayError} /> : null}

      {dayBook ? (
        <>
          <View style={styles.statLine}>
            <MoneyStat label={t('ledger.dayBook.opening')} value={dayBook.openingBalance} />
            <MoneyStat label={t('ledger.dayBook.in')} value={dayBook.totalInflow} tone="in" />
          </View>
          <View style={[styles.statLine, styles.statLineLast]}>
            <MoneyStat label={t('ledger.dayBook.out')} value={dayBook.totalOutflow} tone="out" />
            <MoneyStat label={t('ledger.dayBook.closing')} value={dayBook.closingBalance} />
          </View>

          <View style={styles.card}>
            <View style={styles.tableRow}>
              <Text style={[styles.tableHead, styles.tableFirst]} />
              {(['opening', 'in', 'out', 'closing'] as const).map((col) => (
                <Text key={col} style={styles.tableHead} numberOfLines={1}>
                  {t(`ledger.dayBook.${col}`)}
                </Text>
              ))}
            </View>
            {bucketRows.map(({ key, label, bucket }) => (
              <View key={key} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.tableFirst]} numberOfLines={1}>
                  {label}
                </Text>
                {[bucket.opening, bucket.inflow, bucket.outflow, bucket.closing].map((amount, i) => (
                  <Text key={i} style={styles.tableCell} numberOfLines={1} adjustsFontSizeToFit>
                    {formatLedgerRupees(amount)}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </>
      ) : null}
    </>
  );

  const entriesHeader = (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {PERIODS.map((p) => {
          const selected = period === p;
          return (
            <Pressable
              key={p}
              style={[styles.chip, selected && { backgroundColor: accent.base }]}
              onPress={() => setPeriod(p)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.chipText, selected && styles.chipTextActive]}>{periodLabel(p)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {period === 'custom' ? (
        <View style={styles.pairRow}>
          <View style={styles.pairItem}>
            <DatePickerField
              label={t('ledger.entries.from')}
              value={customFrom}
              onChange={setCustomFrom}
              maximumDate={parseIsoDate(today)}
            />
          </View>
          <View style={styles.pairItem}>
            <DatePickerField
              label={t('ledger.entries.to')}
              value={customTo}
              onChange={setCustomTo}
              maximumDate={parseIsoDate(today)}
            />
          </View>
        </View>
      ) : null}
      {rangeErrorKey ? <ErrorNotice message={t(rangeErrorKey)} /> : null}

      <View style={styles.pairRow}>
        <View style={styles.pairItem}>
          <Dropdown label={t('ledger.entries.category')} value={category} options={categoryOptions(t)} onSelect={setCategory} />
        </View>
        <View style={styles.pairItem}>
          <Dropdown label={t('ledger.entries.method')} value={method} options={methodOptions(t)} onSelect={setMethod} />
        </View>
      </View>

      {entriesError ? <ErrorNotice message={entriesError} /> : null}

      {summary && entriesReady ? (
        <View style={styles.card}>
          <View style={styles.statLine}>
            <MoneyStat label={t('ledger.entries.totals.in')} value={summary.totalInflow} tone="in" flat />
            <MoneyStat label={t('ledger.entries.totals.out')} value={summary.totalOutflow} tone="out" flat />
            <MoneyStat label={t('ledger.entries.totals.net')} value={summary.netBalance} flat />
          </View>
          <View style={styles.statLine}>
            <MoneyStat label={t('ledger.entries.totals.cashNet')} value={summary.cash.net} flat />
            <MoneyStat label={t('ledger.entries.totals.bankNet')} value={summary.bank.net} flat />
            {summary.unspecified.net !== 0 ? (
              <MoneyStat label={t('ledger.entries.totals.unspecifiedNet')} value={summary.unspecified.net} flat />
            ) : null}
          </View>
          {summary.openingBalance !== null && summary.openingBalance !== undefined ? (
            <View style={styles.statLine}>
              <MoneyStat label={t('ledger.entries.totals.opening')} value={summary.openingBalance} flat />
              <MoneyStat label={t('ledger.entries.totals.closing')} value={summary.closingBalance} flat />
            </View>
          ) : null}
        </View>
      ) : null}

      {entriesReady && entries.length > 0 ? (
        <Text style={styles.countLine}>
          {t('ledger.entries.count', { shown: entries.length, total: Math.max(totalEntries, entries.length) })}
        </Text>
      ) : null}
    </>
  );

  const header = (
    <View style={styles.headerBlock}>
      <View style={styles.findRow}>
        <View style={styles.findInput}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder={t('ledger.find.placeholder')}
            onSubmit={handleFind}
          />
        </View>
        <Pressable
          style={[styles.findButton, (!normalizeReceiptQuery(query) || finding) && styles.disabled]}
          onPress={handleFind}
          disabled={!normalizeReceiptQuery(query) || finding}
          accessibilityRole="button"
          accessibilityLabel={t('ledger.find.button')}
        >
          {finding ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Text style={styles.findButtonText}>{t('ledger.find.button')}</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {(['dayBook', 'entries'] as const).map((key) => {
          const selected = tab === key;
          return (
            <Pressable
              key={key}
              style={[styles.tab, selected && styles.tabActive]}
              onPress={() => setTab(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.tabText, selected && styles.tabTextActive]}>{t(`ledger.tabs.${key}`)}</Text>
            </Pressable>
          );
        })}
      </View>

      {tab === 'dayBook' ? dayBookHeader : entriesHeader}
    </View>
  );

  const loading = tab === 'dayBook' ? dayLoading : entriesState === 'loading';
  const rows = tab === 'dayBook' ? (dayBook?.entries ?? []) : entriesReady ? entries : [];

  const empty = loading ? (
    <ActivityIndicator style={styles.loader} color={accent.base} />
  ) : tab === 'dayBook' ? (
    dayBook ? (
      <Text style={styles.empty}>{t('ledger.dayBook.empty', { date: formatLedgerDate(date, t, true) })}</Text>
    ) : null
  ) : entriesReady ? (
    <Text style={styles.empty}>{t('ledger.entries.empty')}</Text>
  ) : null;

  const footer =
    tab === 'dayBook' ? (
      dayBook?.entriesTruncated ? <Text style={styles.note}>{t('ledger.dayBook.truncated')}</Text> : null
    ) : hasNext && entriesReady ? (
      <Pressable
        style={[styles.loadMore, loadingMore && styles.disabled]}
        onPress={handleLoadMore}
        disabled={loadingMore}
        accessibilityRole="button"
        accessibilityLabel={t('ledger.entries.loadMore')}
      >
        {loadingMore ? (
          <ActivityIndicator color={accent.base} size="small" />
        ) : (
          <Text style={styles.loadMoreText}>{t('ledger.entries.loadMore')}</Text>
        )}
      </Pressable>
    ) : null;

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('ledger.title')} subtitle={t('ledger.subtitle')} onBack={() => navigation.goBack()} />
      <FlatList
        data={loading ? [] : rows}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <LedgerRow tx={item} t={t} onPress={() => openEntry(item)} />}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={[styles.listContent, { paddingBottom: listBottom }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  listContent: { paddingHorizontal: spacing.lg },
  headerBlock: { paddingTop: spacing.lg },
  findRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  findInput: { flex: 1 },
  findButton: {
    backgroundColor: accent.base,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  findButtonText: { color: colors.white, fontWeight: '700' },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    padding: spacing.xs,
    marginBottom: spacing.md,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.pill },
  tabActive: { backgroundColor: colors.surface, ...softShadow },
  tabText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  tabTextActive: { color: accent.base },
  dateRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  datePicker: { flex: 1 },
  dayButton: {
    width: 44,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  dayButtonText: { fontSize: 24, fontWeight: '700', color: accent.base },
  disabled: { opacity: 0.4 },
  stat: { flex: 1, minWidth: 0 },
  statCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...softShadow,
  },
  statLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  statValue: { fontSize: 17, fontWeight: '800', marginTop: 2 },
  statLine: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  statLineLast: { marginBottom: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...softShadow,
  },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs },
  tableFirst: { flex: 1.1, textAlign: 'left' },
  tableHead: { flex: 1, fontSize: 11, fontWeight: '700', color: colors.textMuted, textAlign: 'right' },
  tableCell: { flex: 1, fontSize: 11, color: colors.textPrimary, textAlign: 'right' },
  chipRow: { gap: spacing.sm, paddingVertical: spacing.xs, marginBottom: spacing.md },
  chip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  chipTextActive: { color: colors.white },
  pairRow: { flexDirection: 'row', gap: spacing.sm },
  pairItem: { flex: 1 },
  countLine: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
    ...softShadow,
  },
  rowMain: { flex: 1 },
  rowDate: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  rowLabel: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginTop: 2 },
  rowNotes: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  rowMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  rowNumber: { fontSize: 12, color: colors.textMuted, marginRight: spacing.xs },
  struck: { textDecorationLine: 'line-through' },
  rowSide: { alignItems: 'flex-end', gap: spacing.xs },
  rowAmount: { fontSize: 15, fontWeight: '800' },
  methodChip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  methodChipText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  loader: { marginTop: spacing.lg },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  note: { color: colors.textMuted, textAlign: 'center', fontSize: 12, marginVertical: spacing.md },
  loadMore: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: accent.light,
    marginTop: spacing.sm,
  },
  loadMoreText: { color: accent.base, fontWeight: '700' },
});
