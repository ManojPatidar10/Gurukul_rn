import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getErrorMessage } from '../../api/errorMessage';
import { sendFeeReminder } from '../../api/feeAssessments';
import type { FeeAssessment } from '../../api/types';
import { useToast } from '../../context/ToastContext';
import { colors, radius, spacing } from '../../theme/colors';
import { formatRupees } from '../../utils/money';

interface Props {
  schoolId: string;
  bill: Pick<FeeAssessment, 'id' | 'studentName' | 'remainingDue'>;
}

/**
 * The admin's Send fee reminder on one bill: after a confirm, the family (linked parents, else the
 * student's own login) gets the fee-due push now. The server sends it at most once per bill per family
 * a day, and says so when a second tap sent nothing; a refusal (bill paid or cancelled meanwhile,
 * student left) shows its reason.
 */
export function SendFeeReminderButton({ schoolId, bill }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    try {
      const result = await sendFeeReminder(schoolId, bill.id);
      showToast(
        t(result.alreadyRemindedToday ? 'fees.reminder.alreadySent' : 'fees.reminder.sent', { name: bill.studentName }),
        result.alreadyRemindedToday ? 'info' : 'success'
      );
    } catch (e) {
      showToast(getErrorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => {
    Alert.alert(
      t('fees.reminder.confirmTitle'),
      t('fees.reminder.confirmMessage', {
        name: bill.studentName,
        amount: formatRupees(bill.remainingDue, { symbol: false }),
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('fees.reminder.confirm'), onPress: send },
      ]
    );
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        style={[styles.button, busy && styles.buttonBusy]}
        onPress={confirm}
        disabled={busy}
        accessibilityRole="button"
        accessibilityState={{ disabled: busy, busy }}
      >
        {busy ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.buttonText}>{t('fees.reminder.send')}</Text>}
      </Pressable>
      <Text style={styles.hint}>{t('fees.reminder.sendHint')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.md },
  button: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonBusy: { opacity: 0.6 },
  buttonText: { color: colors.primary, fontWeight: '700' },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' },
});
