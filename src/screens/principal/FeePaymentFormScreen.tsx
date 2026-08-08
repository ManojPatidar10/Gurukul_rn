import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { recordFeePayment } from '../../api/feePayments';
import DateField from '../../components/DateField';
import Dropdown from '../../components/Dropdown';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { isPositiveNumber } from '../../utils/validators';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'FeePaymentForm'>;

export function FeePaymentFormScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const assessment = route.params.assessment;

  const PAYMENT_METHOD_OPTIONS = [
    { label: t('fees.paymentMethods.cash'), value: 'CASH' },
    { label: t('fees.paymentMethods.upi'), value: 'UPI' },
    { label: t('fees.paymentMethods.bankTransfer'), value: 'BANK_TRANSFER' },
    { label: t('fees.paymentMethods.cheque'), value: 'CHEQUE' },
    { label: t('fees.paymentMethods.card'), value: 'CARD' },
  ];

  const [amount, setAmount] = useState(String(assessment.remainingDue));
  const [paymentMethod, setPaymentMethod] = useState(route.params.initialPaymentMethod ?? '');
  const [paymentReference, setPaymentReference] = useState(route.params.initialPaymentReference ?? '');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  const canSubmit = Number(amount) > 0 && !!paymentMethod;

  const handleSubmit = async () => {
    if (!isPositiveNumber(amount)) {
      showToast(t('fees.paymentForm.errors.invalidAmount'), 'error');
      return;
    }
    if (Number(amount) > assessment.remainingDue) {
      showToast(
        t('fees.paymentForm.errors.exceedsRemaining', { amount: assessment.remainingDue.toLocaleString('en-IN') }),
        'error'
      );
      return;
    }
    setSubmitting(true);
    try {
      const payment = await recordFeePayment(schoolId, {
        assessmentId: assessment.id,
        amount: Number(amount),
        paymentMethod,
        paymentReference: paymentReference || undefined,
        transactionDate: transactionDate || undefined,
      });
      navigation.navigate('PaymentReceipt', { payment });
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('fees.paymentForm.title')}
        subtitle={t('fees.paymentForm.subtitle', { name: assessment.studentName, roll: assessment.rollNumber })}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        <Text style={styles.hint}>
          {t('fees.paymentForm.hint', { amount: assessment.remainingDue.toLocaleString('en-IN') })}
        </Text>

        <LabeledInput label={t('fees.paymentForm.amount')} required value={amount} onChangeText={setAmount} keyboardType="numeric" />
        <Dropdown
          label={t('fees.paymentForm.paymentMethod')}
          required
          value={paymentMethod}
          options={PAYMENT_METHOD_OPTIONS}
          onSelect={setPaymentMethod}
        />
        <LabeledInput
          label={t('fees.paymentForm.paymentReference')}
          value={paymentReference}
          onChangeText={setPaymentReference}
        />
        <DateField label={t('fees.paymentForm.transactionDate')} value={transactionDate} onChange={setTransactionDate} />

        <Pressable
          style={[styles.submit, (!canSubmit || submitting) && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          <Text style={styles.submitText}>{submitting ? t('fees.paymentForm.submitting') : t('fees.paymentForm.submit')}</Text>
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hint: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.lg },
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
