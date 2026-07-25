import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { createSalaryStructure } from '../../api/salaryStructures';
import EmployeePicker from '../../components/EmployeePicker';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'SalaryStructureForm'>;

export function SalaryStructureFormScreen({ navigation }: Props) {
  const schoolId = useSchoolId();
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [employeeLabel, setEmployeeLabel] = useState('');
  const [basic, setBasic] = useState('');
  const [allowances, setAllowances] = useState('');
  const [deductions, setDeductions] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !!employeeId && Number(basic) > 0 && !!effectiveFrom;

  const handleSubmit = async () => {
    if (!employeeId) return;
    setSubmitting(true);
    setError(null);
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
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Add salary structure" onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <Text style={styles.label}>Employee</Text>
        <EmployeePicker
          schoolId={schoolId}
          selectedId={employeeId}
          onSelect={(emp) => {
            setEmployeeId(emp.id);
            setEmployeeLabel(`${emp.name} (${emp.designation})`);
          }}
        />
        {employeeLabel ? <Text style={styles.selectedHint}>Selected: {employeeLabel}</Text> : null}

        <LabeledInput label="Basic" value={basic} onChangeText={setBasic} keyboardType="numeric" />
        <LabeledInput label="Allowances" value={allowances} onChangeText={setAllowances} keyboardType="numeric" />
        <LabeledInput label="Deductions" value={deductions} onChangeText={setDeductions} keyboardType="numeric" />
        <LabeledInput
          label="Effective from (YYYY-MM-DD)"
          value={effectiveFrom}
          onChangeText={setEffectiveFrom}
          placeholder="2026-04-01"
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.submit, (!canSubmit || submitting) && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          <Text style={styles.submitText}>{submitting ? 'Saving…' : 'Create salary structure'}</Text>
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm },
  selectedHint: { fontSize: 12, color: colors.textMuted, marginTop: -spacing.xs, marginBottom: spacing.sm },
  error: { color: colors.error, marginTop: spacing.md },
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
