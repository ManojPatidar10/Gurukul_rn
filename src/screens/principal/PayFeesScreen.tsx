import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ApiError } from '../../api/client';
import { createFeePaymentRequest } from '../../api/feePaymentRequest';
import { findPendingPaymentAttempt, recordPaymentAttemptResult } from '../../api/paymentAttempts';
import type { FeePaymentRequestResponse, PaymentAttempt, PaymentAttemptStatus } from '../../api/types';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { resolvePaymentAppUrl } from '../../utils/upiPaymentLinks';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'PayFees'>;

type Stage = 'idle' | 'creating' | 'awaitingReturn' | 'reporting' | 'result' | 'error';

const accent = accents.fees;

export function PayFeesScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const assessment = route.params.assessment;

  const [stage, setStage] = useState<Stage>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [paymentRequest, setPaymentRequest] = useState<FeePaymentRequestResponse | null>(null);
  const [resultAttempt, setResultAttempt] = useState<PaymentAttempt | null>(null);
  const returnHandled = useRef(false);

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
   * React Native's Linking API can only fire-and-forget open the UPI app (startActivity) - it
   * cannot capture a real ActivityResult the way native Android code could, so there is no
   * automatic, verified answer to "did the payment succeed?" here. The user's own report is
   * recorded as exactly that - self-reported - never presented as independently verified. See
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

  const handlePay = async () => {
    try {
      const pending = await findPendingPaymentAttempt(schoolId, assessment.id);
      if (pending) {
        Alert.alert(t('fees.payFees.pendingTitle'), t('fees.payFees.pendingMessage'), [
          { text: t('fees.payFees.pendingCancel'), style: 'cancel' },
          { text: t('fees.payFees.pendingContinue'), onPress: startPayment },
        ]);
        return;
      }
    } catch {
      // Non-fatal - if the pending-attempt check itself fails, fall through to a normal attempt
      // rather than blocking the student from paying at all.
    }
    await startPayment();
  };

  const handleRetry = () => {
    setErrorMessage(null);
    setPaymentRequest(null);
    setResultAttempt(null);
    returnHandled.current = false;
    setStage('idle');
  };

  const handleDone = () => navigation.navigate('MyFees');

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

        {(stage === 'idle' || stage === 'error') && (
          <>
            {stage === 'error' && errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
            <Pressable style={styles.payButton} onPress={stage === 'error' ? handleRetry : handlePay}>
              <Text style={styles.payButtonText}>
                {stage === 'error' ? t('fees.payFees.tryAgain') : t('fees.payFees.payNow')}
              </Text>
            </Pressable>
          </>
        )}

        {(stage === 'creating' || stage === 'awaitingReturn' || stage === 'reporting') && (
          <View style={styles.statusCard}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.statusText}>
              {stage === 'creating' && t('fees.payFees.preparing')}
              {stage === 'awaitingReturn' && t('fees.payFees.openingApp')}
              {stage === 'reporting' && t('fees.payFees.confirming')}
            </Text>
          </View>
        )}

        {stage === 'result' && resultAttempt && (
          <View style={styles.resultCard}>
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
              <Text style={[styles.resultTitle, styles.resultFailed]}>{t('fees.payFees.resultFailedMessage')}</Text>
            )}
            {resultAttempt.status === 'CANCELLED' && (
              <Text style={[styles.resultTitle, styles.resultFailed]}>{t('fees.payFees.resultCancelledMessage')}</Text>
            )}
            {resultAttempt.status === 'UNKNOWN' && (
              <Text style={styles.resultTitle}>{t('fees.payFees.resultUnknownMessage')}</Text>
            )}

            {(resultAttempt.status === 'FAILED' || resultAttempt.status === 'CANCELLED') && (
              <Pressable style={styles.payButton} onPress={handleRetry}>
                <Text style={styles.payButtonText}>{t('fees.payFees.tryAgain')}</Text>
              </Pressable>
            )}
            {resultAttempt.status !== 'FAILED' && resultAttempt.status !== 'CANCELLED' && (
              <Pressable style={styles.payButton} onPress={handleDone}>
                <Text style={styles.payButtonText}>{t('common.done')}</Text>
              </Pressable>
            )}
          </View>
        )}

        <Text style={styles.caution}>{t('fees.payFees.caution')}</Text>
      </ScreenContainer>
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
  resultLine: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.xs },
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
