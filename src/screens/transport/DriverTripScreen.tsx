import { FontAwesome5 } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
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
import { ScreenHeader } from '../../components/ScreenHeader';
import { SearchBar } from '../../components/SearchBar';
import { useSchoolId } from '../../context/SchoolContext';
import { useBottomInset } from '../../hooks/useBottomInset';
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
 *
 * The screen is built for a driver standing at the bus door, one-handed and often in sunlight: the
 * trip-ending action is pinned to a footer rather than buried under the list, the list is
 * virtualized and filterable, children already dealt with collapse into a "done" section, and the
 * reason picker opens as a sheet so the rows never shift under a thumb mid-tap.
 */
export function DriverTripScreen({ navigation, route }: Props) {
  const { t, i18n } = useTranslation();
  const schoolId = useSchoolId();
  const bottomInset = useBottomInset(spacing.md);
  const { tripId } = route.params;
  const [trip, setTrip] = useState<BusTrip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  const [results, setResults] = useState<DriverStudentResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasonFor, setReasonFor] = useState<TripStudent | null>(null);
  const [reason, setReason] = useState<NotBoardedReason | null>(null);
  const [note, setNote] = useState('');
  const [working, setWorking] = useState(false);
  const [showDone, setShowDone] = useState(false);
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

  const checklist = trip?.status === 'CHECKLIST';
  const morning = trip?.direction === 'MORNING' && trip.status === 'ACTIVE';
  const returning = trip?.direction === 'RETURN' && trip.status === 'ACTIVE';
  const canAdd = trip?.status === 'ACTIVE' ? trip.direction === 'MORNING' : checklist;

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

  const onTrip = useMemo(() => new Set(trip?.students.map((s) => s.studentId) ?? []), [trip]);
  const boarded = useMemo(() => trip?.students.filter((s) => s.status === 'BOARDED') ?? [], [trip]);
  const unmarked = useMemo(() => trip?.students.filter((s) => s.status === null) ?? [], [trip]);

  /**
   * Children still needing a tap now, and children already dealt with. What counts as "done"
   * depends on the leg: on the checklist it is anyone marked, going home it is anyone dropped off
   * or who never boarded, and on the trip to school nobody is done - the list is the record of who
   * is aboard.
   */
  const { pending, done } = useMemo(() => {
    if (!trip) return { pending: [] as TripStudent[], done: [] as TripStudent[] };
    if (checklist) {
      return { pending: unmarked, done: trip.students.filter((s) => s.status !== null) };
    }
    if (returning) {
      return {
        pending: boarded.filter((s) => !s.droppedAt),
        done: [...boarded.filter((s) => s.droppedAt), ...trip.students.filter((s) => s.status !== 'BOARDED')],
      };
    }
    return { pending: boarded, done: [] as TripStudent[] };
  }, [trip, checklist, returning, unmarked, boarded]);

  // The one search box does double duty: it narrows the children already on this trip, and (where
  // adding is allowed) offers children found on the server underneath.
  const needle = query.trim().toLowerCase();
  const matches = useCallback(
    (rows: TripStudent[]) => (needle ? rows.filter((s) => s.name.toLowerCase().includes(needle)) : rows),
    [needle]
  );
  const visiblePending = useMemo(() => matches(pending), [matches, pending]);
  const visibleDone = useMemo(() => matches(done), [matches, done]);
  const visibleResults = searchable ? results : [];

  // While filtering, a hidden "done" section would look like the child simply isn't there.
  const doneOpen = showDone || needle.length > 0;

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
    setReasonFor(row);
    setReason(null);
    setNote('');
  };

  const saveNotBoarded = async () => {
    const row = reasonFor;
    if (!row || !reason) return;
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

  /** Headline numbers for the progress strip: how far through this leg the driver is. */
  const progress = useMemo(() => {
    if (!trip) return null;
    if (checklist) {
      const total = trip.students.length;
      return { label: t('transport.driver.checklistTitle', { left: unmarked.length, total }), done: total - unmarked.length, total };
    }
    if (returning) {
      const dropped = boarded.filter((s) => s.droppedAt).length;
      return { label: t('transport.driver.droppedCount', { dropped, total: boarded.length }), done: dropped, total: boarded.length };
    }
    return { label: t('transport.driver.onBoardCount', { count: boarded.length }), done: 0, total: 0 };
  }, [trip, checklist, returning, unmarked.length, boarded, t]);

  const renderRow = ({ item }: { item: TripStudent }) => {
    const busy = busyId === item.studentId;
    const goingHome = returning && item.status === 'BOARDED';
    const dropped = item.droppedAt != null;
    return (
      <View style={[styles.row, dropped && styles.rowDone]}>
        <View style={styles.rowTop}>
          <View style={[styles.avatar, statusTint(item)]}>
            <FontAwesome5 name={statusIcon(item, morning)} size={14} color={statusColor(item)} />
          </View>
          <View style={styles.rowMain}>
            <Text style={styles.rowName} numberOfLines={1}>
              {item.name}
              {item.extra ? <Text style={styles.extra}>  {t('transport.driver.addedByHand')}</Text> : null}
            </Text>
            <Text style={styles.rowMeta}>{classLabel(item)}</Text>
            {!morning && (
              <Text
                style={[
                  styles.rowStatus,
                  item.status === 'BOARDED' && styles.statusBoarded,
                  item.status === 'NOT_BOARDED' && styles.statusNotBoarded,
                  dropped && styles.statusDropped,
                ]}
              >
                {boardingLabel(item, t, i18n.language)}
              </Text>
            )}
          </View>
          {busy && <ActivityIndicator color={colors.primary} />}
          {!busy && (morning || (checklist && item.status !== null)) && (
            <Pressable style={styles.undoButton} hitSlop={8} onPress={() => undo(item)}>
              <Text style={styles.undoText}>{morning ? t('common.remove') : t('transport.driver.change')}</Text>
            </Pressable>
          )}
          {!busy && goingHome && dropped && (
            <Pressable style={styles.undoButton} hitSlop={8} onPress={() => undoDropped(item)}>
              <Text style={styles.undoText}>{t('transport.driver.undo')}</Text>
            </Pressable>
          )}
        </View>

        {!busy && goingHome && !dropped && (
          <Pressable style={[styles.markButton, styles.markDropped]} onPress={() => markDropped(item)}>
            <FontAwesome5 name="home" size={14} color={colors.white} />
            <Text style={styles.markText}>{t('transport.driver.markDropped')}</Text>
          </Pressable>
        )}

        {checklist && item.status === null && !busy && (
          <View style={styles.markButtons}>
            <Pressable style={[styles.markButton, styles.markBoarded]} onPress={() => markBoarded(item)}>
              <FontAwesome5 name="check" size={14} color={colors.white} />
              <Text style={styles.markText}>{t('transport.boarding.boarded')}</Text>
            </Pressable>
            <Pressable style={[styles.markButton, styles.markNotBoarded]} onPress={() => openReason(item)}>
              <FontAwesome5 name="times" size={14} color={colors.white} />
              <Text style={styles.markText}>{t('transport.boarding.notBoarded')}</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  const listHeader = (
    <View>
      {error && <ErrorNotice message={error} />}

      {trip?.status === 'ENDED' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('transport.driver.tripEnded')}</Text>
        </View>
      )}

      {trip && canAdd && (
        <View style={styles.searchCard}>
          <SearchBar
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              setSearching(canAdd && text.trim().length >= 2);
            }}
            placeholder={t('transport.driver.searchPlaceholder')}
          />
          {searching && <ActivityIndicator color={colors.primary} />}
          {visibleResults.length > 0 && (
            <Text style={styles.addHint}>
              {trip.direction === 'MORNING' ? t('transport.driver.addBoarding') : t('transport.driver.addExtra')}
            </Text>
          )}
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

      {trip && !canAdd && trip.status === 'ACTIVE' && (
        <SearchBar value={query} onChangeText={setQuery} placeholder={t('transport.driver.searchPlaceholder')} />
      )}

      {trip && trip.students.length === 0 && <Text style={styles.empty}>{t('transport.driver.nobodyYet')}</Text>}
      {trip && trip.students.length > 0 && visiblePending.length === 0 && visibleDone.length === 0 && (
        <Text style={styles.empty}>{t('transport.driver.noMatch')}</Text>
      )}
    </View>
  );

  const listFooter = (
    <View>
      {visibleDone.length > 0 && (
        <>
          <Pressable style={styles.doneHeader} onPress={() => setShowDone((v) => !v)} disabled={needle.length > 0}>
            <Text style={styles.doneHeaderText}>{t('transport.driver.doneCount', { count: visibleDone.length })}</Text>
            {needle.length === 0 && (
              <FontAwesome5 name={doneOpen ? 'chevron-up' : 'chevron-down'} size={12} color={colors.textSecondary} />
            )}
          </Pressable>
          {doneOpen && visibleDone.map((row) => <View key={row.studentId}>{renderRow({ item: row })}</View>)}
        </>
      )}
    </View>
  );

  return (
    <View style={styles.root}>
      <ScreenHeader title={title} onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('DriverHome'))} />

      {/* Pinned above the list: whether parents can see the bus is the one thing never to scroll away. */}
      {trip?.status === 'ACTIVE' && (
        <View style={[styles.banner, tracking?.mode ? styles.bannerOn : styles.bannerOff]}>
          <FontAwesome5
            name={tracking?.mode ? 'map-marker-alt' : 'exclamation-triangle'}
            size={tracking?.mode ? 12 : 16}
            color={tracking?.mode ? colors.success : colors.warning}
          />
          <View style={styles.bannerMain}>
            <Text style={[styles.bannerText, !tracking?.mode && styles.bannerTextOff]}>
              {tracking?.mode === 'background'
                ? t('transport.driver.sharingLocation')
                : tracking?.mode === 'foreground'
                  ? t('transport.driver.sharingForeground')
                  : t('transport.driver.notSharing')}
            </Text>
            {tracking && tracking.pending > 3 && (
              <Text style={styles.bannerSub}>{t('transport.driver.queued', { count: tracking.pending })}</Text>
            )}
          </View>
          {!tracking?.mode && (
            <Pressable
              style={styles.bannerButton}
              onPress={() => startBusTracking(schoolId, tripId).catch((e) => setError(getErrorMessage(e)))}
            >
              <Text style={styles.bannerButtonText}>{t('transport.driver.shareLocation')}</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* The count and bar a driver glances at, held still above the scrolling list. */}
      {trip && progress && trip.status !== 'ENDED' && (
        <View style={styles.progress}>
          <Text style={styles.progressLabel}>{progress.label}</Text>
          {progress.total > 0 && (
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round((progress.done / progress.total) * 100)}%` }]} />
            </View>
          )}
        </View>
      )}

      {!trip && !error && <ActivityIndicator color={colors.primary} style={styles.loading} />}

      <FlatList
        data={visiblePending}
        keyExtractor={(item) => item.studentId}
        renderItem={renderRow}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        windowSize={11}
        removeClippedSubviews
      />

      {/* The trip-ending action, always under the driver's thumb instead of below the whole list. */}
      {trip && trip.status !== 'ENDED' && (
        <View style={[styles.footer, { paddingBottom: bottomInset }]}>
          {checklist ? (
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
          ) : (
            <Pressable style={[styles.endButton, working && styles.disabled]} disabled={working} onPress={confirmEnd}>
              {working ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>{t('transport.driver.endTrip')}</Text>}
            </Pressable>
          )}
        </View>
      )}

      {trip?.status === 'ENDED' && (
        <View style={[styles.footer, { paddingBottom: bottomInset }]}>
          <Pressable style={styles.primary} onPress={() => navigation.navigate('DriverHome')}>
            <Text style={styles.primaryText}>{t('transport.driver.backHome')}</Text>
          </Pressable>
        </View>
      )}

      {/* A sheet, not an inline panel: the rows behind it stay exactly where the thumb left them. */}
      <Modal visible={reasonFor !== null} transparent animationType="slide" onRequestClose={() => setReasonFor(null)}>
        <KeyboardAvoidingView style={styles.sheetRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.scrim} onPress={() => setReasonFor(null)} />
          <View style={[styles.sheet, { paddingBottom: bottomInset }]}>
            <View style={styles.grabber} />
            <Text style={styles.sheetTitle}>{t('transport.driver.chooseReason', { name: reasonFor?.name ?? '' })}</Text>
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
                autoFocus
              />
            )}
            <View style={styles.markButtons}>
              <Pressable style={[styles.markButton, styles.cancelReason]} onPress={() => setReasonFor(null)}>
                <Text style={styles.cancelReasonText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                style={[styles.markButton, styles.markNotBoarded, (!reason || (reason === 'OTHER' && !note.trim())) && styles.disabled]}
                disabled={!reason || (reason === 'OTHER' && !note.trim())}
                onPress={saveNotBoarded}
              >
                <Text style={styles.markText}>{t('common.save')}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

/** The leading icon on a row, saying at a glance what has happened to this child. */
function statusIcon(row: TripStudent, morning: boolean): string {
  if (row.droppedAt) return 'home';
  if (row.status === 'BOARDED') return morning ? 'check' : 'child';
  if (row.status === 'NOT_BOARDED') return 'times';
  return 'user';
}

function statusColor(row: TripStudent): string {
  if (row.droppedAt) return colors.success;
  if (row.status === 'BOARDED') return colors.primary;
  if (row.status === 'NOT_BOARDED') return colors.error;
  return colors.textMuted;
}

function statusTint(row: TripStudent) {
  if (row.droppedAt) return styles.avatarDone;
  if (row.status === 'BOARDED') return styles.avatarBoarded;
  if (row.status === 'NOT_BOARDED') return styles.avatarNot;
  return styles.avatarPlain;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  listContent: { padding: spacing.lg, paddingTop: spacing.md, flexGrow: 1 },
  empty: { color: colors.textMuted, marginVertical: spacing.sm },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  bannerOn: { backgroundColor: '#E6F4EA' },
  bannerOff: { backgroundColor: '#FEF3C7', paddingVertical: spacing.md },
  bannerMain: { flex: 1 },
  bannerText: { fontSize: 13, fontWeight: '700', color: colors.success },
  bannerTextOff: { fontSize: 14, fontWeight: '800', color: colors.warning },
  bannerSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  bannerButton: {
    backgroundColor: colors.warning,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  bannerButtonText: { color: colors.white, fontWeight: '800', fontSize: 14 },

  progress: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  progressLabel: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  track: { height: 6, borderRadius: radius.pill, backgroundColor: colors.border, marginTop: spacing.sm, overflow: 'hidden' },
  fill: { height: 6, borderRadius: radius.pill, backgroundColor: colors.primary },

  searchCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...softShadow,
  },
  addHint: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.xs },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...softShadow,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },

  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  rowDone: { backgroundColor: colors.surfaceMuted, shadowOpacity: 0, elevation: 0 },
  rowTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarPlain: { backgroundColor: colors.surfaceMuted },
  avatarBoarded: { backgroundColor: colors.primaryLight },
  avatarNot: { backgroundColor: '#FDE4E4' },
  avatarDone: { backgroundColor: '#E6F4EA' },
  rowMain: { flex: 1 },
  rowName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  extra: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  rowMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  rowStatus: { fontSize: 13, color: colors.textSecondary, marginTop: 2, fontWeight: '600' },
  statusBoarded: { color: colors.primary },
  statusNotBoarded: { color: colors.error },
  statusDropped: { color: colors.success },
  undoButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  undoText: { color: colors.primary, fontWeight: '800', fontSize: 14 },

  markButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  markButton: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    minHeight: 48,
  },
  markBoarded: { backgroundColor: colors.success },
  markNotBoarded: { backgroundColor: colors.error },
  markDropped: { backgroundColor: colors.success, marginTop: spacing.md },
  markText: { color: colors.white, fontWeight: '800', fontSize: 15 },
  cancelReason: { backgroundColor: colors.surfaceMuted },
  cancelReasonText: { color: colors.textSecondary, fontWeight: '800', fontSize: 15 },

  doneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  doneHeaderText: { fontSize: 14, fontWeight: '800', color: colors.textSecondary },

  result: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, minHeight: 52 },
  addText: { color: colors.primary, fontWeight: '800', fontSize: 15 },
  disabled: { opacity: 0.6 },

  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  primary: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  primaryText: { color: colors.white, fontSize: 17, fontWeight: '800' },
  endButton: {
    backgroundColor: colors.error,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  secondary: { alignItems: 'center', paddingVertical: spacing.md },
  secondaryText: { color: colors.error, fontWeight: '700', fontSize: 14 },

  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(32,26,43,0.45)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.md },
  reasonChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  reasonChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  reasonChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  reasonChipText: { color: colors.textPrimary, fontWeight: '700', fontSize: 15 },
  reasonChipTextActive: { color: colors.primary },
  noteInput: {
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    fontSize: 15,
    color: colors.textPrimary,
  },
});
