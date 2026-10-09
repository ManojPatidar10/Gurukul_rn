import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getErrorMessage } from '../../api/errorMessage';
import { getMyPastTrips } from '../../api/transport';
import type { TripSummary } from '../../api/types';
import { ErrorNotice } from '../../components/ErrorNotice';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import { formatTime } from '../../transport/labels';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'DriverPastTrips'>;

const STATUS_VARIANT = { CHECKLIST: 'warning', ACTIVE: 'success', ENDED: 'neutral' } as const;

/** A driver's own trip history, newest first, grouped by day. Tapping a trip shows who was on it. */
export function DriverPastTripsScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const schoolId = useSchoolId();
  const [trips, setTrips] = useState<TripSummary[] | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFirst = useCallback(() => {
    return getMyPastTrips(schoolId, 0)
      .then((res) => {
        setTrips(res.trips);
        setHasMore(res.hasMore);
        setPage(0);
        setError(null);
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, [schoolId]);

  useEffect(() => {
    loadFirst();
  }, [loadFirst]);

  const loadMore = () => {
    setLoadingMore(true);
    getMyPastTrips(schoolId, page + 1)
      .then((res) => {
        setTrips((prev) => [...(prev ?? []), ...res.trips]);
        setHasMore(res.hasMore);
        setPage(page + 1);
      })
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoadingMore(false));
  };

  const refresh = () => {
    setRefreshing(true);
    loadFirst().finally(() => setRefreshing(false));
  };

  const dayLabel = (date: string) =>
    new Date(`${date}T00:00:00`).toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('transport.driver.pastTrips')} onBack={() => navigation.goBack()} />
      <ScreenContainer refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        {error && <ErrorNotice message={error} />}
        {trips === null && !error && <ActivityIndicator color={colors.primary} style={styles.loading} />}
        {trips?.length === 0 && <Text style={styles.empty}>{t('transport.driver.noPastTrips')}</Text>}
        {trips?.map((trip, index) => {
          const newDay = index === 0 || trips[index - 1].serviceDate !== trip.serviceDate;
          return (
            <View key={trip.id}>
              {newDay && <Text style={styles.day}>{dayLabel(trip.serviceDate)}</Text>}
              <Pressable style={styles.row} onPress={() => navigation.navigate('DriverTrip', { tripId: trip.id })}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle}>
                    {trip.busName} · {t(`transport.direction.${trip.direction}`)}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {[formatTime(trip.startedAt, i18n.language), formatTime(trip.endedAt, i18n.language)]
                      .filter(Boolean)
                      .join(' – ')}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {t('transport.admin.boardedSummary', { boarded: trip.boardedCount })}
                    {trip.notBoardedCount > 0
                      ? ` · ${t('transport.admin.notBoardedSummary', { count: trip.notBoardedCount })}`
                      : ''}
                  </Text>
                </View>
                <StatusChip
                  label={trip.endedAutomatically ? t('transport.driver.endedAutomatically') : t(`transport.status.${trip.status}`)}
                  variant={trip.endedAutomatically ? 'error' : STATUS_VARIANT[trip.status]}
                />
              </Pressable>
            </View>
          );
        })}
        {hasMore && (
          <Pressable style={styles.moreButton} onPress={loadMore} disabled={loadingMore}>
            {loadingMore ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.moreText}>{t('transport.driver.loadMore')}</Text>
            )}
          </Pressable>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  day: { fontSize: 13, fontWeight: '800', color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.sm },
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
  moreButton: { alignItems: 'center', paddingVertical: spacing.md },
  moreText: { color: colors.primary, fontWeight: '700' },
});
