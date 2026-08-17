import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { createSalaryStructure } from '../../api/salaryStructures';
import DateField from '../../components/DateField';
import EmployeePicker from '../../components/EmployeePicker';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { isNonNegativeNumber, isPositiveNumber } from '../../utils/validators';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'SalaryStructureForm'>;

export function SalaryStructureFormScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [employeeLabel, setEmployeeLabel] = useState('');
  const [basic, setBasic] = useState('');
  const [allowances, setAllowances] = useState('');
  const [deductions, setDeductions] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  const canSubmit = !!employeeId && Number(basic) > 0 && !!effectiveFrom;

  const handleSubmit = async () => {
    if (!employeeId) return;
    if (!isPositiveNumber(basic)) {
      showToast(t('payroll.salaryStructureForm.errors.basic'), 'error');
      return;
    }
    if (allowances && !isNonNegativeNumber(allowances)) {
      showToast(t('payroll.salaryStructureForm.errors.allowances'), 'error');
      return;
    }
    if (deductions && !isNonNegativeNumber(deductions)) {
      showToast(t('payroll.salaryStructureForm.errors.deductions'), 'error');
      return;
    }
    setSubmitting(true);
    try {
      await createSalaryStructure(schoolId, {
        employeeId,
        basic: Number(basic),
        allowances: Number(allowances) || 0,
        deductions: Number(deductions) || 0,
        effectiveFrom,
      });
      navigation.goBack();
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('payroll.salaryStructureForm.title')} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <Text style={styles.label}>{t('payroll.salaryStructureForm.employee')} *</Text>
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

        <LabeledInput label={t('payroll.salaryStructureForm.basic')} required value={basic} onChangeText={setBasic} keyboardType="numeric" />
        <LabeledInput label={t('payroll.salaryStructureForm.allowances')} value={allowances} onChangeText={setAllowances} keyboardType="numeric" />
        <LabeledInput label={t('payroll.salaryStructureForm.deductions')} value={deductions} onChangeText={setDeductions} keyboardType="numeric" />
        <DateField label={t('payroll.salaryStructureForm.effectiveFrom')} required value={effectiveFrom} onChange={setEffectiveFrom} />

        <Pressable
          style={[styles.submit, (!canSubmit || submitting) && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          <Text style={styles.submitText}>
            {submitting ? t('payroll.salaryStructureForm.submitting') : t('payroll.salaryStructureForm.submit')}
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
