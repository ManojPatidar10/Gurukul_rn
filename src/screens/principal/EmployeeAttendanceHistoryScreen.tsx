import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { getEmployeeAttendanceHistory } from '../../api/staffAttendance';
import type { AttendanceStatus, EmployeeAttendanceHistory } from '../../api/types';
import { toIsoDate } from '../../components/DatePickerField';
import { MonthAttendanceCalendar } from '../../components/MonthAttendanceCalendar';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'EmployeeAttendanceHistory'>;
type ViewMode = 'calendar' | 'list';

const statusColor: Record<AttendanceStatus, string> = {
  PRESENT: colors.success,
  ABSENT: colors.error,
  LATE: colors.warning,
  HALF_DAY: colors.textSecondary,
};

function monthRange(month: Date) {
  const from = toIsoDate(new Date(month.getFullYear(), month.getMonth(), 1));
  const to = toIsoDate(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  return { from, to };
}

export function EmployeeAttendanceHistoryScreen({ route, navigation }: Props) {
  const schoolId = useSchoolId();
  const employee = route.params.employee;
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [month, setMonth] = useState(() => new Date());

  const [history, setHistory] = useState<EmployeeAttendanceHistory | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [monthHistory, setMonthHistory] = useState<EmployeeAttendanceHistory | null>(null);
  const [loadingMonth, setLoadingMonth] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getEmployeeAttendanceHistory(schoolId, employee.id)
      .then(setHistory)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoadingHistory(false));
  }, [schoolId, employee.id]);

  useEffect(() => {
    setLoadingMonth(true);
    const { from, to } = monthRange(month);
    getEmployeeAttendanceHistory(schoolId, employee.id, from, to)
      .then(setMonthHistory)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoadingMonth(false));
  }, [schoolId, employee.id, month]);

  const recordsByDate = useMemo(() => {
    const map: Record<string, AttendanceStatus> = {};
    monthHistory?.records.forEach((r) => {
      map[r.attendanceDate] = r.status;
    });
    return map;
  }, [monthHistory]);

  const percentPresent =
    history && history.totalRecords > 0 ? Math.round((history.presentCount / history.totalRecords) * 100) : null;

  return (
    <View style={styles.root}>
      <ScreenHeader title={employee.name} subtitle="Attendance history" onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tab, viewMode === 'calendar' && styles.tabActive]}
            onPress={() => setViewMode('calendar')}
          >
            <Text style={[styles.tabText, viewMode === 'calendar' && styles.tabTextActive]}>Calendar</Text>
          </Pressable>
          <Pressable style={[styles.tab, viewMode === 'list' && styles.tabActive]} onPress={() => setViewMode('list')}>
            <Text style={[styles.tabText, viewMode === 'list' && styles.tabTextActive]}>List</Text>
          </Pressable>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        {viewMode === 'calendar' && (
          <View style={styles.calendarCard}>
            {loadingMonth && <ActivityIndicator style={styles.loading} />}
            <MonthAttendanceCalendar month={month} onMonthChange={setMonth} recordsByDate={recordsByDate} />
          </View>
        )}

        {viewMode === 'list' && (
          <>
            {loadingHistory && <ActivityIndicator style={styles.loading} />}
            {history && (
              <>
                <View style={styles.statRow}>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>{percentPresent === null ? '—' : `${percentPresent}%`}</Text>
                    <Text style={styles.statLabel}>Present rate</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>{history.totalRecords}</Text>
                    <Text style={styles.statLabel}>Total days</Text>
                  </View>
                </View>
                <View style={styles.statRow}>
                  <View style={styles.statCard}>
                    <Text style={[styles.statValue, { color: colors.success }]}>{history.presentCount}</Text>
                    <Text style={styles.statLabel}>Present</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={[styles.statValue, { color: colors.error }]}>{history.absentCount}</Text>
                    <Text style={styles.statLabel}>Absent</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={[styles.statValue, { color: colors.warning }]}>{history.lateCount}</Text>
                    <Text style={styles.statLabel}>Late</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>{history.halfDayCount}</Text>
                    <Text style={styles.statLabel}>Half day</Text>
                  </View>
                </View>

                <Text style={styles.label}>Records</Text>
                {history.records.length === 0 && <Text style={styles.empty}>No attendance recorded yet.</Text>}
                {history.records.map((record) => (
                  <View key={record.id} style={styles.row}>
                    <View>
                      <Text style={styles.rowDate}>{record.attendanceDate}</Text>
                      {record.remarks ? <Text style={styles.rowRemarks}>{record.remarks}</Text> : null}
                      {record.selfMarked && <Text style={styles.rowSelfMarked}>📍 Self check-in</Text>}
                    </View>
                    <Text style={[styles.rowStatus, { color: statusColor[record.status] }]}>
                      {record.status.replace('_', ' ')}
                    </Text>
                  </View>
                ))}
              </>
            )}
          </>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: 40 },
  error: { color: colors.error, marginBottom: spacing.md },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: spacing.md,
  },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.pill, alignItems: 'center' },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  tabTextActive: { color: colors.white },
  calendarCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...softShadow,
  },
  statRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    ...softShadow,
  },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  statLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  label: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.sm },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  rowDate: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  rowRemarks: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  rowSelfMarked: { fontSize: 11, color: colors.primary, marginTop: 2, fontWeight: '600' },
  rowStatus: { fontSize: 12, fontWeight: '700' },
});
