import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getErrorMessage } from '../../api/errorMessage';
import { getDriverHome, startTrip } from '../../api/transport';
import type { DriverHome, TripDirection } from '../../api/types';
import { AppVersionFooter } from '../../components/AppVersionFooter';
import { ErrorNotice } from '../../components/ErrorNotice';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import { startBusTracking } from '../../transport/busTracking';
import { formatTime } from '../../transport/labels';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'DriverHome'>;

/**
 * A driver's whole app: pick the bus, then start the trip to school, or the trip home (choosing
 * which of today's morning trips this bus is bringing back). A trip already running reopens.
 */
export function DriverHomeScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const schoolId = useSchoolId();
  const { session, logout } = useAuth();
  const [home, setHome] = useState<DriverHome | null>(null);
  const [busId, setBusId] = useState<string | null>(null);
  const [direction, setDirection] = useState<TripDirection | null>(null);
  const [morningTripIds, setMorningTripIds] = useState<string[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    return getDriverHome(schoolId)
      .then((next) => {
        setHome(next);
        setError(null);
        setBusId((current) => {
          if (current && next.buses.some((b) => b.id === current)) return current;
          return (next.buses.find((b) => b.defaultDriverId === session.ownerId) ?? next.buses[0])?.id ?? null;
        });
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, [schoolId, session.ownerId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      load();
    });
    load();
    return unsubscribe;
  }, [navigation, load]);

  // By default a bus brings home the children it brought in.
  const chooseReturn = (forBusId: string | null) => {
    setDirection('RETURN');
    setMorningTripIds(
      (home?.returnableMorningTrips ?? []).filter((trip) => trip.busId === forBusId).map((trip) => trip.tripId)
    );
  };

  const chooseBus = (nextBusId: string) => {
    setBusId(nextBusId);
    if (direction === 'RETURN') chooseReturn(nextBusId);
  };

  const toggleMorningTrip = (tripId: string) => {
    setMorningTripIds((ids) => (ids.includes(tripId) ? ids.filter((id) => id !== tripId) : [...ids, tripId]));
  };

  const start = async () => {
    if (!busId || !direction) return;
    setStarting(true);
    setError(null);
    try {
      const trip = await startTrip(schoolId, busId, direction, direction === 'RETURN' ? morningTripIds : undefined);
      if (trip.status === 'ACTIVE') {
        await startBusTracking(schoolId, trip.id).catch((e) => setError(getErrorMessage(e)));
      }
      setDirection(null);
      navigation.navigate('DriverTrip', { tripId: trip.id });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setStarting(false);
    }
  };

  const refresh = () => {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  };

  const current = home?.currentTrip ?? null;

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('transport.driver.homeTitle')} subtitle={session.username} showBadge={false} />
      <ScreenContainer refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        {error && <ErrorNotice message={error} />}
        {home === null && !error && <ActivityIndicator color={colors.primary} style={styles.loading} />}

        {current && (
          <Pressable style={[styles.card, styles.currentCard]} onPress={() => navigation.navigate('DriverTrip', { tripId: current.id })}>
            <Text style={styles.currentLabel}>{t('transport.driver.currentTrip')}</Text>
            <Text style={styles.currentTitle}>
              {current.busName} · {t(`transport.direction.${current.direction}`)}
            </Text>
            <Text style={styles.currentMeta}>
              {current.status === 'CHECKLIST'
                ? t('transport.driver.checklistOpen')
                : t('transport.driver.runningSince', { time: formatTime(current.startedAt, i18n.language) })}
            </Text>
            <Text style={styles.continue}>{t('transport.driver.continueTrip')} ›</Text>
          </Pressable>
        )}

        {home && !current && (
          <>
            <Text style={styles.sectionTitle}>{t('transport.driver.chooseBus')}</Text>
            {home.buses.length === 0 && <Text style={styles.empty}>{t('transport.driver.noBuses')}</Text>}
            <View style={styles.chips}>
              {home.buses.map((bus) => (
                <Pressable
                  key={bus.id}
                  style={[styles.chip, bus.id === busId && styles.chipActive]}
                  onPress={() => chooseBus(bus.id)}
                >
                  <Text style={[styles.chipText, bus.id === busId && styles.chipTextActive]}>{bus.name}</Text>
                  {bus.registrationNumber ? (
                    <Text style={[styles.chipSub, bus.id === busId && styles.chipTextActive]}>{bus.registrationNumber}</Text>
                  ) : null}
                </Pressable>
              ))}
            </View>

            {busId && (
              <>
                <Pressable
                  style={[styles.bigButton, direction === 'MORNING' && styles.bigButtonActive]}
                  onPress={() => setDirection('MORNING')}
                >
                  <Text style={styles.bigIcon}>🏫</Text>
                  <View style={styles.bigTextWrap}>
                    <Text style={styles.bigTitle}>{t('transport.driver.startMorning')}</Text>
                    <Text style={styles.bigSub}>{t('transport.driver.startMorningHint')}</Text>
                  </View>
                </Pressable>
                <Pressable
                  style={[styles.bigButton, direction === 'RETURN' && styles.bigButtonActive]}
                  onPress={() => chooseReturn(busId)}
                >
                  <Text style={styles.bigIcon}>🏠</Text>
                  <View style={styles.bigTextWrap}>
                    <Text style={styles.bigTitle}>{t('transport.driver.startReturn')}</Text>
                    <Text style={styles.bigSub}>{t('transport.driver.startReturnHint')}</Text>
                  </View>
                </Pressable>
              </>
            )}

            {direction === 'RETURN' && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{t('transport.driver.pickMorningTrips')}</Text>
                {home.returnableMorningTrips.length === 0 && (
                  <Text style={styles.empty}>{t('transport.driver.noMorningTrips')}</Text>
                )}
                {home.returnableMorningTrips.map((trip) => {
                  const picked = morningTripIds.includes(trip.tripId);
                  return (
                    <Pressable key={trip.tripId} style={styles.checkRow} onPress={() => toggleMorningTrip(trip.tripId)}>
                      <View style={[styles.checkbox, picked && styles.checkboxOn]}>{picked && <Text style={styles.tick}>✓</Text>}</View>
                      <View style={styles.checkText}>
                        <Text style={styles.rowTitle}>{trip.busName}</Text>
                        <Text style={styles.rowMeta}>
                          {t('transport.driver.morningTripMeta', {
                            count: trip.boardedCount,
                            driver: trip.driverName ?? '',
                            time: formatTime(trip.endedAt, i18n.language),
                          })}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {direction && (
              <Pressable style={[styles.primary, starting && styles.disabled]} onPress={start} disabled={starting}>
                {starting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.primaryText}>
                    {direction === 'MORNING' ? t('transport.driver.startNow') : t('transport.driver.openChecklist')}
                  </Text>
                )}
              </Pressable>
            )}
          </>
        )}

        {home && (
          <Pressable style={styles.historyButton} onPress={() => navigation.navigate('DriverPastTrips')}>
            <Text style={styles.historyText}>🕘 {t('transport.driver.pastTrips')}</Text>
          </Pressable>
        )}

        <Pressable style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>{t('common.logOut')}</Text>
        </Pressable>
        <AppVersionFooter onLongPress={() => navigation.navigate('PushDebug')} />
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  empty: { color: colors.textMuted, marginVertical: spacing.sm },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    minWidth: 96,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  chipSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  chipTextActive: { color: colors.white },
  bigButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
    ...softShadow,
  },
  bigButtonActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  bigIcon: { fontSize: 32, marginRight: spacing.md },
  bigTextWrap: { flex: 1 },
  bigTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  bigSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...softShadow,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.sm },
  currentCard: { backgroundColor: colors.primaryLight, borderWidth: 2, borderColor: colors.primary },
  currentLabel: { fontSize: 12, fontWeight: '800', color: colors.primary, textTransform: 'uppercase' },
  currentTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginTop: spacing.xs },
  currentMeta: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  continue: { fontSize: 15, fontWeight: '800', color: colors.primary, marginTop: spacing.sm },
  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  checkboxOn: { backgroundColor: colors.primary },
  tick: { color: colors.white, fontWeight: '900' },
  checkText: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  rowMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  primary: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  primaryText: { color: colors.white, fontSize: 17, fontWeight: '800' },
  disabled: { opacity: 0.6 },
  historyButton: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xl,
    ...softShadow,
  },
  historyText: { fontSize: 16, fontWeight: '800', color: colors.primary },
  logoutButton: { alignItems: 'center', paddingVertical: spacing.lg, marginTop: spacing.md },
  logoutText: { color: colors.error, fontWeight: '700', fontSize: 14 },
});
