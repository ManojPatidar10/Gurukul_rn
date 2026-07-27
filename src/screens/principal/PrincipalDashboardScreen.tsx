import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { listEmployees } from '../../api/employees';
import { getSchool } from '../../api/schools';
import { listStudents } from '../../api/students';
import type { School } from '../../api/types';
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
    id: 'chat',
    title: 'Messages',
    icon: 'comments',
    description: 'Chat with staff and students, and the helpdesk bot',
  },
];

const featureRoutes: Record<FeatureId, keyof PrincipalStackParamList> = {
  students: 'StudentsList',
  employees: 'EmployeesList',
  vendors: 'VendorsList',
  fees: 'FeesHub',
  payroll: 'PayrollHub',
  infraExpenses: 'InfraExpensesList',
  classes: 'ClassesList',
  chat: 'ConversationsList',
};

interface Counts {
  students: number | null;
  employees: number | null;
  vendors: number | null;
}

export function PrincipalDashboardScreen({ navigation }: Props) {
  const schoolId = useSchoolId();
  const { session, logout } = useAuth();
  const [school, setSchool] = useState<School | null>(null);
  const [counts, setCounts] = useState<Counts>({ students: null, employees: null, vendors: null });

  useEffect(() => {
    getSchool(schoolId)
      .then(setSchool)
      .catch(() => setSchool(null));
  }, [schoolId]);

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
      <ScreenHeader title={school?.name ?? 'Gurukul'} subtitle={school ? `Welcome, ${school.principalName}` : undefined} />
      <ScreenContainer>
        <View style={styles.sessionRow}>
          <Text style={styles.sessionText}>
            {session.username} · {session.role}
          </Text>
          <Pressable onPress={logout}>
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        </View>

        <View style={styles.statRow}>
          <StatSummaryCard accentKey="students" icon="user-graduate" label="Students" value={counts.students} />
          <StatSummaryCard accentKey="employees" icon="id-badge" label="Employees" value={counts.employees} />
          <StatSummaryCard accentKey="vendors" icon="truck" label="Vendors" value={counts.vendors} />
        </View>

        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.tileGrid}>
          {featureActions.map((feature) => (
            <FeatureTile
              key={feature.id}
              feature={feature}
              onPress={() => navigation.navigate(featureRoutes[feature.id])}
            />
          ))}
        </View>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
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
