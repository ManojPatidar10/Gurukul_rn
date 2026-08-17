import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { createFeeStructure } from '../../api/feeStructures';
import type { FeeCategory } from '../../api/types';
import ClassSectionPicker from '../../components/ClassSectionPicker';
import Dropdown from '../../components/Dropdown';
import FeeCategoryPicker from '../../components/FeeCategoryPicker';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ACADEMIC_YEAR_OPTIONS } from '../../constants/academicYear';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { isPositiveNumber } from '../../utils/validators';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'FeeStructureForm'>;

interface LineDraft {
  feeCategoryId: string;
  feeCategoryLabel: string;
  amount: string;
}

export function FeeStructureFormScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const [classSectionId, setClassSectionId] = useState<string | null>(null);
  const [classSectionLabel, setClassSectionLabel] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [pickerForIndex, setPickerForIndex] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

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
        i === index
          ? {
              ...line,
              feeCategoryId: category.id,
              feeCategoryLabel: t('fees.structureDetail.lineFormat', { name: category.name, code: category.code }),
            }
          : line
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
    if (lines.length === 0) {
      showToast(t('fees.structureForm.errors.noLines'), 'error');
      return;
    }
    if (lines.some((line) => !line.feeCategoryId)) {
      showToast(t('fees.structureForm.errors.missingCategory'), 'error');
      return;
    }
    if (lines.some((line) => !isPositiveNumber(line.amount))) {
      showToast(t('fees.structureForm.errors.invalidAmount'), 'error');
      return;
    }
    setSubmitting(true);
    try {
      const created = await createFeeStructure(schoolId, {
        classSectionId,
        academicYear,
        lines: lines.map((line) => ({ feeCategoryId: line.feeCategoryId, amount: Number(line.amount) })),
      });
      navigation.replace('FeeStructureDetail', { feeStructure: created });
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('fees.structureForm.title')} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <Text style={styles.label}>{t('fees.structureForm.classSection')} *</Text>
        <ClassSectionPicker
          schoolId={schoolId}
          selectedId={classSectionId}
          onSelect={(cs) => {
            setClassSectionId(cs.id);
            setClassSectionLabel(cs.displayLabel);
            if (!academicYear) setAcademicYear(cs.academicYear);
          }}
        />
        {classSectionLabel ? (
          <Text style={styles.selectedHint}>{t('fees.structureForm.selectedHint', { label: classSectionLabel })}</Text>
        ) : null}

        <Dropdown
          label={t('fees.structureForm.academicYear')}
          required
          value={academicYear}
          options={ACADEMIC_YEAR_OPTIONS}
          onSelect={setAcademicYear}
        />

        <Text style={styles.label}>{t('fees.structureForm.feeLines')} *</Text>
        {lines.map((line, index) => (
          <View key={index} style={styles.lineCard}>
            <View style={styles.lineHeader}>
              <Text style={styles.lineTitle}>
                {line.feeCategoryLabel || t('fees.structureForm.noCategorySelected')}
              </Text>
              <Pressable onPress={() => removeLine(index)}>
                <Text style={styles.removeText}>{t('fees.structureForm.remove')}</Text>
              </Pressable>
            </View>

            {pickerForIndex === index ? (
              <FeeCategoryPicker schoolId={schoolId} selectedId={line.feeCategoryId || null} onSelect={(cat) => setLineCategory(index, cat)} />
            ) : (
              <Pressable onPress={() => setPickerForIndex(index)}>
                <Text style={styles.changeCategory}>
                  {line.feeCategoryId ? t('fees.structureForm.changeCategory') : t('fees.structureForm.chooseCategory')}
                </Text>
              </Pressable>
            )}

            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>{t('fees.structureForm.amount')} *</Text>
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
          <Text style={styles.addLineText}>{t('fees.structureForm.addLine')}</Text>
        </Pressable>

        <Pressable
          style={[styles.submit, (!canSubmit || submitting) && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          <Text style={styles.submitText}>{submitting ? t('fees.structureForm.submitting') : t('fees.structureForm.submit')}</Text>
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
