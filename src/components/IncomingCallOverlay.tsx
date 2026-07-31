import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { acceptImmediateCall, declineImmediateCall } from '../api/calls';
import { subscribeToMyCallEvents } from '../api/callSocket';
import { getEmployee } from '../api/employees';
import { getStudent } from '../api/students';
import type { Session } from '../api/authStorage';
import type { CallEvent } from '../api/types';
import { navigationRef } from '../navigation/navigationRef';
import { colors, radius, softShadow, spacing } from '../theme/colors';

interface Props {
  session: Session;
  schoolId: string;
}

/**
 * Mounted once at the app root (App.tsx, alongside NavigationContainer) so an incoming call
 * surfaces regardless of which screen is currently active. There is no push notification path
 * yet (FCM deferred - see spec), so this only fires while the app holds a live STOMP connection.
 */
export function IncomingCallOverlay({ session, schoolId }: Props) {
  const [incoming, setIncoming] = useState<CallEvent | null>(null);
  const [callerName, setCallerName] = useState('Someone');
  const [responding, setResponding] = useState(false);
  const incomingCallLogIdRef = useRef<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    subscribeToMyCallEvents(session.token, schoolId, session.ownerType, session.ownerId, (event) => {
      if (event.type === 'INCOMING_CALL') {
        incomingCallLogIdRef.current = event.callLogId;
        setIncoming(event);
        setCallerName('Someone');
        if (event.counterpartOwnerType === 'EMPLOYEE' && event.counterpartOwnerId) {
          getEmployee(schoolId, event.counterpartOwnerId).then((e) => setCallerName(e.name)).catch(() => {});
        } else if (event.counterpartOwnerType === 'STUDENT' && event.counterpartOwnerId) {
          getStudent(schoolId, event.counterpartOwnerId).then((s) => setCallerName(s.name)).catch(() => {});
        }
      } else if (event.callLogId && event.callLogId === incomingCallLogIdRef.current) {
        // Caller cancelled while we were still deciding.
        incomingCallLogIdRef.current = null;
        setIncoming(null);
      }
    }).then((unsub) => (unsubscribe = unsub));
    return () => unsubscribe?.();
  }, [session.token, session.ownerType, session.ownerId, schoolId]);

  const handleAccept = async () => {
    if (!incoming?.callLogId) return;
    setResponding(true);
    try {
      const result = await acceptImmediateCall(schoolId, incoming.callLogId);
      incomingCallLogIdRef.current = null;
      setIncoming(null);
      navigationRef.current?.navigate('InCall', {
        roomName: result.roomName,
        displayName: callerName,
        callLogId: incoming.callLogId,
      });
    } finally {
      setResponding(false);
    }
  };

  const handleDecline = async () => {
    if (!incoming?.callLogId) return;
    setResponding(true);
    try {
      await declineImmediateCall(schoolId, incoming.callLogId);
    } finally {
      incomingCallLogIdRef.current = null;
      setIncoming(null);
      setResponding(false);
    }
  };

  return (
    <Modal visible={incoming !== null} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Incoming video call</Text>
          <Text style={styles.caller}>{callerName}</Text>
          <View style={styles.actions}>
            <Pressable style={styles.declineButton} onPress={handleDecline} disabled={responding}>
              {responding ? <ActivityIndicator color={colors.white} /> : <Text style={styles.actionText}>Decline</Text>}
            </Pressable>
            <Pressable style={styles.acceptButton} onPress={handleAccept} disabled={responding}>
              {responding ? <ActivityIndicator color={colors.white} /> : <Text style={styles.actionText}>Accept</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  card: {
    width: '85%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    ...softShadow,
  },
  title: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.xs },
  caller: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.xl },
  actions: { flexDirection: 'row', gap: spacing.md, width: '100%' },
  declineButton: { flex: 1, backgroundColor: colors.error, borderRadius: radius.pill, paddingVertical: spacing.md, alignItems: 'center' },
  acceptButton: { flex: 1, backgroundColor: colors.success, borderRadius: radius.pill, paddingVertical: spacing.md, alignItems: 'center' },
  actionText: { color: colors.white, fontWeight: '700' },
});
