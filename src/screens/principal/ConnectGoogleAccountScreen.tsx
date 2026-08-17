import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { connectGoogleMeet, disconnectGoogleMeet, getGoogleMeetStatus } from '../../api/calls';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'ConnectGoogleAccount'>;

export function ConnectGoogleAccountScreen({ navigation }: Props) {
  const schoolId = useSchoolId();
  const { showToast } = useToast();
  const [connected, setConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(() => {
    setError(null);
    return getGoogleMeetStatus(schoolId)
      .then((res) => {
        setConnected(res.connected);
        setGoogleEmail(res.googleEmail);
      })
      .catch((e) => setError((e as Error).message));
  }, [schoolId]);

  useEffect(() => {
    setLoading(true);
    loadStatus().finally(() => setLoading(false));
  }, [loadStatus]);

  // Google consent happens in the system browser, outside the app - there's no deep-link
  // callback wired up yet, so re-checking status on focus (when the user comes back from the
  // browser) is how the screen picks up a just-completed connection.
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadStatus();
    });
    return unsubscribe;
  }, [navigation, loadStatus]);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const consentUrl = await connectGoogleMeet(schoolId);
      await Linking.openURL(consentUrl);
    } catch (e) {
      setError((e as Error).message);
      showToast((e as Error).message, 'error');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect Google account?',
      'Your calls will use the default video provider instead.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            setDisconnecting(true);
            try {
              await disconnectGoogleMeet(schoolId);
              setConnected(false);
              setGoogleEmail(null);
            } catch (e) {
              showToast((e as Error).message, 'error');
            } finally {
              setDisconnecting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Google Meet" onBack={() => navigation.goBack()} />
      <ScreenContainer>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : (
          <View style={styles.card}>
            <Text style={styles.title}>Google Meet for video calls</Text>
            <Text style={styles.description}>
              Connect your Google account to host your calls on Google Meet instead of the default
              provider. Only you need to connect - it applies to calls you start.
            </Text>

            {error && <Text style={styles.error}>{error}</Text>}

            {connected ? (
              <>
                <View style={styles.statusRow}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>Connected{googleEmail ? ` as ${googleEmail}` : ''}</Text>
                </View>
                <Pressable
                  style={[styles.button, styles.disconnectButton, disconnecting && styles.disabled]}
                  onPress={handleDisconnect}
                  disabled={disconnecting}
                >
                  {disconnecting ? (
                    <ActivityIndicator color={colors.error} size="small" />
                  ) : (
                    <Text style={styles.disconnectButtonText}>Disconnect</Text>
                  )}
                </Pressable>
              </>
            ) : (
              <Pressable
                style={[styles.button, styles.connectButton, connecting && styles.disabled]}
                onPress={handleConnect}
                disabled={connecting}
              >
                {connecting ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.connectButtonText}>Connect Google account</Text>
                )}
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
  loading: { marginTop: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...softShadow,
  },
  title: { fontSize: 17, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.sm },
  description: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginBottom: spacing.lg },
  error: { color: colors.error, marginBottom: spacing.md },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.success },
  statusText: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  button: {
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  connectButton: { backgroundColor: colors.primary },
  connectButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  disconnectButton: { backgroundColor: '#FFEBEE' },
  disconnectButtonText: { color: colors.error, fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.5 },
});
