import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { getChallenge, submitAnswer } from '../../api/arena';
import { serverNow } from '../../api/client';
import type { ChallengeDetailResponse, PublicQuizQuestionResponse, QuizOption } from '../../api/types';
import { QuizReviewList } from '../../components/QuizReviewList';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { challengeEndsIn, challengeXpLine, isChallengeClosedError } from '../../utils/arenaLabels';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'ChallengeDetail'>;

const OPTIONS: { key: QuizOption; field: keyof PublicQuizQuestionResponse }[] = [
  { key: 'A', field: 'optionA' },
  { key: 'B', field: 'optionB' },
  { key: 'C', field: 'optionC' },
  { key: 'D', field: 'optionD' },
];

export function ChallengeDetailScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { challengeId } = route.params;
  const schoolId = useSchoolId();
  const [detail, setDetail] = useState<ChallengeDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Right or wrong only - the correct options are revealed in the review once the challenge is
  // over for both players, so the first to finish can't pass the answers on.
  const [answered, setAnswered] = useState<{ questionId: string; selected: QuizOption; correct: boolean } | null>(null);
  const [now, setNow] = useState(() => serverNow());

  const load = useCallback(() => {
    setError(null);
    return getChallenge(schoolId, challengeId)
      .then(setDetail)
      .catch((e) => setError(getErrorMessage(e)));
  }, [schoolId, challengeId]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  // Keeps the "Ends in" line current while the challenge is still being played.
  const isActive = detail?.summary.status === 'ACTIVE';
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => setNow(serverNow()), 60_000);
    return () => clearInterval(interval);
  }, [isActive]);

  const handleAnswer = async (questionId: string, selected: QuizOption) => {
    if (answered || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitAnswer(schoolId, challengeId, { questionId, selectedOption: selected });
      setAnswered({ questionId, selected, correct: result.correct });
      // Both players are done: reload straight into the result and the review.
      if (result.challengeCompleted) await load();
    } catch (e) {
      if (isChallengeClosedError(e)) {
        // It ran out of time (or closed) while this question was open - reload to show that.
        setAnswered(null);
        await load();
      } else {
        setError(getErrorMessage(e));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = async () => {
    setAnswered(null);
    setSubmitting(true);
    await load();
    setSubmitting(false);
  };

  if (loading) {
    return (
      <View style={styles.root}>
        <ScreenHeader title={t('games.challenge.title')} onBack={() => navigation.goBack()} />
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={styles.root}>
        <ScreenHeader title={t('games.challenge.title')} onBack={() => navigation.goBack()} />
        <ScreenContainer>
          <ErrorNotice message={error ?? t('games.challenge.loadFailed')} />
        </ScreenContainer>
      </View>
    );
  }

  const { summary, questions, myAnsweredQuestionIds } = detail;
  const currentQuestion = questions.find((q) => !myAnsweredQuestionIds.includes(q.id));
  const endsIn = challengeEndsIn(summary, now, t);
  const xpLine = challengeXpLine(summary, t);
  const answeredSummary = t('games.challenge.answeredSummary', {
    mine: summary.myAnsweredCount,
    theirs: summary.opponentAnsweredCount,
    total: summary.totalQuestions,
    opponent: summary.opponentName,
  });

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('games.common.vs', { name: summary.opponentName })}
        subtitle={summary.subjectName}
        onBack={() => navigation.goBack()}
      />
      {/* The review's report box has a text field: taps on Send/Cancel go through while the keyboard
          is up, and on iOS the list scrolls clear of the keyboard. */}
      <ScreenContainer keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        {error && <ErrorNotice message={error} />}

        {endsIn && <Text style={styles.endsIn}>{endsIn}</Text>}

        {summary.status === 'COMPLETED' && (
          <View style={styles.resultBanner}>
            <Text style={styles.resultTitle}>
              {summary.draw
                ? t('games.challenge.draw')
                : summary.youWon
                  ? t('games.challenge.won')
                  : t('games.challenge.lost')}
            </Text>
            <Text style={styles.resultMeta}>{answeredSummary}</Text>
            {xpLine && (
              <Text style={[styles.xpLine, (summary.xpAwarded ?? 0) > 0 ? styles.xpWon : styles.xpNone]}>{xpLine}</Text>
            )}
          </View>
        )}

        {summary.status === 'EXPIRED' && (
          <View style={styles.resultBanner}>
            <Text style={styles.resultTitle}>{t('games.challenge.expired')}</Text>
            <Text style={styles.resultMeta}>{answeredSummary}</Text>
          </View>
        )}

        {summary.status === 'ACTIVE' && !currentQuestion && (
          <View style={styles.resultBanner}>
            <Text style={styles.resultTitle}>{t('games.challenge.waitingFor', { name: summary.opponentName })}</Text>
            <Text style={styles.resultMeta}>{t('games.challenge.allAnswered', { count: summary.totalQuestions })}</Text>
          </View>
        )}

        {summary.status === 'ACTIVE' && currentQuestion && (
          <View style={styles.questionCard}>
            <Text style={styles.progress}>
              {t('games.common.questionOf', {
                number: myAnsweredQuestionIds.length + 1,
                total: summary.totalQuestions,
              })}
            </Text>
            <Text style={styles.questionText}>{currentQuestion.questionText}</Text>

            {answered && answered.questionId === currentQuestion.id && (
              <Text style={[styles.feedback, answered.correct ? styles.feedbackCorrect : styles.feedbackWrong]}>
                {answered.correct ? t('games.common.correct') : t('games.common.notQuite')}
              </Text>
            )}

            {OPTIONS.map(({ key, field }) => {
              const isThisAnswered = answered && answered.questionId === currentQuestion.id;
              const isSelected = isThisAnswered && answered.selected === key;
              return (
                <Pressable
                  key={key}
                  style={[styles.optionButton, isSelected && (answered!.correct ? styles.optionCorrect : styles.optionWrong)]}
                  disabled={submitting || !!isThisAnswered}
                  onPress={() => handleAnswer(currentQuestion.id, key)}
                >
                  <Text style={[styles.optionKey, isSelected && styles.optionKeySelected]}>{key}</Text>
                  <Text style={styles.optionText}>{currentQuestion[field] as string}</Text>
                </Pressable>
              );
            })}

            {answered && answered.questionId === currentQuestion.id && (
              <Pressable style={styles.nextButton} onPress={handleNext} disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.nextButtonText}>{t('games.common.nextQuestion')}</Text>
                )}
              </Pressable>
            )}
          </View>
        )}

        <QuizReviewList items={detail.review} />
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  error: { color: colors.error, marginBottom: spacing.md },
  resultBanner: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    ...softShadow,
  },
  resultTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  resultMeta: { fontSize: 12.5, color: colors.textMuted, textAlign: 'center' },
  xpLine: { fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: spacing.sm },
  xpWon: { color: colors.success },
  xpNone: { color: colors.textSecondary },
  endsIn: { fontSize: 12, fontWeight: '600', color: colors.warning, marginBottom: spacing.sm },
  questionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...softShadow,
  },
  progress: { fontSize: 11, color: colors.textMuted, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.4 },
  questionText: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md, lineHeight: 22 },
  feedback: { fontSize: 13, fontWeight: '700', marginBottom: spacing.sm },
  feedbackCorrect: { color: colors.success },
  feedbackWrong: { color: colors.error },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  optionCorrect: { borderColor: colors.success, backgroundColor: '#E4F5E8' },
  optionWrong: { borderColor: colors.error, backgroundColor: '#FBE7E7' },
  optionKey: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: colors.primary,
    color: colors.white,
    fontWeight: '800',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 24,
  },
  optionKeySelected: { backgroundColor: colors.textPrimary },
  optionText: { flex: 1, fontSize: 14, color: colors.textPrimary },
  nextButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    ...softShadow,
  },
  nextButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
