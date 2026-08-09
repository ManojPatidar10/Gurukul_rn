import { FontAwesome5 } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { startImmediateCall } from '../../api/calls';
import { createConversation } from '../../api/chat';
import { createStudentCredential } from '../../api/credentials';
import { deleteStudent, transferStudentClassSection } from '../../api/students';
import type { Student } from '../../api/types';
import { AvatarBadge } from '../../components/AvatarBadge';
import ClassSectionPicker from '../../components/ClassSectionPicker';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'StudentDetail'>;

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value || '—'}</Text>
    </View>
  );
}

export function StudentDetailScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const isViewerStudent = session.ownerType === 'STUDENT';
  const isViewerAdmin = session.role === 'ADMIN';
  const [student, setStudent] = useState<Student>(route.params.student);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calling, setCalling] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const isSelf = session.ownerType === 'STUDENT' && session.ownerId === student.id;

  const handleVideoCall = async () => {
    setCalling(true);
    setError(null);
    try {
      const call = await startImmediateCall(schoolId, { calleeOwnerType: 'STUDENT', calleeOwnerId: student.id });
      navigation.navigate('InCall', { roomName: call.roomName, displayName: student.name, callLogId: call.callLogId });
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
        otherPartyOwnerType: 'STUDENT',
        otherPartyOwnerId: student.id,
      });
      navigation.navigate('ConversationThread', { conversationId: conversation.id, title: student.name });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMessaging(false);
    }
  };

  const [showCredentials, setShowCredentials] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [creatingCredential, setCreatingCredential] = useState(false);
  const [createdCredential, setCreatedCredential] = useState<{ username: string; password: string } | null>(null);
  const [credentialError, setCredentialError] = useState<string | null>(null);

  const handleCreateCredential = async () => {
    setCreatingCredential(true);
    setCredentialError(null);
    setCreatedCredential(null);
    try {
      await createStudentCredential(schoolId, student.id, { username, password, role: 'STUDENT' });
      setCreatedCredential({ username, password });
    } catch (e) {
      setCredentialError((e as Error).message);
    } finally {
      setCreatingCredential(false);
    }
  };
  const { showToast } = useToast();

  const handleTransfer = async (classSectionId: string) => {
    setTransferring(true);
    try {
      const updated = await transferStudentClassSection(schoolId, student.id, { classSectionId });
      setStudent(updated);
      setShowTransfer(false);
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setTransferring(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(t('students.detail.deleteTitle'), t('students.detail.deleteMessage', { name: student.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteStudent(schoolId, student.id);
            navigation.goBack();
          } catch (e) {
            showToast((e as Error).message, 'error');
            setDeleting(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={student.name}
        subtitle={t('students.detail.rollLabel', { roll: student.rollNumber })}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        <View style={styles.heroRow}>
          <AvatarBadge name={student.name} accentKey="students" size={56} />
          <View style={styles.heroText}>
            <Text style={styles.heroName}>{student.name}</Text>
            <StatusChip
              label={student.status === 'ACTIVE' ? t('common.active') : student.status}
              variant={student.status === 'ACTIVE' ? 'success' : 'neutral'}
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
          <Field label={t('students.detail.classSection')} value={student.classSectionLabel} />
          <Field label={t('students.detail.dob')} value={student.dob} />
          <Field label={t('students.detail.gender')} value={student.gender} />
          {!isViewerStudent && (
            <>
              <Field label={t('students.detail.address')} value={student.address} />
              <Field label={t('students.detail.parentName')} value={student.parentName} />
              <Field label={t('students.detail.parentContact')} value={student.parentContact} />
              <Field label={t('students.detail.admissionDate')} value={student.admissionDate} />
            </>
          )}
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        {(isViewerAdmin || !isViewerStudent) && (
          <View style={styles.actions}>
            {isViewerAdmin && (
              <Pressable style={styles.actionButton} onPress={() => navigation.navigate('StudentForm', { student })}>
                <Text style={styles.actionText}>{t('common.edit')}</Text>
              </Pressable>
            )}
            <Pressable style={styles.actionButton} onPress={() => navigation.navigate('StudentPerformance', { student })}>
              <Text style={styles.actionText}>{t('performance.title')}</Text>
            </Pressable>
            {isViewerAdmin && (
              <Pressable style={styles.actionButton} onPress={() => setShowTransfer((v) => !v)}>
                <Text style={styles.actionText}>
                  {showTransfer ? t('students.detail.cancelTransfer') : t('students.detail.transferClass')}
                </Text>
              </Pressable>
            )}
            <Pressable style={styles.actionButton} onPress={() => navigation.navigate('AttendanceHistory', { student })}>
              <Text style={styles.actionText}>{t('students.detail.attendance')}</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={() => navigation.navigate('ReportCard', { student })}>
              <Text style={styles.actionText}>Report card</Text>
            </Pressable>
            {isViewerAdmin && (
              <Pressable style={styles.actionButton} onPress={() => setShowCredentials((v) => !v)}>
                <Text style={styles.actionText}>{showCredentials ? t('common.cancel') : 'Set login credentials'}</Text>
              </Pressable>
            )}
            {isViewerAdmin && (
              <Pressable style={[styles.actionButton, styles.deleteButton]} onPress={handleDelete} disabled={deleting}>
                <Text style={styles.deleteText}>{deleting ? t('common.deleting') : t('common.delete')}</Text>
              </Pressable>
            )}
          </View>
        )}

        {isViewerAdmin && showCredentials && (
          <View style={styles.transferPanel}>
            <Text style={styles.transferTitle}>Create student login</Text>
            {createdCredential ? (
              <View>
                <Text style={styles.success}>
                  Credential created. Share these with {student.name} — they won&apos;t be shown again:
                </Text>
                <View style={styles.credentialBox}>
                  <Text style={styles.credentialLabel}>Username</Text>
                  <Text style={styles.credentialValue}>{createdCredential.username}</Text>
                  <Text style={[styles.credentialLabel, { marginTop: spacing.sm }]}>Password</Text>
                  <Text style={styles.credentialValue}>{createdCredential.password}</Text>
                </View>
                <Pressable
                  onPress={() => {
                    setCreatedCredential(null);
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
                {credentialError && <Text style={styles.error}>{credentialError}</Text>}
                <Pressable
                  style={[styles.credentialSubmit, (!username || !password || creatingCredential) && styles.disabled]}
                  onPress={handleCreateCredential}
                  disabled={!username || !password || creatingCredential}
                >
                  <Text style={styles.credentialSubmitText}>
                    {creatingCredential ? 'Creating…' : 'Create credential'}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        {showTransfer && (
          <View style={styles.transferPanel}>
            <Text style={styles.transferTitle}>{t('students.detail.moveToClassSection')}</Text>
            <ClassSectionPicker
              schoolId={schoolId}
              selectedId={student.classSectionId}
              onSelect={(cs) => handleTransfer(cs.id)}
            />
            {transferring && <Text style={styles.transferring}>{t('students.detail.transferring')}</Text>}
          </View>
        )}
      </ScreenContainer>
    </View>
  );
}

const accent = accents.students;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  heroRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  heroActions: { flexDirection: 'row', gap: spacing.sm },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: { flex: 1, marginLeft: spacing.md, gap: spacing.xs },
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
  deleteButton: { backgroundColor: '#FFEBEE' },
  deleteText: { color: colors.error, fontWeight: '700' },
  transferPanel: { marginTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg },
  transferTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md },
  transferring: { color: colors.textMuted, marginTop: spacing.sm },
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
  error: { color: colors.error, marginBottom: spacing.md },
});
