import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { createFeeCategory, listFeeCategories } from '../api/feeCategories';
import type { FeeCategory } from '../api/types';
import { colors, radius, spacing } from '../theme/colors';
import LabeledInput from './LabeledInput';

interface Props {
  schoolId: string;
  selectedId: string | null;
  onSelect: (feeCategory: FeeCategory) => void;
}

export default function FeeCategoryPicker({ schoolId, selectedId, onSelect }: Props) {
  const [categories, setCategories] = useState<FeeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    listFeeCategories(schoolId)
      .then(setCategories)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [schoolId]);

  const handleCreate = async () => {
    if (!code || !name) return;
    setCreating(true);
    setError(null);
    try {
      const created = await createFeeCategory(schoolId, { code, name });
      setCategories((prev) => [...prev, created]);
      onSelect(created);
      setShowCreate(false);
      setCode('');
      setName('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <ActivityIndicator style={styles.loading} />;

  return (
    <View>
      {error && <Text style={styles.error}>{error}</Text>}
      {categories.length === 0 && !showCreate && (
        <Text style={styles.empty}>No fee categories yet.</Text>
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
          <LabeledInput label="Code" value={code} onChangeText={setCode} placeholder="e.g. TUITION" autoCapitalize="characters" />
          <LabeledInput label="Name" value={name} onChangeText={setName} placeholder="e.g. Tuition Fee" />
          <Pressable style={styles.createButton} onPress={handleCreate} disabled={creating}>
            <Text style={styles.createButtonText}>{creating ? 'Creating…' : 'Create & select'}</Text>
          </Pressable>
          <Pressable onPress={() => setShowCreate(false)}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={() => setShowCreate(true)}>
          <Text style={styles.addNew}>+ New fee category</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { marginVertical: spacing.md },
  error: { color: colors.error, marginBottom: spacing.sm },
  empty: { color: colors.textMuted, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.textPrimary },
  chipTextSelected: { color: colors.white },
  addNew: { color: colors.primary, fontWeight: '600', marginTop: spacing.xs },
  createForm: { marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  createButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  createButtonText: { color: colors.white, fontWeight: '600' },
  cancel: { color: colors.textMuted, textAlign: 'center' },
});
