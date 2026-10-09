import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getErrorMessage } from '../../api/errorMessage';
import { cancelTrip, endTrip, getTrip } from '../../api/transport';
import { subscribeToBusLocation } from '../../api/transportSocket';
import type { BusLocation, BusTrip } from '../../api/types';
import { BusMap } from '../../components/BusMap';
import { ErrorNotice } from '../../components/ErrorNotice';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import { boardingLabel, classLabel, formatAgo, formatTime } from '../../transport/labels';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'BusTripDetail'>;

/** Admin: one trip - where the bus is, who was on it, and ending a trip the driver forgot. */
export function BusTripDetailScreen({ navigation, route }: Props) {
  const { t, i18n } = useTranslation();
  const schoolId = useSchoolId();
  const { tripId } = route.params;
  const [trip, setTrip] = useState<BusTrip | null>(null);
  const [location, setLocation] = useState<BusLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const load = useCallback(() => {
    getTrip(schoolId, tripId)
      .then((next) => {
        setTrip(next);
        setLocation((current) =>
          current && next.lastLocation && new Date(current.at) > new Date(next.lastLocation.at) ? current : next.lastLocation
        );
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, [schoolId, tripId]);

  useEffect(() => {
    load();
  }, [load]);

  const running = trip?.status === 'ACTIVE';
  useEffect(() => {
    if (!running) return;
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;
    subscribeToBusLocation(schoolId, tripId, (next) => {
      if (!cancelled) setLocation(next);
    })
      .then((unsub) => {
        if (cancelled) unsub();
        else unsubscribe = unsub;
      })
      .catch(() => {});
    const poll = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      unsubscribe?.();
      clearInterval(poll);
    };
  }, [running, schoolId, tripId, load]);

  const confirm = (title: string, body: string, action: () => Promise<unknown>) => {
    Alert.alert(title, body, [
      { text: t('common.back'), style: 'cancel' },
      {
        text: title,
        style: 'destructive',
        onPress: async () => {
          setWorking(true);
          try {
            await action();
          } catch (e) {
            setError(getErrorMessage(e));
          } finally {
            setWorking(false);
          }
        },
      },
    ]);
  };

  const boarded = trip?.students.filter((s) => s.status === 'BOARDED').length ?? 0;

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={trip ? `${trip.busName} · ${t(`transport.direction.${trip.direction}`)}` : t('transport.admin.title')}
        subtitle={trip?.driverName ?? undefined}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        {error && <ErrorNotice message={error} />}
        {!trip && !error && <ActivityIndicator color={colors.primary} style={styles.loading} />}
        {trip && (
          <>
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>{t('transport.admin.boardedSummary', { boarded })}</Text>
                <StatusChip
                  label={trip.endedAutomatically ? t('transport.admin.endedAuto') : t(`transport.status.${trip.status}`)}
                  variant={trip.status === 'ACTIVE' ? 'success' : trip.endedAutomatically ? 'error' : 'neutral'}
                />
              </View>
              {trip.startedAt && (
                <Text style={styles.meta}>
                  {t('transport.admin.startedAt', { time: formatTime(trip.startedAt, i18n.language) })}
                  {trip.endedAt ? ` · ${t('transport.admin.endedAt', { time: formatTime(trip.endedAt, i18n.language) })}` : ''}
                </Text>
              )}
            </View>

            {running && (
              <>
                <BusMap location={location} />
                <Text style={styles.updated}>
                  {location ? t('transport.myBus.lastUpdated', { ago: formatAgo(location.at, t) }) : t('transport.myBus.noLocationYet')}
                </Text>
              </>
            )}

            <Text style={styles.sectionTitle}>{t('transport.admin.children')}</Text>
            {trip.students.length === 0 && <Text style={styles.empty}>{t('transport.driver.nobodyYet')}</Text>}
            {trip.students.map((row) => (
              <View key={row.studentId} style={styles.row}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle}>{row.name}</Text>
                  <Text style={styles.rowMeta}>{classLabel(row)}</Text>
                </View>
                <Text
                  style={[
                    styles.status,
                    row.status === 'BOARDED' && { color: colors.success },
                    row.status === 'NOT_BOARDED' && { color: colors.error },
                  ]}
                >
                  {boardingLabel(row, t, i18n.language)}
                </Text>
              </View>
            ))}

            {running && (
              <Pressable
                style={[styles.danger, working && styles.disabled]}
                disabled={working}
                onPress={() =>
                  confirm(t('transport.driver.endTrip'), t('transport.admin.endTripBody'), () => endTrip(schoolId, tripId).then(setTrip))
                }
              >
                <Text style={styles.dangerText}>{t('transport.driver.endTrip')}</Text>
              </Pressable>
            )}
            {trip.status === 'CHECKLIST' && (
              <Pressable
                style={[styles.danger, working && styles.disabled]}
                disabled={working}
                onPress={() =>
                  confirm(t('transport.driver.cancelTrip'), t('transport.driver.cancelTripBody'), () =>
                    cancelTrip(schoolId, tripId).then(() => navigation.goBack())
                  )
                }
              >
                <Text style={styles.dangerText}>{t('transport.driver.cancelTrip')}</Text>
              </Pressable>
            )}
          </>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  empty: { color: colors.textMuted, marginVertical: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...softShadow,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  meta: { fontSize: 13, color: colors.textSecondary, marginTop: spacing.xs },
  updated: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginVertical: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  rowMain: { flex: 1, marginRight: spacing.sm },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  rowMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  status: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, maxWidth: '50%', textAlign: 'right' },
  danger: { backgroundColor: colors.error, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.lg },
  dangerText: { color: colors.white, fontWeight: '800', fontSize: 15 },
  disabled: { opacity: 0.5 },
});
