import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getErrorMessage } from '../../api/errorMessage';
import {
  cancelTrip,
  dropStudent,
  endTrip,
  getTrip,
  markStudent,
  searchStudentsForBus,
  startReturnTrip,
  undoDrop,
  unmarkStudent,
} from '../../api/transport';
import type { BusTrip, DriverStudentResult, NotBoardedReason, TripStudent } from '../../api/types';
import { ErrorNotice } from '../../components/ErrorNotice';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SearchBar } from '../../components/SearchBar';
import { useSchoolId } from '../../context/SchoolContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import {
  onTrackingStatus,
  sendRemainingLocations,
  startBusTracking,
  stopBusTracking,
  trackedTripId,
  type TrackingStatus,
} from '../../transport/busTracking';
import { boardingLabel, classLabel, NOT_BOARDED_REASONS } from '../../transport/labels';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'DriverTrip'>;

/**
 * One trip, as the driver runs it. Morning: search a child and tap to add them as they board.
 * Return: mark everyone on the checklist boarded or not boarded (with a reason) before the trip can
 * start. While the trip runs, the phone shares its location (busTracking).
 */
export function DriverTripScreen({ navigation, route }: Props) {
  const { t, i18n } = useTranslation();
  const schoolId = useSchoolId();
  const { tripId } = route.params;
  const [trip, setTrip] = useState<BusTrip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  const [results, setResults] = useState<DriverStudentResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [reason, setReason] = useState<NotBoardedReason | null>(null);
  const [note, setNote] = useState('');
  const [working, setWorking] = useState(false);
  const [tracking, setTracking] = useState<TrackingStatus | null>(null);

  const load = useCallback(() => {
    return getTrip(schoolId, tripId)
      .then((next) => {
        setTrip(next);
        setError(null);
        return next;
      })
      .catch((e) => {
        setError(getErrorMessage(e));
        return null;
      });
  }, [schoolId, tripId]);

  useEffect(() => onTrackingStatus(setTracking), []);

  // Opening a running trip (after an app restart, say) resumes sharing location if it had stopped.
  useEffect(() => {
    load().then(async (loaded) => {
      if (loaded?.status !== 'ACTIVE') return;
      if ((await trackedTripId()) !== loaded.id || !tracking?.mode) {
        startBusTracking(schoolId, loaded.id).catch((e) => setError(getErrorMessage(e)));
      }
    });
  }, [load, schoolId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tracking stopped itself because the server refused the trip (an admin ended it, say).
  useEffect(() => {
    if (tracking?.stoppedReason) load();
  }, [tracking?.stoppedReason, load]);

  const canAdd = trip?.status === 'ACTIVE' ? trip.direction === 'MORNING' : trip?.status === 'CHECKLIST';

  const searchable = canAdd && debouncedQuery.length >= 2;
  useEffect(() => {
    if (!searchable) return;
    let cancelled = false;
    searchStudentsForBus(schoolId, debouncedQuery)
      .then((rows) => {
        if (!cancelled) setResults(rows);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [schoolId, debouncedQuery, searchable]);

  const visibleResults = searchable ? results : [];

  const onTrip = useMemo(() => new Set(trip?.students.map((s) => s.studentId) ?? []), [trip]);
  const boarded = trip?.students.filter((s) => s.status === 'BOARDED') ?? [];
  const unmarked = trip?.students.filter((s) => s.status === null) ?? [];

  const act = async (studentId: string, action: () => Promise<BusTrip>) => {
    setBusyId(studentId);
    setError(null);
    try {
      setTrip(await action());
      return true;
    } catch (e) {
      setError(getErrorMessage(e));
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const add = async (student: DriverStudentResult) => {
    if (await act(student.studentId, () => markStudent(schoolId, tripId, student.studentId, { status: 'BOARDED' }))) {
      setQuery('');
    }
  };

  const markBoarded = (row: TripStudent) =>
    act(row.studentId, () => markStudent(schoolId, tripId, row.studentId, { status: 'BOARDED' }));

  const undo = (row: TripStudent) => act(row.studentId, () => unmarkStudent(schoolId, tripId, row.studentId));

  const markDropped = (row: TripStudent) => act(row.studentId, () => dropStudent(schoolId, tripId, row.studentId));

  const undoDropped = (row: TripStudent) => act(row.studentId, () => undoDrop(schoolId, tripId, row.studentId));

  const openReason = (row: TripStudent) => {
    setReasonFor(row.studentId);
    setReason(null);
    setNote('');
  };

  const saveNotBoarded = async (row: TripStudent) => {
    if (!reason) return;
    const ok = await act(row.studentId, () =>
      markStudent(schoolId, tripId, row.studentId, {
        status: 'NOT_BOARDED',
        reason,
        note: reason === 'OTHER' ? note.trim() : undefined,
      })
    );
    if (ok) setReasonFor(null);
  };

  const startHome = async () => {
    setWorking(true);
    setError(null);
    try {
      const started = await startReturnTrip(schoolId, tripId);
      setTrip(started);
      await startBusTracking(schoolId, started.id).catch((e) => setError(getErrorMessage(e)));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setWorking(false);
    }
  };

  const confirmEnd = () => {
    // On the trip home, warn about children nobody marked dropped - their families won't be told.
    const notDropped = trip?.direction === 'RETURN' ? boarded.filter((s) => !s.droppedAt) : [];
    const body = notDropped.length
      ? t('transport.driver.endWithUndropped', { count: notDropped.length, names: notDropped.map((s) => s.name).join(', ') })
      : t('transport.driver.endTripBody');
    Alert.alert(t('transport.driver.endTripTitle'), body, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('transport.driver.endTrip'),
        style: 'destructive',
        onPress: async () => {
          setWorking(true);
          setError(null);
          try {
            await sendRemainingLocations();
            await endTrip(schoolId, tripId);
            await stopBusTracking();
            navigation.navigate('DriverHome');
          } catch (e) {
            setError(getErrorMessage(e));
          } finally {
            setWorking(false);
          }
        },
      },
    ]);
  };

  const confirmCancel = () => {
    Alert.alert(t('transport.driver.cancelTripTitle'), t('transport.driver.cancelTripBody'), [
      { text: t('common.back'), style: 'cancel' },
      {
        text: t('transport.driver.cancelTrip'),
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelTrip(schoolId, tripId);
            navigation.navigate('DriverHome');
          } catch (e) {
            setError(getErrorMessage(e));
          }
        },
      },
    ]);
  };

  const title = trip ? `${trip.busName} · ${t(`transport.direction.${trip.direction}`)}` : t('transport.driver.homeTitle');

  const renderRow = (row: TripStudent) => {
    const busy = busyId === row.studentId;
    const checklist = trip?.status === 'CHECKLIST';
    const morning = trip?.direction === 'MORNING' && trip.status === 'ACTIVE';
    const goingHome = trip?.direction === 'RETURN' && trip.status === 'ACTIVE' && row.status === 'BOARDED';
    return (
      <View key={row.studentId} style={styles.row}>
        <View style={styles.rowTop}>
          <View style={styles.rowMain}>
            <Text style={styles.rowName}>
              {row.name}
              {row.extra ? <Text style={styles.extra}>  {t('transport.driver.addedByHand')}</Text> : null}
            </Text>
            <Text style={styles.rowMeta}>{classLabel(row)}</Text>
            {!morning && (
              <Text
                style={[
                  styles.rowStatus,
                  row.status === 'BOARDED' && styles.statusBoarded,
                  row.status === 'NOT_BOARDED' && styles.statusNotBoarded,
                  row.droppedAt != null && styles.statusDropped,
                ]}
              >
                {boardingLabel(row, t, i18n.language)}
              </Text>
            )}
          </View>
          {busy && <ActivityIndicator color={colors.primary} />}
          {!busy && (morning || (checklist && row.status !== null)) && (
            <Pressable style={styles.undoButton} onPress={() => undo(row)}>
              <Text style={styles.undoText}>{morning ? t('common.remove') : t('transport.driver.change')}</Text>
            </Pressable>
          )}
          {!busy && goingHome && row.droppedAt && (
            <Pressable style={styles.undoButton} onPress={() => undoDropped(row)}>
              <Text style={styles.undoText}>{t('transport.driver.undo')}</Text>
            </Pressable>
          )}
        </View>
        {!busy && goingHome && !row.droppedAt && (
          <Pressable style={[styles.markButton, styles.markDropped]} onPress={() => markDropped(row)}>
            <Text style={styles.markText}>🏠 {t('transport.driver.markDropped')}</Text>
          </Pressable>
        )}
        {checklist && row.status === null && !busy && reasonFor !== row.studentId && (
          <View style={styles.markButtons}>
            <Pressable style={[styles.markButton, styles.markBoarded]} onPress={() => markBoarded(row)}>
              <Text style={styles.markText}>✓ {t('transport.boarding.boarded')}</Text>
            </Pressable>
            <Pressable style={[styles.markButton, styles.markNotBoarded]} onPress={() => openReason(row)}>
              <Text style={styles.markText}>✕ {t('transport.boarding.notBoarded')}</Text>
            </Pressable>
          </View>
        )}
        {reasonFor === row.studentId && (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonTitle}>{t('transport.driver.chooseReason', { name: row.name })}</Text>
            <View style={styles.reasonChips}>
              {NOT_BOARDED_REASONS.map((r) => (
                <Pressable key={r} style={[styles.reasonChip, reason === r && styles.reasonChipActive]} onPress={() => setReason(r)}>
                  <Text style={[styles.reasonChipText, reason === r && styles.reasonChipTextActive]}>
                    {t(`transport.reasons.${r}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
            {reason === 'OTHER' && (
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder={t('transport.driver.notePlaceholder')}
                placeholderTextColor={colors.textMuted}
                maxLength={300}
              />
            )}
            <View style={styles.markButtons}>
              <Pressable style={[styles.markButton, styles.cancelReason]} onPress={() => setReasonFor(null)}>
                <Text style={styles.cancelReasonText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.markButton,
                  styles.markNotBoarded,
                  (!reason || (reason === 'OTHER' && !note.trim())) && styles.disabled,
                ]}
                disabled={!reason || (reason === 'OTHER' && !note.trim())}
                onPress={() => saveNotBoarded(row)}
              >
                <Text style={styles.markText}>{t('common.save')}</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={title} onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('DriverHome'))} />
      <ScreenContainer keyboardShouldPersistTaps="handled">
        {error && <ErrorNotice message={error} />}
        {!trip && !error && <ActivityIndicator color={colors.primary} style={styles.loading} />}

        {trip?.status === 'ACTIVE' && (
          <View style={[styles.banner, tracking?.mode ? styles.bannerOn : styles.bannerOff]}>
            <Text style={styles.bannerText}>
              {tracking?.mode === 'background'
                ? t('transport.driver.sharingLocation')
                : tracking?.mode === 'foreground'
                  ? t('transport.driver.sharingForeground')
                  : t('transport.driver.notSharing')}
            </Text>
            {tracking && tracking.pending > 3 && (
              <Text style={styles.bannerSub}>{t('transport.driver.queued', { count: tracking.pending })}</Text>
            )}
            {!tracking?.mode && (
              <Pressable onPress={() => startBusTracking(schoolId, tripId).catch((e) => setError(getErrorMessage(e)))}>
                <Text style={styles.bannerAction}>{t('transport.driver.shareLocation')}</Text>
              </Pressable>
            )}
          </View>
        )}

        {trip?.status === 'ENDED' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('transport.driver.tripEnded')}</Text>
            <Pressable style={styles.primary} onPress={() => navigation.navigate('DriverHome')}>
              <Text style={styles.primaryText}>{t('transport.driver.backHome')}</Text>
            </Pressable>
          </View>
        )}

        {trip && canAdd && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {trip.direction === 'MORNING' ? t('transport.driver.addBoarding') : t('transport.driver.addExtra')}
            </Text>
            <SearchBar
              value={query}
              onChangeText={(text) => {
                setQuery(text);
                setSearching(text.trim().length >= 2);
              }}
              placeholder={t('transport.driver.searchPlaceholder')}
            />
            {searching && <ActivityIndicator color={colors.primary} />}
            {visibleResults.map((student) => {
              const already = onTrip.has(student.studentId);
              return (
                <Pressable
                  key={student.studentId}
                  style={[styles.result, already && styles.disabled]}
                  disabled={already || busyId !== null}
                  onPress={() => add(student)}
                >
                  <View style={styles.rowMain}>
                    <Text style={styles.rowName}>{student.name}</Text>
                    <Text style={styles.rowMeta}>{classLabel(student)}</Text>
                  </View>
                  {busyId === student.studentId ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <Text style={styles.addText}>{already ? t('transport.driver.onList') : `+ ${t('transport.driver.add')}`}</Text>
                  )}
                </Pressable>
              );
            })}
            {searchable && !searching && visibleResults.length === 0 && (
              <Text style={styles.empty}>{t('transport.driver.noMatch')}</Text>
            )}
          </View>
        )}

        {trip && (
          <>
            <Text style={styles.sectionTitle}>
              {trip.status === 'CHECKLIST'
                ? t('transport.driver.checklistTitle', { left: unmarked.length, total: trip.students.length })
                : trip.direction === 'RETURN'
                  ? t('transport.driver.droppedCount', { dropped: boarded.filter((s) => s.droppedAt).length, total: boarded.length })
                  : t('transport.driver.onBoardCount', { count: boarded.length })}
            </Text>
            {trip.students.length === 0 && <Text style={styles.empty}>{t('transport.driver.nobodyYet')}</Text>}
            {(trip.direction === 'MORNING'
              ? boarded
              : trip.status === 'CHECKLIST'
                ? [...unmarked, ...trip.students.filter((s) => s.status !== null)]
                : // Trip home: still on the bus first, then dropped, then those who never boarded.
                  [
                    ...boarded.filter((s) => !s.droppedAt),
                    ...boarded.filter((s) => s.droppedAt),
                    ...trip.students.filter((s) => s.status !== 'BOARDED'),
                  ]
            ).map(renderRow)}
          </>
        )}

        {trip?.status === 'CHECKLIST' && (
          <>
            <Pressable
              style={[styles.primary, (unmarked.length > 0 || working) && styles.disabled]}
              disabled={unmarked.length > 0 || working}
              onPress={startHome}
            >
              {working ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryText}>
                  {unmarked.length > 0
                    ? t('transport.driver.markEveryone', { count: unmarked.length })
                    : t('transport.driver.startTripHome')}
                </Text>
              )}
            </Pressable>
            <Pressable style={styles.secondary} onPress={confirmCancel}>
              <Text style={styles.secondaryText}>{t('transport.driver.cancelTrip')}</Text>
            </Pressable>
          </>
        )}

        {trip?.status === 'ACTIVE' && (
          <Pressable style={[styles.endButton, working && styles.disabled]} disabled={working} onPress={confirmEnd}>
            {working ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>{t('transport.driver.endTrip')}</Text>}
          </Pressable>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  empty: { color: colors.textMuted, marginVertical: spacing.sm },
  banner: { borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  bannerOn: { backgroundColor: '#E8F5E9' },
  bannerOff: { backgroundColor: '#FFF3E0' },
  bannerText: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  bannerSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  bannerAction: { fontSize: 14, fontWeight: '800', color: colors.primary, marginTop: spacing.xs },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...softShadow,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.sm },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginVertical: spacing.sm },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  addText: { fontSize: 15, fontWeight: '800', color: colors.primary },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center' },
  rowMain: { flex: 1, marginRight: spacing.sm },
  rowName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  extra: { fontSize: 12, fontWeight: '700', color: colors.primary },
  rowMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  rowStatus: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginTop: spacing.xs },
  statusBoarded: { color: colors.success },
  statusNotBoarded: { color: colors.error },
  undoButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  undoText: { color: colors.textSecondary, fontWeight: '700' },
  markButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  markButton: { flex: 1, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  markBoarded: { backgroundColor: colors.success },
  markNotBoarded: { backgroundColor: colors.error },
  markDropped: { backgroundColor: colors.primary, marginTop: spacing.md, flex: 0 },
  statusDropped: { color: colors.primary },
  markText: { color: colors.white, fontWeight: '800', fontSize: 15 },
  reasonBox: { marginTop: spacing.md },
  reasonTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  reasonChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  reasonChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  reasonChipActive: { backgroundColor: colors.primary },
  reasonChipText: { fontWeight: '700', color: colors.textSecondary },
  reasonChipTextActive: { color: colors.white },
  noteInput: {
    marginTop: spacing.sm,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceMuted,
    color: colors.textPrimary,
    fontSize: 15,
  },
  cancelReason: { backgroundColor: colors.surfaceMuted },
  cancelReasonText: { color: colors.textSecondary, fontWeight: '800', fontSize: 15 },
  primary: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  primaryText: { color: colors.white, fontSize: 17, fontWeight: '800' },
  secondary: { alignItems: 'center', paddingVertical: spacing.lg },
  secondaryText: { color: colors.error, fontWeight: '700' },
  endButton: {
    backgroundColor: colors.error,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  disabled: { opacity: 0.5 },
});
