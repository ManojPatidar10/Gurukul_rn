import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../theme/colors';

type ChipVariant = 'success' | 'warning' | 'error' | 'neutral' | 'info';

interface StatusChipProps {
  label: string;
  variant?: ChipVariant;
}

const variantStyles: Record<ChipVariant, { bg: string; text: string }> = {
  success: { bg: '#E8F5E9', text: colors.success },
  warning: { bg: '#FFF3E0', text: colors.warning },
  error: { bg: '#FFEBEE', text: colors.error },
  neutral: { bg: colors.primaryLight, text: colors.textSecondary },
  info: { bg: '#E3F2FD', text: colors.accent },
};

export function StatusChip({ label, variant = 'neutral' }: StatusChipProps) {
  const style = variantStyles[variant];

  return (
    <View style={[styles.chip, { backgroundColor: style.bg }]}>
      <Text style={[styles.text, { color: style.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
