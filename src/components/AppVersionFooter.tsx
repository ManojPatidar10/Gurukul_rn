import Constants from 'expo-constants';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, spacing } from '../theme/colors';

/** The app version, quietly. Long-press opens the hidden push diagnostics screen. */
export function AppVersionFooter({ onLongPress }: { onLongPress: () => void }) {
  return (
    <Pressable onLongPress={onLongPress} delayLongPress={800} style={styles.footer}>
      <Text style={styles.text}>Smart Gurukul v{Constants.expoConfig?.version ?? '?'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  footer: { alignItems: 'center', paddingVertical: spacing.lg },
  text: { fontSize: 12, color: colors.textMuted },
});
