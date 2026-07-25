import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { createFeeStructure } from '../../api/feeStructures';
import type { FeeCategory } from '../../api/types';
import ClassSectionPicker from '../../components/ClassSectionPicker';
import FeeCategoryPicker from '../../components/FeeCategoryPicker';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'FeeStructureForm'>;

interface LineDraft {
  feeCategoryId: string;
  feeCategoryLabel: string;
  amount: string;
}

export function FeeStructureFormScreen({ navigation }: Props) {
  const schoolId = useSchoolId();
  const [classSectionId, setClassSectionId] = useState<string | null>(null);
  const [classSectionLabel, setClassSectionLabel] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [pickerForIndex, setPickerForIndex] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addLine = () => {
    setLines((prev) => [...prev, { feeCategoryId: '', feeCategoryLabel: '', amount: '' }]);
    setPickerForIndex(lines.length);
  };

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
    setPickerForIndex(null);
  };

  const setLineCategory = (index: number, category: FeeCategory) => {
    setLines((prev) =>
      prev.map((line, i) =>
        i === index ? { ...line, feeCategoryId: category.id, feeCategoryLabel: `${category.name} (${category.code})` } : line
      )
    );
    setPickerForIndex(null);
  };

  const setLineAmount = (index: number, amount: string) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, amount } : line)));
  };

  const canSubmit =
    !!classSectionId &&
    !!academicYear &&
    lines.length > 0 &&
    lines.every((line) => line.feeCategoryId && Number(line.amount) > 0);

  const handleSubmit = async () => {
    if (!classSectionId) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await createFeeStructure(schoolId, {
        classSectionId,
        academicYear,
        lines: lines.map((line) => ({ feeCategoryId: line.feeCategoryId, amount: Number(line.amount) })),
      });
      navigation.replace('FeeStructureDetail', { feeStructure: created });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="New fee structure" onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <Text style={styles.label}>Class-section</Text>
        <ClassSectionPicker
          schoolId={schoolId}
          selectedId={classSectionId}
          onSelect={(cs) => {
            setClassSectionId(cs.id);
            setClassSectionLabel(cs.displayLabel);
            if (!academicYear) setAcademicYear(cs.academicYear);
          }}
        />
        {classSectionLabel ? <Text style={styles.selectedHint}>Selected: {classSectionLabel}</Text> : null}

        <LabeledInput
          label="Academic year"
          value={academicYear}
          onChangeText={setAcademicYear}
          placeholder="e.g. 2026-2027"
        />

        <Text style={styles.label}>Fee lines</Text>
        {lines.map((line, index) => (
          <View key={index} style={styles.lineCard}>
            <View style={styles.lineHeader}>
              <Text style={styles.lineTitle}>
                {line.feeCategoryLabel || 'No category selected'}
              </Text>
              <Pressable onPress={() => removeLine(index)}>
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </View>

            {pickerForIndex === index ? (
              <FeeCategoryPicker schoolId={schoolId} selectedId={line.feeCategoryId || null} onSelect={(cat) => setLineCategory(index, cat)} />
            ) : (
              <Pressable onPress={() => setPickerForIndex(index)}>
                <Text style={styles.changeCategory}>
                  {line.feeCategoryId ? 'Change category' : 'Choose category'}
                </Text>
              </Pressable>
            )}

            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Amount</Text>
              <TextInput
                style={styles.amountInput}
                value={line.amount}
                onChangeText={(v) => setLineAmount(index, v)}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>
        ))}

        <Pressable style={styles.addLineButton} onPress={addLine}>
          <Text style={styles.addLineText}>+ Add fee line</Text>
        </Pressable>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.submit, (!canSubmit || submitting) && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          <Text style={styles.submitText}>{submitting ? 'Creating…' : 'Create fee structure'}</Text>
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm, marginTop: spacing.md },
  selectedHint: { fontSize: 12, color: colors.textMuted, marginTop: -spacing.xs, marginBottom: spacing.sm },
  lineCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...softShadow,
  },
  lineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  lineTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, flex: 1 },
  removeText: { color: colors.error, fontWeight: '600', fontSize: 13 },
  changeCategory: { color: colors.primary, fontWeight: '600', marginBottom: spacing.sm },
  amountRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  amountLabel: { fontSize: 13, color: colors.textSecondary, marginRight: spacing.md },
  amountInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    backgroundColor: colors.background,
    color: colors.textPrimary,
  },
  addLineButton: { marginBottom: spacing.lg },
  addLineText: { color: colors.primary, fontWeight: '600' },
  error: { color: colors.error, marginBottom: spacing.md },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    ...softShadow,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: colors.white, fontWeight: '700' },
});
