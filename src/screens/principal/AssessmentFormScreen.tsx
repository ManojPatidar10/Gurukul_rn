import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { createAssessment, listSectionTerms, updateAssessment } from '../../api/assessments';
import type { AssessmentType, Employee, Subject, TermSummary } from '../../api/types';
import { DatePickerField } from '../../components/DatePickerField';
import EmployeePicker from '../../components/EmployeePicker';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import SubjectPicker from '../../components/SubjectPicker';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';
import { canonicalTerm, findExistingTerm } from '../../utils/assessmentTerms';

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
  // Terms this section's assessments already use, offered as chips so "Term 1" isn't retyped as
  // "term 1" or "Term1" - each spelling would otherwise become a separate report card.
  const [sectionTerms, setSectionTerms] = useState<TermSummary[] | null>(null);
  const [termsError, setTermsError] = useState<string | null>(null);

  const loadTerms = useCallback(() => {
    listSectionTerms(schoolId, classSection.id)
      .then(setSectionTerms)
      .catch((e) => setTermsError(getErrorMessage(e)));
  }, [schoolId, classSection.id]);

  useEffect(loadTerms, [loadTerms]);

  const retryTerms = () => {
    setTermsError(null);
    loadTerms();
  };

  const termNames = (sectionTerms ?? []).map((t) => t.term);
  const savedTerm = canonicalTerm(term, termNames);
  const termMatch = findExistingTerm(term, termNames);
  // A published term is locked: the server refuses moving an assessment into it.
  const isLockedTerm = (candidate: string) =>
    (sectionTerms ?? []).some((t) => t.published && t.term === candidate) && candidate !== (assessment?.term ?? null);
  const termLocked = !!savedTerm && isLockedTerm(savedTerm);

  // A term is required: an assessment without one never reaches any report card.
  const canSubmit =
    !!title && !!subjectId && !!assessmentDate && Number(maxMarks) > 0 && !!teacherId && !!savedTerm && !termLocked;

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
      term: savedTerm,
    };
    try {
      const result = isEdit
        ? await updateAssessment(schoolId, assessment!.id, req)
        : await createAssessment(schoolId, classSection.id, req);
      navigation.replace('AssessmentDetail', { assessment: result, classSection });
    } catch (e) {
      setError(getErrorMessage(e));
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
          label="Term (for report cards)"
          required
          value={term}
          onChangeText={setTerm}
          placeholder="Pick one below or type a new term, e.g. Term 1"
        />
        {termsError && (
          <>
            <ErrorNotice message={termsError} />
            <Pressable onPress={retryTerms} style={styles.retry}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </>
        )}
        {sectionTerms && sectionTerms.length > 0 && (
          <>
            <Text style={styles.termHint}>Terms this section already uses (✓ = report cards published):</Text>
            <View style={styles.typeRow}>
              {sectionTerms.map((t) => {
                const selected = savedTerm === t.term;
                const locked = isLockedTerm(t.term);
                return (
                  <Pressable
                    key={t.term}
                    style={[styles.typeChip, selected && styles.typeChipSelected, locked && styles.disabled]}
                    onPress={() => setTerm(t.term)}
                    disabled={locked}
                  >
                    <Text style={[styles.typeChipText, selected && styles.typeChipTextSelected]}>
                      {t.term}
                      {t.published ? ' ✓' : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
        {termLocked ? (
          <Text style={styles.termWarning}>
            Report cards for &quot;{savedTerm}&quot; are already published, so assessments can&apos;t be added to it.
          </Text>
        ) : termMatch && termMatch !== term.trim() ? (
          <Text style={styles.termHint}>Will be saved as &quot;{termMatch}&quot;, the spelling this section already uses.</Text>
        ) : null}
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

        {error && <ErrorNotice message={error} />}

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
  termHint: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },
  termWarning: { fontSize: 12, color: colors.warning, marginBottom: spacing.md },
  retry: { alignSelf: 'flex-start', paddingVertical: spacing.sm, marginBottom: spacing.sm },
  retryText: { color: colors.primary, fontWeight: '700' },
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
