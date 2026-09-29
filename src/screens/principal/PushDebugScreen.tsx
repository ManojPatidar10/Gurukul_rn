import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { refreshPushPermission, registerPushNow, usePushStatus } from '../../push/pushStatus';
import { colors, radius, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'PushDebug'>;

/**
 * Hidden support screen (long-press the app version on Profile or the parent home screen) that
 * turns "why don't I get notifications?" into a quick check. English only - it's for us, not
 * for users.
 */
export function PushDebugScreen({ navigation }: Props) {
  const status = usePushStatus();
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    refreshPushPermission().catch(() => {});
  }, []);

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? '(missing)';
  const { permission, lastRegistration } = status;

  const rows: [string, string, boolean?][] = [
    ['Push available here', status.supported ? 'Yes' : 'No (emulator or Expo Go)', !status.supported],
    [
      'Permission',
      permission ? `${permission.status}${permission.canAskAgain ? '' : ' (can’t ask again)'}` : 'checking…',
      permission?.status !== 'granted',
    ],
    ['Expo push token', status.expoPushToken ? `${status.expoPushToken.slice(0, 20)}…` : 'none'],
    ['Token error', status.tokenError ?? 'none', !!status.tokenError],
    ['Project ID', projectId, projectId === '(missing)'],
    [
      'Last registration',
      lastRegistration
        ? `${lastRegistration.ok ? 'OK' : `Failed: ${lastRegistration.error ?? 'unknown error'}`} · ${new Date(lastRegistration.at).toLocaleString()}`
        : 'not attempted',
      lastRegistration ? !lastRegistration.ok : false,
    ],
    ['App version', `${Constants.expoConfig?.version ?? '?'}`],
  ];

  const registerAgain = async () => {
    setRegistering(true);
    try {
      await registerPushNow();
    } finally {
      setRegistering(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Push notifications" subtitle="Diagnostics" onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <View style={styles.card}>
          {rows.map(([label, value, bad]) => (
            <View key={label} style={styles.row}>
              <Text style={styles.label}>{label}</Text>
              <Text style={[styles.value, bad && styles.valueBad]} selectable>
                {value}
              </Text>
            </View>
          ))}
        </View>
        <Pressable style={styles.button} onPress={registerAgain} disabled={registering}>
          <Text style={styles.buttonText}>{registering ? 'Registering…' : 'Register again'}</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.buttonSecondary]} onPress={() => Linking.openSettings()}>
          <Text style={[styles.buttonText, styles.buttonSecondaryText]}>Open app settings</Text>
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  row: { paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  label: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  value: { fontSize: 15, color: colors.textPrimary, marginTop: 2 },
  valueBad: { color: colors.error },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  buttonSecondary: { backgroundColor: colors.primaryLight },
  buttonSecondaryText: { color: colors.primary },
});
