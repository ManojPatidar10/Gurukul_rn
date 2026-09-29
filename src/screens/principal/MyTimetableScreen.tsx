import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getMyTimetable, getSectionTimetable, type DayOfWeek, type Timetable } from '../../api/timetable';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { TimetableDayTabs } from '../../components/TimetableDayTabs';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { defaultDay, slotsForDay } from '../../utils/timetable';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'MyTimetable'>;

/**
 * Read-only week view. Three sources, picked from the route params:
 * - `classSection`: that section's timetable (a class/subject teacher, or a student, opening a class)
 * - `student`: a parent viewing one child's section
 * - neither: the caller's own timetable (a teacher's periods across sections, or a student's class)
 */
export function MyTimetableScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const classSection = route.params?.classSection;
  const student = route.params?.student;
  const [timetable, setTimetable] = useState<Timetable | null>(null);
  const [day, setDay] = useState<DayOfWeek>('MONDAY');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const request = classSection
      ? getSectionTimetable(schoolId, classSection.id)
      : getMyTimetable(schoolId, student?.id);
    request
      .then((tt) => {
        setTimetable(tt);
        setDay(defaultDay(tt.days));
      })
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [schoolId, classSection, student?.id]);

  useEffect(load, [load]);

  const title = classSection
    ? t('timetable.my.sectionTitle')
    : student
      ? student.name
      : t('timetable.my.title');
  const subtitle = classSection
    ? `${classSection.className} - ${classSection.section}`
    : (timetable?.sectionLabel ?? timetable?.academicYear ?? undefined);

  const isTeacherView = timetable?.scope === 'TEACHER';
  const daySlots = timetable ? slotsForDay(timetable.slots, day) : new Map();

  return (
    <View style={styles.root}>
      <ScreenHeader title={title} subtitle={subtitle} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        {loading && <ActivityIndicator color={colors.primary} style={styles.loading} />}
        {error && (
          <View>
            <ErrorNotice message={t('timetable.loadFailed', { message: error })} />
            <Pressable onPress={load} style={styles.retry}>
              <Text style={styles.retryText}>{t('common.retry')}</Text>
            </Pressable>
          </View>
        )}

        {!loading && !error && timetable && timetable.periods.length === 0 && (
          <Text style={styles.empty}>{t('timetable.noPeriods')}</Text>
        )}

        {!loading && !error && timetable && timetable.periods.length > 0 && (
          <>
            {timetable.slots.length === 0 && (
              <Text style={styles.empty}>
                {isTeacherView ? t('timetable.my.emptyTeacher') : t('timetable.my.emptySection')}
              </Text>
            )}
            <TimetableDayTabs days={timetable.days} selected={day} onSelect={setDay} />
            {timetable.periods.map((period) => {
              const slot = daySlots.get(period.periodNumber);
              return (
                <View key={period.periodNumber} style={[styles.row, period.breakPeriod && styles.breakRow]}>
                  <View style={styles.timeCol}>
                    <Text style={styles.time}>{period.startTime}</Text>
                    <Text style={styles.timeEnd}>{period.endTime}</Text>
                  </View>
                  <View style={styles.bodyCol}>
                    {period.breakPeriod ? (
                      <Text style={styles.breakText}>{period.label ?? t('timetable.break')}</Text>
                    ) : slot ? (
                      <>
                        <Text style={styles.subject}>{slot.subjectName}</Text>
                        <Text style={styles.detail}>
                          {isTeacherView ? `${slot.className} - ${slot.section}` : slot.teacherName}
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.free}>{t('timetable.free')}</Text>
                    )}
                  </View>
                  <Text style={styles.periodNo}>
                    {period.breakPeriod ? '' : (period.label ?? t('timetable.periodN', { n: period.periodNumber }))}
                  </Text>
                </View>
              );
            })}
          </>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  error: { color: colors.error, marginBottom: spacing.md },
  retry: { alignSelf: 'flex-start', paddingVertical: spacing.sm },
  retryText: { color: colors.primary, fontWeight: '700' },
  empty: { color: colors.textMuted, marginBottom: spacing.md, fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  breakRow: { backgroundColor: colors.surfaceMuted },
  timeCol: { width: 56 },
  time: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  timeEnd: { fontSize: 12, color: colors.textMuted },
  bodyCol: { flex: 1, paddingHorizontal: spacing.sm },
  subject: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  detail: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  free: { fontSize: 14, color: colors.textMuted, fontStyle: 'italic' },
  breakText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  periodNo: { fontSize: 12, color: colors.textMuted },
});
