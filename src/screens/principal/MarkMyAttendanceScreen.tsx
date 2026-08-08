import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { getEmployeeAttendanceHistory, selfMarkAttendance } from '../../api/staffAttendance';
import type { AttendanceStatus, EmployeeAttendanceHistory, StaffAttendanceRecord } from '../../api/types';
import { toIsoDate } from '../../components/DatePickerField';
import { MonthAttendanceCalendar } from '../../components/MonthAttendanceCalendar';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'MarkMyAttendance'>;

type Status = 'checking' | 'idle' | 'locating' | 'submitting' | 'success' | 'error';

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthRange(month: Date) {
  const from = toIsoDate(new Date(month.getFullYear(), month.getMonth(), 1));
  const to = toIsoDate(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  return { from, to };
}

export function MarkMyAttendanceScreen({ navigation }: Props) {
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const [status, setStatus] = useState<Status>('checking');
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<StaffAttendanceRecord | null>(null);
  const [month, setMonth] = useState(() => new Date());
  const [monthHistory, setMonthHistory] = useState<EmployeeAttendanceHistory | null>(null);
  const [loadingMonth, setLoadingMonth] = useState(true);

  useEffect(() => {
    setLoadingMonth(true);
    const { from, to } = monthRange(month);
    getEmployeeAttendanceHistory(schoolId, session.ownerId, from, to)
      .then(setMonthHistory)
      .catch(() => setMonthHistory(null))
      .finally(() => setLoadingMonth(false));
  }, [schoolId, session.ownerId, month]);

  const recordsByDate = useMemo(() => {
    const map: Record<string, AttendanceStatus> = {};
    monthHistory?.records.forEach((r) => {
      map[r.attendanceDate] = r.status;
    });
    return map;
  }, [monthHistory]);

  useEffect(() => {
    const today = todayDate();
    getEmployeeAttendanceHistory(schoolId, session.ownerId, today, today)
      .then((history) => {
        const todayRecord = history.records.find((r) => r.attendanceDate === today);
        if (todayRecord) {
          setRecord(todayRecord);
          setStatus('success');
        } else {
          setStatus('idle');
        }
      })
      .catch(() => setStatus('idle'));
  }, [schoolId, session.ownerId]);

  const handleMark = async () => {
    setError(null);
    setStatus('locating');
    try {
      const { status: permission } = await Location.requestForegroundPermissionsAsync();
      if (permission !== 'granted') {
        setError('Location permission is required to mark attendance from here.');
        setStatus('error');
        return;
      }

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setStatus('submitting');
      const saved = await selfMarkAttendance(schoolId, {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy ?? undefined,
      });
      setRecord(saved);
      setStatus('success');
    } catch (e) {
      setError((e as Error).message);
      setStatus('error');
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Mark My Attendance" onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <View style={styles.card}>
          {status === 'checking' ? (
            <ActivityIndicator color={colors.primary} />
          ) : status === 'success' && record ? (
            <>
              <Text style={styles.successIcon}>✓</Text>
              <Text style={styles.title}>You&apos;re marked present</Text>
              <Text style={styles.subtitle}>{record.attendanceDate}</Text>
              <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()}>
                <Text style={styles.secondaryButtonText}>Done</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.title}>Check in from the school</Text>
              <Text style={styles.subtitle}>
                We&apos;ll use your current location to confirm you&apos;re within the school&apos;s premises before
                marking today&apos;s attendance.
              </Text>
              {error && <Text style={styles.error}>{error}</Text>}
              <Pressable
                style={styles.primaryButton}
                onPress={handleMark}
                disabled={status === 'locating' || status === 'submitting'}
              >
                {status === 'locating' || status === 'submitting' ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {status === 'error' ? 'Try again' : 'Mark my attendance'}
                  </Text>
                )}
              </Pressable>
              {status === 'locating' && <Text style={styles.hint}>Getting your location...</Text>}
              {status === 'submitting' && <Text style={styles.hint}>Verifying you&apos;re within range...</Text>}
            </>
          )}
        </View>

        <Text style={styles.calendarTitle}>Past attendance</Text>
        <View style={styles.calendarCard}>
          {loadingMonth && <ActivityIndicator style={styles.loading} color={colors.primary} />}
          <MonthAttendanceCalendar month={month} onMonthChange={setMonth} recordsByDate={recordsByDate} />
        </View>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.lg,
    ...softShadow,
  },
  successIcon: {
    fontSize: 40,
    color: colors.success,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  title: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  error: { color: colors.error, fontSize: 13, textAlign: 'center', marginBottom: spacing.md },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    minWidth: 200,
  },
  primaryButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  secondaryButton: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    minWidth: 200,
  },
  secondaryButtonText: { color: colors.textPrimary, fontWeight: '700', fontSize: 15 },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: spacing.md },
  calendarTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  calendarCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...softShadow,
  },
  loading: { marginBottom: spacing.sm },
});
