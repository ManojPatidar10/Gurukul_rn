import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { createStudent, updateStudent } from '../../api/students';
import type { StudentRequest } from '../../api/types';
import ClassSectionPicker from '../../components/ClassSectionPicker';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'StudentForm'>;

export function StudentFormScreen({ route, navigation }: Props) {
  const schoolId = useSchoolId();
  const student = route.params?.student ?? null;
  const isEdit = !!student;

  const [form, setForm] = useState<StudentRequest>({
    rollNumber: student?.rollNumber ?? '',
    name: student?.name ?? '',
    dob: student?.dob ?? '',
    gender: student?.gender ?? '',
    address: student?.address ?? '',
    parentName: student?.parentName ?? '',
    parentContact: student?.parentContact ?? '',
    classSectionId: student?.classSectionId ?? '',
    admissionDate: student?.admissionDate ?? '',
    status: student?.status ?? 'ACTIVE',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof StudentRequest) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const canSubmit =
    form.rollNumber && form.name && form.dob && form.gender && form.address &&
    form.parentName && form.parentContact && form.classSectionId && form.admissionDate;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const result = isEdit
        ? await updateStudent(schoolId, student!.id, form)
        : await createStudent(schoolId, form);
      navigation.replace('StudentDetail', { student: result });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={isEdit ? 'Edit student' : 'Enroll student'}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        <LabeledInput label="Roll number" value={form.rollNumber} onChangeText={set('rollNumber')} />
        <LabeledInput label="Name" value={form.name} onChangeText={set('name')} />
        <LabeledInput
          label="Date of birth (YYYY-MM-DD)"
          value={form.dob}
          onChangeText={set('dob')}
          placeholder="2015-06-01"
        />
        <LabeledInput
          label="Gender"
          value={form.gender}
          onChangeText={set('gender')}
          placeholder="MALE / FEMALE / OTHER"
        />
        <LabeledInput label="Address" value={form.address} onChangeText={set('address')} />
        <LabeledInput label="Parent name" value={form.parentName} onChangeText={set('parentName')} />
        <LabeledInput
          label="Parent contact"
          value={form.parentContact}
          onChangeText={set('parentContact')}
          keyboardType="phone-pad"
        />
        <LabeledInput
          label="Admission date (YYYY-MM-DD)"
          value={form.admissionDate}
          onChangeText={set('admissionDate')}
          placeholder="2026-04-01"
        />
        <LabeledInput label="Status" value={form.status} onChangeText={set('status')} placeholder="ACTIVE" />

        <Text style={styles.label}>Class-section</Text>
        <ClassSectionPicker
          schoolId={schoolId}
          selectedId={form.classSectionId || null}
          onSelect={(cs) => set('classSectionId')(cs.id)}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.submit, (!canSubmit || submitting) && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          <Text style={styles.submitText}>
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Enroll student'}
          </Text>
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm },
  error: { color: colors.error, marginTop: spacing.md },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    ...softShadow,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: colors.white, fontWeight: '700' },
});
