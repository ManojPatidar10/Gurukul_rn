import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SegmentTabs } from '../../components/SegmentTabs';
import { StatusChip } from '../../components/StatusChip';
import { notices } from '../../data/mockPrincipalDashboard';
import { colors, radius, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'NoticeBoard'>;

export function NoticeBoardScreen({ navigation }: Props) {
  const [tabIndex, setTabIndex] = useState(0);
  const channel = tabIndex === 0 ? 'parents' : 'teachers';
  const filtered = notices.filter((n) => n.channel === channel);

  return (
    <View style={styles.root}>
      <ScreenHeader title="Notice Board" onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <SegmentTabs tabs={['Parents', 'Teachers']} activeIndex={tabIndex} onChange={setTabIndex} />

        {filtered.map((notice) => (
          <View key={notice.id} style={styles.noticeCard}>
            <View style={styles.noticeHeader}>
              <Text style={styles.noticeTitle}>{notice.title}</Text>
              <StatusChip
                label={notice.channel === 'parents' ? 'Parents' : 'Teachers'}
                variant="info"
              />
            </View>
            <Text style={styles.noticeBody} numberOfLines={3}>
              {notice.body}
            </Text>
            <Text style={styles.noticeTime}>{notice.createdAt}</Text>
          </View>
        ))}
      </ScreenContainer>

      <TouchableOpacity style={styles.fab} accessibilityRole="button" accessibilityLabel="Compose notice">
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  noticeCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  noticeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  noticeTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  noticeBody: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  noticeTime: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  fabText: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '300',
    marginTop: -2,
  },
});
