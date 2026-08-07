import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { listQuizQuestions } from '../../api/arena';
import { listClassNames } from '../../api/classSections';
import type { QuizQuestionResponse, Subject } from '../../api/types';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import SubjectPicker from '../../components/SubjectPicker';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'MyQuestions'>;

export function MyQuestionsScreen({ navigation }: Props) {
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [classNames, setClassNames] = useState<string[]>([]);
  const [className, setClassName] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestionResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listClassNames(schoolId).then(setClassNames).catch(() => setClassNames([]));
  }, [schoolId]);

  useEffect(() => {
    if (!subjectId || !className) {
      setQuestions([]);
      return;
    }
    setLoading(true);
    setError(null);
    listQuizQuestions(schoolId, subjectId, className, session.ownerId)
      .then(setQuestions)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [schoolId, subjectId, className, session.ownerId]);

  return (
    <View style={styles.root}>
      <ScreenHeader title="My Questions" onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <Text style={styles.fieldLabel}>Subject</Text>
        <SubjectPicker schoolId={schoolId} selectedId={subjectId} onSelect={(s: Subject) => setSubjectId(s.id)} />

        <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Class</Text>
        <View style={styles.chips}>
          {classNames.map((name) => (
            <Text
              key={name}
              style={[styles.chip, className === name && styles.chipSelected]}
              onPress={() => setClassName(name)}
            >
              {name}
            </Text>
          ))}
          {classNames.length === 0 && <Text style={styles.empty}>No classes set up yet.</Text>}
        </View>

        {error && <Text style={styles.error}>{error}</Text>}
        {loading && <ActivityIndicator color={colors.primary} style={styles.loading} />}

        {!loading && subjectId && className && questions.length === 0 && !error && (
          <Text style={styles.empty}>You haven&apos;t added any questions for this subject/class yet.</Text>
        )}

        {questions.map((q) => (
          <View key={q.id} style={styles.card}>
            <Text style={styles.questionText}>{q.questionText}</Text>
            <Text style={styles.optionText}>A. {q.optionA}</Text>
            <Text style={styles.optionText}>B. {q.optionB}</Text>
            <Text style={styles.optionText}>C. {q.optionC}</Text>
            <Text style={styles.optionText}>D. {q.optionD}</Text>
            <Text style={styles.correct}>Correct answer: {q.correctOption}</Text>
          </View>
        ))}
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
  error: { color: colors.error, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  questionText: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.xs },
  optionText: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  correct: { fontSize: 13, fontWeight: '700', color: colors.success, marginTop: spacing.sm },
});
