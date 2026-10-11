import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { listFeeCategories, updateFeeCategory } from '../../api/feeCategories';
import type { FeeCategory } from '../../api/types';
import LabeledInput from '../../components/LabeledInput';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { useBottomInset } from '../../hooks/useBottomInset';
import { useCreateFeeCategory } from '../../hooks/useCreateFeeCategory';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'FeeCategoriesList'>;

export function FeeCategoriesListScreen({ navigation }: Props) {
  const listBottom = useBottomInset();
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const [categories, setCategories] = useState<FeeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const { code, setCode, name, setName, normalisedCode, creating, create } = useCreateFeeCategory(schoolId);
  // The row being edited inline: its name and whether it's in use, as changed so far.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const load = useCallback(() => {
    setError(null);
    return listFeeCategories(schoolId)
      .then(setCategories)
      .catch((e) => {
        setError(getErrorMessage(e));
        showToast(getErrorMessage(e), 'error');
      });
  }, [schoolId, showToast]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setLoading(true);
      load().finally(() => setLoading(false));
    });
    return unsubscribe;
  }, [navigation, load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  };

  const handleCreate = async () => {
    const created = await create();
    if (!created) return;
    setCategories((prev) => [...prev, created]);
    setShowCreate(false);
  };

  const startEdit = (category: FeeCategory) => {
    setEditingId(category.id);
    setEditName(category.name);
    setEditActive(category.active !== false);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      showToast(t('fees.categories.errors.name'), 'error');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateFeeCategory(schoolId, editingId, { name: trimmed, active: editActive });
      setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setEditingId(null);
      showToast(t('fees.categories.saved'), 'success');
    } catch (e) {
      showToast(getErrorMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('fees.categories.title')} onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        {showCreate ? (
          <View style={styles.createForm}>
            <LabeledInput
              label={t('fees.categories.code')}
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
              label={t('fees.categories.name')}
              required
              value={name}
              onChangeText={setName}
              placeholder={t('fees.categories.namePlaceholder')}
              maxLength={100}
            />
            <Pressable style={styles.addButton} onPress={handleCreate} disabled={creating}>
              <Text style={styles.addButtonText}>{creating ? t('common.creating') : t('fees.categories.createButton')}</Text>
            </Pressable>
            <Pressable onPress={() => setShowCreate(false)}>
              <Text style={styles.cancel}>{t('common.cancel')}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.addButton} onPress={() => setShowCreate(true)}>
            <Text style={styles.addButtonText}>{t('fees.categories.addButton')}</Text>
          </Pressable>
        )}

        <FlatList
          contentContainerStyle={{ paddingBottom: listBottom }}
          data={categories}
          // The inline edit form lives in a row, so rows re-render as it's typed in.
          extraData={{ editingId, editName, editActive, saving }}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator style={styles.loader} color={colors.primary} />
            ) : (
              <Text style={styles.empty}>
                {error ? t('fees.categories.loadError') : t('fees.categories.empty')}
              </Text>
            )
          }
          renderItem={({ item }) =>
            item.id === editingId ? (
              <View style={[styles.row, styles.editCard]}>
                <View style={styles.editHeader}>
                  <View style={styles.codeChip}>
                    <Text style={styles.codeChipText}>{item.code}</Text>
                  </View>
                </View>
                <LabeledInput
                  label={t('fees.categories.name')}
                  required
                  value={editName}
                  onChangeText={setEditName}
                  placeholder={t('fees.categories.namePlaceholder')}
                  maxLength={100}
                />
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>{t('fees.categories.inUse')}</Text>
                  <Switch value={editActive} onValueChange={setEditActive} accessibilityLabel={t('fees.categories.inUse')} />
                </View>
                <Text style={styles.hint}>{t('fees.categories.inUseHint')}</Text>
                <View style={styles.editButtons}>
                  <Pressable style={styles.secondaryButton} onPress={() => setEditingId(null)} disabled={saving}>
                    <Text style={styles.secondaryButtonText}>{t('common.cancel')}</Text>
                  </Pressable>
                  <Pressable style={[styles.primaryButton, saving && styles.disabled]} onPress={handleSaveEdit} disabled={saving}>
                    <Text style={styles.addButtonText}>{saving ? t('common.saving') : t('common.save')}</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                style={[styles.row, item.active === false && styles.rowInactive]}
                onPress={() => startEdit(item)}
                accessibilityRole="button"
                accessibilityHint={t('common.edit')}
              >
                <View style={styles.rowMain}>
                  <Text style={[styles.rowName, item.active === false && styles.rowNameInactive]}>{item.name}</Text>
                  {item.active === false && <Text style={styles.notInUse}>{t('fees.categories.notInUse')}</Text>}
                </View>
                <View style={styles.codeChip}>
                  <Text style={styles.codeChipText}>{item.code}</Text>
                </View>
              </Pressable>
            )
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, paddingHorizontal: spacing.lg },
  createForm: { marginTop: spacing.lg, marginBottom: spacing.md },
  codePreview: { fontSize: 12, color: colors.textMuted, marginTop: -spacing.sm, marginBottom: spacing.md },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    ...softShadow,
  },
  addButtonText: { color: colors.white, fontWeight: '700' },
  cancel: { color: colors.textMuted, textAlign: 'center', marginBottom: spacing.md },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  loader: { marginTop: 40 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  rowInactive: { opacity: 0.6 },
  rowMain: { flex: 1, marginRight: spacing.sm },
  rowName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  rowNameInactive: { color: colors.textSecondary },
  notInUse: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginTop: 2 },
  codeChip: {
    backgroundColor: accents.fees.light,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  codeChipText: { fontSize: 12, fontWeight: '700', color: accents.fees.base },
  editCard: { flexDirection: 'column', alignItems: 'stretch' },
  editHeader: { flexDirection: 'row', marginBottom: spacing.sm },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.md },
  editButtons: { flexDirection: 'row', gap: spacing.sm },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryButtonText: { color: colors.textPrimary, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
