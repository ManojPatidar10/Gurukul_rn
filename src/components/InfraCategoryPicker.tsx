import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { listInfraExpenseCategories } from '../api/infraExpenseCategories';
import type { InfraExpenseCategory } from '../api/types';
import { colors, radius, spacing } from '../theme/colors';

interface Props {
  schoolId: string;
  selectedId: string | null;
  onSelect: (category: InfraExpenseCategory) => void;
}

export default function InfraCategoryPicker({ schoolId, selectedId, onSelect }: Props) {
  const [categories, setCategories] = useState<InfraExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    listInfraExpenseCategories(schoolId)
      .then(setCategories)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [schoolId]);

  if (loading) return <ActivityIndicator style={styles.loading} />;

  return (
    <View>
      {error && <Text style={styles.error}>{error}</Text>}
      {categories.length === 0 && !error && (
        <Text style={styles.empty}>
          No infrastructure expense categories exist on this school yet — these can only be seeded on the
          backend (there's no create endpoint for them).
        </Text>
      )}
      <View style={styles.chips}>
        {categories.map((cat) => (
          <Pressable
            key={cat.id}
            onPress={() => onSelect(cat)}
            style={[styles.chip, selectedId === cat.id && styles.chipSelected]}
          >
            <Text style={[styles.chipText, selectedId === cat.id && styles.chipTextSelected]}>
              {cat.name} ({cat.code})
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { marginVertical: spacing.md },
  error: { color: colors.error, marginBottom: spacing.sm },
  empty: { color: colors.textMuted, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  chipTextSelected: { color: colors.white },
});
