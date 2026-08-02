import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { getEmployee } from '../../api/employees';
import { getStudent } from '../../api/students';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'Profile'>;

interface ProfileField {
  label: string;
  value: string;
}

export function ProfileScreen({ navigation }: Props) {
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const [name, setName] = useState<string | null>(null);
  const [fields, setFields] = useState<ProfileField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const load =
      session.ownerType === 'EMPLOYEE'
        ? getEmployee(schoolId, session.ownerId).then((employee) => {
            setName(employee.name);
            setFields([
              { label: 'Designation', value: employee.designation },
              { label: 'Phone', value: employee.contactPhone || '-' },
              { label: 'Join Date', value: employee.joinDate },
              { label: 'Status', value: employee.status },
            ]);
          })
        : getStudent(schoolId, session.ownerId).then((student) => {
            setName(student.name);
            setFields([
              { label: 'Roll Number', value: student.rollNumber },
              { label: 'Class', value: student.classSectionLabel },
              { label: 'Parent Name', value: student.parentName },
              { label: 'Parent Contact', value: student.parentContact },
              { label: 'Admission Date', value: student.admissionDate },
              { label: 'Status', value: student.status },
            ]);
          });

    load.catch((e) => setError((e as Error).message)).finally(() => setLoading(false));
  }, [schoolId, session.ownerId, session.ownerType]);

  return (
    <View style={styles.root}>
      <ScreenHeader title="Profile" onBack={() => navigation.goBack()} />
      <ScreenContainer>
        {loading && <ActivityIndicator color={colors.primary} />}
        {error && <Text style={styles.error}>{error}</Text>}
        {!loading && !error && (
          <View style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(name ?? session.username).trim().charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={styles.name}>{name ?? session.username}</Text>
            <Text style={styles.roleBadge}>{session.role}</Text>

            <View style={styles.fieldList}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Username</Text>
                <Text style={styles.fieldValue}>{session.username}</Text>
              </View>
              {fields.map((field) => (
                <View key={field.label} style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  <Text style={styles.fieldValue}>{field.value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  error: { color: colors.error, fontSize: 13 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: { color: colors.white, fontSize: 28, fontWeight: '800' },
  name: { fontSize: 19, fontWeight: '800', color: colors.textPrimary },
  roleBadge: {
    marginTop: spacing.xs,
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  fieldList: { width: '100%', marginTop: spacing.lg },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  fieldLabel: { fontSize: 13, color: colors.textMuted },
  fieldValue: { fontSize: 14, color: colors.textPrimary, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
});
