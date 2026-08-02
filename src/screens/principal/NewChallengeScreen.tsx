import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { createChallenge } from '../../api/arena';
import { getStudent, listStudentsByClassSection } from '../../api/students';
import { listSubjects } from '../../api/subjects';
import type { Student, Subject } from '../../api/types';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'NewChallenge'>;

export function NewChallengeScreen({ navigation }: Props) {
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const [classmates, setClassmates] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [opponentId, setOpponentId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getStudent(schoolId, session.ownerId)
      .then((me) =>
        Promise.all([
          listStudentsByClassSection(schoolId, {
            className: me.className,
            section: me.section,
            academicYear: me.academicYear,
          }),
          listSubjects(schoolId),
        ])
      )
      .then(([students, subs]) => {
        setClassmates(students.filter((s) => s.id !== session.ownerId));
        setSubjects(subs);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [schoolId, session.ownerId]);

  const canSubmit = opponentId !== null && subjectId !== null;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const challenge = await createChallenge(schoolId, { opponentStudentId: opponentId!, subjectId: subjectId! });
      navigation.replace('ChallengeDetail', { challengeId: challenge.id });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Challenge a classmate" onBack={() => navigation.goBack()} />
      <ScreenContainer>
        {loading && <ActivityIndicator color={colors.primary} />}
        {error && <Text style={styles.error}>{error}</Text>}

        {!loading && (
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
              {subjects.length === 0 && <Text style={styles.empty}>No subjects set up yet.</Text>}
            </View>

            <Text style={styles.fieldLabel}>Opponent</Text>
            {classmates.length === 0 && <Text style={styles.empty}>No classmates found.</Text>}
            {classmates.map((student) => (
              <Pressable
                key={student.id}
                style={[styles.studentRow, opponentId === student.id && styles.studentRowSelected]}
                onPress={() => setOpponentId(student.id)}
              >
                <Text style={styles.studentName}>{student.name}</Text>
              </Pressable>
            ))}

            <Pressable
              style={[styles.submit, (!canSubmit || submitting) && styles.submitDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit || submitting}
            >
              {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitText}>Send challenge</Text>}
            </Pressable>
          </>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  error: { color: colors.error, marginBottom: spacing.md },
  empty: { color: colors.textMuted, marginBottom: spacing.md },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
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
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  chipTextSelected: { color: colors.white },
  studentRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  studentRowSelected: { borderColor: colors.primary },
  studentName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
    ...softShadow,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: colors.white, fontWeight: '700', fontSize: 16 },
});
