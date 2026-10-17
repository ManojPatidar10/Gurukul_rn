import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '../../api/errorMessage';
import { getSectionTimetable, type Timetable, type TimetableSlot } from '../../api/timetable';
import { ErrorNotice } from '../../components/ErrorNotice';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { buildTimeline, slotKey, slotsToCells, type TimelineBlock } from '../../utils/timetable';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'TimetableWeek'>;

/** Height of one day's lane. Two lines of text in a block, plus breathing room. */
const LANE_HEIGHT = 56;
/** Width of the pinned day column on the left. */
const DAY_COLUMN = 56;

/**
 * A section's whole week as a timeline: one row per day, clock time running left to right.
 *
 * <p>The editor shows one day at a time, which answers "what is on Tuesday" but never "when is
 * this class free" or "does this teacher have two periods back to back". Laying the days under
 * each other against a shared time axis is what makes those readable at a glance.
 *
 * <p>Blocks are positioned and sized from the clock rather than packed end to end, so a 15-minute
 * break is visibly a third of a 45-minute lesson and a free hour is visibly a hole. That is the
 * whole point of the view, and it is why the time axis scrolls rather than being squeezed to fit:
 * compressing six hours into a phone width would make every block too narrow to name a teacher in.
 */
export function TimetableWeekScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { classSection } = route.params;
  const [timetable, setTimetable] = useState<Timetable | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return getSectionTimetable(schoolId, classSection.id)
      .then(setTimetable)
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [schoolId, classSection.id]);

  useEffect(() => {
    load();
  }, [load]);

  const timeline = buildTimeline(timetable?.periods ?? []);
  const cells = slotsToCells(timetable?.slots ?? []);
  const slotsById = new Map((timetable?.slots ?? []).map((s) => [slotKey(s.dayOfWeek, s.periodNumber), s]));

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('timetable.week.title')}
        subtitle={`${classSection.className} - ${classSection.section}`}
        onBack={() => navigation.goBack()}
      />

      {loading && <ActivityIndicator color={colors.primary} style={styles.loading} />}
      {!loading && error && (
        <View style={styles.message}>
          <ErrorNotice message={error} />
        </View>
      )}
      {!loading && !error && timeline.blocks.length === 0 && (
        // No bell schedule means there is no time axis to draw anything against.
        <Text style={styles.empty}>{t('timetable.week.noSchedule')}</Text>
      )}

      {!loading && !error && timeline.blocks.length > 0 && (
        <ScrollView contentContainerStyle={styles.page}>
          <Text style={styles.hint}>{t('timetable.week.hint')}</Text>

          <View style={styles.grid}>
            {/* The day column stays put while the hours scroll, so a row never loses its label. */}
            <View style={styles.dayColumn}>
              <View style={styles.axisSpacer} />
              {(timetable?.days ?? []).map((day) => (
                <View key={day} style={styles.dayCell}>
                  <Text style={styles.dayText}>{t(`timetable.days.${day}`)}</Text>
                </View>
              ))}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ width: timeline.width }}>
              <View>
                <View style={[styles.axis, { width: timeline.width }]}>
                  {timeline.ticks.map((tick) => (
                    <Text key={tick.time} style={[styles.axisLabel, { left: tick.left }]}>
                      {tick.time}
                    </Text>
                  ))}
                </View>

                {(timetable?.days ?? []).map((day) => (
                  <View key={day} style={[styles.lane, { width: timeline.width }]}>
                    {timeline.ticks.map((tick) => (
                      <View key={tick.time} style={[styles.hourRule, { left: tick.left }]} />
                    ))}
                    {timeline.blocks.map((block) => (
                      <Block
                        key={block.periodNumber}
                        block={block}
                        slot={slotsById.get(slotKey(day, block.periodNumber))}
                        free={!cells[slotKey(day, block.periodNumber)]}
                      />
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function Block({ block, slot, free }: { block: TimelineBlock; slot?: TimetableSlot; free: boolean }) {
  const { t } = useTranslation();

  if (block.breakPeriod) {
    // A break belongs to the whole school, so it carries no subject or teacher - just enough ink
    // to read as an interval rather than an empty period nobody has filled in.
    return (
      <View style={[styles.block, styles.breakBlock, { left: block.left, width: block.width }]}>
        <Text style={styles.breakText} numberOfLines={1}>
          {block.label || t('timetable.break')}
        </Text>
      </View>
    );
  }

  if (free || !slot) {
    return <View style={[styles.block, styles.freeBlock, { left: block.left, width: block.width }]} />;
  }

  return (
    <View style={[styles.block, styles.lessonBlock, { left: block.left, width: block.width }]}>
      <Text style={styles.subject} numberOfLines={1}>
        {slot.subjectName}
      </Text>
      <Text style={styles.teacher} numberOfLines={1}>
        {slot.teacherName}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  message: { padding: spacing.md },
  empty: { color: colors.textMuted, textAlign: 'center', padding: spacing.xl },
  page: { padding: spacing.md },
  hint: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.sm },
  grid: { flexDirection: 'row' },
  dayColumn: { width: DAY_COLUMN },
  axisSpacer: { height: 20 },
  dayCell: { height: LANE_HEIGHT, justifyContent: 'center' },
  dayText: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  axis: { height: 20 },
  axisLabel: { position: 'absolute', fontSize: 10, color: colors.textMuted },
  lane: {
    height: LANE_HEIGHT,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    justifyContent: 'center',
  },
  // A rule under each whole hour, so a block's position can be read off the axis above.
  hourRule: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  block: { position: 'absolute', top: 5, bottom: 5, borderRadius: radius.sm, paddingHorizontal: 5, justifyContent: 'center' },
  lessonBlock: { backgroundColor: colors.primaryLight, borderLeftWidth: 3, borderLeftColor: colors.primary },
  // Free and break are both "no lesson", but only one of them is a gap a principal might want to
  // fill, so they do not look alike.
  freeBlock: { backgroundColor: colors.surfaceMuted },
  breakBlock: { backgroundColor: colors.surfaceMuted, justifyContent: 'center', alignItems: 'center' },
  breakText: { fontSize: 9, color: colors.textMuted },
  subject: { fontSize: 11, fontWeight: '700', color: colors.textPrimary },
  teacher: { fontSize: 10, color: colors.textSecondary, marginTop: 1 },
});
