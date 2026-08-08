import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { createPayrollRun, listPayrollRunLines, payPayrollRun, processPayrollRun } from '../../api/payrollRuns';
import type { PayrollLine, PayrollRun } from '../../api/types';
import DateField from '../../components/DateField';
import Dropdown from '../../components/Dropdown';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 4 }, (_, i) => {
  const year = CURRENT_YEAR - 1 + i;
  return { label: String(year), value: String(year) };
});

type Props = NativeStackScreenProps<PrincipalStackParamList, 'PayrollRun'>;

export function PayrollRunScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();

  const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
    label: t(`payroll.run.months.${i + 1}`),
    value: String(i + 1),
  }));

  const PAYMENT_METHOD_OPTIONS = [
    { label: t('fees.paymentMethods.cash'), value: 'CASH' },
    { label: t('fees.paymentMethods.upi'), value: 'UPI' },
    { label: t('fees.paymentMethods.bankTransfer'), value: 'BANK_TRANSFER' },
    { label: t('fees.paymentMethods.cheque'), value: 'CHEQUE' },
    { label: t('fees.paymentMethods.card'), value: 'CARD' },
  ];

  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [run, setRun] = useState<PayrollRun | null>(null);
  const [lines, setLines] = useState<PayrollLine[] | null>(null);
  const [paid, setPaid] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));

  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  const handleCreate = async () => {
    setBusy(true);
    try {
      const created = await createPayrollRun(schoolId, { month: Number(month), year: Number(year) });
      setRun(created);
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleProcess = async () => {
    if (!run) return;
    setBusy(true);
    try {
      const updated = await processPayrollRun(schoolId, run.id);
      setRun(updated);
      const fetchedLines = await listPayrollRunLines(schoolId, run.id);
      setLines(fetchedLines);
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handlePay = async () => {
    if (!run || !paymentMethod) return;
    setBusy(true);
    try {
      const updated = await payPayrollRun(schoolId, run.id, {
        paymentMethod,
        paymentReference: paymentReference || undefined,
        transactionDate: transactionDate || undefined,
      });
      setRun(updated);
      setPaid(true);
    } catch (e) {
      showToast((e as Error).message, 'error');
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
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('payroll.run.title')} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        {!run && (
          <>
            <Dropdown label={t('payroll.run.month')} required value={month} options={MONTH_OPTIONS} onSelect={setMonth} />
            <Dropdown label={t('payroll.run.year')} required value={year} options={YEAR_OPTIONS} onSelect={setYear} />
            <Pressable
              style={[styles.button, (!month || !year || busy) && styles.buttonDisabled]}
              onPress={handleCreate}
              disabled={!month || !year || busy}
            >
              <Text style={styles.buttonText}>{busy ? t('payroll.run.creating') : t('payroll.run.createButton')}</Text>
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
                <Text style={styles.buttonText}>{busy ? t('payroll.run.processing') : t('payroll.run.processButton')}</Text>
              </Pressable>
            )}

            {lines && (
              <View style={styles.linesSection}>
                <Text style={styles.label}>{t('payroll.run.payrollLines', { count: lines.length })}</Text>
                {lines.length === 0 && (
                  <Text style={styles.empty}>{t('payroll.run.noLines')}</Text>
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
                <Text style={styles.label}>{t('payroll.run.payThisRun')}</Text>
                <Dropdown
                  label={t('payroll.run.paymentMethod')}
                  required
                  value={paymentMethod}
                  options={PAYMENT_METHOD_OPTIONS}
                  onSelect={setPaymentMethod}
                />
                <LabeledInput
                  label={t('payroll.run.paymentReference')}
                  value={paymentReference}
                  onChangeText={setPaymentReference}
                />
                <DateField label={t('payroll.run.transactionDate')} value={transactionDate} onChange={setTransactionDate} />
                <Pressable
                  style={[styles.button, (!paymentMethod || busy) && styles.buttonDisabled]}
                  onPress={handlePay}
                  disabled={!paymentMethod || busy}
                >
                  <Text style={styles.buttonText}>{busy ? t('payroll.run.paying') : t('payroll.run.payButton')}</Text>
                </Pressable>
              </View>
            )}

            {paid && <Text style={styles.success}>{t('payroll.run.paidSuccess')}</Text>}

            <Pressable onPress={handleReset} style={styles.resetLink}>
              <Text style={styles.resetText}>{t('payroll.run.startNewRun')}</Text>
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
