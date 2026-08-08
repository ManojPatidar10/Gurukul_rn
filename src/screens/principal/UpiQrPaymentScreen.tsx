import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import QRCode from 'react-native-qrcode-svg';

import { ApiError } from '../../api/client';
import { generateUpiQr } from '../../api/feeUpiQr';
import type { UpiQrResponse } from '../../api/types';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { isPositiveNumber } from '../../utils/validators';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'UpiQrPayment'>;

const accent = accents.fees;

export function UpiQrPaymentScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { showToast } = useToast();
  const assessment = route.params.assessment;

  const [amount, setAmount] = useState(String(assessment.remainingDue));
  const [generating, setGenerating] = useState(false);
  const [qr, setQr] = useState<UpiQrResponse | null>(null);

  const handleOpenUpiApp = async () => {
    if (!qr) return;
    try {
      const canOpen = await Linking.canOpenURL(qr.upiUri);
      if (!canOpen) {
        showToast(t('fees.upiQr.noUpiAppError'), 'error');
        return;
      }
      await Linking.openURL(qr.upiUri);
    } catch {
      showToast(t('fees.upiQr.noUpiAppError'), 'error');
    }
  };

  const handleGenerate = async () => {
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
    setGenerating(true);
    setQr(null);
    try {
      const response = await generateUpiQr(schoolId, assessment.id, Number(amount));
      setQr(response);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : (e as Error).message;
      showToast(message, 'error');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('fees.upiQr.title')}
        subtitle={t('fees.paymentForm.subtitle', { name: assessment.studentName, roll: assessment.rollNumber })}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        <Text style={styles.hint}>
          {t('fees.paymentForm.hint', { amount: assessment.remainingDue.toLocaleString('en-IN') })}
        </Text>

        <LabeledInput label={t('fees.paymentForm.amount')} required value={amount} onChangeText={setAmount} keyboardType="numeric" />

        <Pressable style={[styles.generateButton, generating && styles.buttonDisabled]} onPress={handleGenerate} disabled={generating}>
          {generating ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.generateButtonText}>{qr ? t('fees.upiQr.regenerate') : t('fees.upiQr.generate')}</Text>
          )}
        </Pressable>

        {qr && (
          <View style={styles.qrCard}>
            <View style={styles.qrWrapper}>
              <QRCode value={qr.upiUri} size={220} />
            </View>
            <Text style={styles.amountText}>₹{qr.amount.toLocaleString('en-IN')}</Text>
            <Text style={styles.detailLine}>{t('fees.upiQr.payeeLabel', { name: qr.payeeName })}</Text>
            <Text style={styles.detailLine}>{t('fees.upiQr.vpaLabel', { vpa: qr.payeeVpa })}</Text>
            <Text style={styles.detailLine}>{t('fees.upiQr.referenceLabel', { reference: qr.referenceId })}</Text>

            <Text style={styles.orDivider}>{t('fees.upiQr.orDivider')}</Text>

            <Pressable style={styles.upiAppButton} onPress={handleOpenUpiApp}>
              <Text style={styles.upiAppButtonText}>{t('fees.upiQr.openUpiApp')}</Text>
            </Pressable>

            <Text style={styles.caution}>{t('fees.upiQr.caution')}</Text>

            <Pressable
              style={styles.recordButton}
              onPress={() =>
                navigation.navigate('FeePaymentForm', {
                  assessment,
                  initialPaymentMethod: 'UPI',
                  initialPaymentReference: qr.referenceId,
                })
              }
            >
              <Text style={styles.recordButtonText}>{t('fees.upiQr.recordPayment')}</Text>
            </Pressable>
          </View>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hint: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.lg },
  generateButton: {
    backgroundColor: accent.base,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    ...softShadow,
  },
  buttonDisabled: { opacity: 0.6 },
  generateButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  qrCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.lg,
    alignItems: 'center',
    ...softShadow,
  },
  qrWrapper: { padding: spacing.md, backgroundColor: colors.white, borderRadius: radius.lg, marginBottom: spacing.md },
  amountText: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.xs },
  detailLine: { fontSize: 13, color: colors.textSecondary, marginBottom: 2 },
  orDivider: {
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  upiAppButton: {
    borderWidth: 1.5,
    borderColor: accent.base,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  upiAppButtonText: { color: accent.base, fontWeight: '700' },
  caution: {
    fontSize: 12,
    color: colors.warning,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.md,
    fontStyle: 'italic',
  },
  recordButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    ...softShadow,
  },
  recordButtonText: { color: colors.white, fontWeight: '700' },
});
