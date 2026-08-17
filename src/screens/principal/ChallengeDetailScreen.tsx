import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { getChallenge, submitAnswer } from '../../api/arena';
import type { ChallengeDetailResponse, PublicQuizQuestionResponse, QuizOption } from '../../api/types';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'ChallengeDetail'>;

const OPTIONS: { key: QuizOption; field: keyof PublicQuizQuestionResponse }[] = [
  { key: 'A', field: 'optionA' },
  { key: 'B', field: 'optionB' },
  { key: 'C', field: 'optionC' },
  { key: 'D', field: 'optionD' },
];

export function ChallengeDetailScreen({ route, navigation }: Props) {
  const { challengeId } = route.params;
  const schoolId = useSchoolId();
  const [detail, setDetail] = useState<ChallengeDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [answered, setAnswered] = useState<
    { questionId: string; selected: QuizOption; correct: boolean; correctOption: QuizOption } | null
  >(null);

  const load = useCallback(() => {
    setError(null);
    return getChallenge(schoolId, challengeId)
      .then(setDetail)
      .catch((e) => setError((e as Error).message));
  }, [schoolId, challengeId]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const handleAnswer = async (questionId: string, selected: QuizOption) => {
    if (answered || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitAnswer(schoolId, challengeId, { questionId, selectedOption: selected });
      setAnswered({ questionId, selected, correct: result.correct, correctOption: result.correctOption });
    } catch (e) {
      setError((e as Error).message);
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
        <ScreenHeader title="Quiz Battle" onBack={() => navigation.goBack()} />
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Quiz Battle" onBack={() => navigation.goBack()} />
        <ScreenContainer>
          <Text style={styles.error}>{error ?? 'Could not load this challenge.'}</Text>
        </ScreenContainer>
      </View>
    );
  }

  const { summary, questions, myAnsweredQuestionIds } = detail;
  const currentQuestion = questions.find((q) => !myAnsweredQuestionIds.includes(q.id));

  return (
    <View style={styles.root}>
      <ScreenHeader title={`vs ${summary.opponentName}`} subtitle={summary.subjectName} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        {error && <Text style={styles.error}>{error}</Text>}

        {summary.status === 'COMPLETED' && (
          <View style={styles.resultBanner}>
            <Text style={styles.resultTitle}>
              {summary.draw ? "It's a draw!" : summary.youWon ? 'You won! 🎉' : 'You lost this one'}
            </Text>
            <Text style={styles.resultMeta}>
              {summary.myAnsweredCount}/{summary.totalQuestions} answered by you · {summary.opponentAnsweredCount}/
              {summary.totalQuestions} by {summary.opponentName}
            </Text>
          </View>
        )}

        {summary.status === 'ACTIVE' && !currentQuestion && (
          <View style={styles.resultBanner}>
            <Text style={styles.resultTitle}>Waiting for {summary.opponentName}…</Text>
            <Text style={styles.resultMeta}>You&apos;ve answered all {summary.totalQuestions} questions.</Text>
          </View>
        )}

        {summary.status === 'ACTIVE' && currentQuestion && (
          <View style={styles.questionCard}>
            <Text style={styles.progress}>
              Question {myAnsweredQuestionIds.length + 1} of {summary.totalQuestions}
            </Text>
            <Text style={styles.questionText}>{currentQuestion.questionText}</Text>

            {answered && answered.questionId === currentQuestion.id && (
              <Text style={[styles.feedback, answered.correct ? styles.feedbackCorrect : styles.feedbackWrong]}>
                {answered.correct ? 'Correct!' : 'Not quite.'}
              </Text>
            )}

            {OPTIONS.map(({ key, field }) => {
              const isThisAnswered = answered && answered.questionId === currentQuestion.id;
              const isSelected = isThisAnswered && answered.selected === key;
              const isCorrectOption = isThisAnswered && answered.correctOption === key;
              return (
                <Pressable
                  key={key}
                  style={[
                    styles.optionButton,
                    isSelected && (answered!.correct ? styles.optionCorrect : styles.optionWrong),
                    !isSelected && isCorrectOption && styles.optionCorrect,
                  ]}
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
                  <Text style={styles.nextButtonText}>Next Question</Text>
                )}
              </Pressable>
            )}
          </View>
        )}
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
