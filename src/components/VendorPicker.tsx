import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { createVendor, findSimilarVendors, getVendor, listVendors } from '../api/vendors';
import type { Vendor, VendorSimilar } from '../api/expenseTypes';
import { colors, radius, softShadow, spacing } from '../theme/colors';
import LabeledInput from './LabeledInput';
import { getErrorMessage } from '../api/errorMessage';
import { ErrorNotice } from './ErrorNotice';

interface Props {
  schoolId: string;
  selectedId: string | null;
  onSelect: (vendor: Vendor) => void;
}

/** Same-named vendors, or none when the check itself fails (an older server) - it never blocks creating one. */
async function similarVendors(schoolId: string, name: string): Promise<VendorSimilar[]> {
  try {
    return await findSimilarVendors(schoolId, name);
  } catch {
    return [];
  }
}

export default function VendorPicker({ schoolId, selectedId, onSelect }: Props) {
  const { t } = useTranslation();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    listVendors(schoolId)
      .then(setVendors)
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, [schoolId]);

  const finishCreate = () => {
    setShowCreate(false);
    setName('');
  };

  const create = async (vendorName: string) => {
    setCreating(true);
    setError(null);
    try {
      const created = await createVendor(schoolId, { name: vendorName });
      setVendors((prev) => [...prev, created]);
      onSelect(created);
      finishCreate();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setCreating(false);
    }
  };

  const pickExisting = async (match: VendorSimilar) => {
    const known = vendors.find((v) => v.id === match.id);
    if (known) {
      onSelect(known);
      finishCreate();
      return;
    }
    try {
      onSelect(await getVendor(schoolId, match.id));
      finishCreate();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const handleCreate = async () => {
    const vendorName = name.trim();
    if (!vendorName) return;
    setCreating(true);
    const matches = await similarVendors(schoolId, vendorName);
    setCreating(false);
    if (matches.length === 0) {
      await create(vendorName);
      return;
    }
    const match = matches[0];
    Alert.alert(t('vendors.similar.title'), t('vendors.similar.pickerBody', { name: match.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('vendors.similar.createAnyway'), onPress: () => create(vendorName) },
      { text: t('vendors.similar.use'), onPress: () => pickExisting(match) },
    ]);
  };

  if (loading) return <ActivityIndicator style={styles.loading} />;

  return (
    <View>
      {error && <ErrorNotice message={error} />}
      {vendors.length === 0 && !showCreate && <Text style={styles.empty}>{t('vendors.picker.empty')}</Text>}
      <View style={styles.chips}>
        {vendors.map((v) => (
          <Pressable
            key={v.id}
            onPress={() => onSelect(v)}
            style={[styles.chip, selectedId === v.id && styles.chipSelected]}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedId === v.id }}
          >
            <Text style={[styles.chipText, selectedId === v.id && styles.chipTextSelected]}>{v.name}</Text>
          </Pressable>
        ))}
      </View>

      {showCreate ? (
        <View style={styles.createForm}>
          <LabeledInput label={t('vendors.picker.name')} value={name} onChangeText={setName} maxLength={255} />
          <Pressable style={[styles.createButton, (creating || !name.trim()) && styles.disabled]} onPress={handleCreate} disabled={creating || !name.trim()}>
            <Text style={styles.createButtonText}>{creating ? t('common.creating') : t('common.createAndSelect')}</Text>
          </Pressable>
          <Pressable onPress={() => setShowCreate(false)}>
            <Text style={styles.cancel}>{t('common.cancel')}</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={() => setShowCreate(true)}>
          <Text style={styles.addNew}>{t('vendors.picker.addNew')}</Text>
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
  disabled: { opacity: 0.5 },
  createButtonText: { color: colors.white, fontWeight: '600' },
  cancel: { color: colors.textMuted, textAlign: 'center' },
});
