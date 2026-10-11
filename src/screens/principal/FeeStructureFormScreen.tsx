import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { createFeeStructure, updateFeeStructure } from '../../api/feeStructures';
import type { FeeCategory } from '../../api/types';
import ClassSectionPicker from '../../components/ClassSectionPicker';
import FeeCategoryPicker from '../../components/FeeCategoryPicker';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import {
  canonicalAcademicYear,
  feeLinesError,
  feeLinesRequest,
  feeLinesTotal,
  structureUpdateMessage,
  type FeeLineDraft,
  type FeeLinesError,
} from '../../utils/feeBills';
import { formatRupees, rupeesInputValue } from '../../utils/money';
import { getErrorMessage } from '../../api/errorMessage';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'FeeStructureForm'>;

interface LineDraft extends FeeLineDraft {
  feeCategoryLabel: string;
}

const LINE_ERROR_KEYS: Record<FeeLinesError, string> = {
  noLines: 'fees.structureForm.errors.noLines',
  tooManyLines: 'fees.structureForm.errors.tooManyLines',
  missingCategory: 'fees.structureForm.errors.missingCategory',
  invalidAmount: 'fees.structureForm.errors.invalidAmount',
  duplicateCategory: 'fees.structureForm.errors.duplicateCategory',
};

/**
 * Creates a fee structure for a class-section, or (with `feeStructure`) edits its lines. The
 * academic year is always the section's own, shown read-only. Amounts may be 0. An edit can also
 * re-price the bills nobody has paid or adjusted yet, and then says how many it changed.
 */
export function FeeStructureFormScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const editing = route.params?.feeStructure ?? null;
  const [classSectionId, setClassSectionId] = useState<string | null>(editing?.classSectionId ?? null);
  const [classSectionLabel, setClassSectionLabel] = useState('');
  const [academicYear, setAcademicYear] = useState(editing?.academicYear ?? '');
  const [lines, setLines] = useState<LineDraft[]>(() =>
    (editing?.lines ?? []).map((line) => ({
      feeCategoryId: line.feeCategoryId,
      feeCategoryLabel: t('fees.structureDetail.lineFormat', { name: line.feeCategoryName, code: line.feeCategoryCode }),
      amount: rupeesInputValue(line.amount),
    }))
  );
  const [pickerForIndex, setPickerForIndex] = useState<number | null>(null);
  const [repriceBills, setRepriceBills] = useState(true);
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

  const linesError = feeLinesError(lines);
  const total = feeLinesTotal(lines);
  const canSubmit = !!classSectionId && linesError === null;
  // Only the mistakes the admin can't see at a glance; a missing category shows on its line.
  const shownLinesError = linesError === 'invalidAmount' || linesError === 'duplicateCategory' || linesError === 'tooManyLines';

  const handleSubmit = async () => {
    if (!classSectionId) return;
    if (linesError) {
      showToast(t(LINE_ERROR_KEYS[linesError]), 'error');
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        const result = await updateFeeStructure(schoolId, editing.id, { lines: feeLinesRequest(lines), repriceBills });
        Alert.alert(
          t('fees.structureForm.result.title'),
          structureUpdateMessage(result, t),
          [{ text: t('common.done'), onPress: () => navigation.goBack() }],
          { cancelable: false }
        );
      } else {
        // No academicYear: the server takes the section's own.
        const created = await createFeeStructure(schoolId, { classSectionId, lines: feeLinesRequest(lines) });
        navigation.replace('FeeStructureDetail', { feeStructure: created });
      }
    } catch (e) {
      showToast(getErrorMessage(e), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const submitLabel = editing
    ? submitting
      ? t('fees.structureForm.saving')
      : t('fees.structureForm.saveChanges')
    : submitting
      ? t('fees.structureForm.submitting')
      : t('fees.structureForm.submit');

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={editing ? t('fees.structureForm.editTitle') : t('fees.structureForm.title')}
        subtitle={editing ? t('fees.structureDetail.titleFormat', { className: editing.className, section: editing.section }) : undefined}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer keyboardShouldPersistTaps="handled">
        {!editing && (
          <>
            <Text style={styles.label}>{t('fees.structureForm.classSection')} *</Text>
            <ClassSectionPicker
              schoolId={schoolId}
              selectedId={classSectionId}
              onSelect={(cs) => {
                setClassSectionId(cs.id);
                setClassSectionLabel(cs.displayLabel);
                setAcademicYear(canonicalAcademicYear(cs.academicYear));
              }}
            />
            {classSectionLabel ? (
              <Text style={styles.selectedHint}>{t('fees.structureForm.selectedHint', { label: classSectionLabel })}</Text>
            ) : null}
          </>
        )}
        {academicYear ? (
          <Text style={styles.yearValue}>{t('fees.structureForm.academicYearValue', { year: academicYear })}</Text>
        ) : null}

        <Text style={styles.label}>{t('fees.structureForm.feeLines')} *</Text>
        <Text style={styles.hint}>{t('fees.structureForm.zeroAmountHint')}</Text>
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
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>
        ))}

        <Pressable style={styles.addLineButton} onPress={addLine}>
          <Text style={styles.addLineText}>{t('fees.structureForm.addLine')}</Text>
        </Pressable>

        {lines.length > 0 && total !== null && (
          <Text style={styles.total}>{t('fees.structureForm.lineTotal', { amount: formatRupees(total, { symbol: false }) })}</Text>
        )}
        {linesError && shownLinesError && <Text style={styles.error}>{t(LINE_ERROR_KEYS[linesError])}</Text>}

        {editing && (
          <View style={styles.repriceCard}>
            <View style={styles.repriceRow}>
              <Text style={styles.repriceLabel}>{t('fees.structureForm.repriceBills')}</Text>
              <Switch
                value={repriceBills}
                onValueChange={setRepriceBills}
                accessibilityLabel={t('fees.structureForm.repriceBills')}
              />
            </View>
            <Text style={styles.hint}>{t('fees.structureForm.repriceHint')}</Text>
          </View>
        )}

        <Pressable
          style={[styles.submit, (!canSubmit || submitting) && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          <Text style={styles.submitText}>{submitLabel}</Text>
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm, marginTop: spacing.md },
  selectedHint: { fontSize: 12, color: colors.textMuted, marginTop: -spacing.xs, marginBottom: spacing.sm },
  yearValue: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.sm },
  hint: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },
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
  total: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  error: { fontSize: 13, color: colors.error, marginBottom: spacing.md },
  repriceCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...softShadow,
  },
  repriceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, marginBottom: spacing.xs },
  repriceLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
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
