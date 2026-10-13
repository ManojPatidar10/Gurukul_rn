import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { DayOfWeek, TimetableClash } from '../api/timetable';
import { colors, radius, spacing } from '../theme/colors';
import { describeClash, formatIsoDate } from '../utils/timetable';

/**
 * The periods a timetable save was refused for, one line each: the teacher busy in another class,
 * the room in use, or (for a one-day change) the substitute marked absent - dated when the clash is
 * on one date rather than in the weekly timetable.
 */
export function ClashList({ clashes, title }: { clashes: TimetableClash[]; title?: string }) {
  const { t, i18n } = useTranslation();
  if (clashes.length === 0) return null;
  const dayName = (d: DayOfWeek) => t(`timetable.days.${d}`);
  return (
    <View style={styles.box}>
      {title && <Text style={styles.title}>{title}</Text>}
      {clashes.map((clash, index) => {
        const d = describeClash(clash);
        const line = t(d.key, { day: dayName(d.day), n: d.n, teacher: d.teacher, section: d.section, room: d.room });
        return (
          <Text key={`${d.day}-${d.n}-${clash.reason ?? ''}-${d.date ?? ''}-${index}`} style={styles.line}>
            {d.date ? t('timetable.editor.clashOnDate', { date: formatIsoDate(d.date, i18n.language), line }) : line}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: '#FDECEC',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  title: { color: colors.error, fontWeight: '700', marginBottom: spacing.xs },
  line: { color: colors.textPrimary, fontSize: 13, marginTop: 2 },
});
