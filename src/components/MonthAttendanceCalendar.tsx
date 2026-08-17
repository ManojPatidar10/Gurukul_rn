import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AttendanceStatus } from '../api/types';
import { colors, spacing } from '../theme/colors';
import { toIsoDate } from './DatePickerField';

interface MonthAttendanceCalendarProps {
  /** Any date within the month to display. */
  month: Date;
  onMonthChange: (month: Date) => void;
  /** Keyed by 'YYYY-MM-DD'. */
  recordsByDate: Record<string, AttendanceStatus>;
  /** Disallow navigating past this month (defaults to the current month). */
  maxMonth?: Date;
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const statusColor: Record<AttendanceStatus, string> = {
  PRESENT: colors.success,
  ABSENT: colors.error,
  LATE: colors.warning,
  HALF_DAY: colors.textSecondary,
};

function buildWeeks(year: number, monthIndex: number): (Date | null)[][] {
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: (Date | null)[] = new Array(firstDay.getDay()).fill(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(year, monthIndex, day));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function sameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function MonthAttendanceCalendar({ month, onMonthChange, recordsByDate, maxMonth }: MonthAttendanceCalendarProps) {
  const weeks = buildWeeks(month.getFullYear(), month.getMonth());
  const upperBound = maxMonth ?? new Date();
  const atMaxMonth = sameMonth(month, upperBound);

  const shiftMonth = (deltaMonths: number) => {
    onMonthChange(new Date(month.getFullYear(), month.getMonth() + deltaMonths, 1));
  };

  return (
    <View>
      <View style={styles.nav}>
        <Pressable style={styles.navButton} onPress={() => shiftMonth(-1)}>
          <Text style={styles.navButtonText}>‹</Text>
        </Pressable>
        <Text style={styles.monthLabel}>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
        <Pressable style={styles.navButton} onPress={() => shiftMonth(1)} disabled={atMaxMonth}>
          <Text style={[styles.navButtonText, atMaxMonth && styles.navButtonDisabled]}>›</Text>
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAY_LABELS.map((label, i) => (
          <Text key={i} style={styles.weekdayLabel}>
            {label}
          </Text>
        ))}
      </View>

      {weeks.map((week, weekIndex) => (
        <View key={weekIndex} style={styles.weekRow}>
          {week.map((day, dayIndex) => {
            if (!day) return <View key={dayIndex} style={styles.dayCell} />;
            const status = recordsByDate[toIsoDate(day)];
            return (
              <View key={dayIndex} style={styles.dayCell}>
                <View style={[styles.dayCircle, status && { backgroundColor: statusColor[status] }]}>
                  <Text style={[styles.dayNumber, status && styles.dayNumberMarked]}>{day.getDate()}</Text>
                </View>
              </View>
            );
          })}
        </View>
      ))}

      <View style={styles.legend}>
        {(Object.keys(statusColor) as AttendanceStatus[]).map((status) => (
          <View key={status} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: statusColor[status] }]} />
            <Text style={styles.legendLabel}>{status.replace('_', ' ')}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  navButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  navButtonText: { fontSize: 22, fontWeight: '700', color: colors.primary },
  navButtonDisabled: { color: colors.textMuted },
  monthLabel: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  weekRow: { flexDirection: 'row' },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    paddingVertical: spacing.xs,
  },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: 3 },
  dayCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumber: { fontSize: 13, color: colors.textPrimary },
  dayNumberMarked: { color: colors.white, fontWeight: '700' },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 11, color: colors.textMuted, textTransform: 'capitalize' },
});
