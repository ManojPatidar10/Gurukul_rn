import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { listStudentsInClassSection } from '../../api/classSections';
import { getSectionAttendance, markSectionAttendance } from '../../api/attendance';
import type { AttendanceStatus, Employee, Student } from '../../api/types';
import EmployeePicker from '../../components/EmployeePicker';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'AttendanceTake'>;

const STATUSES: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY'];

const statusColor: Record<AttendanceStatus, string> = {
  PRESENT: colors.success,
  ABSENT: colors.error,
  LATE: colors.warning,
  HALF_DAY: colors.textSecondary,
};

export function AttendanceTakeScreen({ route, navigation }: Props) {
  const schoolId = useSchoolId();
  const classSection = route.params.classSection;

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [roster, setRoster] = useState<Student[]>([]);
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [teacherLabel, setTeacherLabel] = useState('');

  const [loadingRoster, setLoadingRoster] = useState(true);
  const [loadingDate, setLoadingDate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    listStudentsInClassSection(schoolId, classSection.id)
      .then(setRoster)
      .catch((e) => setError(e.message))
      .finally(() => setLoadingRoster(false));
  }, [schoolId, classSection.id]);

  const handleLoadDate = () => {
    setLoadingDate(true);
    setError(null);
    setSuccess(false);
    getSectionAttendance(schoolId, classSection.id, date)
      .then((res) => {
        const nextStatuses: Record<string, AttendanceStatus> = {};
        const nextRemarks: Record<string, string> = {};
        res.entries.forEach((entry) => {
          nextStatuses[entry.studentId] = entry.status;
          nextRemarks[entry.studentId] = entry.remarks ?? '';
        });
        setStatuses(nextStatuses);
        setRemarks(nextRemarks);
      })
      .catch(() => {
        setStatuses({});
        setRemarks({});
      })
      .finally(() => setLoadingDate(false));
  };

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    setStatuses((prev) => ({ ...prev, [studentId]: status }));
  };

  const canSubmit = !!teacherId && roster.every((s) => !!statuses[s.id]);

  const handleSubmit = async () => {
    if (!teacherId) return;
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      await markSectionAttendance(schoolId, classSection.id, {
        date,
        teacherId,
        records: roster.map((s) => ({
          studentId: s.id,
          status: statuses[s.id] ?? 'PRESENT',
          remarks: remarks[s.id] || undefined,
        })),
      });
      setSuccess(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={`${classSection.className} - ${classSection.section}`}
        subtitle="Attendance"
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        <LabeledInput label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} />
        <Pressable style={styles.loadButton} onPress={handleLoadDate} disabled={loadingDate}>
          <Text style={styles.loadButtonText}>{loadingDate ? 'Loading…' : 'Load attendance for this date'}</Text>
        </Pressable>

        <Text style={[styles.label, { marginTop: spacing.md }]}>Marked by (teacher)</Text>
        <EmployeePicker
          schoolId={schoolId}
          selectedId={teacherId}
          onSelect={(e: Employee) => {
            setTeacherId(e.id);
            setTeacherLabel(`${e.name} (${e.designation})`);
          }}
        />
        {teacherLabel ? <Text style={styles.selectedHint}>Selected: {teacherLabel}</Text> : null}

        {loadingRoster && <ActivityIndicator style={styles.loading} />}
        {error && <Text style={styles.error}>{error}</Text>}
        {success && <Text style={styles.success}>Attendance saved for {date}.</Text>}

        {!loadingRoster && roster.length === 0 && (
          <Text style={styles.empty}>0 students in this section.</Text>
        )}

        {roster.map((student) => (
          <View key={student.id} style={styles.studentCard}>
            <Text style={styles.studentName}>
              {student.name} · Roll {student.rollNumber}
            </Text>
            <View style={styles.statusRow}>
              {STATUSES.map((status) => {
                const selected = statuses[student.id] === status;
                return (
                  <Pressable
                    key={status}
                    style={[
                      styles.statusChip,
                      selected && { backgroundColor: statusColor[status], borderColor: statusColor[status] },
                    ]}
                    onPress={() => setStatus(student.id, status)}
                  >
                    <Text style={[styles.statusChipText, selected && styles.statusChipTextSelected]}>
                      {status.replace('_', ' ')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <LabeledInput
              label="Remarks (optional)"
              value={remarks[student.id] ?? ''}
              onChangeText={(v) => setRemarks((prev) => ({ ...prev, [student.id]: v }))}
            />
          </View>
        ))}

        {roster.length > 0 && (
          <Pressable
            style={[styles.submit, (!canSubmit || submitting) && styles.disabled]}
            onPress={handleSubmit}
            disabled={!canSubmit || submitting}
          >
            <Text style={styles.submitText}>{submitting ? 'Saving…' : 'Save attendance'}</Text>
          </Pressable>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  label: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.sm },
  selectedHint: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.sm },
  loadButton: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  loadButtonText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  loading: { marginVertical: spacing.md },
  error: { color: colors.error, marginVertical: spacing.md },
  success: { color: colors.success, marginVertical: spacing.md, fontWeight: '600' },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
  studentCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.md,
    ...softShadow,
  },
  studentName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  statusChip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  statusChipText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  statusChipTextSelected: { color: colors.white },
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
