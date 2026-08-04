import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  cancelScheduledCall,
  getScheduledCall,
  listHostedCalls,
  listMyInvites,
  respondToInvite,
  startScheduledCall,
} from '../../api/calls';
import { subscribeToMyCallEvents } from '../../api/callSocket';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { MyInviteResponse, ScheduledCallResponse } from '../../api/types';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'ScheduledCalls'>;

export function ScheduledCallsScreen({ navigation }: Props) {
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const [hosted, setHosted] = useState<ScheduledCallResponse[]>([]);
  const [invites, setInvites] = useState<MyInviteResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    return Promise.all([listHostedCalls(schoolId), listMyInvites(schoolId)])
      .then(([hostedCalls, myInvites]) => {
        setHosted(hostedCalls);
        setInvites(myInvites);
      })
      .catch((e) => setError((e as Error).message));
  }, [schoolId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setLoading(true);
      load().finally(() => setLoading(false));
    });
    setLoading(true);
    load().finally(() => setLoading(false));
    return unsubscribe;
  }, [navigation, load]);

  // Live update as soon as a host taps "Start now" - without this, an invitee (or the host's own
  // other device) only finds out on the next screen-focus poll, which can be a while for a screen
  // left open in the background.
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    subscribeToMyCallEvents(session.token, schoolId, session.ownerType, session.ownerId, (event) => {
      if (event.type !== 'SCHEDULED_CALL_STARTED' || !event.scheduledCallId) return;
      setHosted((prev) =>
        prev.map((call) => (call.id === event.scheduledCallId ? { ...call, status: 'STARTED' } : call))
      );
      setInvites((prev) =>
        prev.map((invite) =>
          invite.scheduledCallId === event.scheduledCallId ? { ...invite, status: 'STARTED' } : invite
        )
      );
    }).then((unsub) => (unsubscribe = unsub));
    return () => unsubscribe?.();
  }, [session.token, session.ownerType, session.ownerId, schoolId]);

  const withBusy = async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id);
    setError(null);
    try {
      await action();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const joinRoom = (roomName: string, title: string) => {
    navigation.navigate('InCall', { roomName, displayName: title });
  };

  const joinScheduled = async (scheduledCallId: string, title: string) => {
    setBusyId(scheduledCallId);
    setError(null);
    try {
      const call = await getScheduledCall(schoolId, scheduledCallId);
      navigation.navigate('InCall', { roomName: call.roomName, displayName: title, scheduledCallId });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Scheduled calls" onBack={() => navigation.goBack()} />
      <ScreenContainer>
        {loading && <ActivityIndicator color={colors.primary} />}
        {error && <Text style={styles.error}>{error}</Text>}

        <Text style={styles.sectionTitle}>Hosted by me</Text>
        {!loading && hosted.length === 0 && <Text style={styles.empty}>Nothing scheduled.</Text>}
        {hosted.map((call) => (
          <View key={call.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{call.title}</Text>
              <StatusChip label={call.status} variant={statusVariant(call.status)} />
            </View>
            <Text style={styles.cardMeta}>{new Date(call.scheduledAt).toLocaleString()}</Text>
            <Text style={styles.cardMeta}>
              {call.invitees.length} invitee{call.invitees.length === 1 ? '' : 's'} ·{' '}
              {call.invitees.filter((i) => i.rsvpStatus === 'ACCEPTED').length} accepted
            </Text>
            <View style={styles.actionsRow}>
              {call.status === 'SCHEDULED' && (
                <>
                  <Pressable
                    style={styles.actionButton}
                    disabled={busyId === call.id}
                    onPress={() => withBusy(call.id, () => startScheduledCall(schoolId, call.id))}
                  >
                    <Text style={styles.actionText}>Start now</Text>
                  </Pressable>
                  <Pressable
                    style={styles.actionButtonSecondary}
                    disabled={busyId === call.id}
                    onPress={() => withBusy(call.id, () => cancelScheduledCall(schoolId, call.id))}
                  >
                    <Text style={styles.actionTextSecondary}>Cancel</Text>
                  </Pressable>
                </>
              )}
              {call.status === 'STARTED' && (
                <Pressable style={styles.actionButton} onPress={() => joinRoom(call.roomName, call.title)}>
                  <Text style={styles.actionText}>Join</Text>
                </Pressable>
              )}
              {busyId === call.id && <ActivityIndicator color={colors.primary} />}
            </View>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Invited to me</Text>
        {!loading && invites.length === 0 && <Text style={styles.empty}>No invites.</Text>}
        {invites.map((invite) => (
          <View key={invite.scheduledCallId} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{invite.title}</Text>
              <StatusChip label={invite.status} variant={statusVariant(invite.status)} />
            </View>
            <Text style={styles.cardMeta}>{new Date(invite.scheduledAt).toLocaleString()}</Text>
            <Text style={styles.cardMeta}>Your RSVP: {invite.myRsvpStatus}</Text>
            <View style={styles.actionsRow}>
              {invite.status === 'SCHEDULED' && invite.myRsvpStatus === 'PENDING' && (
                <>
                  <Pressable
                    style={styles.actionButton}
                    disabled={busyId === invite.scheduledCallId}
                    onPress={() =>
                      withBusy(invite.scheduledCallId, () =>
                        respondToInvite(schoolId, invite.scheduledCallId, { status: 'ACCEPTED' })
                      )
                    }
                  >
                    <Text style={styles.actionText}>Accept</Text>
                  </Pressable>
                  <Pressable
                    style={styles.actionButtonSecondary}
                    disabled={busyId === invite.scheduledCallId}
                    onPress={() =>
                      withBusy(invite.scheduledCallId, () =>
                        respondToInvite(schoolId, invite.scheduledCallId, { status: 'DECLINED' })
                      )
                    }
                  >
                    <Text style={styles.actionTextSecondary}>Decline</Text>
                  </Pressable>
                </>
              )}
              {invite.status === 'STARTED' && invite.myRsvpStatus === 'ACCEPTED' && (
                <Pressable
                  style={styles.actionButton}
                  disabled={busyId === invite.scheduledCallId}
                  onPress={() => joinScheduled(invite.scheduledCallId, invite.title)}
                >
                  <Text style={styles.actionText}>Join</Text>
                </Pressable>
              )}
              {busyId === invite.scheduledCallId && <ActivityIndicator color={colors.primary} />}
            </View>
          </View>
        ))}
      </ScreenContainer>
    </View>
  );
}

function statusVariant(status: string): 'success' | 'warning' | 'error' | 'neutral' | 'info' {
  if (status === 'STARTED' || status === 'COMPLETED') return 'success';
  if (status === 'SCHEDULED') return 'info';
  return 'neutral';
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.sm },
  empty: { color: colors.textMuted, marginBottom: spacing.sm },
  error: { color: colors.error, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
  cardMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, alignItems: 'center' },
  actionButton: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  actionText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  actionButtonSecondary: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  actionTextSecondary: { color: colors.textSecondary, fontWeight: '700', fontSize: 13 },
});
