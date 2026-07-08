import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SectionTitle } from '../../components/SectionTitle';
import { StatusChip } from '../../components/StatusChip';
import { mockStudents } from '../../data/mockTeacherDashboard';
import { colors, radius, spacing } from '../../theme/colors';
import type { TeacherStackParamList, StudentAttendanceRecord } from '../../types/teacher';

type Props = NativeStackScreenProps<TeacherStackParamList, 'StudentAttendance'>;

export function StudentAttendanceScreen({ navigation }: Props) {
  const [students, setStudents] = useState<StudentAttendanceRecord[]>(mockStudents);

  const toggleStatus = (id: string, status: StudentAttendanceRecord['status']) => {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  };

  const renderItem = ({ item }: { item: StudentAttendanceRecord }) => (
    <View style={styles.studentCard}>
      <View style={styles.studentInfo}>
        <Text style={styles.studentName}>{item.name}</Text>
        <Text style={styles.studentRoll}>Roll No: {item.rollNo}</Text>
      </View>
      <View style={styles.statusButtons}>
        <TouchableOpacity
          style={[styles.statusBtn, item.status === 'present' && styles.btnPresent]}
          onPress={() => toggleStatus(item.id, 'present')}
        >
          <Text style={[styles.btnText, item.status === 'present' && styles.btnTextActive]}>P</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statusBtn, item.status === 'absent' && styles.btnAbsent]}
          onPress={() => toggleStatus(item.id, 'absent')}
        >
          <Text style={[styles.btnText, item.status === 'absent' && styles.btnTextActive]}>A</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statusBtn, item.status === 'late' && styles.btnLate]}
          onPress={() => toggleStatus(item.id, 'late')}
        >
          <Text style={[styles.btnText, item.status === 'late' && styles.btnTextActive]}>L</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <ScreenHeader title="Mark Attendance" onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <FlatList
          data={students}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.headerInfo}>
              <View>
                <Text style={styles.classLabel}>Class 10-A</Text>
                <Text style={styles.dateLabel}>July 8, 2026</Text>
              </View>
              <StatusChip label="In Progress" variant="warning" />
            </View>
          }
          ListFooterComponent={
            <TouchableOpacity style={styles.submitBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.submitText}>Submit Attendance</Text>
            </TouchableOpacity>
          }
        />
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  classLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  dateLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  listContainer: {
    paddingBottom: spacing.xl,
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  studentRoll: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  statusButtons: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  statusBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  btnTextActive: {
    color: colors.white,
  },
  btnPresent: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  btnAbsent: {
    backgroundColor: colors.error,
    borderColor: colors.error,
  },
  btnLate: {
    backgroundColor: colors.warning,
    borderColor: colors.warning,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  submitText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
