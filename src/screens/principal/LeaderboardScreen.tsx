import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { getMyLeaderboard } from '../../api/gamification';
import type { LeaderboardResponse, LeagueTier } from '../../api/types';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, gameColors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'Leaderboard'>;

const TIER_LABELS: Record<LeagueTier, string> = {
  BRONZE: 'Bronze League',
  SILVER: 'Silver League',
  GOLD: 'Gold League',
  PLATINUM: 'Platinum League',
  DIAMOND: 'Diamond League',
  GURUKUL_MASTER: 'Gurukul Master League',
};

const MEDALS = ['🥇', '🥈', '🥉'];

export function LeaderboardScreen({ navigation }: Props) {
  const schoolId = useSchoolId();
  const [board, setBoard] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getMyLeaderboard(schoolId)
      .then(setBoard)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [schoolId]);

  return (
    <View style={styles.root}>
      <ScreenHeader title="Leaderboard" onBack={() => navigation.goBack()} />
      <ScreenContainer>
        {loading && <ActivityIndicator color={colors.primary} style={styles.loading} />}
        {error && <Text style={styles.error}>{error}</Text>}

        {board && (
          <>
            <Text style={styles.tierTitle}>{TIER_LABELS[board.tier]}</Text>
            <Text style={styles.tierSub}>{board.classSectionLabel} · resets weekly</Text>

            {board.entries.length === 0 && (
              <Text style={styles.empty}>No one in this league has earned XP yet this week.</Text>
            )}

            {board.entries.map((entry) => (
              <View key={entry.studentId} style={[styles.row, entry.rank <= 3 && styles.rowTop, entry.isYou && styles.rowYou]}>
                <Text style={[styles.rank, entry.rank <= 3 && styles.rankMedal]}>
                  {entry.rank <= 3 ? MEDALS[entry.rank - 1] : entry.rank}
                </Text>
                <View style={styles.who}>
                  <Text style={styles.whoName} numberOfLines={1}>
                    {entry.name}
                    {entry.isYou ? ' (you)' : ''}
                  </Text>
                </View>
                <Text style={styles.xpTag}>+{entry.weeklyXp}</Text>
              </View>
            ))}

            <View style={styles.progressCard}>
              <Text style={styles.progressTitle}>Your progress</Text>
              <Text style={styles.progressBody}>
                {board.yourRank > 0
                  ? `You're #${board.yourRank} in your league this week.`
                  : "You haven't earned XP yet this week."}{' '}
                Current streak: {board.currentStreakDays} days · Longest ever: {board.longestStreakDays} days.
              </Text>
            </View>
          </>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  error: { color: colors.error, marginBottom: spacing.md },
  tierTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  tierSub: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.md },
  empty: { color: colors.textMuted, marginBottom: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
    ...softShadow,
  },
  rowTop: { borderWidth: 1, borderColor: gameColors.goldSoft, backgroundColor: '#FFF8E8' },
  rowYou: { borderWidth: 1.5, borderColor: colors.primary },
  rank: { width: 26, textAlign: 'center', fontWeight: '800', fontSize: 13, color: colors.textMuted },
  rankMedal: { fontSize: 17 },
  who: { flex: 1, minWidth: 0 },
  whoName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  xpTag: { fontSize: 13, fontWeight: '800', color: gameColors.jade },
  progressCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  progressTitle: { fontSize: 12.5, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  progressBody: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
});
