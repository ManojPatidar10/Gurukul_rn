import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'SectionDetail'>;

const accent = accents.classes;

export function SectionDetailScreen({ route, navigation }: Props) {
  const classSection = route.params.classSection;

  const items: { title: string; description: string; onPress: () => void }[] = [
    {
      title: 'Students',
      description: 'View students enrolled in this section',
      onPress: () => navigation.navigate('SectionStudentsList', { classSection }),
    },
    {
      title: 'Subjects',
      description: 'Subjects taught in this section, with assigned teacher',
      onPress: () => navigation.navigate('SectionSubjectsList', { classSection }),
    },
    {
      title: 'Assessments',
      description: 'Assignments, quizzes, tests, and exams',
      onPress: () => navigation.navigate('SectionAssessmentsList', { classSection }),
    },
    {
      title: 'Attendance',
      description: 'Take or edit attendance for a date',
      onPress: () => navigation.navigate('AttendanceTake', { classSection }),
    },
  ];

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={`${classSection.className} - ${classSection.section}`}
        subtitle={classSection.academicYear}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        {items.map((item) => (
          <Pressable key={item.title} style={styles.row} onPress={item.onPress}>
            <View style={styles.accentBar} />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowDescription}>{item.description}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...softShadow,
  },
  accentBar: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: radius.pill,
    backgroundColor: accent.base,
    marginRight: spacing.md,
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  rowDescription: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  chevron: { fontSize: 22, color: colors.textMuted, marginLeft: spacing.sm },
});
