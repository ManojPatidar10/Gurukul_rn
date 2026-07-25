import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SectionTitle } from '../../components/SectionTitle';
import { SegmentTabs } from '../../components/SegmentTabs';
import { StatusChip } from '../../components/StatusChip';
import {
  classAttendance,
  facultyAttendance,
  studentAttendance,
} from '../../data/mockPrincipalDashboard';
import { colors, radius, spacing } from '../../theme/colors';
import type { AttendanceSummary, PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'Attendance'>;

function SummaryChips({ summary }: { summary: AttendanceSummary }) {
  return (
    <View style={styles.chipRow}>
      <StatusChip label={`Present ${summary.present}`} variant="success" />
      <StatusChip label={`Absent ${summary.absent}`} variant="error" />
      <StatusChip label={`Late ${summary.late}`} variant="warning" />
    </View>
  );
}

export function AttendanceScreen({ navigation }: Props) {
  const [tabIndex, setTabIndex] = useState(0);
  const summary = tabIndex === 0 ? studentAttendance : facultyAttendance;

  return (
    <View style={styles.root}>
      <ScreenHeader title="Attendance" onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <View style={styles.liveRow}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Live · Updated {summary.updatedAt}</Text>
        </View>

        <SegmentTabs tabs={['Students', 'Faculty']} activeIndex={tabIndex} onChange={setTabIndex} />
        <SummaryChips summary={summary} />

        <View style={styles.rateCard}>
          <Text style={styles.rateLabel}>Overall rate</Text>
          <Text style={styles.rateValue}>
            {Math.round((summary.present / summary.total) * 100)}%
          </Text>
          <Text style={styles.rateSub}>
            {summary.present} of {summary.total} present
          </Text>
        </View>

        {tabIndex === 0 ? (
          <>
            <SectionTitle title="Class-wise Breakdown" />
            {classAttendance.map((item) => {
              const pct = Math.round((item.present / item.total) * 100);
              return (
                <View key={item.className} style={styles.listRow}>
                  <View style={styles.listMain}>
                    <Text style={styles.listTitle}>{item.className}</Text>
                    <Text style={styles.listSub}>
                      {item.present}/{item.total} present
                    </Text>
                  </View>
                  <StatusChip
                    label={`${pct}%`}
                    variant={pct >= 90 ? 'success' : pct >= 80 ? 'warning' : 'error'}
                  />
                </View>
              );
            })}
          </>
        ) : (
          <View style={styles.facultyNote}>
            <Text style={styles.facultyNoteText}>
              4 faculty on planned leave today. 1 late arrival recorded at 9:15 AM.
            </Text>
          </View>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: spacing.sm,
  },
  liveText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  rateCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    alignItems: 'center',
  },
  rateLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  rateValue: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.primary,
    marginVertical: spacing.xs,
  },
  rateSub: {
    fontSize: 13,
    color: colors.textMuted,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  listMain: {
    flex: 1,
  },
  listTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  listSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  facultyNote: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  facultyNoteText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
