import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getErrorMessage } from '../api/errorMessage';
import { listBillPayments, listStudentPayments } from '../api/feePayments';
import type { FeePayment } from '../api/types';
import { useSchoolId } from '../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../theme/colors';
import { formatPaymentDate, paymentMethodLabelKey } from '../utils/feePayments';
import { formatRupees } from '../utils/money';
import { ErrorNotice } from './ErrorNotice';
import { StatusChip } from './StatusChip';

type Source = { assessmentId: string; studentId?: never } | { studentId: string; assessmentId?: never };

type Props = Source & {
  /** Show each payment's fee bill (academic year) - for a student's payments across several bills. */
  showAcademicYear?: boolean;
  onOpen: (payment: FeePayment) => void;
};

/**
 * The payments on one bill, or on every bill of one student, newest first - reversed ones included
 * and marked Cancelled. Reloads whenever its screen comes into focus (e.g. back from recording or
 * reversing). Who may see it is the server's rule (admin, the student, a linked parent).
 */
export function FeePaymentHistory({ assessmentId, studentId, showAcademicYear, onOpen }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const request = assessmentId
      ? listBillPayments(schoolId, assessmentId)
      : listStudentPayments(schoolId, studentId as string);
    return request
      .then(setPayments)
      .catch((e) => setError(`${t('fees.paymentHistory.loadError')} ${getErrorMessage(e)}`))
      .finally(() => setLoading(false));
  }, [schoolId, assessmentId, studentId, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading && payments.length === 0) {
    return <ActivityIndicator color={colors.primary} style={styles.loading} />;
  }

  if (error) {
    return (
      <View>
        <ErrorNotice message={error} />
        <Pressable style={styles.retry} onPress={load} accessibilityRole="button">
          <Text style={styles.retryText}>{t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  if (payments.length === 0) {
    return <Text style={styles.empty}>{t('fees.paymentHistory.empty')}</Text>;
  }

  return (
    <View>
      {payments.map((payment) => {
        const methodKey = paymentMethodLabelKey(payment.paymentMethod);
        const method = methodKey ? t(methodKey) : payment.paymentMethod;
        return (
          <Pressable
            key={payment.id}
            style={styles.row}
            onPress={() => onOpen(payment)}
            accessibilityRole="button"
          >
            <View style={styles.rowMain}>
              <Text style={[styles.receipt, payment.reversed && styles.reversedText]}>
                {payment.receiptNumber ?? '—'}
              </Text>
              <Text style={styles.meta}>
                {formatPaymentDate(payment.transactionDate)}
                {showAcademicYear ? ` · ${payment.academicYear}` : ''}
              </Text>
              <Text style={styles.meta}>
                {payment.paymentReference ? `${method} · ${payment.paymentReference}` : method}
              </Text>
              {payment.recordedByName ? (
                <Text style={styles.meta}>{t('fees.paymentHistory.recordedBy', { name: payment.recordedByName })}</Text>
              ) : null}
            </View>
            <View style={styles.rowSide}>
              <Text style={[styles.amount, payment.reversed && styles.reversedText]}>{formatRupees(payment.amount)}</Text>
              {payment.reversed && <StatusChip label={t('fees.paymentHistory.cancelled')} variant="error" />}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { marginVertical: spacing.lg },
  empty: { color: colors.textMuted, textAlign: 'center', marginVertical: spacing.lg },
  retry: { alignSelf: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  retryText: { color: colors.primary, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  rowMain: { flex: 1, marginRight: spacing.sm },
  receipt: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  rowSide: { alignItems: 'flex-end', gap: spacing.xs },
  amount: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  reversedText: { textDecorationLine: 'line-through', color: colors.textMuted },
});
