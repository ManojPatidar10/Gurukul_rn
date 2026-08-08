import { FontAwesome5 } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { startImmediateCall } from '../../api/calls';
import { createConversation } from '../../api/chat';
import { createEmployeeCredential } from '../../api/credentials';
import { AvatarBadge } from '../../components/AvatarBadge';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useAuth } from '../../context/AuthContext';
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
  const { session } = useAuth();
  const isViewerAdmin = session.role === 'ADMIN';
  const { t } = useTranslation();
  const employee = route.params.employee;
  const [showCredentials, setShowCredentials] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ username: string; password: string } | null>(null);
  const [calling, setCalling] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const isSelf = session.ownerType === 'EMPLOYEE' && session.ownerId === employee.id;

  const handleVideoCall = async () => {
    setCalling(true);
    setError(null);
    try {
      const call = await startImmediateCall(schoolId, { calleeOwnerType: 'EMPLOYEE', calleeOwnerId: employee.id });
      navigation.navigate('InCall', { roomName: call.roomName, displayName: employee.name, callLogId: call.callLogId });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCalling(false);
    }
  };

  const handleMessage = async () => {
    setMessaging(true);
    setError(null);
    try {
      const conversation = await createConversation(schoolId, {
        otherPartyOwnerType: 'EMPLOYEE',
        otherPartyOwnerId: employee.id,
      });
      navigation.navigate('ConversationThread', { conversationId: conversation.id, title: employee.name });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMessaging(false);
    }
  };

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
            <StatusChip
              label={employee.status === 'ACTIVE' ? t('common.active') : employee.status === 'INACTIVE' ? t('common.inactive') : employee.status}
              variant={employee.status === 'ACTIVE' ? 'success' : 'neutral'}
            />
          </View>
          {!isSelf && (
            <View style={styles.heroActions}>
              <Pressable style={styles.iconButton} onPress={handleVideoCall} disabled={calling}>
                {calling ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <FontAwesome5 name="video" size={16} color={colors.white} />
                )}
              </Pressable>
              <Pressable style={styles.iconButton} onPress={handleMessage} disabled={messaging}>
                {messaging ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <FontAwesome5 name="comment-dots" size={16} color={colors.white} />
                )}
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Field label={t('employees.detail.designation')} value={employee.designation} />
          <Field label={t('employees.detail.joinDate')} value={employee.joinDate} />
          {isViewerAdmin && <Field label={t('employees.detail.bankAccount')} value={employee.bankAccount} />}
          <Field label={t('employees.detail.contactPhone')} value={employee.contactPhone} />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        {isViewerAdmin && (
          <View style={styles.actions}>
            <Pressable style={styles.actionButton} onPress={() => navigation.navigate('EmployeeForm', { employee })}>
              <Text style={styles.actionText}>{t('common.edit')}</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={() => navigation.navigate('SalaryHistory', { employee })}>
              <Text style={styles.actionText}>{t('employees.detail.salaryHistory')}</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={() => navigation.navigate('TeacherPerformance', { employee })}>
              <Text style={styles.actionText}>{t('performance.title')}</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={() => setShowCredentials((v) => !v)}>
              <Text style={styles.actionText}>{showCredentials ? t('common.cancel') : 'Set login credentials'}</Text>
            </Pressable>
          </View>
        )}

        {isViewerAdmin && showCredentials && (
          <View style={styles.credentialPanel}>
            <Text style={styles.credentialTitle}>Create teacher login</Text>
            {created ? (
              <View>
                <Text style={styles.success}>
                  Credential created. Share these with {employee.name} — they won&apos;t be shown again:
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
  heroText: { flex: 1, marginLeft: spacing.md, gap: spacing.xs },
  heroActions: { flexDirection: 'row', gap: spacing.sm },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
