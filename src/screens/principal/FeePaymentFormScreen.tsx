import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { recordFeePayment } from '../../api/feePayments';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'FeePaymentForm'>;

export function FeePaymentFormScreen({ route, navigation }: Props) {
  const schoolId = useSchoolId();
  const assessment = route.params.assessment;

  const [amount, setAmount] = useState(String(assessment.remainingDue));
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = Number(amount) > 0 && !!paymentMethod;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await recordFeePayment(schoolId, {
        assessmentId: assessment.id,
        amount: Number(amount),
        paymentMethod,
        paymentReference: paymentReference || undefined,
        transactionDate: transactionDate || undefined,
      });
      navigation.pop(2);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Record payment"
        subtitle={`${assessment.studentName} · Roll ${assessment.rollNumber}`}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        <Text style={styles.hint}>
          Remaining due: ₹{assessment.remainingDue.toLocaleString('en-IN')} (partial payments allowed)
        </Text>

        <LabeledInput label="Amount" value={amount} onChangeText={setAmount} keyboardType="numeric" />
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
        <LabeledInput
          label="Transaction date (YYYY-MM-DD)"
          value={transactionDate}
          onChangeText={setTransactionDate}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.submit, (!canSubmit || submitting) && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          <Text style={styles.submitText}>{submitting ? 'Recording…' : 'Record payment'}</Text>
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hint: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.lg },
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
