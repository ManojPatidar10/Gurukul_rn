import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { awardSpotRecognition } from '../../api/houses';
import { listStudents, searchStudents } from '../../api/students';
import type { Student } from '../../api/types';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SearchBar } from '../../components/SearchBar';
import { useSchoolId } from '../../context/SchoolContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'AwardRecognition'>;

const SUGGESTED_AMOUNTS = [3, 5, 8, 12];

export function AwardRecognitionScreen({ navigation }: Props) {
  const schoolId = useSchoolId();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query.trim());
  const [students, setStudents] = useState<Student[]>([]);
  const [selected, setSelected] = useState<Student | null>(null);
  const [amount, setAmount] = useState(5);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (debouncedQuery ? searchStudents(schoolId, debouncedQuery) : listStudents(schoolId))
      .then(setStudents)
      .catch(() => setStudents([]));
  }, [schoolId, debouncedQuery]);

  const canSubmit = selected !== null && reason.trim().length > 0 && amount >= 1 && amount <= 20;

  const handleSubmit = async () => {
    if (!selected || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await awardSpotRecognition(schoolId, { studentId: selected.id, amount, reason: reason.trim() });
      navigation.goBack();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!selected) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Award recognition" onBack={() => navigation.goBack()} />
        <ScreenContainer padded={false}>
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
            <SearchBar value={query} onChangeText={setQuery} placeholder="Search student by name" />
          </View>
          {students.map((student) => (
            <Pressable key={student.id} style={styles.studentRow} onPress={() => setSelected(student)}>
              <Text style={styles.studentName}>{student.name}</Text>
              <Text style={styles.studentMeta}>{student.classSectionLabel}</Text>
            </Pressable>
          ))}
        </ScreenContainer>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader title="Award recognition" onBack={() => setSelected(null)} />
      <ScreenContainer>
        <Text style={styles.selectedLabel}>Recognizing</Text>
        <Text style={styles.selectedName}>{selected.name}</Text>
        <Text style={styles.selectedMeta}>{selected.classSectionLabel}</Text>

        <Text style={styles.fieldLabel}>Points</Text>
        <View style={styles.amountRow}>
          {SUGGESTED_AMOUNTS.map((value) => (
            <Pressable
              key={value}
              style={[styles.amountChip, amount === value && styles.amountChipSelected]}
              onPress={() => setAmount(value)}
            >
              <Text style={[styles.amountChipText, amount === value && styles.amountChipTextSelected]}>+{value}</Text>
            </Pressable>
          ))}
        </View>

        <LabeledInput
          label="Reason"
          value={reason}
          onChangeText={setReason}
          placeholder="e.g. Helped a classmate in lab"
          multiline
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={[styles.submit, (!canSubmit || submitting) && styles.submitDisabled]} onPress={handleSubmit} disabled={!canSubmit || submitting}>
          {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitText}>Award points</Text>}
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  studentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  studentName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  studentMeta: { fontSize: 12, color: colors.textMuted },
  selectedLabel: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  selectedName: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginTop: 2 },
  selectedMeta: { fontSize: 12.5, color: colors.textMuted, marginBottom: spacing.lg },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.4 },
  amountRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  amountChip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  amountChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  amountChipText: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  amountChipTextSelected: { color: colors.white },
  error: { color: colors.error, marginBottom: spacing.md },
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
