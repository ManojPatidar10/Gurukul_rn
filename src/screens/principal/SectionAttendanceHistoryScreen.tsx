import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { getSectionAttendanceHistory } from '../../api/attendance';
import type { ClassSection, SectionAttendanceHistory } from '../../api/types';
import { ScreenContainer } from '../../components/ScreenContainer';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';

interface Props {
  classSection: ClassSection;
  onSelectStudent: (student: { id: string; name: string }) => void;
}

export function SectionAttendanceHistoryBody({ classSection, onSelectStudent }: Props) {
  const schoolId = useSchoolId();
  const [history, setHistory] = useState<SectionAttendanceHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSectionAttendanceHistory(schoolId, classSection.id)
      .then(setHistory)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [schoolId, classSection.id]);

  return (
    <ScreenContainer>
        {loading && <ActivityIndicator style={styles.loading} />}
        {error && <Text style={styles.error}>{error}</Text>}

        {history && history.students.length === 0 && (
          <Text style={styles.empty}>0 students in this section.</Text>
        )}

        {history?.students.map((student) => {
          const percentPresent =
            student.totalRecords > 0 ? Math.round((student.presentCount / student.totalRecords) * 100) : null;
          return (
            <Pressable
              key={student.studentId}
              style={styles.row}
              onPress={() => onSelectStudent({ id: student.studentId, name: student.studentName })}
            >
              <View style={styles.rowBody}>
                <Text style={styles.rowName}>
                  {student.studentName} · Roll {student.rollNumber}
                </Text>
                <Text style={styles.rowMeta}>
                  {student.totalRecords} day{student.totalRecords === 1 ? '' : 's'} recorded
                </Text>
              </View>
              <Text style={styles.rowPercent}>{percentPresent === null ? '—' : `${percentPresent}%`}</Text>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          );
        })}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: 40 },
  error: { color: colors.error, marginBottom: spacing.md },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  rowBody: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  rowMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  rowPercent: { fontSize: 14, fontWeight: '800', color: colors.textPrimary, marginRight: spacing.xs },
  chevron: { fontSize: 20, color: colors.textMuted },
});
