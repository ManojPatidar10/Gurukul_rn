import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  getDayTimetable,
  getMyTimetable,
  getSectionTimetable,
  getTeacherTimetable,
  type DayOfWeek,
  type Timetable,
  type TimetableSlot,
} from '../../api/timetable';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { TimetableDateBar } from '../../components/TimetableDateBar';
import { TimetableDayTabs } from '../../components/TimetableDayTabs';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import {
  addDaysIso,
  dateViewSlots,
  defaultDay,
  formatIsoDate,
  isIsoDate,
  slotBadge,
  slotsByPeriodForDate,
  slotsForDay,
  todayIso,
  type SlotBadge,
} from '../../utils/timetable';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'MyTimetable'>;

const BADGE_VARIANT: Record<SlotBadge['kind'], 'error' | 'success' | 'warning' | 'info'> = {
  cancelled: 'error',
  extra: 'success',
  takenBy: 'warning',
  covering: 'info',
  substitute: 'warning',
};

/**
 * Read-only timetable: one date (Today by default, with that day's substitutions, cancellations
 * and extra classes) or the regular week. Four sources, picked from the route params:
 * - `classSection`: that section's timetable (a class/subject teacher, or a student, opening a class)
 * - `student`: a parent viewing one child's section
 * - `teacher`: an admin viewing any teacher's periods
 * - none: the caller's own timetable (a teacher's periods across sections, or a student's class)
 * `date` opens on that date - a timetable-change push passes it.
 */
