import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { createFeeCategory, listFeeCategories } from '../../api/feeCategories';
import type { FeeCategory } from '../../api/types';
import LabeledInput from '../../components/LabeledInput';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'FeeCategoriesList'>;

export function FeeCategoriesListScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const [categories, setCategories] = useState<FeeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const { showToast } = useToast();

  const load = useCallback(() => {
    setError(null);
    return listFeeCategories(schoolId)
      .then(setCategories)
      .catch((e) => {
        setError(e.message);
        showToast(e.message, 'error');
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
    if (!code.trim()) {
      showToast(t('fees.categories.errors.code'), 'error');
      return;
    }
    if (!name.trim()) {
      showToast(t('fees.categories.errors.name'), 'error');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const created = await createFeeCategory(schoolId, { code, name });
      setCategories((prev) => [...prev, created]);
      setShowCreate(false);
      setCode('');
      setName('');
    } catch (e) {
      setError((e as Error).message);
      showToast((e as Error).message, 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('fees.categories.title')} onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        {showCreate ? (
          <View style={styles.createForm}>
            <LabeledInput label={t('fees.categories.code')} required value={code} onChangeText={setCode} placeholder="e.g. TUITION" autoCapitalize="characters" />
            <LabeledInput label={t('fees.categories.name')} required value={name} onChangeText={setName} placeholder="e.g. Tuition Fee" />
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
          data={categories}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            !loading ? (
              <Text style={styles.empty}>
                {error ? t('fees.categories.loadError') : t('fees.categories.empty')}
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.rowName}>{item.name}</Text>
              <View style={styles.codeChip}>
                <Text style={styles.codeChipText}>{item.code}</Text>
              </View>
            </View>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, paddingHorizontal: spacing.lg },
  createForm: { marginTop: spacing.lg, marginBottom: spacing.md },
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
  rowName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  codeChip: {
    backgroundColor: accents.fees.light,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  codeChipText: { fontSize: 12, fontWeight: '700', color: accents.fees.base },
});
