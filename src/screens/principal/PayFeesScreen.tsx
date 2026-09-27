import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ApiError } from '../../api/client';
import { createFeePaymentRequest } from '../../api/feePaymentRequest';
import { findPendingPaymentAttempt, recordPaymentAttemptResult } from '../../api/paymentAttempts';
import { createRazorpayOrder, getPaymentGatewayStatus, verifyRazorpayPayment } from '../../api/razorpay';
import type {
  FeePaymentRequestResponse,
  PaymentAttempt,
  PaymentAttemptStatus,
  PaymentGatewayStatus,
  RazorpayOrder,
} from '../../api/types';
import { RazorpayCheckoutModal, type RazorpayCheckoutResult } from '../../components/RazorpayCheckoutModal';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { resolvePaymentAppUrl } from '../../utils/upiPaymentLinks';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'PayFees'>;

type Stage =
  | 'loading'
  | 'idle'
  | 'creating'
  | 'checkout'
  | 'verifying'
  | 'awaitingReturn'
  | 'reporting'
  | 'result'
  | 'error';

const accent = accents.fees;

/**
 * Two payment routes live here, and which one is offered is the backend's decision, not this
 * screen's guess: it answers /fee-payments/gateway with RAZORPAY when merchant credentials are
 * configured and UPI_INTENT otherwise.
 *
 * - RAZORPAY: server-created order, Razorpay's hosted checkout, then server-side verification. The
 *   app never learns the outcome by asking the user.
 * - UPI_INTENT (fallback, pre-gateway): a upi:// deep link that hands off to whatever UPI app is
 *   installed and returns nothing. The only way this app can learn what happened is to ask, which
 *   is exactly as unreliable as it sounds - hence the caveats in the result copy on that path.
 */
