import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { createEmployee, updateEmployee } from '../../api/employees';
import type { EmployeeRequest } from '../../api/types';
import DateField from '../../components/DateField';
import Dropdown from '../../components/Dropdown';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { isValidBankAccount, isValidPhone } from '../../utils/validators';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'EmployeeForm'>;

export function EmployeeFormScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const employee = route.params?.employee ?? null;
  const isEdit = !!employee;

  const STATUS_OPTIONS = [
    { label: t('common.active'), value: 'ACTIVE' },
    { label: t('common.inactive'), value: 'INACTIVE' },
  ];

  const [form, setForm] = useState<EmployeeRequest>({
    name: employee?.name ?? '',
    designation: employee?.designation ?? '',
    joinDate: employee?.joinDate ?? '',
    bankAccount: employee?.bankAccount ?? '',
    contactPhone: employee?.contactPhone ?? '',
    status: employee?.status ?? 'ACTIVE',
  });
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  const set = (key: keyof EmployeeRequest) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const canSubmit = form.name && form.designation && form.joinDate;

  const handleSubmit = async () => {
    if (form.contactPhone && !isValidPhone(form.contactPhone)) {
      showToast(t('employees.form.errors.contactPhone'), 'error');
      return;
    }
    if (form.bankAccount && !isValidBankAccount(form.bankAccount)) {
      showToast(t('employees.form.errors.bankAccount'), 'error');
      return;
    }
    setSubmitting(true);
    try {
      const result = isEdit
        ? await updateEmployee(schoolId, employee!.id, form)
        : await createEmployee(schoolId, form);
      navigation.replace('EmployeeDetail', { employee: result });
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={isEdit ? t('employees.form.titleEdit') : t('employees.form.titleCreate')}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        <LabeledInput label={t('employees.form.name')} required value={form.name} onChangeText={set('name')} />
        <LabeledInput label={t('employees.form.designation')} required value={form.designation} onChangeText={set('designation')} />
        <DateField label={t('employees.form.joinDate')} required value={form.joinDate} onChange={set('joinDate')} maximumDate={new Date()} />
        <LabeledInput
          label={t('employees.form.bankAccount')}
          value={form.bankAccount}
          onChangeText={set('bankAccount')}
          keyboardType="number-pad"
        />
        <LabeledInput
          label={t('employees.form.contactPhone')}
          value={form.contactPhone}
          onChangeText={set('contactPhone')}
          keyboardType="phone-pad"
          maxLength={10}
        />
        <Dropdown label={t('employees.form.status')} value={form.status ?? 'ACTIVE'} options={STATUS_OPTIONS} onSelect={set('status')} />

        <Pressable
          style={[styles.submit, (!canSubmit || submitting) && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          <Text style={styles.submitText}>
            {submitting ? t('common.saving') : isEdit ? t('common.saveChanges') : t('employees.form.submitCreate')}
          </Text>
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
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
