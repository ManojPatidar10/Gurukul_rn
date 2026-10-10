import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import {
  dismissQuizQuestionReports,
  listQuizQuestions,
  restoreQuizQuestion,
  retireQuizQuestion,
} from '../../api/arena';
import { listClassNames } from '../../api/classSections';
import type { QuizQuestionResponse, Subject } from '../../api/types';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import SubjectPicker from '../../components/SubjectPicker';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { reportWarning } from '../../utils/questionAuthor';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'MyQuestions'>;

type QuestionAction = (schoolId: string, id: string) => Promise<QuizQuestionResponse>;

export function MyQuestionsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const { showToast } = useToast();
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [subjectName, setSubjectName] = useState<string | null>(null);
  const [classNames, setClassNames] = useState<string[]>([]);
  const [loadingClassNames, setLoadingClassNames] = useState(true);
  const [classNamesError, setClassNamesError] = useState<string | null>(null);
  const [classNamesReload, setClassNamesReload] = useState(0);
  const [className, setClassName] = useState<string | null>(null);
  const [includeRetired, setIncludeRetired] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestionResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listClassNames(schoolId)
      .then((names) => {
        if (!cancelled) setClassNames(names);
      })
      .catch((e) => {
        if (!cancelled) setClassNamesError(getErrorMessage(e));
      })
      .finally(() => {
        if (!cancelled) setLoadingClassNames(false);
      });
    return () => {
      cancelled = true;
    };
  }, [schoolId, classNamesReload]);

  const retryClassNames = () => {
    setLoadingClassNames(true);
    setClassNamesError(null);
    setClassNamesReload((n) => n + 1);
  };

  // Runs when the filters change and every time the screen comes back into focus, so an edit made
  // on the question screen shows up here. A response for filters that have since changed is dropped.
  useFocusEffect(
    useCallback(() => {
      if (!subjectId || !className) {
        setQuestions([]);
        return;
      }
      let cancelled = false;
      setLoading(true);
      setError(null);
      listQuizQuestions(schoolId, subjectId, className, session.ownerId, includeRetired)
        .then((rows) => {
          if (!cancelled) setQuestions(rows);
        })
        .catch((e) => {
          if (!cancelled) setError(getErrorMessage(e));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [schoolId, subjectId, className, session.ownerId, includeRetired])
  );

  // Success and failure both come back as a toast, so a teacher scrolled down to a card sees the
  // result where they are. The list-level `error` is left alone: it is for list-load failures only.
  const runAction = async (q: QuizQuestionResponse, action: QuestionAction, done: string) => {
    setBusyId(q.id);
    try {
      const updated = await action(schoolId, q.id);
      setQuestions((prev) =>
        updated.retired && !includeRetired
          ? prev.filter((p) => p.id !== updated.id)
          : prev.map((p) => (p.id === updated.id ? updated : p))
      );
      showToast(done, 'success');
    } catch (e) {
      showToast(getErrorMessage(e), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const confirmRetire = (q: QuizQuestionResponse) =>
    Alert.alert(t('questionBank.myQuestions.retireTitle'), t('questionBank.myQuestions.retireBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('questionBank.myQuestions.retire'),
        style: 'destructive',
        onPress: () => runAction(q, retireQuizQuestion, t('questionBank.myQuestions.retiredToast')),
      },
    ]);

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('questionBank.myQuestions.title')} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <Text style={styles.fieldLabel}>{t('questionBank.myQuestions.subject')}</Text>
        <SubjectPicker
          schoolId={schoolId}
          selectedId={subjectId}
          onSelect={(s: Subject) => {
            setSubjectId(s.id);
            setSubjectName(s.name);
          }}
        />

        <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>{t('questionBank.myQuestions.class')}</Text>
        {classNamesError ? (
          <>
            <ErrorNotice message={classNamesError} />
            <Pressable style={styles.retryButton} onPress={retryClassNames}>
              <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.chips}>
            {loadingClassNames ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                {classNames.map((name) => (
                  <Text
                    key={name}
                    style={[styles.chip, className === name && styles.chipSelected]}
                    onPress={() => setClassName(name)}
                  >
                    {name}
                  </Text>
                ))}
                {classNames.length === 0 && <Text style={styles.empty}>{t('questionBank.myQuestions.noClasses')}</Text>}
              </>
            )}
          </View>
        )}

        <View style={styles.switchRow}>
          <Text style={styles.switchText}>{t('questionBank.myQuestions.showRetired')}</Text>
          <Switch
            value={includeRetired}
            onValueChange={setIncludeRetired}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>

        {subjectId && className && (
          // The whole grade's answers to this teacher's own questions (no section).
          <Pressable
            style={styles.retryButton}
            accessibilityRole="button"
            onPress={() =>
              navigation.navigate('QuestionStats', { subjectId, subjectName: subjectName ?? undefined, className })
            }
          >
            <Text style={styles.retryButtonText}>{t('questionBank.myQuestions.questionStats')}</Text>
          </Pressable>
        )}

        {error && <ErrorNotice message={error} />}
        {loading && <ActivityIndicator color={colors.primary} style={styles.loading} />}

        {!loading && subjectId && className && questions.length === 0 && !error && (
          <Text style={styles.empty}>{t('questionBank.myQuestions.empty')}</Text>
        )}

        {questions.map((q) => {
          const warning = reportWarning(q.openReportCount, t);
          const comments = q.openReportComments ?? [];
          const busy = busyId === q.id;
          return (
            <View key={q.id} style={[styles.card, q.retired && styles.cardRetired]}>
              {(q.source === 'AI' || q.retired) && (
                <View style={styles.badges}>
                  {q.retired && <StatusChip label={t('questionBank.myQuestions.retired')} variant="neutral" />}
                  {q.source === 'AI' && <StatusChip label={t('questionBank.myQuestions.aiMade')} variant="info" />}
                </View>
              )}
              <Text style={styles.questionText}>{q.questionText}</Text>
              {(q.questionType ?? 'MCQ') === 'MCQ' ? (
                <>
                  <Text style={styles.optionText}>A. {q.optionA}</Text>
                  <Text style={styles.optionText}>B. {q.optionB}</Text>
                  <Text style={styles.optionText}>C. {q.optionC}</Text>
                  <Text style={styles.optionText}>D. {q.optionD}</Text>
                  <Text style={styles.correct}>
                    {t('questionBank.myQuestions.correctAnswer', { option: q.correctOption })}
                  </Text>
                </>
              ) : (
                <>
                  {/* Typed-answer questions aren't used by Arena games (tap-to-answer, MCQ only). */}
                  <Text style={styles.optionText}>
                    {q.questionType === 'NUMERIC'
                      ? t('questionBank.myQuestions.numericAnswer')
                      : t('questionBank.myQuestions.shortWordAnswer')}
                  </Text>
                  <Text style={styles.correct}>{t('questionBank.myQuestions.answer', { answer: q.answerText })}</Text>
                </>
              )}
              {!!q.explanation?.trim() && (
                <Text style={styles.explanation}>
                  <Text style={styles.explanationLabel}>{t('questionBank.myQuestions.explanationLabel')}</Text>{' '}
                  {q.explanation.trim()}
                </Text>
              )}

              {warning && (
                <View style={styles.reportBox}>
                  <Text style={styles.reportWarning}>⚠ {warning}</Text>
                  {comments.map((comment, index) => (
                    <Text key={index} style={styles.reportComment}>
                      “{comment}”
                    </Text>
                  ))}
                </View>
              )}

              {q.canEdit && (
                <View style={styles.actions}>
                  {busy ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <>
                      <Pressable onPress={() => navigation.navigate('QuestionAuthor', { questionId: q.id })} hitSlop={6}>
                        <Text style={styles.action}>{t('common.edit')}</Text>
                      </Pressable>
                      {q.retired ? (
                        <Pressable
                          onPress={() => runAction(q, restoreQuizQuestion, t('questionBank.myQuestions.restoredToast'))}
                          hitSlop={6}
                        >
                          <Text style={styles.action}>{t('questionBank.myQuestions.restore')}</Text>
                        </Pressable>
                      ) : (
                        <Pressable onPress={() => confirmRetire(q)} hitSlop={6}>
                          <Text style={[styles.action, styles.actionDanger]}>
                            {t('questionBank.myQuestions.retire')}
                          </Text>
                        </Pressable>
                      )}
                      {(q.openReportCount ?? 0) > 0 && (
                        <Pressable
                          onPress={() =>
                            runAction(q, dismissQuizQuestionReports, t('questionBank.myQuestions.checkedToast'))
                          }
                          hitSlop={6}
                        >
                          <Text style={styles.action}>{t('questionBank.myQuestions.markChecked')}</Text>
                        </Pressable>
                      )}
                    </>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    overflow: 'hidden',
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary, color: colors.white },
  empty: { color: colors.textMuted, fontSize: 13 },
  retryButton: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs + 2,
    marginBottom: spacing.md,
  },
  retryButtonText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  switchText: { fontSize: 14, color: colors.textPrimary, fontWeight: '600' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  cardRetired: { opacity: 0.75 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  questionText: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.xs },
  optionText: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  correct: { fontSize: 13, fontWeight: '700', color: colors.success, marginTop: spacing.sm },
  explanation: { fontSize: 13, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 18 },
  explanationLabel: { fontWeight: '700', color: colors.textPrimary },
  reportBox: {
    backgroundColor: '#FFF3E0',
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  reportWarning: { fontSize: 13, fontWeight: '700', color: colors.warning },
  reportComment: { fontSize: 12.5, color: colors.textSecondary, marginTop: 4, fontStyle: 'italic' },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  action: { fontSize: 13, fontWeight: '700', color: colors.primary },
  actionDanger: { color: colors.error },
});
