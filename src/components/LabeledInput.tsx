import { StyleSheet, Text, TextInput, View, TextInputProps } from 'react-native';
import { colors, radius, spacing } from '../theme/colors';

interface Props extends TextInputProps {
  label: string;
}

export default function LabeledInput({ label, style, ...rest }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={[styles.input, style]} placeholderTextColor={colors.textMuted} {...rest} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: 0,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    backgroundColor: colors.surfaceMuted,
    color: colors.textPrimary,
  },
});
