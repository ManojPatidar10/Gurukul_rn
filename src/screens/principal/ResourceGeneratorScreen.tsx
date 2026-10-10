import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { discardQuizDraft, loadQuizDraft, quizDraftKey, saveQuizDraft, type StoredQuizDraft } from '../../api/quizDraftStore';
import { shareQuizPaper, ShareUnavailableError } from '../../api/quizPaperPdf';
import { listSectionSubjects, listTeacherAssignments } from '../../api/sectionSubjects';
import { generateQuiz } from '../../api/teacherAi';
import type {
  AiQuizGenerationRequest,
  AiQuizGenerationResponse,
  QuestionType,
  SubjectAssignment,
  TeacherSubjectAssignment,
} from '../../api/types';
import Dropdown from '../../components/Dropdown';
import { ErrorNotice } from '../../components/ErrorNotice';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { isBankEligible } from '../../utils/quizBank';
import {
  assignmentKeyOf,
  bankSelectableNumbers,
  effectiveAssignmentKey,
  questionsForBank,
  quizGenErrorMessage,
  shouldRestoreDraft,
} from '../../utils/quizGenerator';
import { getErrorMessage } from '../../api/errorMessage';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'ResourceGenerator'>;

const accent = accents.teacherTools;

const ASSESSMENT_TYPES = ['QUIZ', 'TEST', 'EXAM', 'ASSIGNMENT_CHECK'] as const;
const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD', 'MIXED'] as const;
const QUESTION_TYPES: QuestionType[] = ['MCQ', 'NUMERIC', 'SHORT_WORD', 'SHORT_ANSWER', 'LONG_ANSWER', 'TRUE_FALSE'];
/** Matches the server's app.quizgen.max-questions default. */
const MAX_QUESTIONS = 30;

/**
 * Two ways in: a principal/admin arrives from the Teacher Tools hub with a teacher + class-section
 * already chosen (route params); a teacher arrives from their own dashboard tile with no params and
 * generates for themselves, picking one of the class + subject pairs they are assigned to.
 *
 * The result is a draft that goes where the teacher sends it: the whole paper as a PDF (with or
 * without the answer key), and its multiple-choice questions to the question bank via
 * QuizBankReview. The last draft is kept on this phone (quizDraftStore) until it is discarded or
 * replaced by a new one, so Back doesn't lose it.
 */
