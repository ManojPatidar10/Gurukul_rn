import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { createEmployee, updateEmployee } from '../../api/employees';
import type { EmployeeRequest, EmployeeType } from '../../api/types';
import { DatePickerField } from '../../components/DatePickerField';
import Dropdown from '../../components/Dropdown';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { isValidBankAccount, isValidEmail, isValidPhone } from '../../utils/validators';
import { getErrorMessage } from '../../api/errorMessage';

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
  const TYPE_OPTIONS = [
    { label: t('employees.form.types.TEACHING'), value: 'TEACHING' },
    { label: t('employees.form.types.NON_TEACHING'), value: 'NON_TEACHING' },
  ];

  const [form, setForm] = useState<EmployeeRequest>({
    name: employee?.name ?? '',
    designation: employee?.designation ?? '',
    joinDate: employee?.joinDate ?? '',
    bankAccount: employee?.bankAccount ?? '',
    contactPhone: employee?.contactPhone ?? '',
    contactEmail: employee?.contactEmail ?? '',
    status: employee?.status ?? 'ACTIVE',
    // Staff saved before the type existed have none - left unset, the save keeps it that way.
    employeeType: employee?.employeeType ?? undefined,
  });
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  const set = (key: keyof EmployeeRequest) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // New staff must say whether they teach; older records without a type can still be edited.
  const canSubmit = form.name && form.designation && form.joinDate && (isEdit || form.employeeType);

  const handleSubmit = async () => {
    if (form.contactPhone && !isValidPhone(form.contactPhone)) {
      showToast(t('employees.form.errors.contactPhone'), 'error');
      return;
    }
    if (form.bankAccount && !isValidBankAccount(form.bankAccount)) {
      showToast(t('employees.form.errors.bankAccount'), 'error');
      return;
    }
    const contactEmail = form.contactEmail?.trim() ?? '';
    if (contactEmail && !isValidEmail(contactEmail)) {
      showToast(t('employees.form.errors.contactEmail'), 'error');
      return;
    }
    // Email is always sent so clearing the field clears it ('' clears, a missing field is kept).
    const request: EmployeeRequest = { ...form, contactEmail };
    setSubmitting(true);
    try {
      const result = isEdit
        ? await updateEmployee(schoolId, employee!.id, request)
        : await createEmployee(schoolId, request);
      navigation.replace('EmployeeDetail', { employee: result });
    } catch (e) {
      showToast(getErrorMessage(e), 'error');
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
        <DatePickerField label={t('employees.form.joinDate')} value={form.joinDate} onChange={set('joinDate')} maximumDate={new Date()} />
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
        <LabeledInput
          label={t('employees.form.contactEmail')}
          value={form.contactEmail}
          onChangeText={set('contactEmail')}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Dropdown
          label={t('employees.form.employeeType')}
          required={!isEdit}
          value={form.employeeType ?? ''}
          options={TYPE_OPTIONS}
          onSelect={(value) => setForm((prev) => ({ ...prev, employeeType: value as EmployeeType }))}
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
