import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ApiError } from '../../api/client';
import { getErrorMessage } from '../../api/errorMessage';
import { getMyChildrenTrips, getTripLocation } from '../../api/transport';
import { subscribeToBusLocation } from '../../api/transportSocket';
import type { BusLocation, MyChildTrip } from '../../api/types';
import { BusMap } from '../../components/BusMap';
import { ErrorNotice } from '../../components/ErrorNotice';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { formatAgo } from '../../transport/labels';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'MyBus'>;

/** Polled as well as live, so the map still moves if the live connection drops. */
const LOCATION_POLL_MS = 20_000;
const TRIPS_POLL_MS = 60_000;

function newest(a: BusLocation | null, b: BusLocation | null): BusLocation | null {
  if (!a || !b) return a ?? b;
  return new Date(a.at) >= new Date(b.at) ? a : b;
}

interface TripGroup {
  tripId: string;
  busName: string;
  busRegistrationNumber: string | null;
  driverName: string | null;
  direction: MyChildTrip['direction'];
  startedAt: string | null;
  children: string[];
  lastLocation: BusLocation | null;
}

/** A student's or parent's view of the bus their child is on right now, with a live map. */
export function MyBusScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const [trips, setTrips] = useState<MyChildTrip[] | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  // The newest position heard live or by polling; the trip list's own copy is used until then.
  const [liveLocation, setLiveLocation] = useState<BusLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [, setTick] = useState(0);

  const loadTrips = useCallback(() => {
    return getMyChildrenTrips(schoolId)
      .then((rows) => {
        setTrips(rows);
        setError(null);
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, [schoolId]);

  useEffect(() => {
    loadTrips();
    const interval = setInterval(loadTrips, TRIPS_POLL_MS);
    const unsubscribe = navigation.addListener('focus', loadTrips);
    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [loadTrips, navigation]);

  // Siblings on the same bus share one card.
  const groups = useMemo<TripGroup[]>(() => {
    const byTrip = new Map<string, TripGroup>();
    for (const row of trips ?? []) {
      const group = byTrip.get(row.tripId);
      if (group) {
        group.children.push(row.studentName);
      } else {
        byTrip.set(row.tripId, {
          tripId: row.tripId,
          busName: row.busName,
          busRegistrationNumber: row.busRegistrationNumber,
          driverName: row.driverName,
          direction: row.direction,
          startedAt: row.startedAt,
          children: [row.studentName],
          lastLocation: row.lastLocation,
        });
      }
    }
    return [...byTrip.values()];
  }, [trips]);

  const selected = groups.find((g) => g.tripId === selectedTripId) ?? groups[0] ?? null;
  const tripId = selected?.tripId ?? null;

  const location = newest(liveLocation?.tripId === tripId ? liveLocation : null, selected?.lastLocation ?? null);

  useEffect(() => {
    if (!tripId) return;
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;
    const keepNewest = (next: BusLocation | null) => {
      if (!next || cancelled) return;
      setLiveLocation((current) => (current?.tripId === next.tripId ? newest(current, next) : next));
    };
    subscribeToBusLocation(schoolId, tripId, keepNewest)
      .then((unsub) => {
        if (cancelled) unsub();
        else unsubscribe = unsub;
      })
      .catch(() => {});
    const poll = setInterval(() => {
      getTripLocation(schoolId, tripId)
        .then(keepNewest)
        .catch((e) => {
          // The trip ended (or the child got off): refresh the list rather than show a stale bus.
          if (e instanceof ApiError && e.status === 403) loadTrips();
        });
    }, LOCATION_POLL_MS);
    return () => {
      cancelled = true;
      unsubscribe?.();
      clearInterval(poll);
    };
  }, [schoolId, tripId, loadTrips]);

  // Re-render "updated 20s ago" as time passes.
  useEffect(() => {
    const interval = setInterval(() => setTick((n) => n + 1), 10_000);
    return () => clearInterval(interval);
  }, []);

  const refresh = () => {
    setRefreshing(true);
    loadTrips().finally(() => setRefreshing(false));
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('transport.myBus.title')} onBack={() => navigation.goBack()} />
      <ScreenContainer refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        {error && <ErrorNotice message={error} />}
        {trips === null && !error && <ActivityIndicator color={colors.primary} style={styles.loading} />}
        {trips !== null && groups.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🚌</Text>
            <Text style={styles.emptyTitle}>{t('transport.myBus.empty')}</Text>
            <Text style={styles.emptyHint}>{t('transport.myBus.emptyHint')}</Text>
          </View>
        )}

        {groups.length > 1 && (
          <View style={styles.tabs}>
            {groups.map((g) => (
              <Pressable
                key={g.tripId}
                style={[styles.tab, g.tripId === selected?.tripId && styles.tabActive]}
                onPress={() => setSelectedTripId(g.tripId)}
              >
                <Text style={[styles.tabText, g.tripId === selected?.tripId && styles.tabTextActive]}>{g.busName}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {selected && (
          <>
            <View style={styles.card}>
              <Text style={styles.onBoard}>
                {t('transport.myBus.onBoard', { names: selected.children.join(', '), bus: selected.busName })}
              </Text>
              <Text style={styles.meta}>
                {t(`transport.direction.${selected.direction}`)}
                {selected.busRegistrationNumber ? ` · ${selected.busRegistrationNumber}` : ''}
              </Text>
              {selected.driverName && (
                <Text style={styles.meta}>{t('transport.myBus.driver', { name: selected.driverName })}</Text>
              )}
            </View>
            <BusMap location={location} height={380} />
            <Text style={styles.updated}>
              {location
                ? t('transport.myBus.lastUpdated', { ago: formatAgo(location.at, t) })
                : t('transport.myBus.noLocationYet')}
            </Text>
          </>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.lg,
    ...softShadow,
  },
  emptyIcon: { fontSize: 40, marginBottom: spacing.sm },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  emptyHint: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  tab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontWeight: '700', color: colors.textSecondary },
  tabTextActive: { color: colors.white },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...softShadow,
  },
  onBoard: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  meta: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  updated: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
});