export function ResourceGeneratorScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const { showToast } = useToast();
  const params = route.params;
  const selfMode = !params;
  const teacherId = params?.teacherId ?? session.ownerId;
  // Principal mode: the section fixed by the hub. Null in teacher self-mode.
  const openSectionId = params?.classSectionId ?? null;
  const draftKey = quizDraftKey(schoolId, session.ownerId, teacherId);

  // Principal mode: the section is fixed by the hub; its subjects come from the section's assignments.
  const [sectionSubjects, setSectionSubjects] = useState<SubjectAssignment[]>([]);
  // Teacher self-mode: every section + subject this teacher is assigned to.
  const [myAssignments, setMyAssignments] = useState<TeacherSubjectAssignment[]>([]);
  const [loadingSetup, setLoadingSetup] = useState(true);
  // A failed load shows an error with Retry - never the "not assigned" / "no subjects" empty states.
  const [setupError, setSetupError] = useState<string | null>(null);
  const [assignmentKey, setAssignmentKey] = useState('');
  // The restored draft's class + subject, which the picker shows until the teacher picks another.
  const [restoredAssignmentKey, setRestoredAssignmentKey] = useState('');

  const [subjectId, setSubjectId] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [assessmentType, setAssessmentType] = useState<(typeof ASSESSMENT_TYPES)[number]>('QUIZ');
  const [title, setTitle] = useState('');
  const [syllabus, setSyllabus] = useState('');
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>('MEDIUM');
  const [questionCount, setQuestionCount] = useState('10');
  const [maxMarks, setMaxMarks] = useState('20');
  const [selectedTypes, setSelectedTypes] = useState<QuestionType[]>([]);
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [result, setResult] = useState<AiQuizGenerationResponse | null>(null);
  // savedAt of the stored draft the result on screen is (null if it couldn't be stored).
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  // Set while the result on screen is a draft restored from this phone rather than just generated.
  const [restoredAt, setRestoredAt] = useState<string | null>(null);
  // Question numbers already saved to the question bank from this draft.
  const [savedToBank, setSavedToBank] = useState<number[]>([]);
  const [selectedForBank, setSelectedForBank] = useState<number[]>([]);
  const [sharing, setSharing] = useState(false);

  // Fetch only: the Retry handler resets the loading / error state before calling it again.
  const loadSetup = useCallback(() => {
    const request =
      openSectionId === null
        ? listTeacherAssignments(schoolId, session.ownerId).then(setMyAssignments)
        : listSectionSubjects(schoolId, openSectionId).then(setSectionSubjects);
    request.catch((e) => setSetupError(getErrorMessage(e))).finally(() => setLoadingSetup(false));
  }, [schoolId, session.ownerId, openSectionId]);

  useEffect(loadSetup, [loadSetup]);

  const retrySetup = () => {
    setLoadingSetup(true);
    setSetupError(null);
    loadSetup();
  };

  const restoreDraft = useCallback((draft: StoredQuizDraft) => {
    const req = draft.request;
    setSubjectId(req.subjectId ?? '');
    setSubjectName(req.subjectName);
    setAssessmentType(req.assessmentType);
    setTitle(req.title);
    setSyllabus(req.syllabus);
    setDifficulty(req.difficulty);
    setQuestionCount(String(req.questionCount));
    setMaxMarks(String(req.maxMarks));
    setSelectedTypes(req.questionTypes ?? []);
    setAdditionalInstructions(req.additionalInstructions ?? '');
    const { classSectionId: sectionId, subjectId: restoredSubjectId } = draft.response;
    setRestoredAssignmentKey(restoredSubjectId ? assignmentKeyOf({ sectionId, subjectId: restoredSubjectId }) : '');
    setResult(draft.response);
    setDraftSavedAt(draft.savedAt);
    setRestoredAt(draft.savedAt);
    setSavedToBank(draft.savedToBank);
    setSelectedForBank(bankSelectableNumbers(draft.response.questions, draft.savedToBank));
  }, []);

  // The last draft comes back alongside the setup load - in principal mode only if it was made for
  // this section (one for another section stays stored, unshown).
  useEffect(() => {
    let active = true;
    loadQuizDraft(draftKey).then((stored) => {
      if (active && stored && shouldRestoreDraft(stored, openSectionId)) restoreDraft(stored);
    });
    return () => {
      active = false;
    };
  }, [draftKey, openSectionId, restoreDraft]);

  // Questions saved on QuizBankReview are recorded in the stored draft; pick that up on coming back.
  useFocusEffect(
    useCallback(() => {
      if (!draftSavedAt) return;
      let active = true;
      loadQuizDraft(draftKey).then((stored) => {
        if (!active || !stored || stored.savedAt !== draftSavedAt) return;
        setSavedToBank(stored.savedToBank);
        setSelectedForBank((prev) => prev.filter((n) => !stored.savedToBank.includes(n)));
      });
      return () => {
        active = false;
      };
    }, [draftKey, draftSavedAt])
  );

  const pickerKey = effectiveAssignmentKey(assignmentKey, restoredAssignmentKey, myAssignments);
  const selectedAssignment = useMemo(
    () => myAssignments.find((a) => assignmentKeyOf(a) === pickerKey) ?? null,
    [myAssignments, pickerKey]
  );
  const classSectionId = openSectionId ?? selectedAssignment?.sectionId ?? '';
  const classSectionLabel = selfMode
    ? selectedAssignment
      ? `${selectedAssignment.className} - ${selectedAssignment.section} (${selectedAssignment.academicYear})`
      : ''
    : params.classSectionLabel;
  // Unique subjects for the principal's dropdown (a section can list a subject once per teacher).
  const subjectOptions = useMemo(() => {
    const seen = new Map<string, string>();
    sectionSubjects.forEach((s) => seen.set(s.subjectId, s.subjectName));
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [sectionSubjects]);

  const selectAssignment = (key: string) => {
    setAssignmentKey(key);
    const a = myAssignments.find((x) => assignmentKeyOf(x) === key);
    setSubjectId(a?.subjectId ?? '');
    setSubjectName(a?.subjectName ?? '');
  };

  const toggleType = (type: QuestionType) => {
    setSelectedTypes((prev) => (prev.includes(type) ? prev.filter((t2) => t2 !== type) : [...prev, type]));
  };

  const toggleBank = (num: number) => {
    setSelectedForBank((prev) => (prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num]));
  };

  // The draft on screen (if any) stays until this succeeds; a failure shows under the button instead.
  const runGenerate = async (req: AiQuizGenerationRequest) => {
    setGenerating(true);
    setGenerateError(null);
    try {
      const response = await generateQuiz(schoolId, teacherId, req);
      const savedAt = new Date().toISOString();
      setResult(response);
      setDraftSavedAt(null);
      setRestoredAt(null);
      setSavedToBank([]);
      setSelectedForBank(bankSelectableNumbers(response.questions, []));
      setGenerateError(null);
      const stored = await saveQuizDraft(draftKey, {
        v: 1,
        savedAt,
        teacherId,
        classSectionId: req.classSectionId,
        request: req,
        response,
        savedToBank: [],
      });
      setDraftSavedAt(stored ? savedAt : null);
    } catch (e) {
      setGenerateError(quizGenErrorMessage(e));
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerate = () => {
    if (selfMode && !selectedAssignment) return showToast(t('teacherTools.generator.errors.assignment'), 'error');
    if (!subjectName.trim()) return showToast(t('teacherTools.generator.errors.subjectName'), 'error');
    if (!title.trim()) return showToast(t('teacherTools.generator.errors.title'), 'error');
    if (!syllabus.trim()) return showToast(t('teacherTools.generator.errors.syllabus'), 'error');
    const count = Number(questionCount);
    if (!Number.isInteger(count) || count < 1 || count > MAX_QUESTIONS) {
      return showToast(t('teacherTools.generator.errors.questionCount', { max: MAX_QUESTIONS }), 'error');
    }
    const marks = Number(maxMarks);
    if (!Number.isInteger(marks) || marks < count) {
      return showToast(t('teacherTools.generator.errors.maxMarks'), 'error');
    }

    const req: AiQuizGenerationRequest = {
      classSectionId,
      subjectId: subjectId || undefined,
      subjectName: subjectName.trim(),
      assessmentType,
      title: title.trim(),
      syllabus: syllabus.trim(),
      difficulty,
      questionCount: count,
      maxMarks: marks,
      questionTypes: selectedTypes.length > 0 ? selectedTypes : undefined,
      additionalInstructions: additionalInstructions.trim() || undefined,
    };
    if (!result) {
      runGenerate(req);
      return;
    }
    Alert.alert(t('teacherTools.generator.replaceConfirmTitle'), t('teacherTools.generator.replaceConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('teacherTools.generator.replace'), onPress: () => runGenerate(req) },
    ]);
  };

  const handleShare = async (withAnswerKey: boolean) => {
    if (!result) return;
    setSharing(true);
    try {
      await shareQuizPaper(result, withAnswerKey, t);
    } catch (e) {
      showToast(
        e instanceof ShareUnavailableError
          ? t('teacherTools.generator.shareUnavailable')
          : t('teacherTools.generator.shareFailed', { message: getErrorMessage(e) }),
        'error'
      );
    } finally {
      setSharing(false);
    }
  };

  // Removes the draft from the phone; the form keeps what was typed.
  const confirmDiscard = () => {
    Alert.alert(t('teacherTools.generator.discardConfirmTitle'), t('teacherTools.generator.discardConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('teacherTools.generator.discard'),
        style: 'destructive',
        onPress: async () => {
          await discardQuizDraft(draftKey);
          setResult(null);
          setDraftSavedAt(null);
          setRestoredAt(null);
          setSavedToBank([]);
          setSelectedForBank([]);
          setGenerateError(null);
        },
      },
    ]);
  };

  const bankClassName = result?.className ?? null;
  const bankSubjectId = result?.subjectId ?? null;
  const canSaveToBank = !!bankClassName && !!bankSubjectId;
  const bankQuestions = result ? questionsForBank(result.questions, selectedForBank, savedToBank) : [];

  const openReview = () => {
    if (!result || !bankClassName || !bankSubjectId) return;
    if (bankQuestions.length === 0) return showToast(t('teacherTools.bank.errors.noneSelected'), 'error');
    navigation.navigate('QuizBankReview', {
      subjectId: bankSubjectId,
      subjectName: result.subjectName,
      className: bankClassName,
      questions: bankQuestions,
      // Only when the draft on screen is the stored one, so its saved flags are recorded on the right draft.
      draftKey: draftSavedAt ? draftKey : undefined,
    });
  };

  const subtitle = selfMode ? classSectionLabel || undefined : `${params.teacherName} · ${params.classSectionLabel}`;
  const generateDisabled = generating || !!setupError;

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('teacherTools.generator.title')} subtitle={subtitle} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        {loadingSetup ? (
          <ActivityIndicator color={accent.base} style={styles.setupLoading} />
        ) : setupError ? (
          <>
            <ErrorNotice
              message={`${t(selfMode ? 'teacherTools.generator.loadAssignmentsFailed' : 'teacherTools.generator.loadSubjectsFailed')} ${setupError}`}
            />
            <Pressable onPress={retrySetup} style={styles.retry} accessibilityRole="button">
              <Text style={styles.retryText}>{t('common.retry')}</Text>
            </Pressable>
          </>
        ) : selfMode ? (
          myAssignments.length === 0 ? (
            <Text style={styles.hint}>{t('teacherTools.generator.noAssignments')}</Text>
          ) : (
            <Dropdown
              label={t('teacherTools.generator.classAndSubject')}
              required
              value={pickerKey}
              onSelect={selectAssignment}
              options={myAssignments.map((a) => ({
                value: assignmentKeyOf(a),
                label: `${a.className} - ${a.section} · ${a.subjectName}`,
              }))}
            />
          )
        ) : subjectOptions.length > 0 ? (
          <Dropdown
            label={t('teacherTools.generator.subjectName')}
            required
            value={subjectId}
            onSelect={(v) => {
              setSubjectId(v);
              setSubjectName(subjectOptions.find((o) => o.value === v)?.label ?? '');
            }}
            options={subjectOptions}
          />
        ) : (
          <>
            <LabeledInput label={t('teacherTools.generator.subjectName')} required value={subjectName} onChangeText={setSubjectName} />
            <Text style={styles.hint}>{t('teacherTools.generator.noSectionSubjects')}</Text>
          </>
        )}
        <Dropdown
          label={t('teacherTools.generator.assessmentType')}
          required
          value={assessmentType}
          onSelect={(v) => setAssessmentType(v as (typeof ASSESSMENT_TYPES)[number])}
          options={ASSESSMENT_TYPES.map((v) => ({ value: v, label: t(`teacherTools.generator.assessmentTypes.${v}`) }))}
        />
        <LabeledInput label={t('teacherTools.generator.quizTitle')} required value={title} onChangeText={setTitle} />
        <LabeledInput
          label={t('teacherTools.generator.syllabus')}
          required
          value={syllabus}
          onChangeText={setSyllabus}
          multiline
          numberOfLines={3}
        />
        <Dropdown
          label={t('teacherTools.generator.difficulty')}
          required
          value={difficulty}
          onSelect={(v) => setDifficulty(v as (typeof DIFFICULTIES)[number])}
          options={DIFFICULTIES.map((v) => ({ value: v, label: t(`teacherTools.generator.difficulties.${v}`) }))}
        />
        <LabeledInput
          label={t('teacherTools.generator.questionCount')}
          required
          value={questionCount}
          onChangeText={setQuestionCount}
          keyboardType="number-pad"
        />
        <LabeledInput
          label={t('teacherTools.generator.maxMarks')}
          required
          value={maxMarks}
          onChangeText={setMaxMarks}
          keyboardType="number-pad"
        />

        <Text style={styles.sectionLabel}>{t('teacherTools.generator.questionTypes')}</Text>
        <View style={styles.chips}>
          {QUESTION_TYPES.map((type) => (
            <Pressable
              key={type}
              onPress={() => toggleType(type)}
              style={[styles.chip, selectedTypes.includes(type) && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selectedTypes.includes(type) && styles.chipTextSelected]}>
                {t(`teacherTools.generator.questionTypeOptions.${type}`)}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.hint}>{t('teacherTools.generator.questionTypesHint')}</Text>

        <LabeledInput
          label={t('teacherTools.generator.additionalInstructions')}
          value={additionalInstructions}
          onChangeText={setAdditionalInstructions}
          multiline
          numberOfLines={2}
        />

        <Pressable
          style={[styles.generateButton, generateDisabled && styles.generateButtonDisabled]}
          onPress={handleGenerate}
          disabled={generateDisabled}
        >
          {generating ? (
            <View style={styles.generatingRow}>
              <ActivityIndicator color={colors.white} />
              <Text style={styles.generateButtonText}>{t('teacherTools.generator.generating')}</Text>
            </View>
          ) : (
            <Text style={styles.generateButtonText}>{t('teacherTools.generator.generateButton')}</Text>
          )}
        </Pressable>
        {generating && <Text style={styles.hint}>{t('teacherTools.generator.generatingHint')}</Text>}
        {generateError && <ErrorNotice message={generateError} />}

        {result && (
          <View style={styles.results}>
            <Text style={styles.resultsTitle}>{t('teacherTools.generator.resultsTitle')}</Text>
            {restoredAt && (
              <Text style={styles.restoredNote}>
                {t('teacherTools.generator.draftRestored', { date: new Date(restoredAt).toLocaleString() })}
              </Text>
            )}
            <Text style={styles.reviewNote}>{t('teacherTools.generator.reviewNote')}</Text>

            <View style={styles.actions}>
              <Pressable
                style={[styles.actionButton, sharing && styles.generateButtonDisabled]}
                onPress={() => handleShare(true)}
                disabled={sharing}
                accessibilityRole="button"
              >
                <Text style={styles.actionButtonText}>{t('teacherTools.generator.sharePdf')}</Text>
              </Pressable>
              <Pressable
                style={[styles.actionButton, sharing && styles.generateButtonDisabled]}
                onPress={() => handleShare(false)}
                disabled={sharing}
                accessibilityRole="button"
              >
                <Text style={styles.actionButtonText}>{t('teacherTools.generator.sharePaperOnly')}</Text>
              </Pressable>
              {sharing && (
                <View style={styles.generatingRow}>
                  <ActivityIndicator color={accent.base} />
                  <Text style={styles.sharingText}>{t('teacherTools.generator.sharing')}</Text>
                </View>
              )}
              <Pressable onPress={confirmDiscard} hitSlop={8} style={styles.discard} accessibilityRole="button">
                <Text style={styles.discardText}>{t('teacherTools.generator.discardDraft')}</Text>
              </Pressable>
            </View>

            {result.questions.map((q) => {
              const eligible = isBankEligible(q);
              const saved = savedToBank.includes(q.number);
              const checked = selectedForBank.includes(q.number);
              return (
                <View key={q.number} style={styles.questionCard}>
                  <View style={styles.questionHeader}>
                    <Text style={styles.questionNumber}>
                      {t('teacherTools.generator.questionLabel', { number: q.number })} ·{' '}
                      {t(`teacherTools.generator.questionTypeOptions.${q.questionType}`)}
                    </Text>
                    <Text style={styles.questionMarks}>{t('teacherTools.generator.marksLabel', { marks: q.marks })}</Text>
                  </View>
                  <Text style={styles.questionText}>{q.question}</Text>
                  {q.options.length > 0 && (
                    <View style={styles.optionsList}>
                      {q.options.map((opt, i) => (
                        <Text key={i} style={styles.optionText}>
                          • {opt}
                        </Text>
                      ))}
                    </View>
                  )}
                  <Text style={styles.answerLabel}>
                    {t('teacherTools.generator.answerLabel')}: <Text style={styles.answerText}>{q.answer}</Text>
                  </Text>
                  {!!q.explanation && <Text style={styles.explanationText}>{q.explanation}</Text>}
                  {!eligible ? (
                    <Text style={styles.paperOnly}>{t('teacherTools.generator.paperOnly')}</Text>
                  ) : saved ? (
                    <Text style={styles.savedText}>{t('teacherTools.generator.savedToBank')}</Text>
                  ) : (
                    canSaveToBank && (
                      <Pressable
                        style={styles.bankToggle}
                        onPress={() => toggleBank(q.number)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked }}
                      >
                        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                          {checked && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        <Text style={styles.bankToggleText}>{t('teacherTools.bank.include')}</Text>
                      </Pressable>
                    )
                  )}
                </View>
              );
            })}
            {canSaveToBank ? (
              <Pressable
                style={[styles.generateButton, bankQuestions.length === 0 && styles.generateButtonDisabled]}
                onPress={openReview}
                disabled={bankQuestions.length === 0}
              >
                <Text style={styles.generateButtonText}>
                  {t('teacherTools.bank.reviewAndSave', { count: bankQuestions.length })}
                </Text>
              </Pressable>
            ) : (
              <Text style={styles.hint}>{t('teacherTools.bank.needsSubject')}</Text>
            )}
          </View>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  setupLoading: { marginVertical: spacing.lg },
  retry: { alignSelf: 'flex-start', paddingVertical: spacing.sm, marginBottom: spacing.sm },
  retryText: { color: accent.base, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.md },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: accent.base, borderColor: accent.base },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  chipTextSelected: { color: colors.white },
  generateButton: {
    backgroundColor: accent.base,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    ...softShadow,
  },
  generateButtonDisabled: { opacity: 0.6 },
  generateButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  generatingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  results: { marginTop: spacing.sm },
  resultsTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.xs },
  restoredNote: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs },
  reviewNote: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.md, fontStyle: 'italic' },
  actions: { gap: spacing.sm, marginBottom: spacing.lg },
  actionButton: {
    borderWidth: 1.5,
    borderColor: accent.base,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  actionButtonText: { color: accent.base, fontWeight: '700', fontSize: 14, textAlign: 'center' },
  sharingText: { fontSize: 13, color: colors.textSecondary },
  discard: { alignSelf: 'flex-start', paddingVertical: spacing.xs },
  discardText: { fontSize: 13, fontWeight: '600', color: colors.error },
  questionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...softShadow,
  },
  questionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  questionNumber: { fontSize: 13, fontWeight: '700', color: accent.base, flexShrink: 1 },
  questionMarks: { fontSize: 12, color: colors.textMuted },
  questionText: { fontSize: 15, color: colors.textPrimary, marginBottom: spacing.sm },
  optionsList: { marginBottom: spacing.sm },
  optionText: { fontSize: 14, color: colors.textSecondary, marginBottom: 2 },
  answerLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: 4 },
  answerText: { fontWeight: '700', color: colors.textPrimary },
  explanationText: { fontSize: 12, color: colors.textMuted },
  bankToggle: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: spacing.sm },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkboxChecked: { backgroundColor: accent.base, borderColor: accent.base },
  checkmark: { color: colors.white, fontWeight: '800', fontSize: 13 },
  bankToggleText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  savedText: { fontSize: 13, fontWeight: '600', color: colors.success, marginTop: spacing.sm },
  paperOnly: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm, fontStyle: 'italic' },
});
