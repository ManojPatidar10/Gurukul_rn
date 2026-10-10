import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { createAssessment, listSectionTerms, updateAssessment } from '../../api/assessments';
import type { AssessmentType, TermSummary } from '../../api/types';
import { DatePickerField } from '../../components/DatePickerField';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { useAcademicTerms } from '../../hooks/useAcademicTerms';
import { useSectionAssignments } from '../../hooks/useSectionAssignments';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';
import {
  adminTeacherHint,
  assessmentPermissions,
  creatorTeacherId,
  soleSubjectTeacher,
  type SubjectChoice,
  type TeacherChoice,
} from '../../utils/assessmentPermissions';
import { parseMarks } from '../../utils/assessmentResults';
import { formTermChoices, termKey } from '../../utils/academicTerms';
import { canonicalTerm, findExistingTerm } from '../../utils/assessmentTerms';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'AssessmentForm'>;

const TYPES: { value: AssessmentType; label: string }[] = [
  { value: 'ASSIGNMENT', label: 'Assignment' },
  { value: 'QUIZ', label: 'Quiz' },
  { value: 'TEST', label: 'Test' },
  { value: 'EXAM', label: 'Exam' },
];

// The server's limits (AssessmentRequest).
const MAX_TITLE_LENGTH = 255;
const MAX_DESCRIPTION_LENGTH = 1000;
const MAX_TERM_LENGTH = 50;

