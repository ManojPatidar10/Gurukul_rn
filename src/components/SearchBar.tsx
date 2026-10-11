import { StyleSheet, TextInput, View } from 'react-native';
import { colors, radius, spacing } from '../theme/colors';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Called when the keyboard's search key is pressed; shows a search key when set. */
  onSubmit?: () => void;
}

export function SearchBar({ value, onChangeText, placeholder = 'Search…', onSubmit }: Props) {
  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        onSubmitEditing={onSubmit}
        returnKeyType={onSubmit ? 'search' : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  input: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    backgroundColor: colors.surfaceMuted,
    color: colors.textPrimary,
  },
});
