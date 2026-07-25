import { FontAwesome5 } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { accents, colors, radius, softShadow, spacing } from '../theme/colors';
import type { FeatureAction } from '../types/principal';

interface FeatureTileProps {
  feature: FeatureAction;
  onPress: () => void;
}

export function FeatureTile({ feature, onPress }: FeatureTileProps) {
  const accent = accents[feature.id];

  return (
    <TouchableOpacity style={styles.tile} onPress={onPress} activeOpacity={0.75} accessibilityRole="button">
      <View style={[styles.iconCircle, { backgroundColor: accent.light }]}>
        <FontAwesome5 name={feature.icon} size={18} color={accent.base} />
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {feature.title}
      </Text>
      <Text style={styles.description} numberOfLines={2}>
        {feature.description}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...softShadow,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  description: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
  },
});
