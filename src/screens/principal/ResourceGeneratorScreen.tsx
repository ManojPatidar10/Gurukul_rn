import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getClassSection } from '../../api/classSections';
import { listSectionSubjects, listTeacherAssignments } from '../../api/sectionSubjects';
import { generateQuiz } from '../../api/teacherAi';
import type {
  AiQuizGenerationResponse,
  QuestionType,
  SubjectAssignment,
  TeacherSubjectAssignment,
} from '../../api/types';
import Dropdown from '../../components/Dropdown';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { ApiError } from '../../api/client';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { isBankEligible } from '../../utils/quizBank';
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
 * generates for themselves, picking one of the class + subject pairs they are assigned to. Either
 * way the result is a draft - nothing is saved until the teacher reviews it on QuizBankReview.
 */
export function ResourceGeneratorScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const { showToast } = useToast();
  const params = route.params;
  const selfMode = !params;
  const teacherId = params?.teacherId ?? session.ownerId;

  // Principal mode: the section is fixed by the hub; its subjects come from the section's assignments.
  const [sectionSubjects, setSectionSubjects] = useState<SubjectAssignment[]>([]);
  const [sectionClassName, setSectionClassName] = useState<string | null>(null);
  // Teacher self-mode: every section + subject this teacher is assigned to.
  const [myAssignments, setMyAssignments] = useState<TeacherSubjectAssignment[]>([]);
  const [loadingSetup, setLoadingSetup] = useState(true);
  const [assignmentKey, setAssignmentKey] = useState('');

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
  const [result, setResult] = useState<AiQuizGenerationResponse | null>(null);
  const [selectedForBank, setSelectedForBank] = useState<number[]>([]);

  useEffect(() => {
    if (selfMode) {
      listTeacherAssignments(schoolId, session.ownerId)
        .then(setMyAssignments)
        .catch(() => setMyAssignments([]))
        .finally(() => setLoadingSetup(false));
      return;
    }
    Promise.allSettled([
      listSectionSubjects(schoolId, params.classSectionId).then(setSectionSubjects),
      getClassSection(schoolId, params.classSectionId).then((cs) => setSectionClassName(cs.className)),
    ]).finally(() => setLoadingSetup(false));
  }, [schoolId, selfMode, session.ownerId, params?.classSectionId]);

  const selectedAssignment = useMemo(
    () => myAssignments.find((a) => `${a.sectionId}|${a.subjectId}` === assignmentKey) ?? null,
    [myAssignments, assignmentKey]
  );
  const classSectionId = selfMode ? selectedAssignment?.sectionId ?? '' : params.classSectionId;
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
    const a = myAssignments.find((x) => `${x.sectionId}|${x.subjectId}` === key);
    setSubjectId(a?.subjectId ?? '');
    setSubjectName(a?.subjectName ?? '');
  };

  const toggleType = (type: QuestionType) => {
    setSelectedTypes((prev) => (prev.includes(type) ? prev.filter((t2) => t2 !== type) : [...prev, type]));
  };

  const toggleBank = (num: number) => {
    setSelectedForBank((prev) => (prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num]));
  };

  const handleGenerate = async () => {
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

    setGenerating(true);
    setResult(null);
    setSelectedForBank([]);
    try {
      const response = await generateQuiz(schoolId, teacherId, {
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
      });
      setResult(response);
      setSelectedForBank(response.questions.filter(isBankEligible).map((q) => q.number));
    } catch (e) {
      const message = e instanceof ApiError ? getErrorMessage(e) : getErrorMessage(e);
      showToast(message, 'error');
    } finally {
      setGenerating(false);
    }
  };

  const bankClassName = result?.className ?? (selfMode ? selectedAssignment?.className : sectionClassName) ?? null;
  const bankSubjectId = result?.subjectId ?? null;
  const canSaveToBank = !!bankClassName && !!bankSubjectId;

  const openReview = () => {
    if (!result || !bankClassName || !bankSubjectId) return;
    const questions = result.questions.filter((q) => selectedForBank.includes(q.number) && isBankEligible(q));
    if (questions.length === 0) return showToast(t('teacherTools.bank.errors.noneSelected'), 'error');
    navigation.navigate('QuizBankReview', {
      subjectId: bankSubjectId,
      subjectName: result.subjectName,
      className: bankClassName,
      questions,
    });
  };

  const subtitle = selfMode ? classSectionLabel || undefined : `${params.teacherName} · ${params.classSectionLabel}`;

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('teacherTools.generator.title')} subtitle={subtitle} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        {loadingSetup ? (
          <ActivityIndicator color={accent.base} style={styles.setupLoading} />
        ) : selfMode ? (
          myAssignments.length === 0 ? (
            <Text style={styles.hint}>{t('teacherTools.generator.noAssignments')}</Text>
          ) : (
            <Dropdown
              label={t('teacherTools.generator.classAndSubject')}
              required
              value={assignmentKey}
              onSelect={selectAssignment}
              options={myAssignments.map((a) => ({
                value: `${a.sectionId}|${a.subjectId}`,
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

        <LabeledInput
          label={t('teacherTools.generator.additionalInstructions')}
          value={additionalInstructions}
          onChangeText={setAdditionalInstructions}
          multiline
          numberOfLines={2}
        />

        <Pressable
          style={[styles.generateButton, generating && styles.generateButtonDisabled]}
          onPress={handleGenerate}
          disabled={generating}
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

        {result && (
          <View style={styles.results}>
            <Text style={styles.resultsTitle}>{t('teacherTools.generator.resultsTitle')}</Text>
            <Text style={styles.reviewNote}>{t('teacherTools.generator.reviewNote')}</Text>
            {result.questions.map((q) => {
              const eligible = isBankEligible(q);
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
                  {canSaveToBank &&
                    (eligible ? (
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
                    ) : (
                      <Text style={styles.notEligible}>{t('teacherTools.bank.notEligible')}</Text>
                    ))}
                </View>
              );
            })}
            {canSaveToBank ? (
              <Pressable
                style={[styles.generateButton, selectedForBank.length === 0 && styles.generateButtonDisabled]}
                onPress={openReview}
                disabled={selectedForBank.length === 0}
              >
                <Text style={styles.generateButtonText}>
                  {t('teacherTools.bank.reviewAndSave', { count: selectedForBank.length })}
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
  hint: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.md },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
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
  reviewNote: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.md, fontStyle: 'italic' },
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
  notEligible: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm, fontStyle: 'italic' },
});
