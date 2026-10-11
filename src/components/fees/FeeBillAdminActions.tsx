import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getErrorMessage } from '../../api/errorMessage';
import { addFeeAdjustment, cancelFeeAssessment, updateFeeAssessmentDueDate } from '../../api/feeAssessments';
import type { FeeAdjustmentType, FeeAssessment } from '../../api/types';
import { useToast } from '../../context/ToastContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import {
  adjustmentConfirmText,
  adjustmentDraft,
  adjustmentLabel,
  canCancelBill,
  dueDateChangeBounds,
  FEE_ADJUSTMENT_TYPES,
  isBillCancelled,
  todayIst,
} from '../../utils/feeBills';
import { formatRupees, rupeesInputValue } from '../../utils/money';
import { DatePickerField, parseIsoDate } from '../DatePickerField';
import { ErrorNotice } from '../ErrorNotice';
import LabeledInput from '../LabeledInput';

type Panel = 'adjust' | 'dueDate' | 'cancel';

const MAX_REASON = 500;

interface Props {
  schoolId: string;
  bill: FeeAssessment;
  /** Called with the bill the server sent back after each change. */
  onUpdated: (bill: FeeAssessment) => void;
}

/**
 * The admin's corrections to one bill: add a concession, waiver, late fee or correction with a
 * reason, move its due date, or cancel it (only while nothing has been paid on it). Each change
 * comes back as the updated bill; refusals (a cancelled bill, a fee below what's paid) show the
 * server's reason. Nothing shows for a cancelled bill.
 */
export function FeeBillAdminActions({ schoolId, bill, onUpdated }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [type, setType] = useState<FeeAdjustmentType>('CONCESSION');
  const [correctionSign, setCorrectionSign] = useState<1 | -1>(-1);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isBillCancelled(bill)) return null;

  const canCancel = canCancelBill(bill);
  const draft = adjustmentDraft(bill, type, amount, correctionSign);
  const bounds = dueDateChangeBounds(todayIst());

  const togglePanel = (next: Panel) => {
    setError(null);
    if (next === 'dueDate') setDueDate(bill.dueDate ?? '');
    setPanel((current) => (current === next ? null : next));
  };

  const run = async (action: () => Promise<FeeAssessment>, doneMessage: string) => {
    setBusy(true);
    setError(null);
    try {
      onUpdated(await action());
      showToast(doneMessage, 'success');
      setPanel(null);
      return true;
    } catch (e) {
      setError(getErrorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  // An adjustment can't be deleted and the family sees it at once, so Save asks first.
  const confirmAdjustment = () => {
    if (draft.error || draft.amount === null || draft.newTotal === null) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      setError(t('fees.adjustment.errors.reason'));
      return;
    }
    const signed = draft.amount;
    Alert.alert(
      t('fees.adjustment.confirmTitle'),
      adjustmentConfirmText(bill.studentName, type, signed, draft.newTotal, t),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('fees.adjustment.submit'),
          onPress: () => {
            run(() => addFeeAdjustment(schoolId, bill.id, { type, amount: signed, reason: trimmed }), t('fees.adjustment.added')).then(
              (ok) => {
                if (ok) {
                  setAmount('');
                  setReason('');
                }
              }
            );
          },
        },
      ]
    );
  };

  const submitDueDate = () => {
    if (!dueDate || dueDate === bill.dueDate) return;
    run(() => updateFeeAssessmentDueDate(schoolId, bill.id, dueDate), t('fees.bill.dueDateSaved'));
  };

  const confirmCancel = () => {
    const trimmed = cancelReason.trim();
    if (!trimmed) {
      setError(t('fees.bill.cancelReasonRequired'));
      return;
    }
    Alert.alert(
      t('fees.bill.cancelConfirmTitle'),
      t('fees.bill.cancelConfirmMessage', { name: bill.studentName, amount: formatRupees(bill.totalDue, { symbol: false }) }),
      [
        { text: t('fees.bill.keepBill'), style: 'cancel' },
        {
          text: t('fees.bill.cancelConfirm'),
          style: 'destructive',
          onPress: () => {
            run(() => cancelFeeAssessment(schoolId, bill.id, trimmed), t('fees.bill.cancelledToast')).then((ok) => {
              if (ok) setCancelReason('');
            });
          },
        },
      ]
    );
  };

  const amountTyped = amount.trim() !== '';
  const showBelowPaid = draft.error === 'belowPaid' && draft.newTotal !== null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('fees.bill.adminActions')}</Text>
      <View style={styles.tabs}>
        <Tab label={t('fees.adjustment.add')} selected={panel === 'adjust'} onPress={() => togglePanel('adjust')} />
        <Tab label={t('fees.bill.changeDueDate')} selected={panel === 'dueDate'} onPress={() => togglePanel('dueDate')} />
        {canCancel && <Tab label={t('fees.bill.cancel')} selected={panel === 'cancel'} onPress={() => togglePanel('cancel')} danger />}
      </View>
      {!canCancel && <Text style={styles.hint}>{t('fees.bill.cancelBlocked')}</Text>}

      {panel === 'adjust' && (
        <View style={styles.panel}>
          <Text style={styles.fieldLabel}>{t('fees.adjustment.type')}</Text>
          <View style={styles.chips}>
            {FEE_ADJUSTMENT_TYPES.map((option) => (
              <Chip key={option} label={adjustmentLabel(option, t)} selected={type === option} onPress={() => setType(option)} />
            ))}
          </View>
          <Text style={styles.hint}>{t(`fees.adjustment.typeHints.${type}`)}</Text>
          {type === 'CORRECTION' && (
            <View style={styles.chips}>
              <Chip label={t('fees.adjustment.decrease')} selected={correctionSign === -1} onPress={() => setCorrectionSign(-1)} />
              <Chip label={t('fees.adjustment.increase')} selected={correctionSign === 1} onPress={() => setCorrectionSign(1)} />
            </View>
          )}
          <LabeledInput
            label={t('fees.adjustment.amount')}
            required
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0"
          />
          {type === 'WAIVER' && bill.remainingDue > 0 && (
            <Pressable
              onPress={() => setAmount(rupeesInputValue(bill.remainingDue))}
              style={styles.linkButton}
              accessibilityRole="button"
            >
              <Text style={styles.link}>{t('fees.adjustment.waiveRemaining', { amount: formatRupees(bill.remainingDue, { symbol: false }) })}</Text>
            </Pressable>
          )}
          {amountTyped && draft.error === 'amount' && <Text style={styles.fieldError}>{t('fees.adjustment.errors.amount')}</Text>}
          {showBelowPaid && (
            <Text style={styles.fieldError}>
              {t('fees.adjustment.errors.belowPaid', { total: formatRupees(draft.newTotal ?? 0, { symbol: false }), paid: formatRupees(bill.totalPaid, { symbol: false }) })}
            </Text>
          )}
          {!draft.error && draft.newTotal !== null && (
            <Text style={styles.preview}>{t('fees.adjustment.newTotal', { amount: formatRupees(draft.newTotal, { symbol: false }) })}</Text>
          )}
          <LabeledInput
            label={t('fees.adjustment.reason')}
            required
            value={reason}
            onChangeText={setReason}
            placeholder={t('fees.adjustment.reasonPlaceholder')}
            maxLength={MAX_REASON}
            multiline
          />
          <Text style={styles.reasonHint}>{t('fees.adjustment.reasonVisible')}</Text>
          {error && <ErrorNotice message={error} />}
          <SubmitButton
            label={busy ? t('fees.adjustment.submitting') : t('fees.adjustment.submit')}
            disabled={busy || draft.error !== null || !reason.trim()}
            onPress={confirmAdjustment}
          />
        </View>
      )}

      {panel === 'dueDate' && (
        <View style={styles.panel}>
          <DatePickerField
            label={t('fees.bill.newDueDate')}
            value={dueDate}
            onChange={setDueDate}
            minimumDate={parseIsoDate(bounds.min)}
            maximumDate={parseIsoDate(bounds.max)}
            placeholder={t('common.selectDate')}
          />
          {error && <ErrorNotice message={error} />}
          <SubmitButton
            label={busy ? t('common.saving') : t('fees.bill.saveDueDate')}
            disabled={busy || !dueDate || dueDate === bill.dueDate}
            onPress={submitDueDate}
          />
        </View>
      )}

      {panel === 'cancel' && canCancel && (
        <View style={styles.panel}>
          <LabeledInput
            label={t('fees.bill.cancelReason')}
            required
            value={cancelReason}
            onChangeText={setCancelReason}
            placeholder={t('fees.bill.cancelReasonPlaceholder')}
            maxLength={MAX_REASON}
            multiline
          />
          <Text style={styles.reasonHint}>{t('fees.bill.cancelReasonVisible')}</Text>
          {error && <ErrorNotice message={error} />}
          <SubmitButton label={t('fees.bill.cancel')} disabled={busy || !cancelReason.trim()} onPress={confirmCancel} danger />
        </View>
      )}
    </View>
  );
}

