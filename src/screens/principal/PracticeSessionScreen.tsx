import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { getPracticeSession, submitPracticeAnswer } from '../../api/practice';
import type { PracticeSessionResponse, PublicQuizQuestionResponse, QuizOption } from '../../api/types';
import { QuizReviewList } from '../../components/QuizReviewList';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'PracticeSession'>;

const OPTIONS: { key: QuizOption; field: keyof PublicQuizQuestionResponse }[] = [
  { key: 'A', field: 'optionA' },
  { key: 'B', field: 'optionB' },
  { key: 'C', field: 'optionC' },
  { key: 'D', field: 'optionD' },
];

export function PracticeSessionScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { sessionId } = route.params;
  const schoolId = useSchoolId();
  const [session, setSession] = useState<PracticeSessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Answer result for whichever question is currently on screen only - cleared the moment we
  // advance, so a previous question's correct/wrong state can never bleed into the next one. Only
  // right or wrong: the correct options are revealed in the review once the session is over.
  const [answered, setAnswered] = useState<{ questionId: string; selected: QuizOption; correct: boolean } | null>(null);

  const load = useCallback(() => {
    setError(null);
    return getPracticeSession(schoolId, sessionId)
      .then(setSession)
      .catch((e) => setError(getErrorMessage(e)));
  }, [schoolId, sessionId]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const { questions = [], myAnsweredQuestionIds = [] } = session ?? {};
  const currentQuestion = questions.find((q) => !myAnsweredQuestionIds.includes(q.id));

  const handleSelect = async (questionId: string, selected: QuizOption) => {
    if (answered || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitPracticeAnswer(schoolId, sessionId, { questionId, selectedOption: selected });
      setAnswered({ questionId, selected, correct: result.correct });
      // The last answer: reload straight into the score and the review. If that fails, the Next
      // button stays up to try again.
      if (result.sessionCompleted) await load();
    } catch (e) {
      setError(getErrorMessage(e));
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
        <ScreenHeader title={t('games.practice.title')} onBack={() => navigation.goBack()} />
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.root}>
        <ScreenHeader title={t('games.practice.title')} onBack={() => navigation.goBack()} />
        <ScreenContainer>
          <ErrorNotice message={error ?? t('games.practice.loadFailed')} />
        </ScreenContainer>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('games.practice.title')}
        subtitle={session.subjectName}
        onBack={() => navigation.goBack()}
      />
      {/* The review's report box has a text field: taps on Send/Cancel go through while the keyboard
          is up, and on iOS the list scrolls clear of the keyboard. */}
      <ScreenContainer keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        {error && <ErrorNotice message={error} />}

        <Text style={styles.noXpNote}>{t('games.practice.noXp')}</Text>

        {session.status === 'COMPLETED' && (
          <View style={styles.resultBanner}>
            <Text style={styles.resultTitle}>{t('games.practice.complete')}</Text>
            <Text style={styles.resultMeta}>
              {t('games.practice.score', { correct: session.correctCount, total: session.totalQuestions })}
            </Text>
          </View>
        )}
        {session.status === 'COMPLETED' && <QuizReviewList items={session.review} />}

        {session.status === 'ACTIVE' && currentQuestion && (
          <View style={styles.questionCard}>
            <Text style={styles.progress}>
              {t('games.common.questionOf', {
                number: myAnsweredQuestionIds.length + 1,
                total: session.totalQuestions,
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
                  onPress={() => handleSelect(currentQuestion.id, key)}
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
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  error: { color: colors.error, marginBottom: spacing.md },
  noXpNote: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.md, fontStyle: 'italic' },
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
