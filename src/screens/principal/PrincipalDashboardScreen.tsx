import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';

import { FeatureTile } from '../../components/FeatureTile';
import { MiniBarChart } from '../../components/MiniBarChart';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SectionTitle } from '../../components/SectionTitle';
import { StatCard } from '../../components/StatCard';
import {
  dashboardStats,
  featureActions,
  principalProfile,
  recentAlerts,
  weeklyAttendanceTrend,
} from '../../data/mockPrincipalDashboard';
import { colors, radius, spacing } from '../../theme/colors';
import type { FeatureId, PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'PrincipalDashboard'>;

const featureRoutes: Record<FeatureId, keyof PrincipalStackParamList> = {
  attendance: 'Attendance',
  payments: 'Payments',
  progressCards: 'ProgressCards',
  noticeBoard: 'NoticeBoard',
  admissions: 'Admissions',
  students: 'StudentsList',
  aiChatbot: 'AIChatbot',
  schedule: 'Schedule',
  inventory: 'Inventory',
};

export function PrincipalDashboardScreen({ navigation }: Props) {
  return (
    <View style={styles.root}>
      <ScreenHeader
        title={principalProfile.school}
        subtitle={`Welcome, ${principalProfile.name}`}
        showNotification
      />
      <ScreenContainer>
        <View style={styles.statGrid}>
          {dashboardStats.map((stat) => (
            <StatCard key={stat.id} stat={stat} />
          ))}
        </View>

        <SectionTitle title="Quick Actions" />
        <View style={styles.tileGrid}>
          {featureActions.map((feature) => (
            <FeatureTile
              key={feature.id}
              feature={feature}
              onPress={() => navigation.navigate(featureRoutes[feature.id])}
            />
          ))}
        </View>

        <SectionTitle title="Weekly Attendance Trend" />
        <MiniBarChart data={weeklyAttendanceTrend} />

        <SectionTitle title="Recent Alerts" />
        {recentAlerts.map((alert) => (
          <View key={alert.id} style={styles.alertRow}>
            <View
              style={[
                styles.alertDot,
                alert.type === 'warning' && styles.alertDotWarning,
                alert.type === 'success' && styles.alertDotSuccess,
              ]}
            />
            <Text style={styles.alertText}>{alert.message}</Text>
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
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  alertDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginRight: spacing.md,
  },
  alertDotWarning: {
    backgroundColor: colors.warning,
  },
  alertDotSuccess: {
    backgroundColor: colors.success,
  },
  alertText: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
  },
});
