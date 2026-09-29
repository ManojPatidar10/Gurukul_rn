import { FontAwesome5 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../theme/colors';

/**
 * How a screen shows that something failed - in place of a bare line of red text. Pass the
 * message from getErrorMessage (src/api/errorMessage.ts). `onRetry` adds a "Try again" button;
 * only pass it where retrying repeats what failed (usually reloading the screen's data), not
 * where the error came from a save. `inset` adds side margins on screens without padding.
 */
export function ErrorNotice({ message, onRetry, inset }: { message: string; onRetry?: () => void; inset?: boolean }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.card, inset && styles.inset]} accessibilityRole="alert">
      <FontAwesome5 name="exclamation-circle" size={16} color={colors.error} style={styles.icon} />
      <View style={styles.body}>
        <Text style={styles.message}>{message}</Text>
        {onRetry && (
          <Pressable onPress={onRetry} hitSlop={8} style={styles.retry}>
            <FontAwesome5 name="redo" size={11} color={colors.primary} />
            <Text style={styles.retryText}>{t('errors.tryAgain')}</Text>
          </Pressable>
        )}
      </View>
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
  body: { flex: 1 },
  message: { color: '#8E1B1B', fontSize: 14, lineHeight: 20 },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: spacing.xs },
  retryText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
});
