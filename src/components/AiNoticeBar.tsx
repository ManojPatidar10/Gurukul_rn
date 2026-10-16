import { FontAwesome5 } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '../theme/colors';

/**
 * The one line under the Academic Helper's and the helpdesk bot's header: "For school work only.
 * Misuse is recorded and shared with your school." Tapping it opens what was recorded about the
 * user (AiMyRecordsSheet).
 */
export function AiNoticeBar({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Pressable
      style={styles.bar}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint={t('ai.noticeHint')}
    >
      <FontAwesome5 name="shield-alt" size={12} color={colors.textSecondary} />
      <Text style={styles.text} numberOfLines={2}>
        {t('ai.notice')}
      </Text>
      <FontAwesome5 name="chevron-right" size={10} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.surfaceMuted,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  text: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 16 },
});
