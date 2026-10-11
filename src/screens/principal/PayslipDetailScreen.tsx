import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getPayslip } from '../../api/payrollRuns';
import type { Payslip } from '../../api/types';
import { ErrorNotice } from '../../components/ErrorNotice';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';
import {
  formatInr,
  lineStatusVariant,
  paymentMethodLabel,
  payslipStatusText,
  runMonthLabel,
} from '../../utils/payroll';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'PayslipDetail'>;

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value || '—'}</Text>
    </View>
  );
}

/**
 * One payroll line's payslip, paid or not - for an admin, or for the employee themself (from My
 * payslips or the "Salary paid" push). An unpaid line says so in plain words; only an admin is
 * told it's on hold.
 */
export function PayslipDetailScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const isAdmin = session.role === 'ADMIN';
  const { payrollLineId, employeeName } = route.params;
  const [payslip, setPayslip] = useState<Payslip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPayslip = useCallback(
    () =>
      getPayslip(schoolId, payrollLineId)
        .then((p) => {
          setPayslip(p);
          setError(null);
        })
        .catch((e) => setError(getErrorMessage(e)))
        .finally(() => setLoading(false)),
    [schoolId, payrollLineId]
  );

  useEffect(() => {
    fetchPayslip();
  }, [fetchPayslip]);

  const retry = () => {
    setLoading(true);
    setError(null);
    fetchPayslip();
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('payroll.payslip.title')}
        subtitle={payslip?.employeeName ?? employeeName}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        {loading && <ActivityIndicator style={styles.loading} color={colors.primary} />}
        {error && !loading && (
          <>
            <ErrorNotice message={`${t('payroll.payslip.loadError')} ${error}`} />
            <Pressable style={styles.retry} onPress={retry}>
              <Text style={styles.retryText}>{t('payroll.payslip.retry')}</Text>
            </Pressable>
          </>
        )}
        {payslip && !error && (
          <View style={styles.card}>
            <View style={styles.statusRow}>
              <Text style={styles.month}>{runMonthLabel(payslip.month, payslip.year, t)}</Text>
              <StatusChip
                label={payslipStatusText(payslip, isAdmin, t)}
                variant={lineStatusVariant(payslip.status, isAdmin)}
              />
            </View>
            <Field label={t('payroll.payslip.employee')} value={payslip.employeeName} />
            {payslip.designation ? <Field label={t('payroll.payslip.designation')} value={payslip.designation} /> : null}
            {payslip.basic != null && <Field label={t('payroll.payslip.basic')} value={formatInr(payslip.basic)} />}
            {payslip.allowances != null && (
              <Field label={t('payroll.payslip.allowances')} value={formatInr(payslip.allowances)} />
            )}
            <Field label={t('payroll.payslip.gross')} value={formatInr(payslip.gross)} />
            <Field label={t('payroll.payslip.deductions')} value={formatInr(payslip.deductions)} />
            <Field label={t('payroll.payslip.netPay')} value={formatInr(payslip.net)} />
            <Field label={t('payroll.payslip.status')} value={payslipStatusText(payslip, isAdmin, t)} />
            {payslip.status === 'PAID' && (
              <>
                <Field label={t('payroll.payslip.method')} value={paymentMethodLabel(payslip.paymentMethod, t)} />
                <Field label={t('payroll.payslip.reference')} value={payslip.paymentReference ?? ''} />
              </>
            )}
            {payslip.payslipNumber ? (
              <Field label={t('payroll.payslip.payslipNumber')} value={payslip.payslipNumber} />
            ) : null}
          </View>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: 40 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...softShadow,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  month: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
  field: { marginBottom: spacing.md },
  fieldLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  fieldValue: { fontSize: 18, color: colors.textPrimary, marginTop: 2, fontWeight: '600' },
  retry: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  retryText: { color: colors.primary, fontWeight: '700' },
});
