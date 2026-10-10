import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { createQuizQuestion, getQuizQuestion, updateQuizQuestion } from '../../api/arena';
import { listClassNames } from '../../api/classSections';
import { listTeacherAssignments } from '../../api/sectionSubjects';
import { listSubjects } from '../../api/subjects';
import type { QuizQuestionResponse, TeacherSubjectAssignment } from '../../api/types';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import {
  draftFromQuestion,
  emptyQuestionDraft,
  questionSaveHint,
  teachableClassNames,
  teachableSubjects,
  toCreateQuestionRequest,
  toUpdateQuestionRequest,
  type TeachableSubject,
} from '../../utils/questionAuthor';
import { OPTION_LETTERS, validateBankDraft, type BankDraft } from '../../utils/quizBank';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'QuestionAuthor'>;

/**
 * Adds a multiple-choice question to the Arena bank, or edits a saved one (`questionId`). Nothing
 * is pre-selected as the answer, and the form is checked with the same rules as the server before
 * it is sent. A teacher can only pick the subjects and grades they teach; an admin, any of them.
 * A saved question's subject, grade and type are fixed.
 */
export function QuestionAuthorScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const questionId = route.params?.questionId;
  const isEdit = !!questionId;
  const isAdmin = session.role === 'ADMIN';

  const [draft, setDraft] = useState<BankDraft>(emptyQuestionDraft);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  // Create mode: where the question goes.
  const [assignments, setAssignments] = useState<TeacherSubjectAssignment[]>([]);
  const [schoolSubjects, setSchoolSubjects] = useState<TeachableSubject[]>([]);
  const [schoolClassNames, setSchoolClassNames] = useState<string[]>([]);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [className, setClassName] = useState<string | null>(null);

  // Edit mode: the saved question.
  const [question, setQuestion] = useState<QuizQuestionResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    let work: Promise<void>;
    if (questionId) {
      work = getQuizQuestion(schoolId, questionId).then((q) => {
        if (cancelled) return;
        setQuestion(q);
        setDraft(draftFromQuestion(q));
      });
    } else if (isAdmin) {
      work = Promise.all([listSubjects(schoolId), listClassNames(schoolId)]).then(([subjects, names]) => {
        if (cancelled) return;
        setSchoolSubjects(subjects.map((s) => ({ id: s.id, name: s.name })));
        setSchoolClassNames(names);
      });
    } else {
      work = listTeacherAssignments(schoolId, session.ownerId).then((rows) => {
        if (!cancelled) setAssignments(rows);
      });
    }
    work
      .catch((e) => {
        if (!cancelled) setLoadError(getErrorMessage(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [schoolId, questionId, isAdmin, session.ownerId, reloadCount]);

  const retry = () => {
    setLoading(true);
    setLoadError(null);
    setReloadCount((n) => n + 1);
  };

  const subjects = useMemo(
    () => (isAdmin ? schoolSubjects : teachableSubjects(assignments)),
    [isAdmin, schoolSubjects, assignments]
  );
  const classNames = useMemo(
    () => (isAdmin ? schoolClassNames : teachableClassNames(assignments, subjectId)),
    [isAdmin, schoolClassNames, assignments, subjectId]
  );

  const pickSubject = (id: string) => {
    setSubjectId(id);
    // A teacher's grades depend on the subject - drop a grade they don't teach it in.
    if (!isAdmin && className && !teachableClassNames(assignments, id).includes(className)) setClassName(null);
  };

  const update = (patch: Partial<BankDraft>) => setDraft((prev) => ({ ...prev, ...patch }));
  const updateOption = (optionIndex: number, value: string) =>
    setDraft((prev) => {
      const options = [...prev.options] as BankDraft['options'];
      options[optionIndex] = value;
      return { ...prev, options };
    });

  const placed = isEdit ? question !== null : subjectId !== null && className !== null;
  const saveHint = questionSaveHint(draft, placed, t);
  const canSave = !loading && !loadError && saveHint === null && !submitting;

  const handleSave = async () => {
    if (!canSave) return;
    const problem = validateBankDraft(draft);
    if (problem) {
      setError(t(`teacherTools.bank.errors.${problem}`));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (questionId) {
        await updateQuizQuestion(schoolId, questionId, toUpdateQuestionRequest(draft));
      } else {
        await createQuizQuestion(schoolId, toCreateQuestionRequest(subjectId!, className!, draft));
      }
      navigation.goBack();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const renderPlacement = () => {
    if (isEdit && question) {
      return (
        <View style={styles.fixedCard}>
          <Text style={styles.fixedRow}>
            <Text style={styles.fixedLabel}>{t('questionBank.author.subjectLabel')}</Text>{' '}
            {question.subjectName ?? '—'}
          </Text>
          <Text style={styles.fixedRow}>
            <Text style={styles.fixedLabel}>{t('questionBank.author.classLabel')}</Text>{' '}
            {question.className}
          </Text>
          <Text style={styles.fixedRow}>
            <Text style={styles.fixedLabel}>{t('questionBank.author.typeLabel')}</Text>{' '}
            {t(`teacherTools.bank.types.${draft.questionType}`)}
          </Text>
          <Text style={styles.fixedNote}>{t('questionBank.author.fixedNote')}</Text>
          {question.retired && <Text style={styles.fixedNote}>{t('questionBank.author.retiredNote')}</Text>}
        </View>
      );
    }
    return (
      <>
        <Text style={styles.fieldLabel}>{t('questionBank.author.subject')}</Text>
        <View style={styles.chips}>
          {subjects.map((subject) => (
            <Pressable
              key={subject.id}
              style={[styles.chip, subjectId === subject.id && styles.chipSelected]}
              onPress={() => pickSubject(subject.id)}
            >
              <Text style={[styles.chipText, subjectId === subject.id && styles.chipTextSelected]}>{subject.name}</Text>
            </Pressable>
          ))}
          {subjects.length === 0 && (
            <Text style={styles.empty}>
              {isAdmin ? t('questionBank.author.noSubjectsAdmin') : t('questionBank.author.noSubjectsTeacher')}
            </Text>
          )}
        </View>

        <Text style={styles.fieldLabel}>{t('questionBank.author.class')}</Text>
        <View style={styles.chips}>
          {classNames.map((name) => (
            <Pressable
              key={name}
              style={[styles.chip, className === name && styles.chipSelected]}
              onPress={() => setClassName(name)}
            >
              <Text style={[styles.chipText, className === name && styles.chipTextSelected]}>{name}</Text>
            </Pressable>
          ))}
          {classNames.length === 0 && (
            <Text style={styles.empty}>
              {!isAdmin && !subjectId ? t('questionBank.author.pickSubjectFirst') : t('questionBank.author.noClasses')}
            </Text>
          )}
        </View>
      </>
    );
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={isEdit ? t('questionBank.author.editTitle') : t('questionBank.author.addTitle')}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : loadError ? (
          <>
            <ErrorNotice message={loadError} />
            <Pressable style={styles.retryButton} onPress={retry}>
              <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
            </Pressable>
          </>
        ) : (
          <>
            {renderPlacement()}

            <LabeledInput
              label={t('teacherTools.bank.questionText')}
              value={draft.questionText}
              onChangeText={(questionText) => update({ questionText })}
              multiline
              placeholder={t('questionBank.author.questionPlaceholder')}
            />

            {draft.questionType === 'MCQ' ? (
              <>
                {OPTION_LETTERS.map((key, optionIndex) => (
                  <LabeledInput
                    key={key}
                    label={t('teacherTools.bank.option', { letter: key })}
                    value={draft.options[optionIndex]}
                    onChangeText={(text) => updateOption(optionIndex, text)}
                  />
                ))}

                <Text style={styles.fieldLabel}>{t('questionBank.author.correctAnswer')}</Text>
                <View style={styles.chips}>
                  {OPTION_LETTERS.map((key) => (
                    <Pressable
                      key={key}
                      style={[styles.chip, draft.correctOption === key && styles.chipSelected]}
                      onPress={() => update({ correctOption: key })}
                    >
                      <Text style={[styles.chipText, draft.correctOption === key && styles.chipTextSelected]}>{key}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : (
              <>
                <LabeledInput
                  label={t(draft.questionType === 'NUMERIC' ? 'teacherTools.bank.numericAnswer' : 'teacherTools.bank.shortWordAnswer')}
                  value={draft.answerText}
                  onChangeText={(answerText) => update({ answerText })}
                  keyboardType={draft.questionType === 'NUMERIC' ? 'numbers-and-punctuation' : 'default'}
                  autoCapitalize="none"
                />
                <Text style={styles.hint}>{t(`teacherTools.bank.markingHint.${draft.questionType}`)}</Text>
              </>
            )}

            <LabeledInput
              label={t('teacherTools.bank.explanation')}
              value={draft.explanation}
              onChangeText={(explanation) => update({ explanation })}
              multiline
              placeholder={t('questionBank.author.explanationPlaceholder')}
            />

            {error && <ErrorNotice message={error} />}

            <Pressable style={[styles.submit, !canSave && styles.submitDisabled]} onPress={handleSave} disabled={!canSave}>
              {submitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.submitText}>
                  {isEdit ? t('common.saveChanges') : t('questionBank.author.saveQuestion')}
                </Text>
              )}
            </Pressable>
            {saveHint && <Text style={styles.saveHint}>{saveHint}</Text>}
          </>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  empty: { color: colors.textMuted, fontSize: 13 },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  chipTextSelected: { color: colors.white },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: -spacing.sm, marginBottom: spacing.md },
  loading: { marginTop: spacing.xl },
  fixedCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...softShadow,
  },
  fixedRow: { fontSize: 14, color: colors.textPrimary, marginBottom: 2 },
  fixedLabel: { fontWeight: '700', color: colors.textSecondary },
  fixedNote: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 17 },
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
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    ...softShadow,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  saveHint: { fontSize: 12.5, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
});
