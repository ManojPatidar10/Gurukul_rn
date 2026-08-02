import { FontAwesome5 } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { listMyChallenges } from '../../api/arena';
import type { ChallengeSummaryResponse } from '../../api/types';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'Arena'>;

export function ArenaScreen({ navigation }: Props) {
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const [challenges, setChallenges] = useState<ChallengeSummaryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (session.ownerType !== 'STUDENT') return Promise.resolve();
    setError(null);
    return listMyChallenges(schoolId)
      .then(setChallenges)
      .catch((e) => setError((e as Error).message));
  }, [schoolId, session.ownerType]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setLoading(true);
      load().finally(() => setLoading(false));
    });
    setLoading(true);
    load().finally(() => setLoading(false));
    return unsubscribe;
  }, [navigation, load]);

  if (session.ownerType !== 'STUDENT') {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Gurukul Arena" onBack={() => navigation.goBack()} />
        <ScreenContainer>
          <Text style={styles.teacherIntro}>
            Students challenge each other to 1v1 quizzes here. As a teacher or admin, you can build
            the question bank each subject draws from.
          </Text>
          <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('QuestionAuthor')}>
            <FontAwesome5 name="plus" size={14} color={colors.white} />
            <Text style={styles.primaryButtonText}>Add a quiz question</Text>
          </Pressable>
        </ScreenContainer>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader title="Gurukul Arena" onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('NewChallenge')}>
          <FontAwesome5 name="bolt" size={14} color={colors.white} />
          <Text style={styles.primaryButtonText}>Challenge a classmate</Text>
        </Pressable>

        {loading && <ActivityIndicator color={colors.primary} style={styles.loading} />}
        {error && <Text style={styles.error}>{error}</Text>}
        {!loading && challenges.length === 0 && <Text style={styles.empty}>No challenges yet — start one above.</Text>}

        {challenges.map((c) => (
          <Pressable key={c.id} style={styles.card} onPress={() => navigation.navigate('ChallengeDetail', { challengeId: c.id })}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>vs {c.opponentName}</Text>
              <StatusChip label={resultLabel(c)} variant={resultVariant(c)} />
            </View>
            <Text style={styles.cardMeta}>
              {c.subjectName} · {c.myAnsweredCount}/{c.totalQuestions} answered
            </Text>
          </Pressable>
        ))}
      </ScreenContainer>
    </View>
  );
}

function resultLabel(c: ChallengeSummaryResponse): string {
  if (c.status !== 'COMPLETED') return c.status;
  if (c.draw) return 'Draw';
  return c.youWon ? 'You won' : 'You lost';
}

function resultVariant(c: ChallengeSummaryResponse): 'success' | 'warning' | 'error' | 'neutral' | 'info' {
  if (c.status === 'ACTIVE') return 'info';
  if (c.status === 'EXPIRED') return 'neutral';
  if (c.draw) return 'neutral';
  return c.youWon ? 'success' : 'warning';
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  error: { color: colors.error, marginBottom: spacing.md },
  empty: { color: colors.textMuted },
  teacherIntro: { fontSize: 13.5, color: colors.textSecondary, lineHeight: 19, marginBottom: spacing.lg },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
    ...softShadow,
  },
  primaryButtonText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  cardMeta: { fontSize: 12, color: colors.textMuted },
});
