import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { getGradingScale, replaceGradingScale } from '../../api/gradingScale';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'GradingScale'>;

interface BandRow {
  key: string;
  minPercentage: string;
  maxPercentage: string;
  label: string;
}

let nextKey = 0;
const newRowKey = () => `new-${nextKey++}`;

export function GradingScaleScreen({ navigation }: Props) {
  const schoolId = useSchoolId();
  const [rows, setRows] = useState<BandRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setLoading(true);
    getGradingScale(schoolId)
      .then((bands) => {
        setRows(
          bands.map((b) => ({
            key: b.id ?? newRowKey(),
            minPercentage: String(b.minPercentage),
            maxPercentage: String(b.maxPercentage),
            label: b.label,
          }))
        );
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [schoolId]);

  const updateRow = (key: string, patch: Partial<BandRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const removeRow = (key: string) => {
    setRows((prev) => prev.filter((r) => r.key !== key));
  };

  const addRow = () => {
    setRows((prev) => [...prev, { key: newRowKey(), minPercentage: '', maxPercentage: '', label: '' }]);
  };

  const canSave =
    rows.length > 0 &&
    rows.every((r) => r.label.trim() && r.minPercentage.trim() && r.maxPercentage.trim() && !Number.isNaN(Number(r.minPercentage)) && !Number.isNaN(Number(r.maxPercentage)));

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const bands = rows
        .map((r) => ({ minPercentage: Number(r.minPercentage), maxPercentage: Number(r.maxPercentage), label: r.label.trim() }))
        .sort((a, b) => b.minPercentage - a.minPercentage);
      await replaceGradingScale(schoolId, bands);
      setSuccess(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Grading Scale" subtitle="Marks-to-grade bands" onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <Text style={styles.description}>
          Marks-percentage bands used to compute a letter grade on every grade card and report
          card. Bands should cover 0-100% without gaps; whichever band a percentage falls into
          (by its minimum) wins.
        </Text>

        {loading && <ActivityIndicator style={styles.loading} color={colors.primary} />}
        {error && <Text style={styles.error}>{error}</Text>}
        {success && <Text style={styles.success}>Grading scale updated.</Text>}

        {!loading &&
          rows.map((row) => (
            <View key={row.key} style={styles.row}>
              <TextInput
                style={[styles.input, styles.inputSmall]}
                value={row.minPercentage}
                onChangeText={(text) => updateRow(row.key, { minPercentage: text })}
                keyboardType="numeric"
                placeholder="Min %"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.dash}>–</Text>
              <TextInput
                style={[styles.input, styles.inputSmall]}
                value={row.maxPercentage}
                onChangeText={(text) => updateRow(row.key, { maxPercentage: text })}
                keyboardType="numeric"
                placeholder="Max %"
                placeholderTextColor={colors.textMuted}
              />
              <TextInput
                style={[styles.input, styles.inputLabel]}
                value={row.label}
                onChangeText={(text) => updateRow(row.key, { label: text })}
                placeholder="Grade"
                placeholderTextColor={colors.textMuted}
              />
              <Pressable style={styles.removeButton} onPress={() => removeRow(row.key)}>
                <Text style={styles.removeButtonText}>✕</Text>
              </Pressable>
            </View>
          ))}

        {!loading && (
          <Pressable style={styles.addButton} onPress={addRow}>
            <Text style={styles.addButtonText}>+ Add band</Text>
          </Pressable>
        )}

        {!loading && (
          <Pressable
            style={[styles.saveButton, (!canSave || saving) && styles.disabled]}
            onPress={handleSave}
            disabled={!canSave || saving}
          >
            {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveButtonText}>Save grading scale</Text>}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  description: { fontSize: 13, color: colors.textMuted, lineHeight: 19, marginBottom: spacing.lg },
  loading: { marginTop: spacing.xl },
  error: { color: colors.error, marginBottom: spacing.md },
  success: { color: colors.success, marginBottom: spacing.md, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.textPrimary,
  },
  inputSmall: { width: 56, textAlign: 'center' },
  inputLabel: { flex: 1 },
  dash: { color: colors.textMuted },
  removeButton: { padding: spacing.xs },
  removeButtonText: { color: colors.error, fontWeight: '700', fontSize: 16 },
  addButton: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  addButtonText: { color: colors.primary, fontWeight: '700' },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.xl,
    ...softShadow,
  },
  disabled: { opacity: 0.5 },
  saveButtonText: { color: colors.white, fontWeight: '700' },
});
