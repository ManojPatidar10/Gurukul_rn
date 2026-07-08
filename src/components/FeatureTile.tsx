import { FontAwesome5 } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, spacing } from '../theme/colors';
import type { FeatureAction } from '../types/principal';

interface FeatureTileProps {
  feature: FeatureAction;
  onPress: () => void;
}

export function FeatureTile({ feature, onPress }: FeatureTileProps) {
  return (
    <TouchableOpacity style={styles.tile} onPress={onPress} accessibilityRole="button">
      <View style={styles.iconCircle}>
        <FontAwesome5 name={feature.icon} size={20} color={colors.primary} />
      </View>
      <Text style={styles.label} numberOfLines={2}>
        {feature.title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: '23%',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
