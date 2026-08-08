import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { createPayrollRun, listPayrollRunLines, payPayrollRun, processPayrollRun } from '../../api/payrollRuns';
import type { PayrollLine, PayrollRun } from '../../api/types';
import { DatePickerField } from '../../components/DatePickerField';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useSchoolId } from '../../context/SchoolContext';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'PayrollRun'>;

export function PayrollRunScreen({ navigation }: Props) {
  const schoolId = useSchoolId();

  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [run, setRun] = useState<PayrollRun | null>(null);
  const [lines, setLines] = useState<PayrollLine[] | null>(null);
  const [paid, setPaid] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await createPayrollRun(schoolId, { month: Number(month), year: Number(year) });
      setRun(created);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleProcess = async () => {
    if (!run) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await processPayrollRun(schoolId, run.id);
      setRun(updated);
      const fetchedLines = await listPayrollRunLines(schoolId, run.id);
      setLines(fetchedLines);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handlePay = async () => {
    if (!run || !paymentMethod) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await payPayrollRun(schoolId, run.id, {
        paymentMethod,
        paymentReference: paymentReference || undefined,
        transactionDate: transactionDate || undefined,
      });
      setRun(updated);
      setPaid(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleReset = () => {
    setMonth('');
    setYear('');
    setRun(null);
    setLines(null);
    setPaid(false);
    setPaymentMethod('');
    setPaymentReference('');
    setError(null);
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Run Payroll" onBack={() => navigation.goBack()} />
      <ScreenContainer>
        {!run && (
          <>
            <LabeledInput label="Month (1-12)" value={month} onChangeText={setMonth} keyboardType="numeric" />
            <LabeledInput label="Year" value={year} onChangeText={setYear} keyboardType="numeric" placeholder="2026" />
            {error && <Text style={styles.error}>{error}</Text>}
            <Pressable
              style={[styles.button, (!month || !year || busy) && styles.buttonDisabled]}
              onPress={handleCreate}
              disabled={!month || !year || busy}
            >
              <Text style={styles.buttonText}>{busy ? 'Creating…' : 'Create payroll run'}</Text>
            </Pressable>
          </>
        )}

        {run && (
          <View>
            <View style={styles.runHeader}>
              <Text style={styles.runTitle}>
                {run.month}/{run.year}
              </Text>
              <StatusChip label={run.status} variant={paid ? 'success' : 'info'} />
            </View>

            {!lines && (
              <Pressable style={[styles.button, busy && styles.buttonDisabled]} onPress={handleProcess} disabled={busy}>
                <Text style={styles.buttonText}>{busy ? 'Processing…' : 'Process run'}</Text>
              </Pressable>
            )}

            {lines && (
              <View style={styles.linesSection}>
                <Text style={styles.label}>Payroll lines ({lines.length})</Text>
                {lines.length === 0 && (
                  <Text style={styles.empty}>
                    No lines generated — make sure employees have a salary structure set up.
                  </Text>
                )}
                {lines.map((line) => (
                  <Pressable
                    key={line.id}
                    style={styles.lineRow}
                    onPress={() => navigation.navigate('PayslipDetail', { payrollLine: line })}
                  >
                    <Text style={styles.lineName}>{line.employeeName}</Text>
                    <Text style={styles.lineNet}>₹{line.net.toLocaleString('en-IN')}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {lines && !paid && (
              <View style={styles.paySection}>
                <Text style={styles.label}>Pay this run</Text>
                <LabeledInput
                  label="Payment method"
                  value={paymentMethod}
                  onChangeText={setPaymentMethod}
                  placeholder="CASH / UPI / BANK_TRANSFER"
                />
                <LabeledInput
                  label="Payment reference (optional)"
                  value={paymentReference}
                  onChangeText={setPaymentReference}
                />
                <DatePickerField label="Transaction date" value={transactionDate} onChange={setTransactionDate} />
                <Pressable
                  style={[styles.button, (!paymentMethod || busy) && styles.buttonDisabled]}
                  onPress={handlePay}
                  disabled={!paymentMethod || busy}
                >
                  <Text style={styles.buttonText}>{busy ? 'Paying…' : 'Pay run'}</Text>
                </Pressable>
              </View>
            )}

            {paid && <Text style={styles.success}>Payroll run paid successfully.</Text>}

            {error && <Text style={styles.error}>{error}</Text>}

            <Pressable onPress={handleReset} style={styles.resetLink}>
              <Text style={styles.resetText}>Start a new run</Text>
            </Pressable>
          </View>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm },
  error: { color: colors.error, marginBottom: spacing.md },
  success: { color: colors.success, marginBottom: spacing.md, fontWeight: '600' },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    ...softShadow,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.white, fontWeight: '700' },
  runHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  runTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  linesSection: { marginTop: spacing.lg },
  empty: { color: colors.textMuted },
  lineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  lineName: { fontSize: 14, color: colors.textPrimary },
  lineNet: { fontSize: 14, fontWeight: '800', color: accents.payroll.base },
  paySection: { marginTop: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg },
  resetLink: { marginTop: spacing.xl, alignItems: 'center' },
  resetText: { color: colors.primary, fontWeight: '600' },
});
