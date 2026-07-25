import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { createEmployee, updateEmployee } from '../../api/employees';
import type { EmployeeRequest } from '../../api/types';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'EmployeeForm'>;

export function EmployeeFormScreen({ route, navigation }: Props) {
  const schoolId = useSchoolId();
  const employee = route.params?.employee ?? null;
  const isEdit = !!employee;

  const [form, setForm] = useState<EmployeeRequest>({
    name: employee?.name ?? '',
    designation: employee?.designation ?? '',
    joinDate: employee?.joinDate ?? '',
    bankAccount: employee?.bankAccount ?? '',
    contactPhone: employee?.contactPhone ?? '',
    status: employee?.status ?? 'ACTIVE',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof EmployeeRequest) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const canSubmit = form.name && form.designation && form.joinDate;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const result = isEdit
        ? await updateEmployee(schoolId, employee!.id, form)
        : await createEmployee(schoolId, form);
      navigation.replace('EmployeeDetail', { employee: result });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={isEdit ? 'Edit employee' : 'Add employee'}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        <LabeledInput label="Name" value={form.name} onChangeText={set('name')} />
        <LabeledInput label="Designation" value={form.designation} onChangeText={set('designation')} />
        <LabeledInput
          label="Join date (YYYY-MM-DD)"
          value={form.joinDate}
          onChangeText={set('joinDate')}
          placeholder="2026-04-01"
        />
        <LabeledInput
          label="Bank account"
          value={form.bankAccount}
          onChangeText={set('bankAccount')}
        />
        <LabeledInput
          label="Contact phone"
          value={form.contactPhone}
          onChangeText={set('contactPhone')}
          keyboardType="phone-pad"
        />
        <LabeledInput label="Status" value={form.status} onChangeText={set('status')} placeholder="ACTIVE" />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.submit, (!canSubmit || submitting) && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          <Text style={styles.submitText}>
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Add employee'}
          </Text>
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  error: { color: colors.error, marginTop: spacing.md },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: colors.white, fontWeight: '700' },
});
