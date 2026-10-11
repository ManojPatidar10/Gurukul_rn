import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { createSalaryStructure, listSalaryStructures, updateSalaryStructure } from '../../api/salaryStructures';
import DateField from '../../components/DateField';
import EmployeePicker from '../../components/EmployeePicker';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';
import {
  amountInputText,
  conflictData,
  formatInr,
  formatPayrollDate,
  structureAmounts,
  structureErrorText,
  structureNetPreview,
  validateStructureAmounts,
} from '../../utils/payroll';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'SalaryStructureForm'>;

/**
 * Adds a salary structure, or edits one no paid salary used yet (the server refuses the rest with
 * 409 SALARY_STRUCTURE_IN_USE). The amounts are checked as the server checks them, so a structure
 * that would leave someone out of payroll (net pay ₹0 or less) can't be saved.
 */
export function SalaryStructureFormScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const structure = route.params?.structure;
  const presetEmployee = route.params?.employee;
  const editing = !!structure;
  const [employeeId, setEmployeeId] = useState<string | null>(structure?.employeeId ?? presetEmployee?.id ?? null);
  const [employeeLabel, setEmployeeLabel] = useState(structure?.employeeName ?? presetEmployee?.name ?? '');
  const [basic, setBasic] = useState(amountInputText(structure?.basic));
  const [allowances, setAllowances] = useState(amountInputText(structure?.allowances));
  const [deductions, setDeductions] = useState(amountInputText(structure?.deductions));
  const [effectiveFrom, setEffectiveFrom] = useState(structure?.effectiveFrom ?? '');
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  const input = { basic, allowances, deductions };
  const amounts = structureAmounts(input);
  const net = structureNetPreview(input);
  // Only for what's been typed (and net pay), so an empty form doesn't open on "Basic must be greater than 0".
  const errors = validateStructureAmounts(input).filter((e) => e.field === 'net' || input[e.field].trim() !== '');
  const canSubmit = !!employeeId && !!effectiveFrom && amounts !== null;

  const editExisting = async (forEmployeeId: string, existingId: string) => {
    try {
      const existing = (await listSalaryStructures(schoolId, { employeeId: forEmployeeId })).find((s) => s.id === existingId);
      if (!existing) {
        showToast(t('payroll.salaryStructuresList.loadError'), 'error');
      } else if (!existing.editable) {
        showToast(t('payroll.salaryStructuresList.lockedHint'), 'info');
      } else {
        navigation.replace('SalaryStructureForm', { structure: existing });
      }
    } catch (e) {
      showToast(getErrorMessage(e), 'error');
    }
  };

  const handleSubmit = async () => {
    if (!employeeId || !amounts || !effectiveFrom) return;
    const req = { employeeId, ...amounts, effectiveFrom };
    setSubmitting(true);
    try {
      if (structure) {
        await updateSalaryStructure(schoolId, structure.id, req);
      } else {
        await createSalaryStructure(schoolId, req);
      }
      navigation.goBack();
    } catch (e) {
      // One structure per employee per date: offer the one already there.
      const taken = conflictData(e, 'SALARY_STRUCTURE_DATE_TAKEN');
      const existingId = typeof taken?.existingStructureId === 'string' ? taken.existingStructureId : null;
      if (existingId) {
        Alert.alert(
          t('payroll.salaryStructureForm.dateTakenTitle'),
          t('payroll.salaryStructureForm.dateTakenBody', { date: formatPayrollDate(effectiveFrom, t) }),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('payroll.salaryStructureForm.editThatOne'), onPress: () => editExisting(employeeId, existingId) },
          ]
        );
      } else {
        showToast(getErrorMessage(e), 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const fieldErrors = (field: 'basic' | 'allowances' | 'deductions' | 'net') =>
    errors
      .filter((e) => e.field === field)
      .map((e) => (
        <Text key={e.key} style={styles.error}>
          {structureErrorText(e, t)}
        </Text>
      ));

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={editing ? t('payroll.salaryStructureForm.editTitle') : t('payroll.salaryStructureForm.title')}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        <Text style={styles.label}>{t('payroll.salaryStructureForm.employee')} *</Text>
        {editing ? (
          // A structure stays with its employee: add a new one for someone else instead.
          <Text style={styles.lockedEmployee}>{structure.employeeName}</Text>
        ) : (
          <>
            <EmployeePicker
              schoolId={schoolId}
              selectedId={employeeId}
              onSelect={(emp) => {
                setEmployeeId(emp.id);
                setEmployeeLabel(t('payroll.salaryStructureForm.employeeLabel', { name: emp.name, designation: emp.designation }));
              }}
            />
            {employeeLabel ? (
              <Text style={styles.selectedHint}>{t('payroll.salaryStructureForm.selectedHint', { label: employeeLabel })}</Text>
            ) : null}
          </>
        )}

        <LabeledInput label={t('payroll.salaryStructureForm.basic')} required value={basic} onChangeText={setBasic} keyboardType="numeric" />
        {fieldErrors('basic')}
        <LabeledInput label={t('payroll.salaryStructureForm.allowances')} value={allowances} onChangeText={setAllowances} keyboardType="numeric" />
        {fieldErrors('allowances')}
        <LabeledInput label={t('payroll.salaryStructureForm.deductions')} value={deductions} onChangeText={setDeductions} keyboardType="numeric" />
        {fieldErrors('deductions')}

        {net !== null && (
          <Text style={[styles.netPreview, net <= 0 && styles.netPreviewBad]}>
            {t('payroll.salaryStructureForm.netPreview', { net: formatInr(net) })}
          </Text>
        )}
        {fieldErrors('net')}

        <DateField label={t('payroll.salaryStructureForm.effectiveFrom')} required value={effectiveFrom} onChange={setEffectiveFrom} />
        <Text style={styles.hint}>{t('payroll.salaryStructureForm.effectiveFromHint')}</Text>

        <Pressable
          style={[styles.submit, (!canSubmit || submitting) && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          <Text style={styles.submitText}>
            {submitting
              ? t('payroll.salaryStructureForm.submitting')
              : editing
                ? t('payroll.salaryStructureForm.save')
                : t('payroll.salaryStructureForm.submit')}
          </Text>
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm },
  selectedHint: { fontSize: 12, color: colors.textMuted, marginTop: -spacing.xs, marginBottom: spacing.sm },
  lockedEmployee: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md },
  error: { fontSize: 12, color: colors.error, marginTop: -spacing.sm, marginBottom: spacing.sm },
  netPreview: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  netPreviewBad: { color: colors.error },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: -spacing.sm, marginBottom: spacing.sm, lineHeight: 17 },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    ...softShadow,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: colors.white, fontWeight: '700' },
});
