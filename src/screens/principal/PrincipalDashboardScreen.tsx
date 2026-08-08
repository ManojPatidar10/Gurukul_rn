import { FontAwesome5 } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getClassSection, listClassSections } from '../../api/classSections';
import { getEmployee, listEmployees } from '../../api/employees';
import { getSchool } from '../../api/schools';
import { getStudent, listStudents } from '../../api/students';
import type { ClassSection, Employee, School } from '../../api/types';
import { listVendors } from '../../api/vendors';
import { FeatureTile } from '../../components/FeatureTile';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatSummaryCard } from '../../components/StatSummaryCard';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, spacing } from '../../theme/colors';
import type { FeatureAction, FeatureId, PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'PrincipalDashboard'>;

const featureActions: FeatureAction[] = [
  { id: 'students', title: 'Students', icon: 'user-graduate', description: 'Manage student records and class-sections' },
  { id: 'employees', title: 'Employees', icon: 'id-badge', description: 'Manage staff records' },
  { id: 'vendors', title: 'Vendors', icon: 'truck', description: 'Manage vendor directory' },
  { id: 'fees', title: 'Fees', icon: 'file-invoice-dollar', description: 'Fee structures, dues, and payments' },
  { id: 'payroll', title: 'Payroll', icon: 'money-check-alt', description: 'Salary structures and payroll runs' },
  {
    id: 'infraExpenses',
    title: 'Infra Expenses',
    icon: 'tools',
    description: 'Submit, approve, purchase, and pay infrastructure requests',
  },
  {
    id: 'classes',
    title: 'Classes',
    icon: 'chalkboard-teacher',
    description: 'Sections, subjects, assessments, and attendance',
  },
  {
    id: 'myClassSection',
    title: 'My Class Section',
    icon: 'door-open',
    description: 'Attendance and assessments for your homeroom class',
  },
  {
    id: 'calls',
    title: 'Video Calls',
    icon: 'video',
    description: 'Start or schedule a video call',
  },
  {
    id: 'gamification',
    title: 'Game Hub',
    icon: 'trophy',
    description: 'XP, streaks, and levels',
  },
  {
    id: 'arena',
    title: 'Gurukul Arena',
    icon: 'gamepad',
    description: 'Build the quiz question bank for student challenges',
  },
  {
    id: 'events',
    title: 'School Events',
    icon: 'calendar-alt',
    description: 'Annual function, sports meet, competitions, and more',
  },
  {
    id: 'reportCard',
    title: 'Report Card',
    icon: 'file-alt',
    description: 'Your term grades and attendance',
  },
  {
    id: 'gradingScale',
    title: 'Grading Scale',
    icon: 'sliders-h',
    description: 'Marks-percentage to letter-grade bands',
  },
  {
    id: 'markMyAttendance',
    title: 'Mark My Attendance',
    icon: 'map-marker-alt',
    description: 'Check in from the school premises',
  },
  {
    id: 'schoolLocation',
    title: 'School Location',
    icon: 'map-pin',
    description: 'Geofence for teacher self-attendance',
  },
  {
    id: 'staffAttendance',
    title: 'Staff Attendance',
    icon: 'clipboard-check',
    description: "Today's staff roster and check-in history",
  },
];

// Game Hub is a student-only concept (there is no "my XP" for an admin/teacher account), so it's
// filtered out of the grid below rather than being one more tile everyone sees but can't use.
// Arena is the reverse: students now reach it from inside Game Hub, so its own tile is only
// needed for teachers/admins, who use it to author quiz questions rather than play.
const STUDENT_ONLY_FEATURES: FeatureId[] = ['gamification', 'reportCard'];
// Arena (question authoring) and self-mark check-in are teacher-only concepts - a principal/admin
// self-marking isn't part of this tile's intent even though the backend also permits it for ADMIN.
const TEACHER_ONLY_FEATURES: FeatureId[] = ['arena', 'markMyAttendance'];
// Vendors/Payroll/Infra Expenses are purely school-admin/procurement concerns - a student account
// has no legitimate use for any of them, so they're hidden outright rather than scoped down.
const STUDENT_HIDDEN_FEATURES: FeatureId[] = ['vendors', 'payroll', 'infraExpenses', 'gradingScale', 'schoolLocation', 'staffAttendance'];
// Managing other staff, vendors, fees, and infra requests are school-admin concerns a teacher has
// no business in - Payroll stays visible but is rerouted to just their own payslip history below.
const TEACHER_HIDDEN_FEATURES: FeatureId[] = ['employees', 'vendors', 'fees', 'infraExpenses', 'gradingScale', 'schoolLocation', 'staffAttendance'];

const featureRoutes: Record<FeatureId, keyof PrincipalStackParamList> = {
  students: 'StudentsList',
  employees: 'EmployeesList',
  vendors: 'VendorsList',
  fees: 'FeesHub',
  payroll: 'PayrollHub',
  infraExpenses: 'InfraExpensesList',
  classes: 'ClassesList',
  myClassSection: 'SectionDetail',
  calls: 'VideoCallHub',
  gamification: 'GamificationHub',
  houses: 'HouseWars',
  arena: 'Arena',
  events: 'EventsList',
  reportCard: 'ReportCard',
  gradingScale: 'GradingScale',
  markMyAttendance: 'MarkMyAttendance',
  schoolLocation: 'SchoolLocationSettings',
  staffAttendance: 'StaffAttendance',
};

// Employees/Classes/Fees route to the same screens admins use, but scoped to the student's own
// class-section - the copy needs to reflect that scope instead of the school-wide admin framing.
const STUDENT_COPY: Partial<Record<FeatureId, Pick<FeatureAction, 'title' | 'description'>>> = {
  students: { title: 'My Classmates', description: 'Students in your class' },
  employees: { title: 'My Teachers', description: 'Teachers assigned to your class' },
  classes: { title: 'My Class', description: 'Subjects, assessments, and attendance for your class' },
  fees: { title: 'My Fees', description: 'Your fee dues and payment history' },
};

// Students/Payroll route to the same screens admins use, but scoped to the classes a teacher
// teaches / their own payslips - the copy needs to reflect that instead of the school-wide framing.
const TEACHER_COPY: Partial<Record<FeatureId, Pick<FeatureAction, 'title' | 'description'>>> = {
  students: { title: 'My Students', description: 'Students in classes you teach' },
  payroll: { title: 'My Payslips', description: 'Your own salary history' },
};

function applyRoleCopy(feature: FeatureAction, copy: Partial<Record<FeatureId, Pick<FeatureAction, 'title' | 'description'>>>): FeatureAction {
  const override = copy[feature.id];
  return override ? { ...feature, ...override } : feature;
}

interface Counts {
  students: number | null;
  employees: number | null;
  vendors: number | null;
}

export function PrincipalDashboardScreen({ navigation }: Props) {
  const schoolId = useSchoolId();
  const { session, logout } = useAuth();
  const isStudent = session.ownerType === 'STUDENT';
  const isTeacher = session.role === 'TEACHER';
  const [school, setSchool] = useState<School | null>(null);
  const [myName, setMyName] = useState<string | null>(null);
  const [myEmployee, setMyEmployee] = useState<Employee | null>(null);
  const [myClassSection, setMyClassSection] = useState<ClassSection | null>(null);
  const [myHomeroomSection, setMyHomeroomSection] = useState<ClassSection | null>(null);
  const [counts, setCounts] = useState<Counts>({ students: null, employees: null, vendors: null });

  const visibleFeatures = featureActions
    .filter((feature) => {
      if (feature.id === 'myClassSection') return isTeacher && !!myHomeroomSection;
      if (STUDENT_ONLY_FEATURES.includes(feature.id)) return session.ownerType === 'STUDENT';
      if (session.role === 'ADMIN') return true;
      if (TEACHER_ONLY_FEATURES.includes(feature.id)) return session.role === 'TEACHER';
      if (isStudent && STUDENT_HIDDEN_FEATURES.includes(feature.id)) return false;
      if (isTeacher && TEACHER_HIDDEN_FEATURES.includes(feature.id)) return false;
      return true;
    })
    // Employees/Classes are only scoped to the student's own class-section once it's loaded -
    // rather than briefly showing a tile that would route somewhere before we know where.
    .filter((feature) => !(isStudent && (feature.id === 'employees' || feature.id === 'classes') && !myClassSection))
    .map((feature) => {
      if (isStudent) return applyRoleCopy(feature, STUDENT_COPY);
      if (isTeacher) return applyRoleCopy(feature, TEACHER_COPY);
      return feature;
    });

  useEffect(() => {
    getSchool(schoolId)
      .then(setSchool)
      .catch(() => setSchool(null));
  }, [schoolId]);

  useEffect(() => {
    if (session.ownerType === 'EMPLOYEE') {
      getEmployee(schoolId, session.ownerId)
        .then((owner) => {
          setMyName(owner.name);
          setMyEmployee(owner);
        })
        .catch(() => setMyName(null));
      if (session.role === 'TEACHER') {
        listClassSections(schoolId)
          .then((sections) => setMyHomeroomSection(sections.find((cs) => cs.classTeacherId === session.ownerId) ?? null))
          .catch(() => setMyHomeroomSection(null));
      }
      return;
    }
    getStudent(schoolId, session.ownerId)
      .then((student) => {
        setMyName(student.name);
        if (!student.classSectionId) return;
        getClassSection(schoolId, student.classSectionId)
          .then(setMyClassSection)
          .catch(() => setMyClassSection(null));
      })
      .catch(() => setMyName(null));
  }, [schoolId, session.ownerId, session.ownerType, session.role]);

  useEffect(() => {
    const load = () => {
      listStudents(schoolId)
        .then((rows) => setCounts((prev) => ({ ...prev, students: rows.length })))
        .catch(() => setCounts((prev) => ({ ...prev, students: null })));
      listEmployees(schoolId)
        .then((rows) => setCounts((prev) => ({ ...prev, employees: rows.length })))
        .catch(() => setCounts((prev) => ({ ...prev, employees: null })));
      listVendors(schoolId)
        .then((rows) => setCounts((prev) => ({ ...prev, vendors: rows.length })))
        .catch(() => setCounts((prev) => ({ ...prev, vendors: null })));
    };
    const unsubscribe = navigation.addListener('focus', load);
    load();
    return unsubscribe;
  }, [schoolId, navigation]);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={school?.name ?? 'Gurukul'}
        subtitle={`Welcome, ${myName ?? session.username}`}
        rightAction={
          <View style={styles.headerActions}>
            <Pressable
              style={styles.headerChatButton}
              onPress={() => navigation.navigate('GlobalSearch')}
              accessibilityLabel="Search"
            >
              <FontAwesome5 name="search" size={18} color={colors.white} />
            </Pressable>
            <Pressable
              style={styles.headerChatButton}
              onPress={() => navigation.navigate('ConversationsList')}
              accessibilityLabel="Messages"
            >
              <FontAwesome5 name="comment-dots" size={18} color={colors.white} />
            </Pressable>
            <Pressable
              style={styles.headerChatButton}
              onPress={() => navigation.navigate('Profile')}
              accessibilityLabel="Profile"
            >
              <FontAwesome5 name="user" size={18} color={colors.white} />
            </Pressable>
          </View>
        }
      />
      <ScreenContainer>
        <View style={styles.sessionRow}>
          <Text style={styles.sessionText}>
            {session.username} · {session.role}
          </Text>
          <Pressable onPress={logout}>
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        </View>

        {!isStudent && !isTeacher && (
          <View style={styles.statRow}>
            <StatSummaryCard accentKey="students" icon="user-graduate" label="Students" value={counts.students} />
            <StatSummaryCard accentKey="employees" icon="id-badge" label="Employees" value={counts.employees} />
            <StatSummaryCard accentKey="vendors" icon="truck" label="Vendors" value={counts.vendors} />
          </View>
        )}

        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.tileGrid}>
          {visibleFeatures.map((feature) => (
            <FeatureTile
              key={feature.id}
              feature={feature}
              onPress={() => {
                if (isStudent && feature.id === 'students') {
                  navigation.navigate('Classmates');
                  return;
                }
                if (isStudent && myClassSection && feature.id === 'employees') {
                  navigation.navigate('SectionSubjectsList', { classSection: myClassSection });
                  return;
                }
                if (isStudent && myClassSection && feature.id === 'classes') {
                  navigation.navigate('SectionDetail', { classSection: myClassSection });
                  return;
                }
                if (isStudent && feature.id === 'fees') {
                  navigation.navigate('MyFees');
                  return;
                }
                if (isStudent && feature.id === 'reportCard') {
                  navigation.navigate('ReportCard', {
                    student: { id: session.ownerId, name: myName ?? session.username },
                  });
                  return;
                }
                if (isTeacher && feature.id === 'students') {
                  navigation.navigate('MyStudents');
                  return;
                }
                if (isTeacher && myEmployee && feature.id === 'payroll') {
                  navigation.navigate('SalaryHistory', { employee: myEmployee });
                  return;
                }
                if (isTeacher && myHomeroomSection && feature.id === 'myClassSection') {
                  navigation.navigate('SectionDetail', { classSection: myHomeroomSection });
                  return;
                }
                navigation.navigate(featureRoutes[feature.id] as never);
              }}
            />
          ))}
        </View>
      </ScreenContainer>
      <Pressable style={styles.fab} onPress={() => navigation.navigate('HelpdeskBot')} accessibilityLabel="Helpdesk Bot">
        <FontAwesome5 name="robot" size={22} color={colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerChatButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
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
    shadowColor: '#0F1E3D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sessionText: { fontSize: 13, color: colors.textMuted },
  logoutText: { fontSize: 13, color: colors.error, fontWeight: '700' },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
});