export function MyTimetableScreen({ route, navigation }: Props) {
  const { t, i18n } = useTranslation();
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const classSection = route.params?.classSection;
  const student = route.params?.student;
  const teacher = route.params?.teacher;
  const paramDate = route.params?.date;
  const [selectedDate, setSelectedDate] = useState<string | null>(isIsoDate(paramDate) ? paramDate : todayIso());
  const [timetable, setTimetable] = useState<Timetable | null>(null);
  const [day, setDay] = useState<DayOfWeek>('MONDAY');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  // A timetable-change push tapped while this screen is open brings a new date.
  const [shownParamDate, setShownParamDate] = useState(paramDate);
  if (paramDate !== shownParamDate) {
    setShownParamDate(paramDate);
    if (isIsoDate(paramDate)) setSelectedDate(paramDate);
  }

  const load = useCallback(() => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setError(null);
    const date = selectedDate;
    let request: Promise<Timetable>;
    if (date) {
      request = classSection
        ? getDayTimetable(schoolId, date, { sectionId: classSection.id })
        : teacher
          ? getTeacherTimetable(schoolId, teacher.id, date)
          : getMyTimetable(schoolId, student?.id, date);
    } else {
      request = classSection
        ? getSectionTimetable(schoolId, classSection.id)
        : teacher
          ? getTeacherTimetable(schoolId, teacher.id)
          : getMyTimetable(schoolId, student?.id);
    }
    request
      .then((tt) => {
        if (requestId !== requestRef.current) return;
        setTimetable(tt);
        if (!date) setDay(defaultDay(tt.days));
      })
      .catch((e) => {
        if (requestId === requestRef.current) setError(getErrorMessage(e));
      })
      .finally(() => {
        if (requestId === requestRef.current) setLoading(false);
      });
  }, [schoolId, classSection, teacher, student?.id, selectedDate]);

  useEffect(load, [load]);

  const title = teacher
    ? teacher.name
    : classSection
      ? t('timetable.my.sectionTitle')
      : student
        ? student.name
        : t('timetable.my.title');
  const subtitle = classSection
    ? `${classSection.className} - ${classSection.section}`
    : (timetable?.sectionLabel ?? timetable?.academicYear ?? undefined);

  // Whose eyes the badges speak to: the teacher being viewed, else the signed-in staff member.
  const viewerId = teacher ? teacher.id : session.ownerType === 'EMPLOYEE' ? session.ownerId : null;
  const thirdPerson = !!teacher && !(session.ownerType === 'EMPLOYEE' && session.ownerId === teacher.id);

  const isTeacherView = timetable?.scope === 'TEACHER';
  const today = todayIso();
  const tomorrow = addDaysIso(today, 1);
  const ready = !loading && !error && !!timetable;
  const noSchool = ready && !!selectedDate && timetable.schoolDay === false;
  const dateSlots = timetable && selectedDate ? dateViewSlots(timetable, selectedDate) : [];
  const dateByPeriod = slotsByPeriodForDate(dateSlots, viewerId);
  const weekSlots = timetable && !selectedDate ? slotsForDay(timetable.slots, day) : new Map<number, TimetableSlot>();

  const badgeText = (badge: SlotBadge) =>
    badge.kind === 'cancelled' || badge.kind === 'extra'
      ? t(`timetable.badge.${badge.kind}`)
      : t(`timetable.badge.${badge.kind}`, { teacher: badge.teacher });

  const renderSlot = (slot: TimetableSlot, index: number) => {
    const badge = slotBadge(slot, viewerId, { thirdPerson });
    const cancelled = slot.overrideKind === 'CANCELLED';
    return (
      <View key={`${slot.sectionId}-${slot.overrideId ?? 'regular'}`} style={index > 0 ? styles.slotDivider : undefined}>
        <Text style={[styles.subject, cancelled && styles.struck]}>{slot.subjectName}</Text>
        <Text style={[styles.detail, cancelled && styles.struck]}>
          {isTeacherView ? `${slot.className} - ${slot.section}` : slot.teacherName}
        </Text>
        {!!slot.roomName && !cancelled && <Text style={styles.room}>{t('timetable.room', { name: slot.roomName })}</Text>}
        {badge && (
          <View style={styles.badge}>
            <StatusChip label={badgeText(badge)} variant={BADGE_VARIANT[badge.kind]} />
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={title} subtitle={subtitle} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <TimetableDateBar value={selectedDate} onChange={setSelectedDate} showWeek />

        {loading && <ActivityIndicator color={colors.primary} style={styles.loading} />}
        {error && (
          <View>
            <ErrorNotice message={t('timetable.loadFailed', { message: error })} />
            <Pressable onPress={load} style={styles.retry}>
              <Text style={styles.retryText}>{t('common.retry')}</Text>
            </Pressable>
          </View>
        )}

        {ready && timetable.periods.length === 0 && <Text style={styles.empty}>{t('timetable.noPeriods')}</Text>}

        {noSchool && selectedDate && (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>
              {t('timetable.date.noSchool', { date: formatIsoDate(selectedDate, i18n.language) })}
            </Text>
            {!!timetable?.holidayName && (
              <Text style={styles.noticeText}>{t('timetable.date.holiday', { name: timetable.holidayName })}</Text>
            )}
            <View style={styles.noticeButtons}>
              {selectedDate !== tomorrow && (
                <Pressable style={styles.noticeButton} onPress={() => setSelectedDate(tomorrow)}>
                  <Text style={styles.noticeButtonText}>{t('timetable.date.tomorrow')}</Text>
                </Pressable>
              )}
              <Pressable style={styles.noticeButton} onPress={() => setSelectedDate(null)}>
                <Text style={styles.noticeButtonText}>{t('timetable.date.week')}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {ready && !noSchool && selectedDate && timetable.periods.length > 0 && (
          <>
            {dateSlots.length === 0 && <Text style={styles.empty}>{t('timetable.my.nothingToday')}</Text>}
            {timetable.periods.map((period) => {
              const slots = dateByPeriod.get(period.periodNumber) ?? [];
              return (
                <View key={period.periodNumber} style={[styles.row, period.breakPeriod && styles.breakRow]}>
                  <View style={styles.timeCol}>
                    <Text style={styles.time}>{period.startTime}</Text>
                    <Text style={styles.timeEnd}>{period.endTime}</Text>
                  </View>
                  <View style={styles.bodyCol}>
                    {period.breakPeriod ? (
                      <Text style={styles.breakText}>{period.label ?? t('timetable.break')}</Text>
                    ) : slots.length > 0 ? (
                      slots.map(renderSlot)
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

        {ready && !selectedDate && timetable.periods.length > 0 && (
          <>
            {timetable.slots.length === 0 && (
              <Text style={styles.empty}>
                {isTeacherView ? t('timetable.my.emptyTeacher') : t('timetable.my.emptySection')}
              </Text>
            )}
            <TimetableDayTabs days={timetable.days} selected={day} onSelect={setDay} />
            {timetable.periods.map((period) => {
              const slot = weekSlots.get(period.periodNumber);
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
                        {!!slot.roomName && <Text style={styles.room}>{t('timetable.room', { name: slot.roomName })}</Text>}
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
  retry: { alignSelf: 'flex-start', paddingVertical: spacing.sm },
  retryText: { color: colors.primary, fontWeight: '700' },
  empty: { color: colors.textMuted, marginBottom: spacing.md, fontSize: 14 },
  notice: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...softShadow,
  },
  noticeTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  noticeText: { color: colors.textSecondary, fontSize: 14, marginTop: spacing.xs },
  noticeButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  noticeButton: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  noticeButtonText: { color: colors.primary, fontWeight: '700' },
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
  slotDivider: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  subject: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  detail: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  room: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  struck: { textDecorationLine: 'line-through', color: colors.textMuted },
  badge: { flexDirection: 'row', marginTop: spacing.xs },
  free: { fontSize: 14, color: colors.textMuted, fontStyle: 'italic' },
  breakText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  periodNo: { fontSize: 12, color: colors.textMuted },
});
