import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { approveRegistration, createTeacherInvite, listRegistrations, rejectRegistration } from '../../api/registration';
import type { Employee, RegistrationInboxEntry } from '../../api/types';
import EmployeePicker from '../../components/EmployeePicker';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'RegistrationInbox'>;

export function RegistrationInboxScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const [entries, setEntries] = useState<RegistrationInboxEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const [showInvite, setShowInvite] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [invite, setInvite] = useState<{ code: string; expiresAt: string } | null>(null);
  const [generatingInvite, setGeneratingInvite] = useState(false);

  const load = useCallback(() => {
    setError(null);
    return listRegistrations(schoolId, 'PARENT_REGISTRATION')
      .then(setEntries)
      .catch((e) => setError((e as Error).message));
  }, [schoolId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setLoading(true);
      load().finally(() => setLoading(false));
    });
    return unsubscribe;
  }, [navigation, load]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const handleGenerateInvite = async () => {
    if (!selectedEmployee) return;
    setGeneratingInvite(true);
    setError(null);
    try {
      const result = await createTeacherInvite(schoolId, selectedEmployee.id);
      setInvite(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGeneratingInvite(false);
    }
  };

  const handleDecide = (entry: RegistrationInboxEntry, decision: 'approve' | 'reject') => {
    Alert.alert(
      decision === 'approve' ? t('registrationInbox.approveTitle') : t('registrationInbox.rejectTitle'),
      t('registrationInbox.confirmMessage', {
        action: decision === 'approve' ? t('registrationInbox.approve') : t('registrationInbox.reject'),
        name: entry.displayName,
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: decision === 'approve' ? t('registrationInbox.approve') : t('registrationInbox.reject'),
          style: decision === 'reject' ? 'destructive' : 'default',
          onPress: async () => {
            setDecidingId(entry.entityId);
            setError(null);
            try {
              if (decision === 'approve') {
                await approveRegistration(schoolId, entry.entityType, entry.entityId);
              } else {
                await rejectRegistration(schoolId, entry.entityType, entry.entityId);
              }
              setEntries((prev) => prev.filter((e) => e.entityId !== entry.entityId));
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setDecidingId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('registrationInbox.title')} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <View style={styles.inviteCard}>
          {invite ? (
            <>
              <Text style={styles.inviteLabel}>{t('registrationInbox.shareCode')}</Text>
              <Text style={styles.inviteCode} selectable>
                {invite.code}
              </Text>
              <Text style={styles.inviteExpiry}>
                {t('registrationInbox.expires', { date: new Date(invite.expiresAt).toLocaleString() })}
              </Text>
              <Pressable
                onPress={() => {
                  setInvite(null);
                  setSelectedEmployee(null);
                  setShowInvite(false);
                }}
              >
                <Text style={styles.inviteDone}>{t('common.done')}</Text>
              </Pressable>
            </>
          ) : showInvite ? (
            <>
              <Text style={styles.inviteLabel}>{t('registrationInbox.pickTeacher')}</Text>
              <EmployeePicker schoolId={schoolId} selectedId={selectedEmployee?.id ?? null} onSelect={setSelectedEmployee} />
              <Pressable
                style={[styles.inviteButton, !selectedEmployee && styles.inviteButtonDisabled]}
                onPress={handleGenerateInvite}
                disabled={!selectedEmployee || generatingInvite}
              >
                <Text style={styles.inviteButtonText}>
                  {generatingInvite ? t('registrationInbox.generating') : t('registrationInbox.generateInviteCode')}
                </Text>
              </Pressable>
            </>
          ) : (
            <Pressable style={styles.inviteButton} onPress={() => setShowInvite(true)}>
              <Text style={styles.inviteButtonText}>{t('registrationInbox.inviteTeacher')}</Text>
            </Pressable>
          )}
        </View>

        {error && <Text style={styles.error}>{error}</Text>}
        {loading && <ActivityIndicator color={colors.primary} style={styles.loading} />}

        {!loading && entries.length === 0 && !error && (
          <Text style={styles.empty}>{t('registrationInbox.empty')}</Text>
        )}

        {entries.map((entry) => (
          <View key={entry.entityId} style={styles.row}>
            <View style={styles.rowBody}>
              <Text style={styles.rowName}>{entry.displayName}</Text>
              <Text style={styles.rowMeta}>
                {entry.submittedBy} · {new Date(entry.submittedAt).toLocaleString()}
              </Text>
            </View>
            <View style={styles.rowActions}>
              {decidingId === entry.entityId ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <>
                  <Pressable style={styles.approveButton} onPress={() => handleDecide(entry, 'approve')}>
                    <Text style={styles.approveButtonText}>{t('registrationInbox.approve')}</Text>
                  </Pressable>
                  <Pressable style={styles.rejectButton} onPress={() => handleDecide(entry, 'reject')}>
                    <Text style={styles.rejectButtonText}>{t('registrationInbox.reject')}</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        ))}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  inviteCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
    ...softShadow,
  },
  inviteButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  inviteButtonDisabled: { opacity: 0.5 },
  inviteButtonText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  inviteLabel: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },
  inviteCode: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginTop: 4, letterSpacing: 1 },
  inviteExpiry: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  inviteDone: { color: colors.primary, fontWeight: '700', marginTop: spacing.sm },
  loading: { marginTop: spacing.xl },
  error: { color: colors.error, marginBottom: spacing.md },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  rowBody: { flex: 1, marginRight: spacing.sm },
  rowName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  rowMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  rowActions: { flexDirection: 'row', gap: spacing.sm },
  approveButton: {
    backgroundColor: colors.success,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  approveButtonText: { color: colors.white, fontWeight: '700', fontSize: 12.5 },
  rejectButton: {
    backgroundColor: '#FFEBEE',
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  rejectButtonText: { color: colors.error, fontWeight: '700', fontSize: 12.5 },
});