export function PayFeesScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const assessment = route.params.assessment;

  const [stage, setStage] = useState<Stage>('loading');
  const [gateway, setGateway] = useState<PaymentGatewayStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [paymentRequest, setPaymentRequest] = useState<FeePaymentRequestResponse | null>(null);
  const [razorpayOrder, setRazorpayOrder] = useState<RazorpayOrder | null>(null);
  const [resultAttempt, setResultAttempt] = useState<PaymentAttempt | null>(null);
  const returnHandled = useRef(false);

  const usesGateway = gateway?.provider === 'RAZORPAY';

  useEffect(() => {
    let cancelled = false;
    getPaymentGatewayStatus(schoolId)
      .then((status) => {
        if (cancelled) return;
        setGateway(status);
        setStage('idle');
      })
      .catch(() => {
        if (cancelled) return;
        // Falling back rather than blocking: an older backend has no such endpoint, and the
        // UPI-intent path is the behaviour that existed before the gateway and still works.
        setGateway({ provider: 'UPI_INTENT', verifiedPaymentsAvailable: false });
        setStage('idle');
      });
    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && stage === 'awaitingReturn' && !returnHandled.current && paymentRequest) {
        returnHandled.current = true;
        promptForOutcome(paymentRequest);
      }
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, paymentRequest]);

  /**
   * UPI-intent path only. React Native's Linking API can only fire-and-forget open the UPI app
   * (startActivity) - it cannot capture a real ActivityResult the way native Android code could, so
   * there is no automatic, verified answer to "did the payment succeed?" here. The user's own report
   * is recorded as exactly that - self-reported - never presented as independently verified. See
   * PaymentAttemptStatus (backend) for why RESPONSE_SUCCESS is kept distinct from VERIFIED.
   */
  const promptForOutcome = (request: FeePaymentRequestResponse) => {
    Alert.alert(
      t('fees.payFees.confirmTitle'),
      t('fees.payFees.confirmMessage'),
      [
        { text: t('fees.payFees.confirmYes'), onPress: () => reportOutcome(request, 'RESPONSE_SUCCESS') },
        { text: t('fees.payFees.confirmNo'), onPress: () => reportOutcome(request, 'CANCELLED') },
        {
          text: t('fees.payFees.confirmUnsure'),
          style: 'cancel',
          onPress: () => reportOutcome(request, 'UNKNOWN'),
        },
      ]
    );
  };

  const reportOutcome = async (request: FeePaymentRequestResponse, status: PaymentAttemptStatus) => {
    setStage('reporting');
    try {
      const attempt = await recordPaymentAttemptResult(schoolId, request.referenceId, {
        status,
        rawResponse: `self-reported:${status}`,
      });
      setResultAttempt(attempt);
      setStage('result');
    } catch (e) {
      const message = e instanceof ApiError ? e.message : (e as Error).message;
      setErrorMessage(message);
      setStage('error');
    }
  };

  const startPayment = async () => {
    setErrorMessage(null);
    setStage('creating');
    returnHandled.current = false;
    try {
      const request = await createFeePaymentRequest(schoolId, assessment.id);
      setPaymentRequest(request);

      const openableUri = await resolvePaymentAppUrl(request.upiUri);
      if (!openableUri) {
        setErrorMessage(t('fees.payFees.noUpiAppError'));
        setStage('error');
        return;
      }
      setStage('awaitingReturn');
      await Linking.openURL(openableUri);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : (e as Error).message;
      setErrorMessage(message);
      setStage('error');
    }
  };

  const startRazorpayPayment = async () => {
    setErrorMessage(null);
    setStage('creating');
    try {
      const order = await createRazorpayOrder(schoolId, assessment.id);
      setRazorpayOrder(order);
      setStage('checkout');
    } catch (e) {
      const message = e instanceof ApiError ? e.message : (e as Error).message;
      setErrorMessage(message);
      setStage('error');
    }
  };

  /**
   * A "success" from Checkout is only a claim until the backend re-derives the signature and
   * re-fetches the payment from Razorpay, so the fee is never shown as paid on this word alone.
   */
  const handleCheckoutResult = async (result: RazorpayCheckoutResult) => {
    if (result.kind === 'dismissed') {
      setRazorpayOrder(null);
      setStage('idle');
      return;
    }
    if (result.kind === 'failed') {
      setRazorpayOrder(null);
      setErrorMessage(result.reason ?? t('fees.payFees.resultFailedMessage'));
      setStage('error');
      return;
    }

    setRazorpayOrder(null);
    setStage('verifying');
    try {
      const attempt = await verifyRazorpayPayment(schoolId, {
        razorpayOrderId: result.razorpayOrderId,
        razorpayPaymentId: result.razorpayPaymentId,
        razorpaySignature: result.razorpaySignature,
      });
      setResultAttempt(attempt);
      setStage('result');
    } catch (e) {
      // The money may well have been taken - verification is a separate network call, and Razorpay's
      // webhook will reconcile this server-side within minutes regardless. Telling the student to
      // retry here is how double payments happen, so the copy explicitly says not to.
      const message = e instanceof ApiError ? e.message : (e as Error).message;
      setErrorMessage(`${t('fees.payFees.verifyFailedMessage')}\n\n${message}`);
      setStage('error');
    }
  };

  const handlePay = async () => {
    const start = usesGateway ? startRazorpayPayment : startPayment;
    try {
      const pending = await findPendingPaymentAttempt(schoolId, assessment.id);
      if (pending) {
        Alert.alert(t('fees.payFees.pendingTitle'), t('fees.payFees.pendingMessage'), [
          { text: t('fees.payFees.pendingCancel'), style: 'cancel' },
          { text: t('fees.payFees.pendingContinue'), onPress: start },
        ]);
        return;
      }
    } catch {
      // Non-fatal - if the pending-attempt check itself fails, fall through to a normal attempt
      // rather than blocking the student from paying at all.
    }
    await start();
  };

  const handleRetry = () => {
    setErrorMessage(null);
    setPaymentRequest(null);
    setRazorpayOrder(null);
    setResultAttempt(null);
    returnHandled.current = false;
    setStage('idle');
  };

  const handleDone = () => navigation.navigate('MyFees');

  const isBusy = stage === 'creating' || stage === 'awaitingReturn' || stage === 'reporting' || stage === 'verifying';

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('fees.payFees.title')}
        subtitle={t('fees.payFees.subtitle', { name: assessment.studentName, roll: assessment.rollNumber })}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        {stage !== 'result' && (
          <View style={styles.amountCard}>
            <Text style={styles.amountLabel}>{t('fees.payFees.amountDue')}</Text>
            <Text style={styles.amountValue}>₹{assessment.remainingDue.toLocaleString('en-IN')}</Text>
          </View>
        )}

        {stage === 'loading' && (
          <View style={styles.statusCard}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        )}

        {(stage === 'idle' || stage === 'error') && (
          <>
            {stage === 'error' && errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
            <Pressable style={styles.payButton} onPress={stage === 'error' ? handleRetry : handlePay}>
              <Text style={styles.payButtonText}>
                {stage === 'error' ? t('fees.payFees.tryAgain') : t('fees.payFees.payNow')}
              </Text>
            </Pressable>

            {usesGateway && stage === 'idle' && <Text style={styles.secureNote}>{t('fees.payFees.secureNote')}</Text>}

            {/* Manual fallback is meaningful only on the UPI-intent path, where there is a VPA to
                copy and self-reporting is the only source of truth. */}
            {!usesGateway && stage === 'error' && paymentRequest && (
              <View style={styles.manualCard}>
                <Text style={styles.manualTitle}>{t('fees.payFees.manualTitle')}</Text>
                <Text style={styles.manualHint}>{t('fees.payFees.manualHint')}</Text>
                <Text style={styles.manualLabel}>{t('fees.payFees.manualUpiId')}</Text>
                <Text style={styles.manualValue} selectable>
                  {paymentRequest.payeeVpa}
                </Text>
                <Text style={styles.manualLabel}>{t('fees.payFees.manualAmount')}</Text>
                <Text style={styles.manualValue} selectable>
                  ₹{paymentRequest.amount.toLocaleString('en-IN')}
                </Text>
                <Text style={styles.manualNote}>{t('fees.payFees.manualNote')}</Text>
                <Pressable style={styles.manualReportButton} onPress={() => promptForOutcome(paymentRequest)}>
                  <Text style={styles.manualReportButtonText}>{t('fees.payFees.manualReportButton')}</Text>
                </Pressable>
              </View>
            )}
          </>
        )}

        {isBusy && (
          <View style={styles.statusCard}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.statusText}>
              {stage === 'creating' && t('fees.payFees.preparing')}
              {stage === 'awaitingReturn' && t('fees.payFees.openingApp')}
              {stage === 'reporting' && t('fees.payFees.confirming')}
              {stage === 'verifying' && t('fees.payFees.verifying')}
            </Text>
          </View>
        )}

        {stage === 'result' && resultAttempt && (
          <View style={styles.resultCard}>
            {/* VERIFIED is reachable only through the gateway - it means the backend confirmed the
                capture with Razorpay, so unlike RESPONSE_SUCCESS it carries no caveat. */}
            {resultAttempt.status === 'VERIFIED' && (
              <>
                <Text style={[styles.resultTitle, styles.resultSuccess]}>{t('fees.payFees.resultVerifiedTitle')}</Text>
                <Text style={styles.resultAmount}>₹{resultAttempt.amount.toLocaleString('en-IN')}</Text>
                <Text style={styles.resultLine}>{t('fees.payFees.resultVerifiedSubtitle')}</Text>
                {resultAttempt.razorpayPaymentId && (
                  <Text style={styles.resultLine}>
                    {t('fees.payFees.resultReference')}: {resultAttempt.razorpayPaymentId}
                  </Text>
                )}
              </>
            )}
            {resultAttempt.status === 'RESPONSE_SUCCESS' && (
              <>
                <Text style={[styles.resultTitle, styles.resultSuccess]}>{t('fees.payFees.resultSuccessTitle')}</Text>
                <Text style={styles.resultAmount}>₹{resultAttempt.amount.toLocaleString('en-IN')}</Text>
                {resultAttempt.upiTransactionId && (
                  <Text style={styles.resultLine}>
                    {t('fees.payFees.resultTransactionId')}: {resultAttempt.upiTransactionId}
                  </Text>
                )}
                <Text style={styles.resultCaveat}>{t('fees.payFees.resultUnverifiedCaveat')}</Text>
              </>
            )}
            {resultAttempt.status === 'PENDING' && (
              <Text style={styles.resultTitle}>{t('fees.payFees.resultPendingMessage')}</Text>
            )}
            {resultAttempt.status === 'FAILED' && (
              <>
                <Text style={[styles.resultTitle, styles.resultFailed]}>{t('fees.payFees.resultFailedMessage')}</Text>
                {resultAttempt.failureReason && (
                  <Text style={styles.resultLine}>{resultAttempt.failureReason}</Text>
                )}
              </>
            )}
            {resultAttempt.status === 'CANCELLED' && (
              <Text style={[styles.resultTitle, styles.resultFailed]}>{t('fees.payFees.resultCancelledMessage')}</Text>
            )}
            {resultAttempt.status === 'UNKNOWN' && (
              <Text style={styles.resultTitle}>{t('fees.payFees.resultUnknownMessage')}</Text>
            )}

            {(resultAttempt.status === 'FAILED' || resultAttempt.status === 'CANCELLED') && (
              <Pressable style={[styles.payButton, styles.resultButton]} onPress={handleRetry}>
                <Text style={styles.payButtonText}>{t('fees.payFees.tryAgain')}</Text>
              </Pressable>
            )}
            {resultAttempt.status !== 'FAILED' && resultAttempt.status !== 'CANCELLED' && (
              <Pressable style={[styles.payButton, styles.resultButton]} onPress={handleDone}>
                <Text style={styles.payButtonText}>{t('common.done')}</Text>
              </Pressable>
            )}
          </View>
        )}

        {stage !== 'loading' && (
          <Text style={styles.caution}>
            {usesGateway ? t('fees.payFees.cautionGateway') : t('fees.payFees.caution')}
          </Text>
        )}
      </ScreenContainer>

      {stage === 'checkout' && razorpayOrder && (
        <RazorpayCheckoutModal order={razorpayOrder} onResult={handleCheckoutResult} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  amountCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...softShadow,
  },
  amountLabel: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.xs },
  amountValue: { fontSize: 32, fontWeight: '800', color: colors.textPrimary },
  error: { color: colors.error, marginBottom: spacing.md, textAlign: 'center' },
  payButton: {
    backgroundColor: accent.base,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    ...softShadow,
  },
  payButtonText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  resultButton: { alignSelf: 'stretch', marginTop: spacing.lg },
  secureNote: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  manualCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.lg,
    ...softShadow,
  },
  manualTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.xs },
  manualHint: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 18 },
  manualLabel: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: spacing.sm },
  manualValue: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginTop: 2 },
  manualNote: { fontSize: 12, color: colors.textMuted, marginTop: spacing.md, fontStyle: 'italic' },
  manualReportButton: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  manualReportButtonText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  statusCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  statusText: { marginTop: spacing.md, fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  resultCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    ...softShadow,
  },
  resultTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.sm },
  resultSuccess: { color: colors.success },
  resultFailed: { color: colors.error },
  resultAmount: { fontSize: 28, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.sm },
  resultLine: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.xs, textAlign: 'center' },
  resultCaveat: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    fontStyle: 'italic',
  },
  caution: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
    fontStyle: 'italic',
  },
});
