import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LanguageSwitch } from './LanguageSwitch';
import { gradients, radius, shadow, spacing } from '../theme/colors';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: ReactNode;
  /**
   * Render the title/subtitle on their own full-width line below the badge + actions row, instead of
   * squeezed between them. Use when rightAction is wide (several icons) and the title would truncate.
   */
  stacked?: boolean;
  /** Set false to omit the leading initial-letter badge on a root screen (no onBack). Defaults to true. */
  showBadge?: boolean;
}

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  rightAction,
  stacked = false,
  showBadge = true,
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const initial = (title ?? '').trim().charAt(0).toUpperCase() || '?';
  const titleBlock = (
    <View style={styles.titleBlock}>
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={styles.subtitle} numberOfLines={stacked ? 2 : 1}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );

  return (
    <LinearGradient
      colors={gradients.header}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, { paddingTop: insets.top + spacing.md }]}
    >
      <View style={styles.row}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.badge} accessibilityRole="button">
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
        ) : showBadge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{initial}</Text>
          </View>
        ) : null}
        {stacked ? <View style={styles.spacer} /> : titleBlock}
        <View style={styles.rightActionWrap}>{rightAction ?? <LanguageSwitch />}</View>
      </View>
      {stacked ? <View style={styles.stackedTitleBlock}>{titleBlock}</View> : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    ...shadow,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  backText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  titleBlock: {
    flex: 1,
    flexShrink: 1,
    overflow: 'hidden',
  },
  spacer: {
    flex: 1,
  },
  stackedTitleBlock: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  rightActionWrap: {
    flexShrink: 0,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 23,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    marginTop: 2,
  },
});
