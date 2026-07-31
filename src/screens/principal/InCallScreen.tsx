import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { endImmediateCall, endScheduledCall } from '../../api/calls';
import { subscribeToMyCallEvents } from '../../api/callSocket';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'InCall'>;

const TERMINAL_EVENT_TYPES = new Set(['CALL_DECLINED', 'CALL_BUSY', 'CALL_MISSED', 'CALL_CANCELLED', 'CALL_ENDED']);

/**
 * Jitsi's own server handles all WebRTC signaling/media once this WebView joins the room - see
 * the spec's note on why this is a WebView (Jitsi's react-native-sdk has no Expo config plugin,
 * and this project is a managed/CNG app) rather than the native SDK's conference view.
 */
export function InCallScreen({ route, navigation }: Props) {
  const { roomName, displayName, callLogId, scheduledCallId } = route.params;
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const [permissionsGranted, setPermissionsGranted] = useState<boolean | null>(null);
  const endedRef = useRef(false);

  useEffect(() => {
    Promise.all([Camera.requestCameraPermissionsAsync(), Audio.requestPermissionsAsync()]).then(
      ([camera, mic]) => setPermissionsGranted(camera.status === 'granted' && mic.status === 'granted')
    );
  }, []);

  useEffect(() => {
    if (!callLogId) return;
    let unsubscribe: (() => void) | undefined;
    subscribeToMyCallEvents(session.token, schoolId, session.ownerType, session.ownerId, (event) => {
      if (event.callLogId !== callLogId || !TERMINAL_EVENT_TYPES.has(event.type)) return;
      if (endedRef.current) return;
      endedRef.current = true;
      Alert.alert('Call ended', outcomeMessage(event.type), [{ text: 'OK', onPress: () => navigation.goBack() }]);
    }).then((unsub) => (unsubscribe = unsub));
    return () => unsubscribe?.();
  }, [callLogId, schoolId, session.token, session.ownerType, session.ownerId, navigation]);

  const handleEnd = async () => {
    if (endedRef.current) return;
    endedRef.current = true;
    try {
      if (callLogId) await endImmediateCall(schoolId, callLogId);
      else if (scheduledCallId) await endScheduledCall(schoolId, scheduledCallId);
    } catch {
      // Best-effort - still leave the call locally either way.
    }
    navigation.goBack();
  };

  if (permissionsGranted === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.white} size="large" />
      </View>
    );
  }

  if (!permissionsGranted) {
    return (
      <View style={styles.center}>
        <Text style={styles.deniedText}>Camera and microphone access are required for video calls.</Text>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const url = `https://meet.jit.si/${roomName}#config.prejoinPageEnabled=false&config.disableDeepLinking=true&userInfo.displayName=${encodeURIComponent(JSON.stringify(displayName))}`;

  return (
    <View style={styles.root}>
      <WebView
        source={{ uri: url }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        mediaCapturePermissionGrantType="grant"
      />
      <Pressable style={styles.endButton} onPress={handleEnd} accessibilityLabel="End call">
        <Text style={styles.endButtonText}>End call</Text>
      </Pressable>
    </View>
  );
}

function outcomeMessage(type: string): string {
  switch (type) {
    case 'CALL_DECLINED':
      return 'The other person declined.';
    case 'CALL_BUSY':
      return 'The other person is already on a call.';
    case 'CALL_MISSED':
      return 'No answer.';
    case 'CALL_CANCELLED':
      return 'The call was cancelled.';
    default:
      return 'The call has ended.';
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  center: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  deniedText: { color: colors.white, fontSize: 15, textAlign: 'center', marginBottom: spacing.lg },
  backButton: { paddingVertical: spacing.md, paddingHorizontal: spacing.xl, backgroundColor: colors.primary, borderRadius: 999 },
  backButtonText: { color: colors.white, fontWeight: '700' },
  endButton: {
    position: 'absolute',
    bottom: spacing.xl,
    left: spacing.xl,
    right: spacing.xl,
    backgroundColor: colors.error,
    borderRadius: 999,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  endButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
