import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { getStaffAttendanceRoster } from '../../api/staffAttendance';
import type { AttendanceStatus, StaffAttendanceRoster } from '../../api/types';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'StaffAttendance'>;

const statusVariant: Record<AttendanceStatus, 'success' | 'error' | 'warning' | 'neutral'> = {
  PRESENT: 'success',
  ABSENT: 'error',
  LATE: 'warning',
  HALF_DAY: 'neutral',
};

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isToday(dateString: string) {
  return dateString === toDateString(new Date());
}

export function StaffAttendanceScreen({ navigation }: Props) {
  const schoolId = useSchoolId();
  const [date, setDate] = useState(() => toDateString(new Date()));
  const [roster, setRoster] = useState<StaffAttendanceRoster | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getStaffAttendanceRoster(schoolId, date)
      .then(setRoster)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [schoolId, date]);

  const shiftDate = (deltaDays: number) => {
    const next = new Date(date);
    next.setDate(next.getDate() + deltaDays);
    setDate(toDateString(next));
  };

  const markedCount = roster?.entries.filter((e) => e.status != null).length ?? 0;
  const selfMarkedCount = roster?.entries.filter((e) => e.selfMarked).length ?? 0;

  return (
    <View style={styles.root}>
      <ScreenHeader title="Staff Attendance" subtitle="Today's check-ins" onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <View style={styles.dateNav}>
          <Pressable style={styles.dateNavButton} onPress={() => shiftDate(-1)}>
            <Text style={styles.dateNavButtonText}>‹</Text>
          </Pressable>
          <Text style={styles.dateText}>{isToday(date) ? `Today · ${date}` : date}</Text>
          <Pressable style={styles.dateNavButton} onPress={() => shiftDate(1)} disabled={isToday(date)}>
            <Text style={[styles.dateNavButtonText, isToday(date) && styles.dateNavButtonDisabled]}>›</Text>
          </Pressable>
        </View>

        {loading && <ActivityIndicator style={styles.loading} color={colors.primary} />}
        {error && <Text style={styles.error}>{error}</Text>}

        {roster && !loading && (
          <>
            <View style={styles.summaryCard}>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryValue}>
                  {markedCount}/{roster.entries.length}
                </Text>
                <Text style={styles.summaryLabel}>Marked</Text>
              </View>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryValue}>{selfMarkedCount}</Text>
                <Text style={styles.summaryLabel}>Self check-in</Text>
              </View>
            </View>

            {roster.entries.length === 0 && <Text style={styles.empty}>No staff records for this school yet.</Text>}
            {roster.entries.map((entry) => (
              <Pressable
                key={entry.employeeId}
                style={styles.row}
                onPress={() =>
                  navigation.navigate('EmployeeAttendanceHistory', {
                    employee: { id: entry.employeeId, name: entry.employeeName },
                  })
                }
              >
                <View style={styles.rowMain}>
                  <Text style={styles.rowName}>{entry.employeeName}</Text>
                  <Text style={styles.rowMeta}>
                    {entry.designation}
                    {entry.selfMarked ? ' · 📍 self check-in' : ''}
                  </Text>
                </View>
                <StatusChip
                  label={entry.status ? entry.status.replace('_', ' ') : 'Not marked'}
                  variant={entry.status ? statusVariant[entry.status] : 'neutral'}
                />
              </Pressable>
            ))}
          </>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    ...softShadow,
  },
  dateNavButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  dateNavButtonText: { fontSize: 22, fontWeight: '700', color: colors.primary },
  dateNavButtonDisabled: { color: colors.textMuted },
  dateText: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  loading: { marginTop: spacing.xl },
  error: { color: colors.error, marginBottom: spacing.md },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...softShadow,
  },
  summaryStat: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  summaryLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
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
  rowMain: { flex: 1, marginRight: spacing.sm },
  rowName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  rowMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
