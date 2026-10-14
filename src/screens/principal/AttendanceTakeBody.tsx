import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Trans, useTranslation } from 'react-i18next';

import { getEmployee, isActiveEmployee, searchEmployees } from '../../api/employees';
import { listStudentsInClassSection } from '../../api/classSections';
import { getSectionAttendance, markSectionAttendance } from '../../api/attendance';
import type { AttendanceMethod, AttendanceStatus, ClassSection, Employee, Student } from '../../api/types';
import { DatePickerField } from '../../components/DatePickerField';
import { ScreenContainer } from '../../components/ScreenContainer';
import { SearchBar } from '../../components/SearchBar';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';
import { attendanceStatusLabel } from '../../utils/attendanceLabels';

interface Props {
  classSection: ClassSection;
}

const STATUSES: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY'];
const SEARCH_DEBOUNCE_MS = 300;

const statusColor: Record<AttendanceStatus, string> = {
  PRESENT: colors.success,
  ABSENT: colors.error,
  LATE: colors.warning,
  HALF_DAY: colors.textSecondary,
};

const methodEmoji: Record<AttendanceMethod, string> = {
  RFID: '📇',
  FINGERPRINT: '👆',
  FACE: '📷',
};

export function AttendanceTakeBody({ classSection }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const isAdmin = session.role === 'ADMIN';

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [roster, setRoster] = useState<Student[]>([]);
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [methods, setMethods] = useState<Record<string, AttendanceMethod | null>>({});
  const [teacherId, setTeacherId] = useState<string | null>(isAdmin ? classSection.classTeacherId : session.ownerId);
  // Admin only: who the attendance will be marked as.
  const [teacherLabel, setTeacherLabel] = useState(isAdmin ? (classSection.classTeacherName ?? '') : '');
  // Non-admin only: their own name - null while it loads, '' if it couldn't be.
  const [myName, setMyName] = useState<string | null>(null);

  // Admin-only: search for a different marker than the section's default class teacher.
  const [showTeacherSearch, setShowTeacherSearch] = useState(isAdmin && !classSection.classTeacherId);
  const [teacherQuery, setTeacherQuery] = useState('');
  const [teacherResults, setTeacherResults] = useState<Employee[]>([]);
  const [searchingTeachers, setSearchingTeachers] = useState(false);

  const [loadingRoster, setLoadingRoster] = useState(true);
  const [loadingDate, setLoadingDate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    listStudentsInClassSection(schoolId, classSection.id)
      .then(setRoster)
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoadingRoster(false));
  }, [schoolId, classSection.id]);

  // Non-admins can only ever mark as themselves (the backend enforces this and ignores any
  // other teacherId they send) - just look up their own name for a friendly label.
  useEffect(() => {
    if (isAdmin) return;
    getEmployee(schoolId, session.ownerId)
      .then((me) => setMyName(me.name))
      .catch(() => setMyName(''));
  }, [isAdmin, schoolId, session.ownerId]);

  // "<name> (you)", or just "you" when the name couldn't be loaded.
  const selfLabel =
    myName === null
      ? '…'
      : myName
        ? t('attendance.take.selfWithName', { name: myName })
        : t('attendance.take.self');

  useEffect(() => {
    if (!isAdmin || !showTeacherSearch || teacherQuery.trim().length < 2) {
      setTeacherResults([]);
      return;
    }
    let cancelled = false;
    setSearchingTeachers(true);
    const handle = setTimeout(() => {
      searchEmployees(schoolId, teacherQuery.trim())
        .then((results) => !cancelled && setTeacherResults(results.filter(isActiveEmployee)))
        .catch(() => !cancelled && setTeacherResults([]))
        .finally(() => !cancelled && setSearchingTeachers(false));
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [isAdmin, showTeacherSearch, teacherQuery, schoolId]);

  const handleLoadDate = () => {
    setLoadingDate(true);
    setError(null);
    setSuccess(false);
    getSectionAttendance(schoolId, classSection.id, date)
      .then((res) => {
        const nextStatuses: Record<string, AttendanceStatus> = {};
        const nextMethods: Record<string, AttendanceMethod | null> = {};
        res.entries.forEach((entry) => {
          nextStatuses[entry.studentId] = entry.status;
          nextMethods[entry.studentId] = entry.method;
        });
        setStatuses(nextStatuses);
        setMethods(nextMethods);
      })
      .catch(() => {
        setStatuses({});
        setMethods({});
      })
      .finally(() => setLoadingDate(false));
  };

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    setStatuses((prev) => ({ ...prev, [studentId]: status }));
    // Saving will clear any device attribution for this student's record (teacher's mark takes
    // over, matching AttendanceService.markSection) - drop the stale badge here too.
    setMethods((prev) => ({ ...prev, [studentId]: null }));
  };

  const markAllPresent = () => {
    setStatuses((prev) => {
      const next = { ...prev };
      roster.forEach((s) => (next[s.id] = 'PRESENT'));
      return next;
    });
  };

  const allMarkedPresent = roster.length > 0 && roster.every((s) => statuses[s.id] === 'PRESENT');

  const selectTeacher = (employee: Employee) => {
    setTeacherId(employee.id);
    setTeacherLabel(`${employee.name} (${employee.designation})`);
    setShowTeacherSearch(false);
    setTeacherQuery('');
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
        })),
      });
      setSuccess(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <DatePickerField label={t('attendance.take.date')} value={date} onChange={setDate} />
        <Pressable style={styles.loadButton} onPress={handleLoadDate} disabled={loadingDate}>
          <Text style={styles.loadButtonText}>{loadingDate ? t('common.loading') : t('attendance.take.load')}</Text>
        </Pressable>

        <Text style={[styles.label, { marginTop: spacing.md }]}>{t('attendance.take.markedBy')}</Text>
        {!isAdmin ? (
          <View style={styles.fixedMarker}>
            <Text style={styles.fixedMarkerText}>
              <Trans
                t={t}
                i18nKey="attendance.take.youWillMark"
                values={{ name: selfLabel }}
                components={{ bold: <Text style={styles.fixedMarkerName} /> }}
              />
            </Text>
          </View>
        ) : !showTeacherSearch ? (
          <View style={styles.markerCard}>
            <View style={styles.markerCardBody}>
              <Text style={styles.markerCardLabel}>{t('attendance.take.classTeacher')}</Text>
              <Text style={styles.markerCardName}>{teacherLabel || t('attendance.take.notSet')}</Text>
            </View>
            <Pressable onPress={() => setShowTeacherSearch(true)}>
              <Text style={styles.changeLink}>{t('attendance.take.change')}</Text>
            </Pressable>
          </View>
        ) : (
          <View>
            <SearchBar
              value={teacherQuery}
              onChangeText={setTeacherQuery}
              placeholder={t('attendance.take.searchMarker')}
            />
            {searchingTeachers && <ActivityIndicator color={colors.primary} style={styles.searchLoading} />}
            {!searchingTeachers &&
              teacherQuery.trim().length >= 2 &&
              teacherResults.map((employee) => (
                <Pressable key={employee.id} style={styles.teacherRow} onPress={() => selectTeacher(employee)}>
                  <Text style={styles.teacherRowText}>
                    {employee.name} ({employee.designation})
                  </Text>
                </Pressable>
              ))}
            {!searchingTeachers && teacherQuery.trim().length >= 2 && teacherResults.length === 0 && (
              <Text style={styles.empty}>{t('attendance.take.noMatch')}</Text>
            )}
            {classSection.classTeacherId && (
              <Pressable
                onPress={() => {
                  setTeacherId(classSection.classTeacherId);
                  setTeacherLabel(classSection.classTeacherName ?? '');
                  setShowTeacherSearch(false);
                  setTeacherQuery('');
                }}
              >
                <Text style={styles.changeLink}>
                  {t('attendance.take.useClassTeacher', { name: classSection.classTeacherName ?? '' })}
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {loadingRoster && <ActivityIndicator style={styles.loading} />}
        {error && <ErrorNotice message={error} />}
        {success && <Text style={styles.success}>{t('attendance.take.saved', { date })}</Text>}

        {!loadingRoster && roster.length === 0 && (
          <Text style={styles.empty}>{t('attendance.noStudents')}</Text>
        )}

        {roster.length > 0 && (
          <Pressable style={styles.selectAllButton} onPress={markAllPresent} disabled={allMarkedPresent}>
            <View style={[styles.checkbox, allMarkedPresent && styles.checkboxChecked]}>
              {allMarkedPresent && <Text style={styles.checkboxTick}>✓</Text>}
            </View>
            <Text style={styles.selectAllText}>{t('attendance.take.markAll')}</Text>
          </Pressable>
        )}

        {roster.map((student) => (
          <View key={student.id} style={styles.studentCard}>
            <Pressable
              style={styles.studentHeaderRow}
              onPress={() => setStatus(student.id, statuses[student.id] === 'PRESENT' ? 'ABSENT' : 'PRESENT')}
            >
              <View style={[styles.checkbox, statuses[student.id] === 'PRESENT' && styles.checkboxChecked]}>
                {statuses[student.id] === 'PRESENT' && <Text style={styles.checkboxTick}>✓</Text>}
              </View>
              <Text style={styles.studentName}>
                {t('attendance.studentRow', { name: student.name, roll: student.rollNumber })}
                {methods[student.id] ? ` · ${methodEmoji[methods[student.id] as AttendanceMethod]}` : ''}
              </Text>
            </Pressable>
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
                      {attendanceStatusLabel(status, t)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}

        {roster.length > 0 && (
          <Pressable
            style={[styles.submit, (!canSubmit || submitting) && styles.disabled]}
            onPress={handleSubmit}
            disabled={!canSubmit || submitting}
          >
            <Text style={styles.submitText}>{submitting ? t('common.saving') : t('attendance.take.save')}</Text>
          </Pressable>
        )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.sm },
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
  fixedMarker: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  fixedMarkerText: { fontSize: 13.5, color: colors.textSecondary },
  fixedMarkerName: { fontWeight: '700', color: colors.textPrimary },
  markerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  markerCardBody: { flex: 1 },
  markerCardLabel: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  markerCardName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginTop: 2 },
  changeLink: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  searchLoading: { marginVertical: spacing.sm },
  teacherRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  teacherRowText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  selectAllText: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkboxChecked: { backgroundColor: colors.success, borderColor: colors.success },
  checkboxTick: { color: colors.white, fontWeight: '800', fontSize: 13 },
  studentCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.md,
    ...softShadow,
  },
  studentHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  studentName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
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
