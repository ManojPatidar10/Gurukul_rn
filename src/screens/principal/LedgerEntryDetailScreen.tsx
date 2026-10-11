import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ApiError } from '../../api/client';
import { getErrorMessage } from '../../api/errorMessage';
import { getLedgerTransaction, reverseLedgerTransaction } from '../../api/ledger';
import { ErrorNotice } from '../../components/ErrorNotice';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import {
  canReverseEntry,
  directionLabel,
  displayNumber,
  entryChips,
  entryLabel,
  formatLedgerDate,
  formatLedgerInstant,
  formatSignedLedgerRupees,
  isValidReversalReason,
  linkedDocumentText,
  numberLabelKey,
  paymentMethodLabel,
  REVERSAL_REASON_MAX,
  reversalTypeLabel,
  reverseConfirmText,
  reverseHint,
  signedAmount,
} from '../../utils/ledger';
import { istToday } from '../../utils/quizInsights';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'LedgerEntryDetail'>;

const accent = accents.fees;

function Field({ label, value, children }: { label: string; value?: string | null; children?: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children ?? <Text style={styles.fieldValue}>{value || '—'}</Text>}
    </View>
  );
}

export function LedgerEntryDetailScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { showToast } = useToast();
  const tx = route.params.transaction;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reversing, setReversing] = useState(false);
  const [reverseError, setReverseError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  const number = displayNumber(tx);
  const hintKey = reverseHint(tx);
  const reversalType = reversalTypeLabel(tx, t);
  const inflow = tx.direction === 'INFLOW';
  const canConfirm = isValidReversalReason(reason) && !reversing;

  const closeConfirm = () => {
    if (reversing) return;
    setConfirmOpen(false);
    setReverseError(null);
  };

  const handleReverse = async () => {
    if (!canConfirm) return;
    setReversing(true);
    setReverseError(null);
    try {
      const result = await reverseLedgerTransaction(schoolId, tx.id, reason);
      navigation.setParams({ transaction: result.original });
      setConfirmOpen(false);
      setReason('');
      showToast(t('ledger.reverse.done'), 'success');
    } catch (e) {
      if (e instanceof ApiError && e.errorCode === 'ALREADY_REVERSED') {
        // Reversed meanwhile (another admin, or a double tap): show it as it is now. Only manual
        // entries, event collections and sponsorships are reversed here, so it's the entry wording,
        // not errors.codes.ALREADY_REVERSED's fee payment one.
        setConfirmOpen(false);
        showToast(t('ledger.reverse.alreadyReversed'), 'error');
        try {
          navigation.setParams({ transaction: await getLedgerTransaction(schoolId, tx.id) });
        } catch {
          // The message above already says what happened; the stale view is only cosmetic.
        }
      } else {
        setReverseError(getErrorMessage(e));
      }
    } finally {
      setReversing(false);
    }
  };

  /** Opens the linked reversal (or original) entry as its own detail screen. */
  const openLinked = async (id: string) => {
    if (opening) return;
    setOpening(id);
    try {
      const linked = await getLedgerTransaction(schoolId, id);
      navigation.push('LedgerEntryDetail', { transaction: linked });
    } catch (e) {
      showToast(getErrorMessage(e), 'error');
    } finally {
      setOpening(null);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('ledger.detail.title')}
        subtitle={number ?? entryLabel(tx, t)}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        <View style={styles.amountCard}>
          <Text style={[styles.amount, { color: inflow ? colors.success : colors.error }]}>
            {formatSignedLedgerRupees(signedAmount(tx))}
          </Text>
          <Text style={styles.direction}>{directionLabel(tx.direction, t)}</Text>
          <View style={styles.chips}>
            {entryChips(tx).map((chip) => (
              <StatusChip key={chip.key} label={t(chip.key)} variant={chip.variant} />
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Field label={t('ledger.detail.date')} value={formatLedgerDate(tx.transactionDate, t, true)} />
          <Field label={t('ledger.detail.category')} value={entryLabel(tx, t)} />
          <Field label={t('ledger.detail.method')} value={paymentMethodLabel(tx.paymentMethod, t)} />
          <Field label={t('ledger.detail.reference')} value={tx.paymentReference} />
          <Field label={t(numberLabelKey(tx))}>
            <View style={styles.numberRow}>
              <Text style={[styles.fieldValue, tx.reversed && number ? styles.struck : null]}>
                {number ?? t('ledger.detail.noNumber')}
              </Text>
              {tx.reversed && number ? <StatusChip label={t('ledger.detail.cancelled')} variant="error" /> : null}
            </View>
          </Field>
          <Field label={t('ledger.detail.notes')} value={tx.notes} />
          <Field label={t('ledger.detail.recordedAt')} value={formatLedgerInstant(tx.createdAt, t)} />
          <Field label={t('ledger.detail.linkedTo')} value={linkedDocumentText(tx, t)} />
        </View>

        {tx.reversed || tx.reversalOfId ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('ledger.detail.reversalTitle')}</Text>
            {tx.reversalOfId ? <Text style={styles.reversalNote}>{t('ledger.detail.isReversal')}</Text> : null}
            {tx.reversed ? (
              <>
                <Field label={t('ledger.detail.reversedAt')} value={formatLedgerInstant(tx.reversedAt, t)} />
                <Field label={t('ledger.detail.reversedBy')} value={tx.reversedBy} />
                {reversalType ? <Field label={t('ledger.detail.reversalType')} value={reversalType} /> : null}
              </>
            ) : null}
            <Field label={t('ledger.detail.reversalReason')} value={tx.reversalReason} />
            {tx.reversalTransactionId ? (
              <Pressable
                style={styles.link}
                onPress={() => openLinked(tx.reversalTransactionId!)}
                disabled={!!opening}
                accessibilityRole="link"
                accessibilityLabel={t('ledger.detail.viewReversal')}
              >
                {opening === tx.reversalTransactionId ? (
                  <ActivityIndicator color={accent.base} size="small" />
                ) : (
                  <Text style={styles.linkText}>{t('ledger.detail.viewReversal')}</Text>
                )}
              </Pressable>
            ) : null}
            {tx.reversalOfId ? (
              <Pressable
                style={styles.link}
                onPress={() => openLinked(tx.reversalOfId!)}
                disabled={!!opening}
                accessibilityRole="link"
                accessibilityLabel={t('ledger.detail.viewOriginal')}
              >
                {opening === tx.reversalOfId ? (
                  <ActivityIndicator color={accent.base} size="small" />
                ) : (
                  <Text style={styles.linkText}>{t('ledger.detail.viewOriginal')}</Text>
                )}
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {canReverseEntry(tx) ? (
          <Pressable
            style={styles.reverseButton}
            onPress={() => {
              setReverseError(null);
              setConfirmOpen(true);
            }}
            accessibilityRole="button"
          >
            <Text style={styles.reverseButtonText}>{t('ledger.detail.reverseButton')}</Text>
          </Pressable>
        ) : hintKey ? (
          <Text style={styles.hint}>{t(hintKey)}</Text>
        ) : null}
      </ScreenContainer>

      <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={closeConfirm}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('ledger.reverse.title')}</Text>
            <Text style={styles.modalBody}>{reverseConfirmText(tx, t, istToday(new Date()))}</Text>
            <LabeledInput
              label={t('ledger.reverse.reasonLabel')}
              required
              value={reason}
              onChangeText={setReason}
              placeholder={t('ledger.reverse.reasonPlaceholder')}
              maxLength={REVERSAL_REASON_MAX}
              multiline
              editable={!reversing}
              style={styles.reasonInput}
            />
            <Text style={styles.reasonHint}>{t('ledger.reverse.reasonHint')}</Text>
            {reverseError ? <ErrorNotice message={reverseError} /> : null}
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalCancel, reversing && styles.disabled]}
                onPress={closeConfirm}
                disabled={reversing}
                accessibilityRole="button"
              >
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                style={[styles.modalConfirm, !canConfirm && styles.disabled]}
                onPress={handleReverse}
                disabled={!canConfirm}
                accessibilityRole="button"
                accessibilityLabel={t('ledger.reverse.confirm')}
              >
                {reversing ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>{t('ledger.reverse.confirm')}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  amountCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
    ...softShadow,
  },
  amount: { fontSize: 28, fontWeight: '800' },
  direction: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs },
  chips: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...softShadow,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md },
  field: { marginBottom: spacing.md },
  fieldLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '700' },
  fieldValue: { fontSize: 16, color: colors.textPrimary, marginTop: 2 },
  numberRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  struck: { textDecorationLine: 'line-through', color: colors.textMuted },
  reversalNote: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md },
  link: { paddingVertical: spacing.sm, alignSelf: 'flex-start' },
  linkText: { color: accent.base, fontWeight: '700' },
  reverseButton: {
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
  },
  reverseButtonText: { color: colors.error, fontWeight: '700' },
  hint: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  disabled: { opacity: 0.5 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(32, 26, 43, 0.4)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.sm },
  modalBody: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.md },
  reasonInput: { minHeight: 72, textAlignVertical: 'top' },
  reasonHint: { fontSize: 12, color: colors.textMuted, marginTop: -spacing.sm, marginBottom: spacing.sm },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
  modalCancel: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  modalCancelText: { color: colors.textMuted, fontWeight: '700' },
  modalConfirm: {
    backgroundColor: colors.error,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    minWidth: 110,
    alignItems: 'center',
  },
  modalConfirmText: { color: colors.white, fontWeight: '700' },
});
