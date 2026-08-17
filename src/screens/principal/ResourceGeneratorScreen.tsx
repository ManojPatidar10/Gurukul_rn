import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { generateQuiz } from '../../api/teacherAi';
import type { AiQuizGenerationResponse, QuestionType } from '../../api/types';
import Dropdown from '../../components/Dropdown';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { ApiError } from '../../api/client';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'ResourceGenerator'>;

const accent = accents.teacherTools;

const ASSESSMENT_TYPES = ['QUIZ', 'TEST', 'EXAM', 'ASSIGNMENT_CHECK'] as const;
const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD', 'MIXED'] as const;
const QUESTION_TYPES: QuestionType[] = ['MCQ', 'SHORT_ANSWER', 'LONG_ANSWER', 'TRUE_FALSE'];

export function ResourceGeneratorScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { showToast } = useToast();
  const { teacherId, teacherName, classSectionId, classSectionLabel } = route.params;

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

  const toggleType = (type: QuestionType) => {
    setSelectedTypes((prev) => (prev.includes(type) ? prev.filter((t2) => t2 !== type) : [...prev, type]));
  };

  const handleGenerate = async () => {
    if (!subjectName.trim()) return showToast(t('teacherTools.generator.errors.subjectName'), 'error');
    if (!title.trim()) return showToast(t('teacherTools.generator.errors.title'), 'error');
    if (!syllabus.trim()) return showToast(t('teacherTools.generator.errors.syllabus'), 'error');
    const count = Number(questionCount);
    if (!Number.isInteger(count) || count < 1 || count > 50) {
      return showToast(t('teacherTools.generator.errors.questionCount'), 'error');
    }
    const marks = Number(maxMarks);
    if (!Number.isFinite(marks) || marks <= 0) {
      return showToast(t('teacherTools.generator.errors.maxMarks'), 'error');
    }

    setGenerating(true);
    setResult(null);
    try {
      const response = await generateQuiz(schoolId, teacherId, {
        classSectionId,
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
    } catch (e) {
      const message = e instanceof ApiError ? e.message : (e as Error).message;
      showToast(message, 'error');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('teacherTools.generator.title')}
        subtitle={`${teacherName} · ${classSectionLabel}`}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        <LabeledInput label={t('teacherTools.generator.subjectName')} required value={subjectName} onChangeText={setSubjectName} />
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
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.generateButtonText}>{t('teacherTools.generator.generateButton')}</Text>
          )}
        </Pressable>

        {result && (
          <View style={styles.results}>
            <Text style={styles.resultsTitle}>{t('teacherTools.generator.resultsTitle')}</Text>
            <Text style={styles.reviewNote}>{result.reviewNote}</Text>
            {result.questions.map((q) => (
              <View key={q.number} style={styles.questionCard}>
                <View style={styles.questionHeader}>
                  <Text style={styles.questionNumber}>{t('teacherTools.generator.questionLabel', { number: q.number })}</Text>
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
                <Text style={styles.explanationText}>{q.explanation}</Text>
              </View>
            ))}
          </View>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
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
  questionNumber: { fontSize: 13, fontWeight: '700', color: accent.base },
  questionMarks: { fontSize: 12, color: colors.textMuted },
  questionText: { fontSize: 15, color: colors.textPrimary, marginBottom: spacing.sm },
  optionsList: { marginBottom: spacing.sm },
  optionText: { fontSize: 14, color: colors.textSecondary, marginBottom: 2 },
  answerLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: 4 },
  answerText: { fontWeight: '700', color: colors.textPrimary },
  explanationText: { fontSize: 12, color: colors.textMuted },
});
