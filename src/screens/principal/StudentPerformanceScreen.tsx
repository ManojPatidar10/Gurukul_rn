import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { createAssessment, submitAssessmentResults } from '../../api/assessments';
import { getStudentPerformance } from '../../api/performance';
import { listSubjects } from '../../api/subjects';
import type { AssessmentType, StudentPerformanceSummary, Subject } from '../../api/types';
import DateField from '../../components/DateField';
import Dropdown from '../../components/Dropdown';
import EmployeePicker from '../../components/EmployeePicker';
import LabeledInput from '../../components/LabeledInput';
import { PerformanceChart, type ChartType } from '../../components/PerformanceChart';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { ATTENDANCE_STATUS_COLORS } from '../../theme/chartPalette';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { isPositiveNumber } from '../../utils/validators';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'StudentPerformance'>;

const accent = accents.students;

export function StudentPerformanceScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const student = route.params.student;
  const { showToast } = useToast();

  const [summary, setSummary] = useState<StudentPerformanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState('');
  const [type, setType] = useState<AssessmentType>('TEST');
  const [assessmentDate, setAssessmentDate] = useState('');
  const [maxMarks, setMaxMarks] = useState('');
  const [marksObtained, setMarksObtained] = useState('');
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [teacherLabel, setTeacherLabel] = useState('');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState<string | null>(null);

  const [examChartType, setExamChartType] = useState<ChartType>('bar');
  const [attendanceChartType, setAttendanceChartType] = useState<ChartType>('bar');

  const TYPE_OPTIONS = [
    { label: t('performance.assessmentTypes.ASSIGNMENT'), value: 'ASSIGNMENT' },
    { label: t('performance.assessmentTypes.QUIZ'), value: 'QUIZ' },
    { label: t('performance.assessmentTypes.TEST'), value: 'TEST' },
    { label: t('performance.assessmentTypes.EXAM'), value: 'EXAM' },
  ];

  const load = useCallback(() => {
    setLoading(true);
    getStudentPerformance(schoolId, student.id)
      .then(setSummary)
      .catch((e) => showToast((e as Error).message, 'error'))
      .finally(() => setLoading(false));
  }, [schoolId, student.id, showToast]);

  useEffect(load, [load]);

  useEffect(() => {
    listSubjects(schoolId)
      .then(setSubjects)
      .catch((e) => showToast((e as Error).message, 'error'));
  }, [schoolId, showToast]);

  const resetForm = () => {
    setTitle('');
    setType('TEST');
    setAssessmentDate('');
    setMaxMarks('');
    setMarksObtained('');
    setTeacherId(null);
    setTeacherLabel('');
    setSubjectId(null);
  };

  const handleSubmitEntry = async () => {
    if (!title.trim()) {
      showToast(t('performance.errors.title'), 'error');
      return;
    }
    if (!assessmentDate) {
      showToast(t('performance.errors.assessmentDate'), 'error');
      return;
    }
    if (!isPositiveNumber(maxMarks)) {
      showToast(t('performance.errors.maxMarks'), 'error');
      return;
    }
    if (!marksObtained.trim() || Number(marksObtained) < 0) {
      showToast(t('performance.errors.marksObtained'), 'error');
      return;
    }
    if (Number(marksObtained) > Number(maxMarks)) {
      showToast(t('performance.errors.marksExceedMax'), 'error');
      return;
    }
    if (!subjectId) {
      showToast(t('performance.errors.subject'), 'error');
      return;
    }
    if (!teacherId) {
      showToast(t('performance.errors.teacher'), 'error');
      return;
    }

    setSubmitting(true);
    try {
      const assessment = await createAssessment(schoolId, student.classSectionId, {
        title: title.trim(),
        type,
        subjectId,
        assessmentDate,
        maxMarks: Number(maxMarks),
        teacherId,
      });
      await submitAssessmentResults(schoolId, assessment.id, {
        results: [{ studentId: student.id, marksObtained: Number(marksObtained) }],
      });
      resetForm();
      setShowEntryForm(false);
      load();
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !summary) {
    return (
      <View style={styles.root}>
        <ScreenHeader title={student.name} subtitle={t('performance.title')} onBack={() => navigation.goBack()} />
        <ActivityIndicator style={styles.loadingSpinner} color={accent.base} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader title={student.name} subtitle={t('performance.title')} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        {showEntryForm ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('performance.recordExamResult')}</Text>
            <LabeledInput label={t('performance.examTitle')} required value={title} onChangeText={setTitle} />
            <Dropdown label={t('performance.assessmentType')} required value={type} options={TYPE_OPTIONS} onSelect={(v) => setType(v as AssessmentType)} />
            <Dropdown
              label={t('performance.subject')}
              required
              value={subjectId ?? ''}
              options={subjects.map((s) => ({ label: s.name, value: s.id }))}
              onSelect={setSubjectId}
            />
            <DateField label={t('performance.assessmentDate')} required value={assessmentDate} onChange={setAssessmentDate} maximumDate={new Date()} />
            <LabeledInput label={t('performance.maxMarks')} required value={maxMarks} onChangeText={setMaxMarks} keyboardType="numeric" />
            <LabeledInput label={t('performance.marksObtained')} required value={marksObtained} onChangeText={setMarksObtained} keyboardType="numeric" />
            <Text style={styles.label}>{t('performance.teacher')}</Text>
            <EmployeePicker
              schoolId={schoolId}
              selectedId={teacherId}
              onSelect={(emp) => {
                setTeacherId(emp.id);
                setTeacherLabel(emp.name);
              }}
            />
            {teacherLabel ? <Text style={styles.selectedHint}>{t('performance.selectedTeacher', { name: teacherLabel })}</Text> : null}

            <Pressable style={[styles.submitButton, submitting && styles.submitDisabled]} onPress={handleSubmitEntry} disabled={submitting}>
              <Text style={styles.submitText}>{submitting ? t('common.saving') : t('performance.saveResult')}</Text>
            </Pressable>
            <Pressable onPress={() => { setShowEntryForm(false); resetForm(); }}>
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.addButton} onPress={() => setShowEntryForm(true)}>
            <Text style={styles.addButtonText}>{t('performance.recordExamResult')}</Text>
          </Pressable>
        )}

        {summary && (
          <>
            <View style={styles.overallCard}>
              <Text style={styles.overallLabel}>{t('performance.overall')}</Text>
              <Text style={styles.overallValue}>{summary.overallPerformancePercentage}%</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('performance.examPerformance')}</Text>
              <Text style={styles.statLine}>{t('performance.examAverage', { value: summary.examWeightedAveragePercentage })}</Text>
              {summary.byAssessmentType.map((b) => (
                <Text key={b.type} style={styles.breakdownLine}>
                  {t(`performance.assessmentTypes.${b.type}`)}: {b.averagePercentage}% ({b.count})
                </Text>
              ))}
              <PerformanceChart
                type={examChartType}
                onTypeChange={setExamChartType}
                valueSuffix="%"
                data={summary.examHistory.map((r) => ({ label: r.assessmentDate.slice(5), value: r.percentage }))}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('performance.attendance')}</Text>
              <Text style={styles.statLine}>
                {t('performance.attendancePercentage', { value: summary.attendance.attendancePercentage })}
              </Text>
              <PerformanceChart
                type={attendanceChartType}
                onTypeChange={setAttendanceChartType}
                availableTypes={['bar', 'pie']}
                data={[
                  { label: t('performance.attendanceStatus.PRESENT'), value: summary.attendance.presentCount, color: ATTENDANCE_STATUS_COLORS.PRESENT },
                  { label: t('performance.attendanceStatus.ABSENT'), value: summary.attendance.absentCount, color: ATTENDANCE_STATUS_COLORS.ABSENT },
                  { label: t('performance.attendanceStatus.LATE'), value: summary.attendance.lateCount, color: ATTENDANCE_STATUS_COLORS.LATE },
                  { label: t('performance.attendanceStatus.HALF_DAY'), value: summary.attendance.halfDayCount, color: ATTENDANCE_STATUS_COLORS.HALF_DAY },
                ]}
              />
              {summary.attendanceByMonth.length > 0 && (
                <>
                  <Text style={styles.subCardTitle}>{t('performance.monthlyTrend')}</Text>
                  <PerformanceChart
                    type="line"
                    onTypeChange={() => {}}
                    availableTypes={['line']}
                    valueSuffix="%"
                    data={summary.attendanceByMonth.map((m) => ({ label: m.month.slice(2), value: m.percentage }))}
                  />
                </>
              )}
            </View>
          </>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loadingSpinner: { marginTop: 60 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm },
  selectedHint: { fontSize: 12, color: colors.textMuted, marginTop: -spacing.xs, marginBottom: spacing.sm },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...softShadow,
  },
  addButtonText: { color: colors.white, fontWeight: '700' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...softShadow,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.sm },
  subCardTitle: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.xs },
  statLine: { fontSize: 14, color: colors.textPrimary, marginBottom: spacing.xs, fontWeight: '600' },
  breakdownLine: { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: colors.white, fontWeight: '700' },
  cancelText: { color: colors.textMuted, textAlign: 'center', marginBottom: spacing.sm },
  overallCard: {
    backgroundColor: accent.light,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  overallLabel: { fontSize: 13, fontWeight: '700', color: accent.base, textTransform: 'uppercase', letterSpacing: 0.4 },
  overallValue: { fontSize: 36, fontWeight: '800', color: accent.base, marginTop: spacing.xs },
});