export function AssessmentFormScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const { classSection, assessment } = route.params;
  const isEdit = !!assessment;
  const isAdmin = session.role === 'ADMIN';
  const isStaff = isAdmin || session.role === 'TEACHER';

  const {
    assignments,
    loading: assignmentsLoading,
    error: assignmentsError,
    reload: reloadAssignments,
  } = useSectionAssignments(schoolId, isStaff ? classSection.id : null);
  const permissions = assessmentPermissions(session, classSection, assignments);

  // No type is preselected on create, so a quiz isn't saved as an assignment by accident.
  const [type, setType] = useState<AssessmentType | null>(assessment?.type ?? null);
  const [title, setTitle] = useState(assessment?.title ?? '');
  const [subjectId, setSubjectId] = useState<string | null>(assessment?.subjectId ?? null);
  const [assessmentDate, setAssessmentDate] = useState(assessment?.assessmentDate ?? '');
  const [maxMarks, setMaxMarks] = useState(assessment ? String(assessment.maxMarks) : '');
  const [description, setDescription] = useState(assessment?.description ?? '');
  const [term, setTerm] = useState(assessment?.term ?? '');
  // The admin's teacher chip. A teacher has no picker: the server records them as the creator.
  const [teacherId, setTeacherId] = useState<string | null>(isAdmin ? (assessment?.createdByTeacherId ?? null) : null);
  // Once the admin picks a teacher, changing the subject stops picking one for them.
  const [teacherTouched, setTeacherTouched] = useState(isEdit);
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
  // The school's term list. Once it has a term, the server only accepts listed terms (and an old
  // assessment's own term on edit), so the term becomes a pick from the list, never typed. Without
  // one (or from an older server, which has no list) the form works as before.
  const {
    terms: listedTerms,
    configured: termListConfigured,
    loading: termListLoading,
    error: termListError,
    reload: reloadTermList,
  } = useAcademicTerms(schoolId);

  useEffect(loadTerms, [loadTerms]);

  const retryTerms = () => {
    setTermsError(null);
    loadTerms();
  };

  // Back from "Assign subjects": the class may have subjects now.
  const reloadAssignmentsOnFocus = useRef(false);
  useEffect(
    () =>
      navigation.addListener('focus', () => {
        if (!reloadAssignmentsOnFocus.current) return;
        reloadAssignmentsOnFocus.current = false;
        reloadAssignments();
      }),
    [navigation, reloadAssignments]
  );

  // On edit the current subject and creator stay offered, even if the section no longer lists them.
  const subjectOptions: SubjectChoice[] =
    assessment?.subjectId && !permissions.subjectChoices.some((s) => s.subjectId === assessment.subjectId)
      ? [
          {
            subjectId: assessment.subjectId,
            subjectName: assessment.subjectName ?? 'Current subject',
            subjectCode: assessment.subjectCode ?? '',
          },
          ...permissions.subjectChoices,
        ]
      : permissions.subjectChoices;
  const teacherOptions: TeacherChoice[] =
    isAdmin &&
    assessment?.createdByTeacherId &&
    !permissions.teacherChoices.some((c) => c.teacherId === assessment.createdByTeacherId)
      ? [
          {
            teacherId: assessment.createdByTeacherId,
            teacherName: assessment.createdByTeacherName ?? 'Current teacher',
            isClassTeacher: false,
          },
          ...permissions.teacherChoices,
        ]
      : permissions.teacherChoices;

  const teacherHint = adminTeacherHint({
    assignmentsLoading,
    assignmentsFailed: !!assignmentsError,
    hasChoices: teacherOptions.length > 0,
    adminIsEmployee: session.ownerType === 'EMPLOYEE',
  });

  const pickSubject = (id: string) => {
    setSubjectId(id);
    if (isAdmin && !teacherTouched) setTeacherId(soleSubjectTeacher(assignments, id));
  };

  const pickTeacher = (id: string) => {
    setTeacherTouched(true);
    // On create the admin may clear it, and the admin is then recorded. On edit an empty pick keeps
    // the current creator, so clearing would do nothing.
    setTeacherId(!isEdit && teacherId === id ? null : id);
  };

  const openAssignSubjects = () => {
    reloadAssignmentsOnFocus.current = true;
    navigation.navigate('SectionSubjectsList', { classSection });
  };

  const parsedMaxMarks = parseMarks(maxMarks);
  const maxMarksValid = parsedMaxMarks !== null && parsedMaxMarks > 0;

  const termNames = (sectionTerms ?? []).map((t) => t.term);
  // From the list, the chip's value is sent as it is: it's already the section's own spelling.
  const savedTerm = termListConfigured ? term.trim() : canonicalTerm(term, termNames);
  const termMatch = findExistingTerm(term, termNames);
  const listChoices = termListConfigured ? formTermChoices(listedTerms, sectionTerms ?? [], assessment?.term) : [];
  // A published term is locked: the server refuses moving an assessment into it, and refuses any
  // edit at all to an assessment already in one, so say so up front instead of after Save.
  const isLockedTerm = (candidate: string) => (sectionTerms ?? []).some((t) => t.published && t.term === candidate);
  const editLocked = isEdit && !!assessment?.term && isLockedTerm(assessment.term);
  const termLocked = !!savedTerm && isLockedTerm(savedTerm);

  // A term is required: an assessment without one never reaches any report card.
  const canSubmit =
    !editLocked &&
    !!title.trim() &&
    !!type &&
    !!subjectId &&
    !!assessmentDate &&
    maxMarksValid &&
    !!savedTerm &&
    !termLocked;

  const handleSubmit = async () => {
    if (!type || !subjectId || parsedMaxMarks === null) return;
    setSubmitting(true);
    setError(null);
    // Sent even by a teacher (the server ignores it from them): a server from before this change
    // clears the creator when it's left out. See creatorTeacherId.
    const creator = creatorTeacherId(session, teacherId, assessment ?? null);
    const fields = {
      title: title.trim(),
      type,
      subjectId,
      assessmentDate,
      maxMarks: parsedMaxMarks,
      term: savedTerm,
      ...(creator ? { teacherId: creator } : {}),
    };
    try {
      const result = isEdit
        ? // A PUT keeps any field left out, so an emptied description is sent as "" to clear it.
          await updateAssessment(schoolId, assessment!.id, { ...fields, description: description.trim() })
        : await createAssessment(schoolId, classSection.id, { ...fields, description: description.trim() || undefined });
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
        {editLocked && (
          <Text style={styles.lockNotice}>
            Report cards for &quot;{assessment?.term}&quot; are published, so this assessment can&apos;t be edited.
          </Text>
        )}
        <Text style={styles.label}>Type</Text>
        <View style={styles.typeRow}>
          {TYPES.map((t) => (
            <Pressable
              key={t.value}
              style={[styles.typeChip, type === t.value && styles.typeChipSelected]}
              onPress={() => setType(t.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: type === t.value }}
            >
              <Text style={[styles.typeChipText, type === t.value && styles.typeChipTextSelected]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
        {!type && <Text style={styles.fieldHint}>Pick a type</Text>}

        <LabeledInput label="Title" value={title} onChangeText={setTitle} maxLength={MAX_TITLE_LENGTH} />

        <Text style={styles.label}>Subject</Text>
        {subjectOptions.length > 0 && (
          <View style={styles.typeRow}>
            {subjectOptions.map((s) => {
              const selected = subjectId === s.subjectId;
              return (
                <Pressable
                  key={s.subjectId}
                  style={[styles.typeChip, selected && styles.typeChipSelected]}
                  onPress={() => pickSubject(s.subjectId)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                >
                  <Text style={[styles.typeChipText, selected && styles.typeChipTextSelected]}>{s.subjectName}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
        {assignmentsLoading ? (
          <ActivityIndicator style={styles.termsLoading} color={colors.primary} />
        ) : assignmentsError ? (
          <View style={styles.noticeRow}>
            <Text style={styles.noticeText}>
              {isAdmin ? "Couldn't load this class's subjects." : "Couldn't check which subjects you teach here."}
            </Text>
            <Pressable onPress={reloadAssignments}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : subjectOptions.length === 0 ? (
          <View style={styles.noticeRow}>
            <Text style={styles.noticeText}>No subjects are set up for this class yet.</Text>
            {permissions.canAssignSubjectTeachers && (
              <Pressable onPress={openAssignSubjects}>
                <Text style={styles.retryText}>Assign subjects</Text>
              </Pressable>
            )}
          </View>
        ) : null}

        <DatePickerField label="Assessment date" value={assessmentDate} onChange={setAssessmentDate} />
        <LabeledInput label="Max marks" value={maxMarks} onChangeText={setMaxMarks} keyboardType="decimal-pad" />
        {maxMarks.trim() !== '' && !maxMarksValid ? (
          <Text style={styles.termWarning}>Max marks must be from 0.01 to 999.99, with up to 2 decimal places.</Text>
        ) : isEdit ? (
          <Text style={styles.termHint}>Can&apos;t go below a mark already entered.</Text>
        ) : null}
        {termListLoading ? (
          <>
            <Text style={styles.label}>Term (for report cards)</Text>
            <ActivityIndicator style={styles.termsLoading} color={colors.primary} />
          </>
        ) : termListConfigured ? (
          <>
            <Text style={styles.label}>
              Term (for report cards)<Text style={styles.required}> *</Text>
            </Text>
            {sectionTerms === null && !termsError && <ActivityIndicator style={styles.termsLoading} color={colors.primary} />}
            {termsError && (
              <>
                <ErrorNotice message={termsError} />
                <Pressable onPress={retryTerms} style={styles.retry}>
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
              </>
            )}
            <View style={styles.typeRow}>
              {listChoices.map((choice) => {
                const selected = !!savedTerm && termKey(savedTerm) === termKey(choice.term);
                return (
                  <Pressable
                    key={choice.term}
                    style={[styles.typeChip, selected && styles.typeChipSelected, choice.published && styles.disabled]}
                    onPress={() => setTerm(choice.term)}
                    disabled={choice.published}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected, disabled: choice.published }}
                  >
                    <Text style={[styles.typeChipText, selected && styles.typeChipTextSelected]}>
                      {choice.listed ? choice.listed.name : choice.term}
                      {choice.published ? ' ✓' : ''}
                      {choice.listed ? '' : ` ${t('academicTerms.picker.notInList')}`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {editLocked ? null : termLocked ? (
              <Text style={styles.termWarning}>
                Report cards for &quot;{savedTerm}&quot; are already published, so assessments can&apos;t be added to it.
              </Text>
            ) : !savedTerm ? (
              <Text style={isEdit ? styles.termWarning : styles.termHint}>{t('academicTerms.picker.pickOne')}</Text>
            ) : null}
          </>
        ) : (
          <>
            <LabeledInput
              label="Term (for report cards)"
              required
              value={term}
              onChangeText={setTerm}
              maxLength={MAX_TERM_LENGTH}
              placeholder={
                sectionTerms && sectionTerms.length > 0 ? 'Pick one below or type a new term, e.g. Term 1' : 'Type a term, e.g. Term 1'
              }
            />
            {sectionTerms === null && !termsError && <ActivityIndicator style={styles.termsLoading} color={colors.primary} />}
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
                  {sectionTerms.map((summary) => {
                    const selected = savedTerm === summary.term;
                    const locked = isLockedTerm(summary.term);
                    return (
                      <Pressable
                        key={summary.term}
                        style={[styles.typeChip, selected && styles.typeChipSelected, locked && styles.disabled]}
                        onPress={() => setTerm(summary.term)}
                        disabled={locked}
                      >
                        <Text style={[styles.typeChipText, selected && styles.typeChipTextSelected]}>
                          {summary.term}
                          {summary.published ? ' ✓' : ''}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
            {editLocked ? null : termLocked ? (
              <Text style={styles.termWarning}>
                Report cards for &quot;{savedTerm}&quot; are already published, so assessments can&apos;t be added to it.
              </Text>
            ) : termMatch && termMatch !== term.trim() ? (
              <Text style={styles.termHint}>Will be saved as &quot;{termMatch}&quot;, the spelling this section already uses.</Text>
            ) : !savedTerm ? (
              // Otherwise Save is greyed out with no reason given - e.g. editing an old assessment saved without a term.
              <Text style={isEdit ? styles.termWarning : styles.termHint}>
                Pick or type a term - an assessment without one is left off every report card.
              </Text>
            ) : null}
            {termListError && (
              <View style={styles.noticeRow}>
                <Text style={styles.noticeText}>{termListError}</Text>
                <Pressable onPress={reloadTermList}>
                  <Text style={styles.retryText}>{t('common.retry')}</Text>
                </Pressable>
              </View>
            )}
            {isAdmin && !termListError && <Text style={styles.termHint}>{t('academicTerms.picker.setupHint')}</Text>}
          </>
        )}
        <LabeledInput
          label="Description (optional)"
          value={description}
          onChangeText={setDescription}
          maxLength={MAX_DESCRIPTION_LENGTH}
        />

        <Text style={[styles.label, { marginTop: spacing.md }]}>Teacher</Text>
        {isAdmin ? (
          <>
            {teacherOptions.length > 0 && (
              <View style={styles.typeRow}>
                {teacherOptions.map((c) => {
                  const selected = teacherId === c.teacherId;
                  return (
                    <Pressable
                      key={c.teacherId}
                      style={[styles.typeChip, selected && styles.typeChipSelected]}
                      onPress={() => pickTeacher(c.teacherId)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                    >
                      <Text style={[styles.typeChipText, selected && styles.typeChipTextSelected]}>
                        {c.teacherName}
                        {c.isClassTeacher ? ' (class teacher)' : ''}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
            {!isEdit && teacherHint && <Text style={styles.termHint}>{teacherHint}</Text>}
          </>
        ) : (
          <Text style={styles.teacherText}>
            {isEdit ? `Created by: ${assessment?.createdByTeacherName ?? '—'}` : 'Teacher: You'}
          </Text>
        )}

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
  required: { color: colors.error },
  fieldHint: { fontSize: 12, color: colors.warning, marginTop: -spacing.xs, marginBottom: spacing.md },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  noticeText: { flex: 1, fontSize: 12, color: colors.textMuted },
  teacherText: { fontSize: 15, color: colors.textPrimary, marginBottom: spacing.md },
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
  termsLoading: { alignSelf: 'flex-start', marginBottom: spacing.md },
  lockNotice: { fontSize: 13, fontWeight: '600', color: colors.warning, lineHeight: 19, marginBottom: spacing.md },
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
