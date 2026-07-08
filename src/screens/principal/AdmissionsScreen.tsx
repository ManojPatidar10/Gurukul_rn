import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';

import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SectionTitle } from '../../components/SectionTitle';
import { StatusChip } from '../../components/StatusChip';
import { admissionApplications, admissionStages } from '../../data/mockPrincipalDashboard';
import { colors, radius, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'Admissions'>;

export function AdmissionsScreen({ navigation }: Props) {
  return (
    <View style={styles.root}>
      <ScreenHeader title="Admissions" onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <SectionTitle title="Enrollment Pipeline" />
        <View style={styles.pipeline}>
          {admissionStages.map((stage, index) => (
            <View key={stage.stage} style={styles.stageColumn}>
              <View style={[styles.stageCard, index === admissionStages.length - 1 && styles.stageCardActive]}>
                <Text style={styles.stageCount}>{stage.count}</Text>
                <Text style={styles.stageName}>{stage.stage}</Text>
              </View>
              {index < admissionStages.length - 1 ? <Text style={styles.arrow}>→</Text> : null}
            </View>
          ))}
        </View>

        <SectionTitle title="Recent Applications" />
        {admissionApplications.map((app) => (
          <View key={app.id} style={styles.appRow}>
            <View style={styles.appMain}>
              <Text style={styles.appName}>{app.name}</Text>
              <Text style={styles.appMeta}>
                {app.grade} · Applied {app.appliedAt}
              </Text>
            </View>
            <StatusChip label={app.stage} variant="info" />
          </View>
        ))}

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>57 total inquiries this month</Text>
          <Text style={styles.summarySub}>
            6 students enrolled · 9 interviews scheduled · 3 forms pending review
          </Text>
        </View>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  pipeline: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  stageColumn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stageCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    minHeight: 72,
    justifyContent: 'center',
  },
  stageCardActive: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  stageCount: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  stageName: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  arrow: {
    fontSize: 14,
    color: colors.textMuted,
    marginHorizontal: 2,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  appMain: {
    flex: 1,
  },
  appName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  appMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  summaryCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  summarySub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
});
