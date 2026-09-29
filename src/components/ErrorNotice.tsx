import { FontAwesome5 } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../theme/colors';

/**
 * How a screen shows that something failed - in place of a bare line of red text. Pass the
 * message from getErrorMessage (src/api/errorMessage.ts), which says what went wrong and what to
 * do about it. `inset` adds side margins on screens without padding.
 */
export function ErrorNotice({ message, inset }: { message: string; inset?: boolean }) {
  return (
    <View style={[styles.card, inset && styles.inset]} accessibilityRole="alert">
      <FontAwesome5 name="exclamation-circle" size={16} color={colors.error} style={styles.icon} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: '#FDECEC',
    borderColor: '#F5C2C2',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginVertical: spacing.sm,
  },
  inset: { marginHorizontal: spacing.lg },
  icon: { marginTop: 2 },
  message: { flex: 1, color: '#8E1B1B', fontSize: 14, lineHeight: 20 },
});
