import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { createQuizQuestion } from '../../api/arena';
import { listClassNames } from '../../api/classSections';
import { listSubjects } from '../../api/subjects';
import type { QuizOption, Subject } from '../../api/types';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'QuestionAuthor'>;

const OPTION_KEYS: QuizOption[] = ['A', 'B', 'C', 'D'];

export function QuestionAuthorScreen({ navigation }: Props) {
  const schoolId = useSchoolId();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [classNames, setClassNames] = useState<string[]>([]);
  const [className, setClassName] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState({ A: '', B: '', C: '', D: '' });
  const [correctOption, setCorrectOption] = useState<QuizOption>('A');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);

  useEffect(() => {
    setLoadingOptions(true);
    Promise.all([
      listSubjects(schoolId).then(setSubjects).catch(() => setSubjects([])),
      listClassNames(schoolId).then(setClassNames).catch(() => setClassNames([])),
    ]).finally(() => setLoadingOptions(false));
  }, [schoolId]);

  const canSubmit =
    subjectId !== null &&
    className !== null &&
    questionText.trim().length > 0 &&
    OPTION_KEYS.every((k) => options[k].trim().length > 0);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await createQuizQuestion(schoolId, {
        subjectId: subjectId!,
        className: className!,
        questionText: questionText.trim(),
        optionA: options.A.trim(),
        optionB: options.B.trim(),
        optionC: options.C.trim(),
        optionD: options.D.trim(),
        correctOption,
      });
      navigation.goBack();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Add a quiz question" onBack={() => navigation.goBack()} />
      <ScreenContainer>
        {loadingOptions ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : (
          <>
            <Text style={styles.fieldLabel}>Subject</Text>
            <View style={styles.chips}>
              {subjects.map((subject) => (
                <Pressable
                  key={subject.id}
                  style={[styles.chip, subjectId === subject.id && styles.chipSelected]}
                  onPress={() => setSubjectId(subject.id)}
                >
                  <Text style={[styles.chipText, subjectId === subject.id && styles.chipTextSelected]}>{subject.name}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Class</Text>
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
              {classNames.length === 0 && <Text style={styles.empty}>No classes set up yet.</Text>}
            </View>
          </>
        )}

        <LabeledInput label="Question" value={questionText} onChangeText={setQuestionText} multiline placeholder="e.g. What is the capital of India?" />

        {OPTION_KEYS.map((key) => (
          <LabeledInput
            key={key}
            label={`Option ${key}`}
            value={options[key]}
            onChangeText={(text) => setOptions((prev) => ({ ...prev, [key]: text }))}
          />
        ))}

        <Text style={styles.fieldLabel}>Correct answer</Text>
        <View style={styles.chips}>
          {OPTION_KEYS.map((key) => (
            <Pressable
              key={key}
              style={[styles.chip, correctOption === key && styles.chipSelected]}
              onPress={() => setCorrectOption(key)}
            >
              <Text style={[styles.chipText, correctOption === key && styles.chipTextSelected]}>{key}</Text>
            </Pressable>
          ))}
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={[styles.submit, (!canSubmit || submitting) && styles.submitDisabled]} onPress={handleSubmit} disabled={!canSubmit || submitting}>
          {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitText}>Save question</Text>}
        </Pressable>
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
  error: { color: colors.error, marginBottom: spacing.md },
  loading: { marginTop: spacing.xl },
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
});
