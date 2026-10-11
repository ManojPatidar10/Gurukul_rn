import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { listFeeCategories } from '../api/feeCategories';
import type { FeeCategory } from '../api/types';
import { useToast } from '../context/ToastContext';
import { useCreateFeeCategory } from '../hooks/useCreateFeeCategory';
import { colors, radius, softShadow, spacing } from '../theme/colors';
import { categoryPickerEmptyKey, pickableCategories } from '../utils/feeBills';
import LabeledInput from './LabeledInput';
import { getErrorMessage } from '../api/errorMessage';

interface Props {
  schoolId: string;
  selectedId: string | null;
  onSelect: (feeCategory: FeeCategory) => void;
}

/** Categories in use (plus the one already on this line, even if it was retired since), and a quick "new category" form. */
export default function FeeCategoryPicker({ schoolId, selectedId, onSelect }: Props) {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<FeeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const { code, setCode, name, setName, normalisedCode, creating, create } = useCreateFeeCategory(schoolId);
  const { showToast } = useToast();

  const load = () => {
    setLoading(true);
    listFeeCategories(schoolId)
      .then(setCategories)
      .catch((e) => showToast(getErrorMessage(e), 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [schoolId]);

  const handleCreate = async () => {
    const created = await create();
    if (!created) return;
    setCategories((prev) => [...prev, created]);
    onSelect(created);
    setShowCreate(false);
  };

  if (loading) return <ActivityIndicator style={styles.loading} />;

  const shown = pickableCategories(categories, selectedId);
  const emptyKey = categoryPickerEmptyKey(categories.length, shown.length);

  return (
    <View>
      {emptyKey && !showCreate && <Text style={styles.empty}>{t(emptyKey)}</Text>}
      <View style={styles.chips}>
        {shown.map((cat) => (
          <Pressable
            key={cat.id}
            onPress={() => onSelect(cat)}
            style={[styles.chip, selectedId === cat.id && styles.chipSelected]}
          >
            <Text style={[styles.chipText, selectedId === cat.id && styles.chipTextSelected]}>
              {cat.name} ({cat.code}){cat.active === false ? ` · ${t('fees.categories.notInUse')}` : ''}
            </Text>
          </Pressable>
        ))}
      </View>

      {showCreate ? (
        <View style={styles.createForm}>
          <LabeledInput
            label={t('fees.categoryPicker.code')}
            required
            value={code}
            onChangeText={setCode}
            placeholder={t('fees.categories.codePlaceholder')}
            autoCapitalize="characters"
            maxLength={40}
          />
          {normalisedCode && normalisedCode !== code ? (
            <Text style={styles.codePreview}>{t('fees.categories.codePreview', { code: normalisedCode })}</Text>
          ) : null}
          <LabeledInput
            label={t('fees.categoryPicker.name')}
            required
            value={name}
            onChangeText={setName}
            placeholder={t('fees.categories.namePlaceholder')}
            maxLength={100}
          />
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
  codePreview: { fontSize: 12, color: colors.textMuted, marginTop: -spacing.sm, marginBottom: spacing.md },
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
