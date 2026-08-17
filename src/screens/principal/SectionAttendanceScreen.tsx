import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AttendanceTakeBody } from './AttendanceTakeBody';
import { SectionAttendanceHistoryBody } from './SectionAttendanceHistoryScreen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, radius, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'AttendanceTake'>;
type Tab = 'take' | 'history';

export function SectionAttendanceScreen({ route, navigation }: Props) {
  const classSection = route.params.classSection;
  const [tab, setTab] = useState<Tab>('take');

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={`${classSection.className} - ${classSection.section}`}
        subtitle="Attendance"
        onBack={() => navigation.goBack()}
      />
      <View style={styles.tabRow}>
        <Pressable style={[styles.tab, tab === 'take' && styles.tabActive]} onPress={() => setTab('take')}>
          <Text style={[styles.tabText, tab === 'take' && styles.tabTextActive]}>Take Attendance</Text>
        </Pressable>
        <Pressable style={[styles.tab, tab === 'history' && styles.tabActive]} onPress={() => setTab('history')}>
          <Text style={[styles.tabText, tab === 'history' && styles.tabTextActive]}>History</Text>
        </Pressable>
      </View>

      {tab === 'take' ? (
        <AttendanceTakeBody classSection={classSection} />
      ) : (
        <SectionAttendanceHistoryBody
          classSection={classSection}
          onSelectStudent={(student) => navigation.navigate('AttendanceHistory', { student })}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    padding: 4,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.pill, alignItems: 'center' },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  tabTextActive: { color: colors.white },
});
