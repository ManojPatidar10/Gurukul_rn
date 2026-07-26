import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { createEmployeeCredential } from '../../api/credentials';
import { AvatarBadge } from '../../components/AvatarBadge';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useSchoolId } from '../../context/SchoolContext';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'EmployeeDetail'>;

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value || '—'}</Text>
    </View>
  );
}

export function EmployeeDetailScreen({ route, navigation }: Props) {
  const schoolId = useSchoolId();
  const employee = route.params.employee;
  const [showCredentials, setShowCredentials] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ username: string; password: string } | null>(null);

  const handleCreateCredential = async () => {
    setSubmitting(true);
    setError(null);
    setCreated(null);
    try {
      await createEmployeeCredential(schoolId, employee.id, { username, password, role: 'TEACHER' });
      setCreated({ username, password });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={employee.name} subtitle={employee.designation} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <View style={styles.heroRow}>
          <AvatarBadge name={employee.name} accentKey="employees" size={56} />
          <View style={styles.heroText}>
            <Text style={styles.heroName}>{employee.name}</Text>
            <StatusChip label={employee.status} variant={employee.status === 'ACTIVE' ? 'success' : 'neutral'} />
          </View>
        </View>

        <View style={styles.card}>
          <Field label="Designation" value={employee.designation} />
          <Field label="Join date" value={employee.joinDate} />
          <Field label="Bank account" value={employee.bankAccount} />
          <Field label="Contact phone" value={employee.contactPhone} />
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.actionButton} onPress={() => navigation.navigate('EmployeeForm', { employee })}>
            <Text style={styles.actionText}>Edit</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => navigation.navigate('SalaryHistory', { employee })}>
            <Text style={styles.actionText}>Salary history</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => setShowCredentials((v) => !v)}>
            <Text style={styles.actionText}>{showCredentials ? 'Cancel' : 'Set login credentials'}</Text>
          </Pressable>
        </View>

        {showCredentials && (
          <View style={styles.credentialPanel}>
            <Text style={styles.credentialTitle}>Create teacher login</Text>
            {created ? (
              <View>
                <Text style={styles.success}>
                  Credential created. Share these with {employee.name} — they won't be shown again:
                </Text>
                <View style={styles.credentialBox}>
                  <Text style={styles.credentialLabel}>Username</Text>
                  <Text style={styles.credentialValue}>{created.username}</Text>
                  <Text style={[styles.credentialLabel, { marginTop: spacing.sm }]}>Password</Text>
                  <Text style={styles.credentialValue}>{created.password}</Text>
                </View>
                <Pressable
                  onPress={() => {
                    setCreated(null);
                    setUsername('');
                    setPassword('');
                  }}
                >
                  <Text style={styles.doneLink}>Done</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <LabeledInput label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" />
                <LabeledInput label="Password" value={password} onChangeText={setPassword} secureTextEntry />
                {error && <Text style={styles.error}>{error}</Text>}
                <Pressable
                  style={[styles.credentialSubmit, (!username || !password || submitting) && styles.disabled]}
                  onPress={handleCreateCredential}
                  disabled={!username || !password || submitting}
                >
                  <Text style={styles.credentialSubmitText}>{submitting ? 'Creating…' : 'Create credential'}</Text>
                </Pressable>
              </>
            )}
          </View>
        )}
      </ScreenContainer>
    </View>
  );
}

const accent = accents.employees;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  heroRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  heroText: { marginLeft: spacing.md, gap: spacing.xs },
  heroName: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...softShadow,
  },
  field: { marginBottom: spacing.md },
  fieldLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '700' },
  fieldValue: { fontSize: 16, color: colors.textPrimary, marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  actionButton: {
    backgroundColor: accent.light,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  actionText: { color: accent.base, fontWeight: '700' },
  credentialPanel: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...softShadow,
  },
  credentialTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md },
  error: { color: colors.error, marginBottom: spacing.md },
  success: { color: colors.success, marginBottom: spacing.md, lineHeight: 20 },
  credentialBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  credentialLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase' },
  credentialValue: { fontSize: 16, color: colors.textPrimary, fontWeight: '700', marginTop: 2 },
  doneLink: { color: colors.primary, fontWeight: '700', textAlign: 'center' },
  credentialSubmit: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    ...softShadow,
  },
  disabled: { opacity: 0.5 },
  credentialSubmitText: { color: colors.white, fontWeight: '700' },
});
