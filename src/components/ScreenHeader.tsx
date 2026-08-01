import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { gradients, radius, shadow, spacing } from '../theme/colors';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: ReactNode;
}

export function ScreenHeader({ title, subtitle, onBack, rightAction }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const initial = title.trim().charAt(0).toUpperCase() || '?';

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
        ) : (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{initial}</Text>
          </View>
        )}
        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {rightAction}
      </View>
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
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    marginTop: 2,
  },
});
