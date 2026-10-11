import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ApiError } from '../../api/client';
import { getErrorMessage } from '../../api/errorMessage';
import { reverseFeePayment } from '../../api/feePayments';
import type { FeePaymentReversalRequest, PaymentMethod, ReversalType } from '../../api/types';
import Dropdown from '../../components/Dropdown';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { useHoldWhileSaving } from '../../hooks/useHoldWhileSaving';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import {
  FEE_PAYMENT_METHODS,
  formatPaymentDate,
  MAX_REVERSAL_REASON,
  MIN_REVERSAL_REASON,
  normalizeReference,
  paymentMethodLabelKey,
  REVERSAL_TYPE_KEYS,
  reversalTypesFor,
  validateReversal,
  type ReversalErrors,
} from '../../utils/feePayments';
import { newIdempotencyKey } from '../../utils/idempotencyKey';
import { formatRupees } from '../../utils/money';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'ReversePayment'>;

/**
 * Admin: cancel a recorded payment as a correction (entered by mistake), a bounce (cheque or
 * transfer didn't clear) or a refund (money given back). The payment stays on record marked
 * CANCELLED, its receipt number is never reused, and the bill's paid total goes down by its amount.
 */
export function ReversePaymentScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { showToast } = useToast();
  const { payment } = route.params;
  const types = reversalTypesFor(payment.paymentMethod);

  const [type, setType] = useState<ReversalType | null>(null);
  const [reason, setReason] = useState('');
  const [refundMethod, setRefundMethod] = useState<PaymentMethod | null>(null);
  const [refundReference, setRefundReference] = useState('');
  const [errors, setErrors] = useState<ReversalErrors>({});
  const [saving, setSaving] = useState(false);
  // Same rule as recording: one key per unchanged form, so a retried submit reverses only once.
  const keyRef = useRef<string | null>(null);
  const savingRef = useRef(false);
  useHoldWhileSaving(saving, savingRef, () => showToast(t('fees.reversePayment.stillReversing'), 'info'));

  const edit = <T,>(setter: (value: T) => void) => (value: T) => {
    keyRef.current = null;
    setErrors({});
    setter(value);
  };

  const methodLabel = (method: string | null | undefined) => {
    const key = paymentMethodLabelKey(method);
    return key ? t(key) : (method ?? '—');
  };
  const methodOptions = FEE_PAYMENT_METHODS.map((value) => ({ value, label: methodLabel(value) }));
  const amount = formatRupees(payment.amount, { decimals: 'always' });
  const receipt = payment.receiptNumber ?? '—';

  const send = async () => {
    if (savingRef.current || !type) return;
    savingRef.current = true;
    setSaving(true);
    const key = (keyRef.current ??= newIdempotencyKey());
    const request: FeePaymentReversalRequest = { type, reason: reason.trim() };
    if (type === 'REFUND') {
      request.refundMethod = refundMethod ?? undefined;
      request.refundReference = normalizeReference(refundReference) ?? undefined;
    }
    try {
      const reversed = await reverseFeePayment(schoolId, payment.id, request, key);
      showToast(t('fees.reversePayment.done'), 'success');
      savingRef.current = false; // so the hold lets this navigation through
      // `pop`: go back to the receipt this was opened from (React Navigation 7's navigate would
      // otherwise push a second receipt and leave this form behind it).
      navigation.navigate({ name: 'PaymentReceipt', params: { payment: reversed }, merge: true, pop: true });
    } catch (e) {
      if (e instanceof ApiError && e.errorCode === 'ALREADY_REVERSED') {
        showToast(getErrorMessage(e), 'info');
        savingRef.current = false;
        navigation.goBack();
        return;
      }
      if (e instanceof ApiError && e.errorCode === 'IDEMPOTENCY_KEY_REUSED') keyRef.current = null;
      showToast(getErrorMessage(e), 'error');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleSubmit = () => {
    const result = validateReversal({ type, reason, refundMethod, refundReference });
    setErrors(result.errors);
    if (!result.valid) return;
    Alert.alert(
      t('fees.reversePayment.confirmTitle'),
      t('fees.reversePayment.confirmMessage', { receipt, amount, student: payment.studentName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('fees.reversePayment.confirm'), style: 'destructive', onPress: () => void send() },
      ]
    );
  };

  const errorText = (key: string | undefined) =>
    key ? <Text style={styles.error}>{t(key, { min: MIN_REVERSAL_REASON })}</Text> : null;

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('fees.reversePayment.title')} subtitle={payment.studentName} onBack={() => navigation.goBack()} />
      <ScreenContainer keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{receipt}</Text>
          <Text style={styles.cardAmount}>{amount}</Text>
          <Text style={styles.cardMeta}>
            {payment.paymentReference
              ? `${methodLabel(payment.paymentMethod)} · ${payment.paymentReference}`
              : methodLabel(payment.paymentMethod)}
          </Text>
          <Text style={styles.cardMeta}>{formatPaymentDate(payment.transactionDate)}</Text>
        </View>

        <Text style={styles.label}>{t('fees.reversePayment.typeLabel')} *</Text>
        {types.map((option) => {
          const selected = option === type;
          return (
            <Pressable
              key={option}
              style={[styles.option, selected && styles.optionSelected]}
              onPress={() => edit(setType)(option)}
              disabled={saving}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled: saving }}
            >
              <View style={[styles.radio, selected && styles.radioSelected]}>
                {selected && <View style={styles.radioDot} />}
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>{t(REVERSAL_TYPE_KEYS[option].label)}</Text>
                <Text style={styles.optionDescription}>{t(REVERSAL_TYPE_KEYS[option].description)}</Text>
              </View>
            </Pressable>
          );
        })}
        {errorText(errors.type)}

        <LabeledInput
          label={t('fees.reversePayment.reason')}
          required
          value={reason}
          onChangeText={edit(setReason)}
          multiline
          maxLength={MAX_REVERSAL_REASON}
          placeholder={t('fees.reversePayment.reasonPlaceholder')}
          style={styles.reasonInput}
        />
        <Text style={styles.counter}>
          {t('fees.reversePayment.reasonCount', { length: reason.trim().length, max: MAX_REVERSAL_REASON })}
        </Text>
        {errorText(errors.reason)}

        {type === 'REFUND' && (
          <>
            <Dropdown
              label={t('fees.reversePayment.refundMethod')}
              required
              value={refundMethod ?? ''}
              options={methodOptions}
              onSelect={edit((value: string) => setRefundMethod(value as PaymentMethod))}
            />
            {errorText(errors.refundMethod)}
            <LabeledInput
              label={t('fees.reversePayment.refundReference')}
              required
              value={refundReference}
              onChangeText={edit(setRefundReference)}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={100}
            />
            <Text style={styles.hint}>{t('fees.reversePayment.refundReferenceHint')}</Text>
            {errorText(errors.refundReference)}
            <Text style={styles.note}>{t('fees.reversePayment.refundEnteredToday')}</Text>
          </>
        )}

        <Pressable
          style={[styles.submit, saving && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={saving}
          accessibilityRole="button"
        >
          <Text style={styles.submitText}>
            {saving ? t('fees.reversePayment.submitting') : t('fees.reversePayment.submit')}
          </Text>
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...softShadow,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  cardAmount: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, marginTop: spacing.xs },
  cardMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    marginTop: 2,
  },
  radioSelected: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  optionDescription: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  reasonInput: { minHeight: 90, textAlignVertical: 'top' },
  counter: { fontSize: 12, color: colors.textMuted, textAlign: 'right', marginTop: -spacing.sm, marginBottom: spacing.md },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: -spacing.sm, marginBottom: spacing.md },
  note: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md },
  error: { fontSize: 12, color: colors.error, marginTop: -spacing.sm, marginBottom: spacing.md },
  submit: {
    backgroundColor: colors.error,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    ...softShadow,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: colors.white, fontWeight: '700' },
});