function Tab({ label, selected, onPress, danger }: { label: string; selected: boolean; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable
      style={[styles.tab, selected && (danger ? styles.tabSelectedDanger : styles.tabSelected)]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded: selected }}
    >
      <Text style={[styles.tabText, danger && styles.tabTextDanger, selected && styles.tabTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function SubmitButton({ label, disabled, onPress, danger }: { label: string; disabled: boolean; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable
      style={[styles.submit, danger && styles.submitDanger, disabled && styles.submitDisabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
    >
      <Text style={styles.submitText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.lg,
    ...softShadow,
  },
  title: { fontSize: 13, fontWeight: '800', color: colors.textSecondary, marginBottom: spacing.sm },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tab: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  tabSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabSelectedDanger: { backgroundColor: colors.error, borderColor: colors.error },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  tabTextDanger: { color: colors.error },
  tabTextSelected: { color: colors.white },
  hint: { fontSize: 12.5, color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.sm },
  panel: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.xs },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12.5, fontWeight: '700', color: colors.textSecondary },
  chipTextSelected: { color: colors.white },
  linkButton: { marginTop: -spacing.xs, marginBottom: spacing.sm },
  link: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  fieldError: { color: colors.error, fontSize: 12.5, marginTop: -spacing.xs, marginBottom: spacing.sm },
  reasonHint: { color: colors.textMuted, fontSize: 12.5, marginTop: -spacing.sm, marginBottom: spacing.sm },
  preview: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginTop: -spacing.xs, marginBottom: spacing.sm },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  submitDanger: { backgroundColor: colors.error },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: colors.white, fontWeight: '700' },
});
