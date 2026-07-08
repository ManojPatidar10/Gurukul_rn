import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View, ScrollView } from 'react-native';

import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SectionTitle } from '../../components/SectionTitle';
import { StatusChip } from '../../components/StatusChip';
import { teacherSchedule } from '../../data/mockTeacherDashboard';
import { colors, radius, spacing } from '../../theme/colors';
import type { TeacherStackParamList } from '../../types/teacher';

type Props = NativeStackScreenProps<TeacherStackParamList, 'TeacherSchedule'>;

export function TeacherScheduleScreen({ navigation }: Props) {
  return (
    <View style={styles.root}>
      <ScreenHeader title="My Schedule" onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <View style={styles.reminderCard}>
          <Text style={styles.reminderTitle}>Pre-class Reminders</Text>
          <Text style={styles.reminderSub}>Get notified 5 mins before each session</Text>
          <View style={styles.reminderToggle}>
             <StatusChip label="Enabled" variant="success" />
          </View>
        </View>

        <SectionTitle title="Today's Timetable" />
        <ScrollView showsVerticalScrollIndicator={false}>
          {teacherSchedule.map((item) => (
            <View key={item.id} style={styles.scheduleRow}>
              <View style={styles.timeInfo}>
                <Text style={styles.timeText}>{item.time}</Text>
                <Text style={styles.durationText}>{item.duration}</Text>
              </View>
              <View style={styles.subjectInfo}>
                <Text style={styles.subjectText}>{item.subject}</Text>
                <Text style={styles.roomText}>Room {item.room}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  reminderCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  reminderSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  reminderToggle: {
    marginTop: spacing.md,
    alignItems: 'flex-start',
  },
  scheduleRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  timeInfo: {
    width: 80,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    marginRight: spacing.lg,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  durationText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  subjectInfo: {
    flex: 1,
  },
  subjectText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  roomText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
