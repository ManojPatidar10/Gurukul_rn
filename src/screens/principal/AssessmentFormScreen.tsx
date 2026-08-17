import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { createAssessment, updateAssessment } from '../../api/assessments';
import type { AssessmentType, Employee, Subject } from '../../api/types';
import { DatePickerField } from '../../components/DatePickerField';
import EmployeePicker from '../../components/EmployeePicker';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import SubjectPicker from '../../components/SubjectPicker';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'AssessmentForm'>;

const TYPES: AssessmentType[] = ['ASSIGNMENT', 'QUIZ', 'TEST', 'EXAM'];

export function AssessmentFormScreen({ route, navigation }: Props) {
  const schoolId = useSchoolId();
  const { classSection, assessment } = route.params;
  const isEdit = !!assessment;

  const [type, setType] = useState<AssessmentType>(assessment?.type ?? 'ASSIGNMENT');
  const [title, setTitle] = useState(assessment?.title ?? '');
  const [subjectId, setSubjectId] = useState<string | null>(assessment?.subjectId ?? null);
  const [subjectLabel, setSubjectLabel] = useState(
    assessment ? `${assessment.subjectName} (${assessment.subjectCode})` : ''
  );
  const [assessmentDate, setAssessmentDate] = useState(assessment?.assessmentDate ?? '');
  const [maxMarks, setMaxMarks] = useState(assessment ? String(assessment.maxMarks) : '');
  const [description, setDescription] = useState(assessment?.description ?? '');
  const [term, setTerm] = useState(assessment?.term ?? '');
  const [teacherId, setTeacherId] = useState<string | null>(assessment?.createdByTeacherId ?? null);
  const [teacherLabel, setTeacherLabel] = useState(assessment?.createdByTeacherName ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !!title && !!subjectId && !!assessmentDate && Number(maxMarks) > 0 && !!teacherId;

  const handleSubmit = async () => {
    if (!subjectId || !teacherId) return;
    setSubmitting(true);
    setError(null);
    const req = {
      title,
      type,
      subjectId,
      assessmentDate,
      maxMarks: Number(maxMarks),
      description: description || undefined,
      teacherId,
      term: term.trim() || undefined,
    };
    try {
      const result = isEdit
        ? await updateAssessment(schoolId, assessment!.id, req)
        : await createAssessment(schoolId, classSection.id, req);
      navigation.replace('AssessmentDetail', { assessment: result, classSection });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={isEdit ? 'Edit assessment' : 'New assessment'} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <Text style={styles.label}>Type</Text>
        <View style={styles.typeRow}>
          {TYPES.map((t) => (
            <Pressable
              key={t}
              style={[styles.typeChip, type === t && styles.typeChipSelected]}
              onPress={() => setType(t)}
            >
              <Text style={[styles.typeChipText, type === t && styles.typeChipTextSelected]}>{t}</Text>
            </Pressable>
          ))}
        </View>

        <LabeledInput label="Title" value={title} onChangeText={setTitle} />

        <Text style={styles.label}>Subject</Text>
        <SubjectPicker
          schoolId={schoolId}
          selectedId={subjectId}
          onSelect={(s: Subject) => {
            setSubjectId(s.id);
            setSubjectLabel(`${s.name} (${s.code})`);
          }}
        />
        {subjectLabel ? <Text style={styles.selectedHint}>Selected: {subjectLabel}</Text> : null}

        <DatePickerField label="Assessment date" value={assessmentDate} onChange={setAssessmentDate} />
        <LabeledInput label="Max marks" value={maxMarks} onChangeText={setMaxMarks} keyboardType="numeric" />
        <LabeledInput
          label="Term (optional, e.g. Term 1 - for report cards)"
          value={term}
          onChangeText={setTerm}
          placeholder="Term 1"
        />
        <LabeledInput label="Description (optional)" value={description} onChangeText={setDescription} />

        <Text style={[styles.label, { marginTop: spacing.md }]}>Teacher</Text>
        <EmployeePicker
          schoolId={schoolId}
          selectedId={teacherId}
          onSelect={(e: Employee) => {
            setTeacherId(e.id);
            setTeacherLabel(`${e.name} (${e.designation})`);
          }}
        />
        {teacherLabel ? <Text style={styles.selectedHint}>Selected: {teacherLabel}</Text> : null}

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.submit, (!canSubmit || submitting) && styles.disabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          <Text style={styles.submitText}>{submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create assessment'}</Text>
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  label: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.sm },
  selectedHint: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.sm },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  typeChip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  typeChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeChipText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  typeChipTextSelected: { color: colors.white },
  error: { color: colors.error, marginTop: spacing.md },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    ...softShadow,
  },
  disabled: { opacity: 0.5 },
  submitText: { color: colors.white, fontWeight: '700' },
});
