import { FontAwesome5 } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing } from '../theme/colors';
import { pausedUntilLabel } from '../utils/aiGuard';

type Props = { kind: 'paused'; pausedUntil: string } | { kind: 'off' };

/**
 * Above the composer of the Academic Helper and the helpdesk bot while it can't be used: the
 * user's AI help is paused (until a time, in the phone's own time zone), or the feature is
 * switched off. The screen disables its composer alongside.
 */
export function AiPausedBanner(props: Props) {
  const { t, i18n } = useTranslation();
  const paused = props.kind === 'paused';
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <FontAwesome5 name={paused ? 'pause-circle' : 'power-off'} size={16} color={colors.warning} style={styles.icon} />
      <View style={styles.textBlock}>
        <Text style={styles.title}>
          {paused ? t('ai.paused', { time: pausedUntilLabel(props.pausedUntil, i18n.language) }) : t('ai.off')}
        </Text>
        {paused ? <Text style={styles.detail}>{t('ai.pausedReason')}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  icon: { marginTop: 2 },
  textBlock: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontWeight: '700', color: '#78350F' },
  detail: { fontSize: 12, color: '#92400E', lineHeight: 16 },
});
