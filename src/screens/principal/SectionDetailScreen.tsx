import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { listTeacherAssignments } from '../../api/sectionSubjects';
import type { TeacherSubjectAssignment } from '../../api/types';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { canSeeQuizResults } from '../../utils/quizInsights';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'SectionDetail'>;

const accent = accents.classes;

export function SectionDetailScreen({ route, navigation }: Props) {
  const { session } = useAuth();
  const schoolId = useSchoolId();
  const classSection = route.params.classSection;
  const isAdmin = session.role === 'ADMIN';
  const isStudent = session.ownerType === 'STUDENT';
  // A class teacher has the same report-card authority as admin for their own section (marks entry
  // across every subject, publishing - see AssessmentResultService/ReportCardService on the backend),
  // so the tiles below must be reachable for them too, not just admin.
  const isClassTeacherOfSection = session.role === 'TEACHER' && classSection.classTeacherId === session.ownerId;
  const canManageReportCards = isAdmin || isClassTeacherOfSection;
  // The backend only lets the admin and this section's class teacher read its attendance - other
  // teachers would get a 403 from the attendance screen.
  const canTakeAttendance = isAdmin || isClassTeacherOfSection;

  // Quiz results are open to the admin, the class teacher and the section's subject teachers. Only
  // a teacher who is neither admin nor class teacher needs their assignments to know; if that call
  // fails the tile stays hidden (it is a secondary tile, and the server enforces the rule anyway).
  const needsAssignments =
    session.role === 'TEACHER' && session.ownerType === 'EMPLOYEE' && !isClassTeacherOfSection;
  const [assignments, setAssignments] = useState<TeacherSubjectAssignment[] | null>(null);
  useEffect(() => {
    if (!needsAssignments) return;
    let cancelled = false;
    listTeacherAssignments(schoolId, session.ownerId)
      .then((rows) => {
        if (!cancelled) setAssignments(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [needsAssignments, schoolId, session.ownerId]);
  const canSeeQuiz = canSeeQuizResults(session, classSection, assignments);

  const items: { title: string; description: string; onPress: () => void }[] = [
    // A student's classmates live here rather than as their own dashboard tile, on the student-safe
    // Classmates screen instead of the staff roster.
    isStudent
      ? {
          title: 'My classmates',
          description: 'Students in your class',
          onPress: () => navigation.navigate('Classmates'),
        }
      : {
          title: 'Students',
          description: 'View students enrolled in this section',
          onPress: () => navigation.navigate('SectionStudentsList', { classSection }),
        },
    {
      title: isStudent ? 'Subjects & teachers' : 'Subjects',
      description: 'Subjects taught in this section, with assigned teacher',
      onPress: () => navigation.navigate('SectionSubjectsList', { classSection }),
    },
    {
      title: 'Assessments',
      description: 'Tests, quizzes and exams for this class',
      onPress: () => navigation.navigate('SectionAssessmentsList', { classSection }),
    },
    {
      title: 'Timetable',
      description: isAdmin ? 'Build or change the weekly timetable' : 'Weekly timetable for this section',
      onPress: () =>
        isAdmin
          ? navigation.navigate('TimetableEditor', { classSection })
          : navigation.navigate('MyTimetable', { classSection }),
    },
    ...(canTakeAttendance
      ? [
          {
            title: 'Attendance',
            description: 'Take attendance for a date, or view history',
            onPress: () => navigation.navigate('AttendanceTake', { classSection }),
          },
        ]
      : []),
    ...(canManageReportCards
      ? [
          ...(isClassTeacherOfSection
            ? [
                {
                  title: 'Class fees',
                  description: 'Fee payment status for students in your class',
                  onPress: () => navigation.navigate('MyClassFees', { classSection }),
                },
              ]
            : []),
          {
            title: 'Class marks grid',
            description: 'Every student x subject marks for a term, side by side',
            onPress: () => navigation.navigate('SectionReportCardsGrid', { classSection }),
          },
          {
            title: 'Publish report cards',
            description: "Release a term's report cards to every student in this section",
            onPress: () => navigation.navigate('PublishReportCards', { classSection }),
          },
        ]
      : []),
    // Last, so a subject teacher's tile appearing once assignments load doesn't shift the others.
    ...(canSeeQuiz
      ? [
          {
            title: 'Quiz results',
            description: 'How students did in Practice, Arena and Battle',
            onPress: () => navigation.navigate('QuizResults', { classSection }),
          },
        ]
      : []),
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
