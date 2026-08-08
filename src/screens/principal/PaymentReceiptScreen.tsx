import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { FeePayment } from '../../api/types';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useToast } from '../../context/ToastContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'PaymentReceipt'>;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildReceiptHtml(payment: FeePayment, t: (key: string) => string): string {
  const referenceRow = payment.paymentReference
    ? `<p><strong>${t('fees.receipt.paymentReference')}:</strong> ${escapeHtml(payment.paymentReference)}</p>`
    : '';
  return `
    <html>
      <body style="font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 32px; color: #201A2B;">
        <h1 style="margin-bottom: 0;">${escapeHtml(payment.schoolName)}</h1>
        <p style="color: #5B5468; margin-top: 4px;">${t('fees.receipt.subtitle')}</p>
        <hr />
        <p><strong>${t('fees.receipt.receiptNumber')}:</strong> ${escapeHtml(payment.receiptNumber)}</p>
        <p><strong>${t('fees.receipt.date')}:</strong> ${escapeHtml(payment.transactionDate)}</p>
        <p><strong>${t('fees.receipt.studentName')}:</strong> ${escapeHtml(payment.studentName)}</p>
        <p><strong>${t('fees.receipt.rollNumber')}:</strong> ${escapeHtml(payment.rollNumber)}</p>
        <p><strong>${t('fees.receipt.classSection')}:</strong> ${escapeHtml(payment.classSectionLabel)}</p>
        <p><strong>${t('fees.receipt.academicYear')}:</strong> ${escapeHtml(payment.academicYear)}</p>
        <p><strong>${t('fees.receipt.paymentMethod')}:</strong> ${escapeHtml(payment.paymentMethod)}</p>
        ${referenceRow}
        <h2 style="margin-top: 24px;">${t('fees.receipt.amountPaid')}: &#8377;${payment.amount.toLocaleString('en-IN')}</h2>
      </body>
    </html>
  `;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function PaymentReceiptScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const payment = route.params.payment;
  const [sharing, setSharing] = useState(false);

  const handleDone = () => navigation.navigate('FeeAssessmentsList');

  const handleShare = async () => {
    setSharing(true);
    try {
      const html = buildReceiptHtml(payment, t);
      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        showToast(t('fees.receipt.shareUnavailable'), 'error');
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: t('fees.receipt.shareTitle') });
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setSharing(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('fees.receipt.title')} onBack={handleDone} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.schoolName}>{payment.schoolName}</Text>
          <Text style={styles.receiptSubtitle}>{t('fees.receipt.subtitle')}</Text>
          <View style={styles.divider} />
          <Row label={t('fees.receipt.receiptNumber')} value={payment.receiptNumber} />
          <Row label={t('fees.receipt.date')} value={payment.transactionDate} />
          <Row label={t('fees.receipt.studentName')} value={payment.studentName} />
          <Row label={t('fees.receipt.rollNumber')} value={payment.rollNumber} />
          <Row label={t('fees.receipt.classSection')} value={payment.classSectionLabel} />
          <Row label={t('fees.receipt.academicYear')} value={payment.academicYear} />
          <Row label={t('fees.receipt.paymentMethod')} value={payment.paymentMethod} />
          {payment.paymentReference && (
            <Row label={t('fees.receipt.paymentReference')} value={payment.paymentReference} />
          )}
          <View style={styles.divider} />
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>{t('fees.receipt.amountPaid')}</Text>
            <Text style={styles.amountValue}>₹{payment.amount.toLocaleString('en-IN')}</Text>
          </View>
        </View>

        <Pressable style={[styles.shareButton, sharing && styles.buttonDisabled]} onPress={handleShare} disabled={sharing}>
          <Text style={styles.shareButtonText}>{sharing ? t('fees.receipt.sharing') : t('fees.receipt.shareOrPrint')}</Text>
        </Pressable>

        <Pressable style={styles.doneButton} onPress={handleDone}>
          <Text style={styles.doneButtonText}>{t('common.done')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...softShadow,
  },
  schoolName: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  receiptSubtitle: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 2, marginBottom: spacing.md },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  rowLabel: { fontSize: 13, color: colors.textMuted },
  rowValue: { fontSize: 13, color: colors.textPrimary, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amountLabel: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  amountValue: { fontSize: 22, fontWeight: '800', color: colors.primary },
  shareButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    ...softShadow,
  },
  buttonDisabled: { opacity: 0.6 },
  shareButtonText: { color: colors.white, fontWeight: '700' },
  doneButton: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.sm },
  doneButtonText: { color: colors.textMuted, fontWeight: '600' },
});
