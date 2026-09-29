import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { DayOfWeek } from '../api/timetable';
import { colors, radius, spacing } from '../theme/colors';

interface Props {
  days: DayOfWeek[];
  selected: DayOfWeek;
  onSelect: (day: DayOfWeek) => void;
}

/**
 * One tab per school day. A phone can't fit a readable 6-day x 8-period grid, so every timetable
 * screen shows one day at a time with its periods as rows.
 */
export function TimetableDayTabs({ days, selected, onSelect }: Props) {
  const { t } = useTranslation();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.scroll}>
      {days.map((day) => {
        const active = day === selected;
        return (
          <Pressable
            key={day}
            onPress={() => onSelect(day)}
            style={[styles.tab, active && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.tabText, active && styles.tabTextActive]}>{t(`timetable.days.${day}`)}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, marginBottom: spacing.md },
  row: { gap: spacing.sm, paddingVertical: spacing.xs },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 52,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  tabTextActive: { color: colors.white },
});
