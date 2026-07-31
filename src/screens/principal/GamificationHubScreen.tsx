import { FontAwesome5 } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { getMyGameProfile } from '../../api/gamification';
import type { GameProfileResponse } from '../../api/types';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, gameColors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'GamificationHub'>;

export function GamificationHubScreen({ navigation }: Props) {
  const schoolId = useSchoolId();
  const [profile, setProfile] = useState<GameProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const xpAnim = useRef(new Animated.Value(0)).current;
  const flameAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setLoading(true);
    setError(null);
    getMyGameProfile(schoolId)
      .then(setProfile)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [schoolId]);

  useEffect(() => {
    if (!profile || profile.xpForNextLevel <= 0) return;
    const fraction = Math.min(1, profile.xpIntoLevel / profile.xpForNextLevel);
    Animated.timing(xpAnim, {
      toValue: fraction,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [profile, xpAnim]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flameAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(flameAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [flameAnim]);

  const flameScale = flameAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const xpWidth = xpAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.root}>
      <ScreenHeader title="Game Hub" onBack={() => navigation.goBack()} />
      <ScreenContainer>
        {loading && <ActivityIndicator color={colors.primary} style={styles.loading} />}
        {error && <Text style={styles.error}>{error}</Text>}

        {profile && (
          <View style={styles.hero}>
            <View style={styles.heroTopRow}>
              <View style={styles.levelBadge}>
                <Text style={styles.levelBadgeLabel}>LVL</Text>
                <Text style={styles.levelBadgeNumber}>{profile.level}</Text>
              </View>
              <View style={styles.streakChip}>
                <Animated.Text style={[styles.flameGlyph, { transform: [{ scale: flameScale }] }]}>
                  🔥
                </Animated.Text>
                <Text style={styles.streakText}>{profile.currentStreakDays}-day streak</Text>
              </View>
            </View>

            <View style={styles.xpLabels}>
              <Text style={styles.xpLabel}>{profile.totalXp} XP total</Text>
              <Text style={styles.xpLabelStrong}>
                {Math.max(0, profile.xpForNextLevel - profile.xpIntoLevel)} XP to Level {profile.level + 1}
              </Text>
            </View>
            <View style={styles.xpTrack}>
              <Animated.View style={[styles.xpFill, { width: xpWidth }]} />
            </View>

            <View style={styles.statRow}>
              <View style={styles.statCard}>
                <FontAwesome5 name="fire" size={14} color={gameColors.ember} />
                <Text style={styles.statValue}>{profile.longestStreakDays}</Text>
                <Text style={styles.statLabel}>Longest streak</Text>
              </View>
              <View style={styles.statCard}>
                <FontAwesome5 name="bolt" size={14} color={gameColors.gold} />
                <Text style={styles.statValue}>{profile.totalXp}</Text>
                <Text style={styles.statLabel}>Total XP</Text>
              </View>
            </View>
          </View>
        )}

        <Pressable style={styles.leaderboardButton} onPress={() => navigation.navigate('Leaderboard')}>
          <FontAwesome5 name="trophy" size={16} color={gameColors.gold} />
          <Text style={styles.leaderboardButtonText}>View my league leaderboard</Text>
          <FontAwesome5 name="chevron-right" size={13} color={colors.textMuted} />
        </Pressable>

        <Text style={styles.comingSoon}>House wars, badges, and quiz battles are coming in the next update.</Text>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  error: { color: colors.error, marginBottom: spacing.md },
  hero: {
    backgroundColor: gameColors.ink,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...softShadow,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  levelBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: gameColors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelBadgeLabel: { fontSize: 9, fontWeight: '800', color: '#3A2400', letterSpacing: 0.5 },
  levelBadgeNumber: { fontSize: 20, fontWeight: '800', color: '#3A2400', marginTop: -2 },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,90,60,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,90,60,0.4)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
  },
  flameGlyph: { fontSize: 16 },
  streakText: { color: '#FFE2D4', fontWeight: '700', fontSize: 12.5 },
  xpLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  xpLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11.5 },
  xpLabelStrong: { color: gameColors.goldSoft, fontSize: 11.5, fontWeight: '700' },
  xpTrack: {
    height: 14,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  xpFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: gameColors.gold,
  },
  statRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { color: '#fff', fontWeight: '800', fontSize: 16 },
  statLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 10.5 },
  comingSoon: { fontSize: 12.5, color: colors.textMuted, textAlign: 'center', paddingHorizontal: spacing.md },
  leaderboardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    ...softShadow,
  },
  leaderboardButtonText: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.textPrimary },
});
