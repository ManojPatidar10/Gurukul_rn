import { FontAwesome5 } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { listMyChallenges } from '../../api/arena';
import { serverNow } from '../../api/client';
import type { ChallengeSummaryResponse } from '../../api/types';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { challengeEndsIn, challengeStatusLabel, challengeStatusVariant } from '../../utils/arenaLabels';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'Arena'>;

export function ArenaScreen({ navigation }: Props) {
  const { t } = useTranslation();
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
      .catch((e) => setError(getErrorMessage(e)));
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
        <ScreenHeader title={t('games.arena.title')} onBack={() => navigation.goBack()} />
        <ScreenContainer>
          <Text style={styles.teacherIntro}>{t('games.arena.teacherIntro')}</Text>
          <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('QuestionAuthor')}>
            <FontAwesome5 name="plus" size={14} color={colors.white} />
            <Text style={styles.primaryButtonText}>{t('games.arena.addQuestion')}</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('MyQuestions')}>
            <FontAwesome5 name="list" size={14} color={colors.primary} />
            <Text style={styles.secondaryButtonText}>{t('games.arena.myQuestions')}</Text>
          </Pressable>
        </ScreenContainer>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('games.arena.title')} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('NewChallenge')}>
          <FontAwesome5 name="bolt" size={14} color={colors.white} />
          <Text style={styles.primaryButtonText}>{t('games.arena.challengeClassmate')}</Text>
        </Pressable>

        {loading && <ActivityIndicator color={colors.primary} style={styles.loading} />}
        {error && <ErrorNotice message={error} />}
        {!loading && challenges.length === 0 && <Text style={styles.empty}>{t('games.arena.empty')}</Text>}

        {challenges.map((c) => {
          const endsIn = challengeEndsIn(c, serverNow(), t);
          const meta = { subject: c.subjectName, answered: c.myAnsweredCount, total: c.totalQuestions };
          return (
            <Pressable key={c.id} style={styles.card} onPress={() => navigation.navigate('ChallengeDetail', { challengeId: c.id })}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{t('games.common.vs', { name: c.opponentName })}</Text>
                <StatusChip label={challengeStatusLabel(c, t)} variant={challengeStatusVariant(c)} />
              </View>
              <Text style={styles.cardMeta}>
                {endsIn ? t('games.arena.cardMetaEndsIn', { ...meta, endsIn }) : t('games.arena.cardMeta', meta)}
              </Text>
            </Pressable>
          );
        })}
      </ScreenContainer>
    </View>
  );
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
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  secondaryButtonText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
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
