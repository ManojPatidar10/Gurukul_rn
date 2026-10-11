import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { listInfraExpenseCategories } from '../api/infraExpenseCategories';
import type { InfraExpenseCategory } from '../api/expenseTypes';
import { colors, radius, spacing } from '../theme/colors';
import type { PrincipalStackParamList } from '../types/principal';
import { categoryLabel } from '../utils/expenses';
import { getErrorMessage } from '../api/errorMessage';
import { ErrorNotice } from './ErrorNotice';

interface Props {
  schoolId: string;
  selectedId: string | null;
  onSelect: (category: InfraExpenseCategory) => void;
}

/** The active categories, for a new request. Reloads on focus, so one added under Categories shows up. */
export default function InfraCategoryPicker({ schoolId, selectedId, onSelect }: Props) {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<PrincipalStackParamList>>();
  const [categories, setCategories] = useState<InfraExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setError(null);
      listInfraExpenseCategories(schoolId)
        // The server lists active ones only; an older one may not send `active` at all.
        .then((rows) => setCategories(rows.filter((c) => c.active !== false)))
        .catch((e) => setError(getErrorMessage(e)))
        .finally(() => setLoading(false));
    }, [schoolId])
  );

  if (loading) return <ActivityIndicator style={styles.loading} />;

  return (
    <View>
      {error && <ErrorNotice message={error} />}
      {categories.length === 0 && !error && (
        <View style={styles.emptyRow}>
          <Text style={styles.empty}>{t('expenseCategories.picker.empty')}</Text>
          <Pressable onPress={() => navigation.navigate('InfraCategories')} accessibilityRole="link">
            <Text style={styles.addLink}>{t('expenseCategories.picker.addLink')}</Text>
          </Pressable>
        </View>
      )}
      <View style={styles.chips}>
        {categories.map((cat) => (
          <Pressable
            key={cat.id}
            onPress={() => onSelect(cat)}
            style={[styles.chip, selectedId === cat.id && styles.chipSelected]}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedId === cat.id }}
          >
            <Text style={[styles.chipText, selectedId === cat.id && styles.chipTextSelected]}>{categoryLabel(cat, t)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { marginVertical: spacing.md },
  emptyRow: { marginBottom: spacing.sm },
  empty: { color: colors.textMuted, marginBottom: spacing.xs },
  addLink: { color: colors.primary, fontWeight: '700' },
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
