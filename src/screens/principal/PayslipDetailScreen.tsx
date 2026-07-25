import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { getPayslip } from '../../api/payrollRuns';
import type { Payslip } from '../../api/types';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'PayslipDetail'>;

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value || '—'}</Text>
    </View>
  );
}

export function PayslipDetailScreen({ route, navigation }: Props) {
  const schoolId = useSchoolId();
  const payrollLine = route.params.payrollLine;
  const [payslip, setPayslip] = useState<Payslip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPayslip(schoolId, payrollLine.id)
      .then(setPayslip)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [schoolId, payrollLine.id]);

  return (
    <View style={styles.root}>
      <ScreenHeader title="Payslip" subtitle={payrollLine.employeeName} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        {loading && <ActivityIndicator style={styles.loading} />}
        {error && <Text style={styles.error}>{error}</Text>}
        {payslip && (
          <>
            <Field label="Gross" value={`₹${payrollLine.gross.toLocaleString('en-IN')}`} />
            <Field label="Deductions" value={`₹${payrollLine.deductions.toLocaleString('en-IN')}`} />
            <Field label="Net pay" value={`₹${payslip.net.toLocaleString('en-IN')}`} />
            <Field label="Document reference" value={payslip.documentRef} />
          </>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: 40 },
  error: { color: colors.error },
  field: { marginBottom: spacing.md },
  fieldLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  fieldValue: { fontSize: 18, color: colors.textPrimary, marginTop: 2, fontWeight: '600' },
});
