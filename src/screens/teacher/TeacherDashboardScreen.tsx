import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

import { FeatureTile } from '../../components/FeatureTile';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SectionTitle } from '../../components/SectionTitle';
import {
  teacherProfile,
  nextClass,
  teacherFeatures,
} from '../../data/mockTeacherDashboard';
import { colors, radius, spacing } from '../../theme/colors';
import type { TeacherFeatureId, TeacherStackParamList } from '../../types/teacher';

type Props = NativeStackScreenProps<TeacherStackParamList, 'TeacherDashboard'>;

const featureRoutes: Record<TeacherFeatureId, keyof TeacherStackParamList> = {
  attendance: 'StudentAttendance',
  quiz: 'QuizAssistant',
  schedule: 'TeacherSchedule',
  library: 'DigitalLibrary',
};

export function TeacherDashboardScreen({ navigation }: Props) {
  return (
    <View style={styles.root}>
      <ScreenHeader
        title={teacherProfile.school}
        subtitle={`Hello, ${teacherProfile.name}`}
        showNotification
      />
      <ScreenContainer>
        <SectionTitle title="Next Class" />
        <View style={styles.nextClassCard}>
          <View style={styles.nextClassMain}>
            <View style={styles.iconCircle}>
              <FontAwesome5 name="clock" size={20} color={colors.primary} />
            </View>
            <View style={styles.nextClassInfo}>
              <Text style={styles.subjectText}>{nextClass.subject}</Text>
              <Text style={styles.classText}>Class {nextClass.className} · {nextClass.time}</Text>
            </View>
          </View>
          <View style={styles.countdownBadge}>
            <Text style={styles.countdownText}>{nextClass.countdown}</Text>
          </View>
        </View>

        <SectionTitle title="Quick Actions" />
        <View style={styles.tileGrid}>
          {teacherFeatures.map((feature) => (
            <FeatureTile
              key={feature.id}
              feature={feature as any} // Using existing tile component
              onPress={() => navigation.navigate(featureRoutes[feature.id] as any)}
            />
          ))}
        </View>

        <SectionTitle title="Recent Notices" />
        <ScrollView style={styles.noticeList} showsVerticalScrollIndicator={false}>
          <View style={styles.noticeItem}>
            <View style={styles.noticeDot} />
            <Text style={styles.noticeText}>Faculty meeting at 4:00 PM today in Hall B.</Text>
          </View>
          <View style={styles.noticeItem}>
            <View style={styles.noticeDot} />
            <Text style={styles.noticeText}>New reference books added to the Digital Library.</Text>
          </View>
          <View style={styles.noticeItem}>
            <View style={styles.noticeDot} />
            <Text style={styles.noticeText}>Mid-term exam schedule has been updated.</Text>
          </View>
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
  nextClassCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  nextClassMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  nextClassInfo: {
    gap: 2,
  },
  subjectText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  classText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  countdownBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
  },
  countdownText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2E7D32',
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  noticeList: {
    maxHeight: 200,
  },
  noticeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  noticeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginRight: spacing.md,
  },
  noticeText: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
  },
});
