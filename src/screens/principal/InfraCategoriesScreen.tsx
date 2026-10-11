import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  createInfraExpenseCategory,
  listInfraExpenseCategories,
  updateInfraExpenseCategory,
} from '../../api/infraExpenseCategories';
import type { CategoryExistsData, InfraExpenseCategory } from '../../api/expenseTypes';
import LabeledInput from '../../components/LabeledInput';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { useBottomInset } from '../../hooks/useBottomInset';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';
import { categoryExistsData, categoryLabel } from '../../utils/expenses';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'InfraCategories'>;

const NAME_MAX_LENGTH = 100;

/** Infra expense categories: add, rename, and turn on or off. Turned-off ones can't be picked for new requests. */
export function InfraCategoriesScreen({ navigation }: Props) {
  const listBottom = useBottomInset();
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { showToast } = useToast();
  const [categories, setCategories] = useState<InfraExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError(null);
    return listInfraExpenseCategories(schoolId, true)
      .then(setCategories)
      .catch((e) => setError(getErrorMessage(e)));
  }, [schoolId]);

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

  const upsert = (saved: InfraExpenseCategory) =>
    setCategories((prev) => {
      const others = prev.filter((c) => c.id !== saved.id);
      return [...others, saved].sort(
        (a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || a.code.localeCompare(b.code)
      );
    });

  const turnBackOn = async (existing: CategoryExistsData) => {
    setBusy(true);
    try {
      const saved = await updateInfraExpenseCategory(schoolId, existing.id, { name: existing.name, active: true });
      upsert(saved);
      setShowCreate(false);
      setNewName('');
      setEditingId(null);
      showToast(t('expenseCategories.turnedBackOn', { name: saved.name }), 'success');
    } catch (e) {
      showToast(getErrorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  /** A name that's taken: offer to turn the existing one back on when it's off, else just say so. */
  const handleExists = (e: unknown) => {
    const existing = categoryExistsData(e);
    if (existing && !existing.active) {
      Alert.alert(t('expenseCategories.existsTitle'), t('expenseCategories.existsInactive', { name: existing.name }), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('expenseCategories.turnBackOn'), onPress: () => turnBackOn(existing) },
      ]);
      return;
    }
    showToast(getErrorMessage(e), 'error');
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      showToast(t('expenseCategories.nameRequired'), 'error');
      return;
    }
    setBusy(true);
    try {
      const created = await createInfraExpenseCategory(schoolId, { name });
      upsert(created);
      setShowCreate(false);
      setNewName('');
    } catch (e) {
      handleExists(e);
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (category: InfraExpenseCategory) => {
    if (editingId === category.id) {
      setEditingId(null);
      return;
    }
    setEditingId(category.id);
    setEditName(category.name);
    setEditActive(category.active !== false);
  };

  const handleSave = async (category: InfraExpenseCategory) => {
    const name = editName.trim();
    if (!name) {
      showToast(t('expenseCategories.nameRequired'), 'error');
      return;
    }
    setBusy(true);
    try {
      const saved = await updateInfraExpenseCategory(schoolId, category.id, { name, active: editActive });
      upsert(saved);
      setEditingId(null);
      showToast(t('expenseCategories.saved'), 'success');
    } catch (e) {
      handleExists(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('expenseCategories.title')} onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        {showCreate ? (
          <View style={styles.createCard}>
            <LabeledInput
              label={t('expenseCategories.name')}
              required
              value={newName}
              onChangeText={setNewName}
              maxLength={NAME_MAX_LENGTH}
              autoFocus
            />
            <View style={styles.rowButtons}>
              <Pressable style={[styles.primaryButton, busy && styles.disabled]} onPress={handleCreate} disabled={busy}>
                <Text style={styles.primaryButtonText}>{busy ? t('expenseCategories.creating') : t('expenseCategories.create')}</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={() => setShowCreate(false)}>
                <Text style={styles.secondaryButtonText}>{t('common.cancel')}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable style={styles.addButton} onPress={() => setShowCreate(true)}>
            <Text style={styles.addButtonText}>{t('expenseCategories.add')}</Text>
          </Pressable>
        )}

        <Text style={styles.hint}>{t('expenseCategories.activeHint')}</Text>
        {error && <ErrorNotice message={error} />}

        <FlatList
          contentContainerStyle={{ paddingBottom: listBottom }}
          data={categories}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator style={styles.loader} color={colors.primary} />
            ) : (
              <Text style={styles.empty}>{error ? t('expenseCategories.loadError') : t('expenseCategories.empty')}</Text>
            )
          }
          renderItem={({ item }) => {
            const active = item.active !== false;
            const editing = editingId === item.id;
            return (
              <View style={styles.row}>
                <Pressable style={styles.rowHeader} onPress={() => startEdit(item)} accessibilityRole="button">
                  <Text style={[styles.rowName, !active && styles.rowNameOff]}>{categoryLabel(item, t)}</Text>
                  {!active && <StatusChip label={t('expenseCategories.turnedOff')} variant="neutral" />}
                </Pressable>
                {editing && (
                  <View style={styles.editor}>
                    <LabeledInput
                      label={t('expenseCategories.name')}
                      required
                      value={editName}
                      onChangeText={setEditName}
                      maxLength={NAME_MAX_LENGTH}
                    />
                    <View style={styles.switchRow}>
                      <Text style={styles.switchLabel}>{t('expenseCategories.inUse')}</Text>
                      <Switch
                        value={editActive}
                        onValueChange={setEditActive}
                        trackColor={{ true: colors.primary, false: colors.border }}
                      />
                    </View>
                    <View style={styles.rowButtons}>
                      <Pressable style={[styles.primaryButton, busy && styles.disabled]} onPress={() => handleSave(item)} disabled={busy}>
                        <Text style={styles.primaryButtonText}>{busy ? t('common.saving') : t('common.save')}</Text>
                      </Pressable>
                      <Pressable style={styles.secondaryButton} onPress={() => setEditingId(null)}>
                        <Text style={styles.secondaryButtonText}>{t('common.cancel')}</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            );
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, paddingHorizontal: spacing.lg },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  addButtonText: { color: colors.white, fontWeight: '700' },
  createCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  hint: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.md },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  loader: { marginTop: 40 },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  rowName: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  rowNameOff: { color: colors.textMuted },
  editor: { marginTop: spacing.md },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  switchLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  rowButtons: { flexDirection: 'row', gap: spacing.sm },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  primaryButtonText: { color: colors.white, fontWeight: '700' },
  secondaryButton: {
    flex: 1,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  secondaryButtonText: { color: colors.primary, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
