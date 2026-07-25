import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { createFeeCategory, listFeeCategories } from '../../api/feeCategories';
import type { FeeCategory } from '../../api/types';
import LabeledInput from '../../components/LabeledInput';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'FeeCategoriesList'>;

export function FeeCategoriesListScreen({ navigation }: Props) {
  const schoolId = useSchoolId();
  const [categories, setCategories] = useState<FeeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setError(null);
    return listFeeCategories(schoolId)
      .then(setCategories)
      .catch((e) => setError(e.message));
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

  const handleCreate = async () => {
    if (!code || !name) return;
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
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Fee Categories" onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        {showCreate ? (
          <View style={styles.createForm}>
            <LabeledInput label="Code" value={code} onChangeText={setCode} placeholder="e.g. TUITION" autoCapitalize="characters" />
            <LabeledInput label="Name" value={name} onChangeText={setName} placeholder="e.g. Tuition Fee" />
            <Pressable style={styles.addButton} onPress={handleCreate} disabled={creating}>
              <Text style={styles.addButtonText}>{creating ? 'Creating…' : 'Create category'}</Text>
            </Pressable>
            <Pressable onPress={() => setShowCreate(false)}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.addButton} onPress={() => setShowCreate(true)}>
            <Text style={styles.addButtonText}>+ Add category</Text>
          </Pressable>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <FlatList
          data={categories}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            !loading ? (
              <Text style={styles.empty}>
                {error ? 'Could not load categories.' : '0 fee categories yet — add the first one.'}
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.rowName}>{item.name}</Text>
              <Text style={styles.rowMeta}>{item.code}</Text>
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
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  addButtonText: { color: colors.white, fontWeight: '700' },
  cancel: { color: colors.textMuted, textAlign: 'center', marginBottom: spacing.md },
  error: { color: colors.error, marginBottom: spacing.md },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowName: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  rowMeta: { fontSize: 13, color: colors.textMuted },
});
