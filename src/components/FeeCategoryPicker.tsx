import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { createFeeCategory, listFeeCategories } from '../api/feeCategories';
import type { FeeCategory } from '../api/types';
import { useToast } from '../context/ToastContext';
import { colors, radius, softShadow, spacing } from '../theme/colors';
import LabeledInput from './LabeledInput';

interface Props {
  schoolId: string;
  selectedId: string | null;
  onSelect: (feeCategory: FeeCategory) => void;
}

export default function FeeCategoryPicker({ schoolId, selectedId, onSelect }: Props) {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<FeeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const { showToast } = useToast();

  const load = () => {
    setLoading(true);
    listFeeCategories(schoolId)
      .then(setCategories)
      .catch((e) => showToast(e.message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [schoolId]);

  const handleCreate = async () => {
    if (!code.trim()) {
      showToast(t('fees.categories.errors.code'), 'error');
      return;
    }
    if (!name.trim()) {
      showToast(t('fees.categories.errors.name'), 'error');
      return;
    }
    setCreating(true);
    try {
      const created = await createFeeCategory(schoolId, { code, name });
      setCategories((prev) => [...prev, created]);
      onSelect(created);
      setShowCreate(false);
      setCode('');
      setName('');
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <ActivityIndicator style={styles.loading} />;

  return (
    <View>
      {categories.length === 0 && !showCreate && (
        <Text style={styles.empty}>{t('fees.categoryPicker.empty')}</Text>
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

      {showCreate ? (
        <View style={styles.createForm}>
          <LabeledInput label={t('fees.categoryPicker.code')} required value={code} onChangeText={setCode} placeholder="e.g. TUITION" autoCapitalize="characters" />
          <LabeledInput label={t('fees.categoryPicker.name')} required value={name} onChangeText={setName} placeholder="e.g. Tuition Fee" />
          <Pressable style={styles.createButton} onPress={handleCreate} disabled={creating}>
            <Text style={styles.createButtonText}>{creating ? t('common.creating') : t('common.createAndSelect')}</Text>
          </Pressable>
          <Pressable onPress={() => setShowCreate(false)}>
            <Text style={styles.cancel}>{t('common.cancel')}</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={() => setShowCreate(true)}>
          <Text style={styles.addNew}>{t('fees.categoryPicker.addNew')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { marginVertical: spacing.md },
  empty: { color: colors.textMuted, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
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
  addNew: { color: colors.primary, fontWeight: '700', marginTop: spacing.xs },
  createForm: { marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  createButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
    ...softShadow,
  },
  createButtonText: { color: colors.white, fontWeight: '600' },
  cancel: { color: colors.textMuted, textAlign: 'center' },
});
