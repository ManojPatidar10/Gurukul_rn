import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ApiError } from '../../api/client';
import { getErrorMessage } from '../../api/errorMessage';
import { recordFeePayment } from '../../api/feePayments';
import type { PaymentMethod } from '../../api/types';
import { DatePickerField, parseIsoDate } from '../../components/DatePickerField';
import Dropdown from '../../components/Dropdown';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { localToday } from '../../utils/assessmentStatus';
import {
  duplicateReferenceInfo,
  FEE_PAYMENT_METHODS,
  formatPaymentDate,
  normalizeReference,
  paymentDateBounds,
  paymentMethodLabelKey,
  referenceRequired,
  validateRecordPayment,
  type RecordPaymentErrors,
} from '../../utils/feePayments';
import { newIdempotencyKey } from '../../utils/idempotencyKey';
import { formatRupees, rupeesInputValue } from '../../utils/money';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'RecordPayment'>;

/** Admin: record a cash, cheque, bank or UPI payment on one bill, then show its receipt. */
export function RecordPaymentScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { showToast } = useToast();
  const { assessment } = route.params;
  const today = localToday();
  const bounds = paymentDateBounds(today);

  const [amount, setAmount] = useState(rupeesInputValue(Math.max(0, assessment.remainingDue)));
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(today);
  const [errors, setErrors] = useState<RecordPaymentErrors>({});
  const [saving, setSaving] = useState(false);
  // One key per form submission: a retry of the unchanged form (after a timeout, say) sends the same
  // key, so the server hands back the first payment instead of recording it twice. Editing any
  // field makes it a different submission.
  const keyRef = useRef<string | null>(null);
  const savingRef = useRef(false);

  const edit = <T,>(setter: (value: T) => void) => (value: T) => {
    keyRef.current = null;
    setErrors({});
    setter(value);
  };

  const methodOptions = FEE_PAYMENT_METHODS.map((value) => ({
    value,
    label: t(paymentMethodLabelKey(value) ?? value),
  }));

  const submit = async (confirmDuplicateReference: boolean) => {
    if (savingRef.current) return;
    const result = validateRecordPayment({ amount, method, reference, date }, assessment.remainingDue, today);
    setErrors(result.errors);
    if (!result.valid || result.amount === null) return;

    savingRef.current = true;
    setSaving(true);
    const key = (keyRef.current ??= newIdempotencyKey());
    try {
      const payment = await recordFeePayment(
        schoolId,
        {
          assessmentId: assessment.id,
          amount: result.amount,
          paymentMethod: method,
          paymentReference: normalizeReference(reference) ?? undefined,
          transactionDate: date || undefined,
          confirmDuplicateReference: confirmDuplicateReference || undefined,
        },
        key
      );
      navigation.replace('PaymentReceipt', { payment });
    } catch (e) {
      const duplicate = duplicateReferenceInfo(e);
      if (duplicate) {
        Alert.alert(
          t('fees.recordPayment.duplicateTitle'),
          t('fees.recordPayment.duplicateMessage', {
            reference: normalizeReference(reference) ?? reference,
            receipt: duplicate.existingReceiptNumber ?? '—',
            student: duplicate.existingStudentName,
            date: formatPaymentDate(duplicate.existingTransactionDate),
            amount: formatRupees(duplicate.existingAmount),
          }),
          [
            { text: t('common.cancel'), style: 'cancel' },
            // The same form, so the same key: nothing was written for the refused attempt.
            { text: t('fees.recordPayment.duplicateConfirm'), onPress: () => void submit(true) },
          ]
        );
        return;
      }
      // A key the server has seen with other details can't be reused; the next save gets a new one.
      if (e instanceof ApiError && e.errorCode === 'IDEMPOTENCY_KEY_REUSED') keyRef.current = null;
      showToast(getErrorMessage(e), 'error');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const needsReference = referenceRequired(method);
  const errorText = (key: string | undefined) =>
    key ? <Text style={styles.error}>{t(key, { max: formatRupees(assessment.remainingDue) })}</Text> : null;

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('fees.recordPayment.title')}
        subtitle={`${assessment.studentName} · ${t('fees.recordPayment.remaining', {
          amount: formatRupees(assessment.remainingDue),
        })}`}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer keyboardShouldPersistTaps="handled">
        <LabeledInput
          label={t('fees.recordPayment.amount')}
          required
          value={amount}
          onChangeText={edit(setAmount)}
          keyboardType="decimal-pad"
          placeholder="15,000"
        />
        {errorText(errors.amount)}

        <Dropdown
          label={t('fees.recordPayment.method')}
          required
          value={method}
          options={methodOptions}
          onSelect={edit((value: string) => setMethod(value as PaymentMethod))}
        />

        <LabeledInput
          label={t('fees.recordPayment.reference')}
          required={needsReference}
          value={reference}
          onChangeText={edit(setReference)}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={100}
          placeholder={needsReference ? undefined : t('fees.recordPayment.referenceOptional')}
        />
        <Text style={styles.hint}>{t('fees.recordPayment.referenceHint')}</Text>
        {errorText(errors.reference)}

        <DatePickerField
          label={t('fees.recordPayment.date')}
          value={date}
          onChange={edit(setDate)}
          minimumDate={parseIsoDate(bounds.min)}
          maximumDate={parseIsoDate(bounds.max)}
        />
        {errorText(errors.date)}

        <Pressable
          style={[styles.submit, saving && styles.submitDisabled]}
          onPress={() => void submit(false)}
          disabled={saving}
          accessibilityRole="button"
        >
          <Text style={styles.submitText}>{saving ? t('fees.recordPayment.saving') : t('fees.recordPayment.save')}</Text>
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: -spacing.sm, marginBottom: spacing.md },
  error: { fontSize: 12, color: colors.error, marginTop: -spacing.sm, marginBottom: spacing.md },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    ...softShadow,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: colors.white, fontWeight: '700' },
});
