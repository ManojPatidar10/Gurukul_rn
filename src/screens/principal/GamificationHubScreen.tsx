import { FontAwesome5 } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
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

const MODES: {
  route: keyof PrincipalStackParamList;
  icon: string;
  title: string;
  subtitle: string;
  color: string;
}[] = [
  { route: 'Leaderboard', icon: 'trophy', title: 'Leaderboard', subtitle: 'Your league ranking', color: gameColors.gold },
  { route: 'HouseWars', icon: 'shield-alt', title: 'House Wars', subtitle: 'School-wide standings', color: gameColors.ember },
  { route: 'BattleRoomMatch', icon: 'bolt', title: 'Battle Room', subtitle: 'Live group quiz', color: gameColors.jade },
  { route: 'Arena', icon: 'gamepad', title: 'Gurukul Arena', subtitle: 'Challenge a classmate', color: '#8B5CF6' },
  { route: 'PracticeStart', icon: 'graduation-cap', title: 'Practice', subtitle: 'Solo, no opponent', color: '#38BDF8' },
];

export function GamificationHubScreen({ navigation }: Props) {
  const schoolId = useSchoolId();
  const [profile, setProfile] = useState<GameProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const xpAnim = useRef(new Animated.Value(0)).current;
  const flameAnim = useRef(new Animated.Value(0)).current;
  const levelPulse = useRef(new Animated.Value(0)).current;

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

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(levelPulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(levelPulse, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [levelPulse]);

  const flameScale = flameAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const xpWidth = xpAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const levelGlow = levelPulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  return (
    <View style={styles.root}>
      <ScreenHeader title="Game Hub" onBack={() => navigation.goBack()} />
      <ScreenContainer>
        {loading && <ActivityIndicator color={colors.primary} style={styles.loading} />}
        {error && <Text style={styles.error}>{error}</Text>}

        {profile && (
          <LinearGradient
            colors={[gameColors.ink, gameColors.inkSoft, '#3B2F6B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroTopRow}>
              <View style={styles.levelBadgeWrap}>
                <Animated.View style={[styles.levelBadgeGlow, { opacity: levelGlow }]} />
                <View style={styles.levelBadge}>
                  <Text style={styles.levelBadgeLabel}>LVL</Text>
                  <Text style={styles.levelBadgeNumber}>{profile.level}</Text>
                </View>
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
              <Animated.View style={[styles.xpFillWrap, { width: xpWidth }]}>
                <LinearGradient
                  colors={[gameColors.gold, '#FFE9B0']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.xpFill}
                />
              </Animated.View>
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
          </LinearGradient>
        )}

        <Text style={styles.sectionTitle}>Play</Text>
        <View style={styles.modeGrid}>
          {MODES.map((mode) => (
            <Pressable
              key={mode.route}
              style={styles.modeCard}
              onPress={() => navigation.navigate(mode.route as never)}
            >
              <View style={[styles.modeIconCircle, { backgroundColor: `${mode.color}22` }]}>
                <FontAwesome5 name={mode.icon} size={20} color={mode.color} />
              </View>
              <Text style={styles.modeTitle}>{mode.title}</Text>
              <Text style={styles.modeSubtitle}>{mode.subtitle}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.comingSoon}>Badges are coming in the next update.</Text>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  error: { color: colors.error, marginBottom: spacing.md },
  hero: {
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
  levelBadgeWrap: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  levelBadgeGlow: {
    position: 'absolute',
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: gameColors.gold,
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
  xpFillWrap: { height: '100%' },
  xpFill: { flex: 1, borderRadius: radius.pill },
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
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  modeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  modeCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...softShadow,
  },
  modeIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  modeTitle: { fontSize: 14.5, fontWeight: '800', color: colors.textPrimary, marginBottom: 2 },
  modeSubtitle: { fontSize: 11.5, color: colors.textMuted },
  comingSoon: { fontSize: 12.5, color: colors.textMuted, textAlign: 'center', paddingHorizontal: spacing.md, marginTop: spacing.sm },
});
