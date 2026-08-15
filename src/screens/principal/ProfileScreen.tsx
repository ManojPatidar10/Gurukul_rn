import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getEmployee, updateEmployee } from '../../api/employees';
import { getStudent, updateStudent } from '../../api/students';
import type { Employee, Student } from '../../api/types';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'Profile'>;

export function ProfileScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { session, logout } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');
  const [parentContact, setParentContact] = useState('');

  const load = () => {
    setLoading(true);
    setError(null);
    const request =
      session.ownerType === 'EMPLOYEE'
        ? getEmployee(schoolId, session.ownerId).then((row) => {
            setEmployee(row);
            setName(row.name);
            setContactPhone(row.contactPhone ?? '');
          })
        : getStudent(schoolId, session.ownerId).then((row) => {
            setStudent(row);
            setName(row.name);
            setAddress(row.address);
            setParentContact(row.parentContact);
          });
    request.catch((e) => setError((e as Error).message)).finally(() => setLoading(false));
  };

  useEffect(load, [schoolId, session.ownerId, session.ownerType]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (session.ownerType === 'EMPLOYEE' && employee) {
        const updated = await updateEmployee(schoolId, employee.id, {
          name,
          designation: employee.designation,
          joinDate: employee.joinDate,
          bankAccount: employee.bankAccount,
          contactPhone,
          status: employee.status,
        });
        setEmployee(updated);
      } else if (student) {
        const updated = await updateStudent(schoolId, student.id, {
          name,
          dob: student.dob,
          gender: student.gender,
          address,
          parentName: student.parentName,
          parentContact,
          classSectionId: student.classSectionId,
          admissionDate: student.admissionDate,
          status: student.status,
        });
        setStudent(updated);
      }
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const displayName = employee?.name ?? student?.name ?? session.username;

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('common.profile')} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        {loading && <ActivityIndicator color={colors.primary} />}
        {error && <Text style={styles.error}>{error}</Text>}
        {!loading && !error && (employee || student) && (
          <View style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{displayName.trim().charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.roleBadge}>{session.role}</Text>

            {!editing ? (
              <View style={styles.fieldList}>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Username</Text>
                  <Text style={styles.fieldValue}>{session.username}</Text>
                </View>
                {employee && (
                  <>
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Designation</Text>
                      <Text style={styles.fieldValue}>{employee.designation}</Text>
                    </View>
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Phone</Text>
                      <Text style={styles.fieldValue}>{employee.contactPhone || '-'}</Text>
                    </View>
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Join Date</Text>
                      <Text style={styles.fieldValue}>{employee.joinDate}</Text>
                    </View>
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Status</Text>
                      <Text style={styles.fieldValue}>{employee.status}</Text>
                    </View>
                  </>
                )}
                {student && (
                  <>
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Roll Number</Text>
                      <Text style={styles.fieldValue}>{student.rollNumber}</Text>
                    </View>
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Class</Text>
                      <Text style={styles.fieldValue}>{student.classSectionLabel}</Text>
                    </View>
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Address</Text>
                      <Text style={styles.fieldValue}>{student.address}</Text>
                    </View>
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Parent Name</Text>
                      <Text style={styles.fieldValue}>{student.parentName}</Text>
                    </View>
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Parent Contact</Text>
                      <Text style={styles.fieldValue}>{student.parentContact}</Text>
                    </View>
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Admission Date</Text>
                      <Text style={styles.fieldValue}>{student.admissionDate}</Text>
                    </View>
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Status</Text>
                      <Text style={styles.fieldValue}>{student.status}</Text>
                    </View>
                  </>
                )}
              </View>
            ) : (
              <View style={styles.form}>
                <LabeledInput label="Name" value={name} onChangeText={setName} />
                {employee && (
                  <LabeledInput
                    label="Phone"
                    value={contactPhone}
                    onChangeText={setContactPhone}
                    keyboardType="phone-pad"
                  />
                )}
                {student && (
                  <>
                    <LabeledInput label="Address" value={address} onChangeText={setAddress} />
                    <LabeledInput
                      label="Parent Contact"
                      value={parentContact}
                      onChangeText={setParentContact}
                      keyboardType="phone-pad"
                    />
                  </>
                )}
              </View>
            )}

            <View style={styles.actionsRow}>
              {editing ? (
                <>
                  <Pressable
                    style={[styles.actionButton, styles.cancelButton]}
                    onPress={() => {
                      setEditing(false);
                      load();
                    }}
                    disabled={saving}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionButton, styles.saveButton]}
                    onPress={handleSave}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <Text style={styles.saveButtonText}>Save</Text>
                    )}
                  </Pressable>
                </>
              ) : (
                <Pressable style={[styles.actionButton, styles.editButton]} onPress={() => setEditing(true)}>
                  <Text style={styles.editButtonText}>Edit Profile</Text>
                </Pressable>
              )}
            </View>

            {!editing && session.ownerType === 'EMPLOYEE' && (
              <Pressable style={styles.googleMeetButton} onPress={() => navigation.navigate('ConnectGoogleAccount')}>
                <Text style={styles.googleMeetButtonText}>Google Meet settings</Text>
              </Pressable>
            )}

            {!editing && (
              <Pressable style={styles.logoutButton} onPress={logout}>
                <Text style={styles.logoutButtonText}>{t('common.logOut')}</Text>
              </Pressable>
            )}
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
  form: { width: '100%', marginTop: spacing.lg },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  fieldLabel: { fontSize: 13, color: colors.textMuted },
  fieldValue: { fontSize: 14, color: colors.textPrimary, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  actionsRow: { flexDirection: 'row', width: '100%', gap: spacing.sm, marginTop: spacing.lg },
  actionButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  editButton: { backgroundColor: colors.primary },
  editButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  cancelButton: { backgroundColor: colors.surfaceMuted },
  cancelButtonText: { color: colors.textPrimary, fontWeight: '700', fontSize: 15 },
  saveButton: { backgroundColor: colors.primary },
  saveButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  googleMeetButton: {
    width: '100%',
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
  },
  googleMeetButtonText: { color: colors.textPrimary, fontWeight: '700', fontSize: 15 },
  logoutButton: {
    width: '100%',
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.error,
    alignItems: 'center',
  },
  logoutButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
