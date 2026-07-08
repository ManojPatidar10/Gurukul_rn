import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SectionTitle } from '../../components/SectionTitle';
import { StatusChip } from '../../components/StatusChip';
import { scheduleEntries } from '../../data/mockPrincipalDashboard';
import { colors, radius, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'Schedule'>;

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function ScheduleScreen({ navigation }: Props) {
  const [selectedDay, setSelectedDay] = useState(0);

  return (
    <View style={styles.root}>
      <ScreenHeader title="Schedule" onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroll}>
          {days.map((day, index) => (
            <TouchableOpacity
              key={day}
              style={[styles.dayChip, selectedDay === index && styles.dayChipActive]}
              onPress={() => setSelectedDay(index)}
            >
              <Text style={[styles.dayText, selectedDay === index && styles.dayTextActive]}>
                {day}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.conflictBanner}>
          <StatusChip label="1 conflict" variant="warning" />
          <Text style={styles.conflictText}>Room 105 double-booked at 9:45 AM</Text>
        </View>

        <SectionTitle title={`Timetable — ${days[selectedDay]}`} />
        {scheduleEntries.map((entry) => (
          <View key={`${entry.period}-${entry.time}`} style={styles.periodRow}>
            <View style={styles.periodTime}>
              <Text style={styles.periodLabel}>P{entry.period}</Text>
              <Text style={styles.timeText}>{entry.time}</Text>
            </View>
            <View style={styles.periodDetails}>
              <Text style={styles.classText}>{entry.className}</Text>
              <Text style={styles.teacherText}>{entry.teacher}</Text>
              <Text style={styles.roomText}>Room {entry.room}</Text>
            </View>
          </View>
        ))}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  dayScroll: {
    marginBottom: spacing.lg,
  },
  dayChip: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  dayTextActive: {
    color: colors.white,
  },
  conflictBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#FFF3E0',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  conflictText: {
    flex: 1,
    fontSize: 13,
    color: colors.warning,
    fontWeight: '500',
  },
  periodRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  periodTime: {
    width: 72,
    marginRight: spacing.md,
  },
  periodLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  timeText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  periodDetails: {
    flex: 1,
  },
  classText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  teacherText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  roomText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
});
