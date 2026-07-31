import { FontAwesome5 } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { getHouseWars } from '../../api/houses';
import type { HouseWarsResponse } from '../../api/types';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'HouseWars'>;

export function HouseWarsScreen({ navigation }: Props) {
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const [wars, setWars] = useState<HouseWarsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    return getHouseWars(schoolId)
      .then(setWars)
      .catch((e) => setError((e as Error).message));
  }, [schoolId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setLoading(true);
      load().finally(() => setLoading(false));
    });
    setLoading(true);
    load().finally(() => setLoading(false));
    return unsubscribe;
  }, [navigation, load]);

  const canAward = session.ownerType === 'EMPLOYEE';
  const maxPoints = wars ? Math.max(1, ...wars.standings.map((s) => s.totalPoints)) : 1;

  return (
    <View style={styles.root}>
      <ScreenHeader title="House Wars" onBack={() => navigation.goBack()} />
      <ScreenContainer>
        {loading && <ActivityIndicator color={colors.primary} style={styles.loading} />}
        {error && <Text style={styles.error}>{error}</Text>}

        {wars && wars.standings.length === 0 && (
          <Text style={styles.empty}>No houses have been set up for this school yet.</Text>
        )}

        {wars?.standings.map((house) => (
          <View key={house.houseId} style={styles.houseCard}>
            <View style={styles.houseHeader}>
              <Text style={styles.houseName}>
                {house.name}
                {wars.yourHouseId === house.houseId ? ' · Your House' : ''}
              </Text>
              <Text style={styles.housePoints}>{house.totalPoints} pts</Text>
            </View>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width: `${Math.max(4, (house.totalPoints / maxPoints) * 100)}%`, backgroundColor: house.colorHex },
                ]}
              />
            </View>
            <Text style={styles.memberCount}>{house.memberCount} members</Text>
          </View>
        ))}

        {canAward && (
          <Pressable style={styles.awardButton} onPress={() => navigation.navigate('AwardRecognition')}>
            <FontAwesome5 name="star" size={14} color={colors.white} />
            <Text style={styles.awardButtonText}>Award spot recognition</Text>
          </Pressable>
        )}

        <Text style={styles.sectionTitle}>Recent recognition</Text>
        {wars && wars.recentFeed.length === 0 && <Text style={styles.empty}>Nothing yet.</Text>}
        {wars?.recentFeed.map((item, index) => (
          <View key={index} style={styles.feedRow}>
            <FontAwesome5 name="award" size={13} color={colors.textMuted} />
            <Text style={styles.feedText} numberOfLines={2}>
              <Text style={styles.feedName}>{item.studentName}</Text> ({item.houseName}) — {item.reason}
            </Text>
            <Text style={styles.feedAmount}>+{item.amount}</Text>
          </View>
        ))}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  error: { color: colors.error, marginBottom: spacing.md },
  empty: { color: colors.textMuted, marginBottom: spacing.md },
  houseCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  houseHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  houseName: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  housePoints: { fontSize: 13, fontWeight: '800', color: colors.textSecondary },
  track: { height: 14, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  memberCount: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  awardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    marginVertical: spacing.md,
    ...softShadow,
  },
  awardButtonText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginTop: spacing.md, marginBottom: spacing.sm },
  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  feedText: { flex: 1, fontSize: 12.5, color: colors.textSecondary },
  feedName: { fontWeight: '700', color: colors.textPrimary },
  feedAmount: { fontSize: 13, fontWeight: '800', color: colors.success },
});
