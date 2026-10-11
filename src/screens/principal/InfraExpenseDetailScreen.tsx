import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { NetworkError } from '../../api/client';
import {
  approveInfraExpenseRequest,
  cancelInfraExpenseRequest,
  getInfraExpenseRequest,
  payInfraExpenseRequest,
  purchaseInfraExpenseRequest,
  rejectInfraExpenseRequest,
  reviseInfraExpenseRequest,
  submitInfraExpenseRequest,
} from '../../api/infraExpenseRequests';
import type {
  AmountAboveApprovedData,
  ExpenseAction,
  InfraExpenseRequest,
  PaymentMethod,
  Vendor,
} from '../../api/expenseTypes';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { DatePickerField } from '../../components/DatePickerField';
import Dropdown from '../../components/Dropdown';
import LabeledInput from '../../components/LabeledInput';
import VendorPicker from '../../components/VendorPicker';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';
import { localToday } from '../../utils/assessmentStatus';
import {
  aboveApprovedData,
  aboveApprovedMessage,
  actorLabel,
  approvedLimit,
  billAboveApproved,
  COMMENT_MAX_LENGTH,
  defaultReviseAmount,
  duplicateInvoiceMessage,
  expenseErrorKind,
  formatExpenseDate,
  formatExpenseTime,
  infraActions,
  infraStatusLabel,
  infraStatusVariant,
  INVOICE_MAX_LENGTH,
  needsPaymentReference,
  needsReapproval,
  PAYMENT_REFERENCE_MAX_LENGTH,
  paymentMethodLabel,
  paymentMethodOptions,
  REJECT_REASON_MIN_LENGTH,
  requestCategoryLabel,
  reviseBelowBillMessage,
  selfApprovalMessage,
  timelineStepLabel,
} from '../../utils/expenses';
import { amountInputText, amountProblemKey, formatInr, parseInrAmount, toPaise } from '../../utils/money';
import { bankDetailsChangedRecently } from '../../utils/vendors';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'InfraExpenseDetail'>;

/** The bill a "send back for approval" comes from, for its comment. */
interface BillContext {
  invoice: string;
  vendorName: string;
}

function Field({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {onPress ? (
        <Pressable onPress={onPress} accessibilityRole="link">
          <Text style={[styles.fieldValue, styles.link]}>{value || '—'}</Text>
        </Pressable>
      ) : (
        <Text style={styles.fieldValue}>{value || '—'}</Text>
      )}
    </View>
  );
}

function AmountCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.amountCell}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.amountValue}>{value}</Text>
    </View>
  );
}

function ConfirmButton({ label, busy, onPress }: { label: string; busy: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Pressable style={[styles.submit, busy && styles.disabled]} onPress={onPress} disabled={busy} accessibilityRole="button">
      <Text style={styles.submitText}>{busy ? t('infraExpenses.panels.working') : label}</Text>
    </Pressable>
  );
}

export function InfraExpenseDetailScreen({ route, navigation }: Props) {
  const { t, i18n } = useTranslation();
  const schoolId = useSchoolId();
  const { requestId } = route.params;
  const [request, setRequest] = useState<InfraExpenseRequest | null>(route.params.request ?? null);
  const [loading, setLoading] = useState(!route.params.request);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [panel, setPanel] = useState<ExpenseAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Panel inputs. Field errors show once the panel's button has been tapped.
  const [attempted, setAttempted] = useState(false);
  const [comment, setComment] = useState('');
  const [reviseText, setReviseText] = useState('');
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [billText, setBillText] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [paymentReference, setPaymentReference] = useState('');
  const [transactionDate, setTransactionDate] = useState(localToday());

  // The latest state, for callbacks that run later (alert buttons) and must send the current version.
  const requestRef = useRef(request);
  useEffect(() => {
    requestRef.current = request;
  }, [request]);

  // Takes a fetched copy unless it's older than what an action already returned.
  const applyFetched = useCallback((fetched: InfraExpenseRequest) => {
    setRequest((prev) =>
      prev && typeof prev.version === 'number' && typeof fetched.version === 'number' && fetched.version < prev.version
        ? prev
        : fetched
    );
  }, []);

  const refetch = useCallback(
    () =>
      getInfraExpenseRequest(schoolId, requestId)
        .then((fetched) => {
          applyFetched(fetched);
          setLoadError(null);
        })
        .catch((e) => setLoadError(getErrorMessage(e))),
    [schoolId, requestId, applyFetched]
  );

  // Always fetched fresh on focus: the route's copy (from the list) has no history and may be stale.
  useFocusEffect(
    useCallback(() => {
      refetch().finally(() => setLoading(false));
    }, [refetch])
  );

  const openPanel = (action: ExpenseAction) => {
    if (!request) return;
    setError(null);
    setNotice(null);
    setAttempted(false);
    setComment('');
    if (action === 'REVISE') setReviseText(amountInputText(defaultReviseAmount(request)));
    if (action === 'RECORD_PURCHASE') {
      setVendor(null);
      setInvoiceNumber('');
      setBillText('');
    }
    if (action === 'PAY') {
      setPaymentMethod('');
      setPaymentReference('');
      setTransactionDate(localToday());
    }
    setPanel(panel === action ? null : action);
  };

  const closePanel = () => {
    setPanel(null);
    setAttempted(false);
  };

  /** Runs one action. True when it went through. */
  const run = async (call: (current: InfraExpenseRequest) => Promise<InfraExpenseRequest>, bill?: BillContext) => {
    const current = requestRef.current;
    if (!current) return false;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await call(current);
      requestRef.current = updated;
      setRequest(updated);
      closePanel();
      return true;
    } catch (e) {
      handleError(e, bill);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const sendBack = async (amount: number, bill?: BillContext) => {
    const ok = await run(
      (current) =>
        reviseInfraExpenseRequest(schoolId, current.id, {
          estimatedAmount: amount,
          comment: bill
            ? t('infraExpenses.aboveApproved.reviseComment', { invoice: bill.invoice, vendor: bill.vendorName, amount: formatInr(amount) })
            : undefined,
          expectedVersion: current.version,
        }),
      bill
    );
    if (ok) setNotice(t('infraExpenses.aboveApproved.sentBack'));
  };

  const offerSendBack = (data: AmountAboveApprovedData, bill?: BillContext) => {
    Alert.alert(t('infraExpenses.aboveApproved.title'), aboveApprovedMessage(data, t), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('infraExpenses.aboveApproved.sendBack', { amount: formatInr(data.actualAmount) }),
        onPress: () => {
          sendBack(data.actualAmount, bill);
        },
      },
    ]);
  };

  function handleError(e: unknown, bill?: BillContext) {
    if (e instanceof NetworkError) {
      // The step may have gone through before the connection dropped: show what the server has now.
      setError(getErrorMessage(e));
      refetch();
      return;
    }
    switch (expenseErrorKind(e)) {
      case 'stale':
        closePanel();
        setError(getErrorMessage(e));
        refetch();
        return;
      case 'aboveApproved': {
        const data = aboveApprovedData(e);
        const purchase = requestRef.current?.purchase;
        if (data) {
          offerSendBack(data, bill ?? (purchase ? { invoice: purchase.invoiceNumber, vendorName: purchase.vendorName } : undefined));
          return;
        }
        break;
      }
      case 'selfApproval':
        closePanel();
        setError(selfApprovalMessage(e, t));
        refetch();
        return;
      case 'duplicateInvoice':
        setError(duplicateInvoiceMessage(e, t) ?? getErrorMessage(e));
        return;
      default:
        break;
    }
    setError(reviseBelowBillMessage(e, t) ?? getErrorMessage(e));
  }

  // ---- Panel actions

  const commentValue = () => comment.trim() || undefined;

  const handleSimple = (action: 'SUBMIT' | 'APPROVE') => {
    const call = action === 'SUBMIT' ? submitInfraExpenseRequest : approveInfraExpenseRequest;
    run((current) => call(schoolId, current.id, { comment: commentValue(), expectedVersion: current.version }));
  };

  const handleReject = () => {
    setAttempted(true);
    if (comment.trim().length < REJECT_REASON_MIN_LENGTH) return;
    run((current) => rejectInfraExpenseRequest(schoolId, current.id, { comment: comment.trim(), expectedVersion: current.version }));
  };

  const handleCancel = () => {
    Alert.alert(t('infraExpenses.panels.cancelConfirmTitle'), t('infraExpenses.panels.cancelConfirmBody'), [
      { text: t('infraExpenses.panels.keep'), style: 'cancel' },
      {
        text: t('infraExpenses.actions.CANCEL'),
        style: 'destructive',
        onPress: () => {
          run((current) => cancelInfraExpenseRequest(schoolId, current.id, { comment: commentValue(), expectedVersion: current.version }));
        },
      },
    ]);
  };

  const revised = parseInrAmount(reviseText);
  const reviseError = (() => {
    if (!revised.ok) return attempted || revised.problem !== 'empty' ? t(amountProblemKey(revised.problem)) : null;
    const bill = request?.purchase?.actualAmount;
    if (bill !== undefined && revised.paise < toPaise(bill)) {
      return t('infraExpenses.errors.reviseBelowBill', { amount: formatInr(bill) });
    }
    return null;
  })();

  const handleRevise = () => {
    setAttempted(true);
    if (!revised.ok || reviseError) return;
    run((current) =>
      reviseInfraExpenseRequest(schoolId, current.id, {
        estimatedAmount: revised.value,
        comment: commentValue(),
        expectedVersion: current.version,
      })
    );
  };

  const bill = parseInrAmount(billText);
  const billError = !bill.ok && (attempted || bill.problem !== 'empty') ? t(amountProblemKey(bill.problem)) : null;

  const handlePurchase = () => {
    setAttempted(true);
    if (!request || !vendor || !invoiceNumber.trim() || !bill.ok) return;
    const context: BillContext = { invoice: invoiceNumber.trim(), vendorName: vendor.name };
    // Check before sending: a bill above the approval has to go back for approval first.
    if (billAboveApproved(request, bill.value)) {
      offerSendBack({ approvedAmount: approvedLimit(request), actualAmount: bill.value }, context);
      return;
    }
    run(
      (current) =>
        purchaseInfraExpenseRequest(schoolId, current.id, {
          vendorId: vendor.id,
          invoiceNumber: invoiceNumber.trim(),
          actualAmount: bill.value,
          expectedVersion: current.version,
        }),
      context
    );
  };

  const referenceNeeded = needsPaymentReference(paymentMethod);
  const handlePay = () => {
    setAttempted(true);
    if (!paymentMethod || (referenceNeeded && !paymentReference.trim())) return;
    run((current) =>
      payInfraExpenseRequest(schoolId, current.id, {
        paymentMethod,
        paymentReference: paymentReference.trim() || undefined,
        transactionDate: transactionDate || undefined,
        expectedVersion: current.version,
      })
    );
  };

  // ---- Render

  if (!request) {
    return (
      <View style={styles.root}>
        <ScreenHeader title={t('infraExpenses.detail.title')} onBack={() => navigation.goBack()} />
        <ScreenContainer>
          {loading ? (
            <ActivityIndicator style={styles.loader} color={colors.primary} />
          ) : (
            <>
              <ErrorNotice message={loadError ?? t('errors.generic')} />
              <Pressable style={styles.actionButton} onPress={() => refetch()}>
                <Text style={styles.actionText}>{t('common.retry')}</Text>
              </Pressable>
            </>
          )}
        </ScreenContainer>
      </View>
    );
  }

  const locale = i18n.language;
  const actions = infraActions(request);
  const purchase = request.purchase ?? null;
  const payment = request.payment ?? null;
  const overApproval = needsReapproval(request);
  const bankChanged = purchase?.vendorBankDetailsChangedAt ?? null;
  // A panel stays open only while its step is still possible (a reload can change that).
  const openAction = panel && actions.includes(panel) ? panel : null;

  const actionButton = (action: ExpenseAction) => {
    const destructive = action === 'REJECT' || action === 'CANCEL';
    return (
      <Pressable
        key={action}
        style={[styles.actionButton, destructive && styles.destructiveButton, openAction === action && styles.actionButtonActive, busy && styles.disabled]}
        onPress={() => openPanel(action)}
        disabled={busy}
        accessibilityRole="button"
      >
        <Text style={[styles.actionText, destructive && styles.destructiveText]}>{t(`infraExpenses.actions.${action}`)}</Text>
      </Pressable>
    );
  };

  const commentInput = (label = t('infraExpenses.panels.comment')) => (
    <LabeledInput label={label} value={comment} onChangeText={setComment} maxLength={COMMENT_MAX_LENGTH} multiline />
  );

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('infraExpenses.detail.title')}
        subtitle={requestCategoryLabel(request, t)}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        <View style={styles.statusRow}>
          <StatusChip label={infraStatusLabel(request.status, t)} variant={infraStatusVariant(request.status)} />
        </View>

        <View style={styles.card}>
          <Field label={t('infraExpenses.detail.category')} value={requestCategoryLabel(request, t)} />
          <Field label={t('infraExpenses.detail.description')} value={request.description} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('infraExpenses.detail.amountsTitle')}</Text>
          <View style={styles.amountGrid}>
            <AmountCell label={t('infraExpenses.detail.requested')} value={formatInr(request.estimatedAmount)} />
            <AmountCell label={t('infraExpenses.detail.approved')} value={formatInr(request.approvedAmount)} />
            <AmountCell label={t('infraExpenses.detail.bill')} value={formatInr(purchase?.actualAmount)} />
            <AmountCell label={t('infraExpenses.detail.paid')} value={formatInr(payment?.amount)} />
          </View>
        </View>

        {overApproval && purchase && (
          <View style={styles.warning}>
            <Text style={styles.warningText}>
              {t('infraExpenses.detail.needsReapproval', {
                bill: formatInr(purchase.actualAmount),
                approved: formatInr(approvedLimit(request)),
              })}
            </Text>
          </View>
        )}

        {purchase && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('infraExpenses.detail.purchaseTitle')}</Text>
            <Field
              label={t('infraExpenses.detail.vendor')}
              value={purchase.vendorName}
              onPress={() => navigation.navigate('VendorDetail', { vendorId: purchase.vendorId })}
            />
            <Field label={t('infraExpenses.detail.invoice')} value={purchase.invoiceNumber} />
            <Field label={t('infraExpenses.detail.bill')} value={formatInr(purchase.actualAmount)} />
            <Field
              label={t('infraExpenses.detail.recordedBy')}
              value={[actorLabel(purchase.recordedByName, purchase.recordedBy), formatExpenseTime(purchase.recordedAt, locale)]
                .filter(Boolean)
                .join(' · ')}
            />
          </View>
        )}

        {payment && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('infraExpenses.detail.paymentTitle')}</Text>
            <Field label={t('infraExpenses.detail.paid')} value={formatInr(payment.amount)} />
            <Field label={t('infraExpenses.detail.paidOn')} value={formatExpenseDate(payment.transactionDate, locale)} />
            <Field label={t('infraExpenses.detail.method')} value={paymentMethodLabel(payment.paymentMethod, t)} />
            <Field label={t('infraExpenses.detail.reference')} value={payment.paymentReference ?? ''} />
            <Field
              label={t('infraExpenses.detail.paidBy')}
              value={[actorLabel(payment.paidByName, payment.paidBy), formatExpenseTime(payment.paidAt, locale)]
                .filter(Boolean)
                .join(' · ')}
            />
          </View>
        )}

        {notice && (
          <View style={styles.info}>
            <Text style={styles.infoText}>{notice}</Text>
          </View>
        )}
        {error && <ErrorNotice message={error} />}

        {request.selfApprovalBlocked && (
          <View style={styles.info}>
            <Text style={styles.infoText}>{t('infraExpenses.detail.selfApprovalBlocked')}</Text>
          </View>
        )}

        {actions.length > 0 ? (
          <View style={styles.actions}>{actions.map(actionButton)}</View>
        ) : (
          !request.selfApprovalBlocked && <Text style={styles.muted}>{t('infraExpenses.detail.noActions')}</Text>
        )}

        {(openAction === 'SUBMIT' || openAction === 'APPROVE') && (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>
              {openAction === 'SUBMIT'
                ? t('infraExpenses.panels.submitTitle')
                : t('infraExpenses.panels.approveTitle', { amount: formatInr(request.estimatedAmount) })}
            </Text>
            {commentInput()}
            <ConfirmButton label={t(`infraExpenses.actions.${openAction}`)} busy={busy} onPress={() => handleSimple(openAction)} />
          </View>
        )}

        {openAction === 'CANCEL' && (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>{t('infraExpenses.panels.cancelTitle')}</Text>
            {commentInput()}
            <ConfirmButton label={t('infraExpenses.actions.CANCEL')} busy={busy} onPress={handleCancel} />
          </View>
        )}

        {openAction === 'REJECT' && (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>{t('infraExpenses.panels.rejectTitle')}</Text>
            {commentInput(t('infraExpenses.panels.rejectReason'))}
            {attempted && comment.trim().length < REJECT_REASON_MIN_LENGTH && (
              <Text style={styles.fieldError}>{t('infraExpenses.panels.rejectReasonTooShort')}</Text>
            )}
            <ConfirmButton label={t('infraExpenses.actions.REJECT')} busy={busy} onPress={handleReject} />
          </View>
        )}

        {openAction === 'REVISE' && (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>{t('infraExpenses.panels.reviseTitle')}</Text>
            <LabeledInput
              label={t('infraExpenses.panels.reviseAmount')}
              required
              value={reviseText}
              onChangeText={setReviseText}
              keyboardType="decimal-pad"
            />
            {reviseError && <Text style={styles.fieldError}>{reviseError}</Text>}
            {commentInput()}
            <Text style={styles.hint}>{t('infraExpenses.panels.reviseNote')}</Text>
            <ConfirmButton label={t('infraExpenses.actions.SUBMIT')} busy={busy} onPress={handleRevise} />
          </View>
        )}

        {openAction === 'RECORD_PURCHASE' && (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>{t('infraExpenses.panels.purchaseTitle')}</Text>
            <Text style={styles.hint}>{t('infraExpenses.panels.approvedLimit', { amount: formatInr(approvedLimit(request)) })}</Text>
            <Text style={styles.label}>{t('infraExpenses.panels.vendor')}</Text>
            <VendorPicker schoolId={schoolId} selectedId={vendor?.id ?? null} onSelect={setVendor} />
            {vendor && <Text style={styles.hint}>{t('vendors.picker.selected', { name: vendor.name })}</Text>}
            {attempted && !vendor && <Text style={styles.fieldError}>{t('infraExpenses.panels.pickVendor')}</Text>}
            <LabeledInput
              label={t('infraExpenses.panels.invoice')}
              required
              value={invoiceNumber}
              onChangeText={setInvoiceNumber}
              maxLength={INVOICE_MAX_LENGTH}
              autoCapitalize="characters"
            />
            {attempted && !invoiceNumber.trim() && <Text style={styles.fieldError}>{t('infraExpenses.panels.enterInvoice')}</Text>}
            <LabeledInput
              label={t('infraExpenses.panels.bill')}
              required
              value={billText}
              onChangeText={setBillText}
              keyboardType="decimal-pad"
            />
            {billError && <Text style={styles.fieldError}>{billError}</Text>}
            <ConfirmButton label={t('infraExpenses.actions.RECORD_PURCHASE')} busy={busy} onPress={handlePurchase} />
          </View>
        )}

        {openAction === 'PAY' && (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>{t('infraExpenses.panels.payTitle')}</Text>
            {purchase && (
              <Text style={styles.hint}>
                {t('infraExpenses.panels.payAmount', { amount: formatInr(purchase.actualAmount), vendor: purchase.vendorName })}
              </Text>
            )}
            {purchase && bankDetailsChangedRecently(bankChanged) && (
              <View style={styles.warning}>
                <Text style={styles.warningText}>
                  {t('infraExpenses.panels.bankChangedWarning', {
                    vendor: purchase.vendorName,
                    date: formatExpenseDate(bankChanged, locale),
                  })}
                </Text>
              </View>
            )}
            <Dropdown
              label={t('infraExpenses.panels.method')}
              required
              value={paymentMethod}
              options={paymentMethodOptions(t)}
              onSelect={(value) => setPaymentMethod(value as PaymentMethod)}
            />
            {attempted && !paymentMethod && <Text style={styles.fieldError}>{t('infraExpenses.panels.pickMethod')}</Text>}
            <LabeledInput
              label={referenceNeeded ? t('infraExpenses.panels.reference') : t('infraExpenses.panels.referenceOptional')}
              required={referenceNeeded}
              value={paymentReference}
              onChangeText={setPaymentReference}
              maxLength={PAYMENT_REFERENCE_MAX_LENGTH}
              autoCapitalize="characters"
            />
            {attempted && referenceNeeded && !paymentReference.trim() && (
              <Text style={styles.fieldError}>{t('infraExpenses.panels.referenceRequired')}</Text>
            )}
            <DatePickerField
              label={t('infraExpenses.panels.date')}
              value={transactionDate}
              onChange={setTransactionDate}
              maximumDate={new Date()}
            />
            <ConfirmButton label={t('infraExpenses.actions.PAY')} busy={busy} onPress={handlePay} />
          </View>
        )}

        {request.timeline && request.timeline.length > 0 && (
          <View style={[styles.card, styles.historyCard]}>
            <Text style={styles.cardTitle}>{t('infraExpenses.detail.historyTitle')}</Text>
            {request.timeline.map((entry, index) => (
              <View key={`${entry.step}-${entry.at}-${index}`} style={[styles.step, index > 0 && styles.stepDivider]}>
                <View style={styles.stepHeader}>
                  <Text style={styles.stepTitle}>{timelineStepLabel(entry.step, t)}</Text>
                  {entry.amount !== null && entry.amount !== undefined && (
                    <Text style={styles.stepAmount}>{formatInr(entry.amount)}</Text>
                  )}
                </View>
                <Text style={styles.stepMeta}>
                  {[actorLabel(entry.byName, entry.by), formatExpenseTime(entry.at, locale)].filter(Boolean).join(' · ')}
                </Text>
                {entry.selfApproved && <Text style={styles.stepFlag}>{t('infraExpenses.detail.onlyAdmin')}</Text>}
                {entry.comment ? <Text style={styles.stepComment}>{entry.comment}</Text> : null}
              </View>
            ))}
          </View>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loader: { marginTop: 40 },
  statusRow: { flexDirection: 'row', marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...softShadow,
  },
  historyCard: { marginTop: spacing.lg },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md },
  field: { marginBottom: spacing.md },
  fieldLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '700' },
  fieldValue: { fontSize: 16, color: colors.textPrimary, marginTop: 2 },
  link: { color: colors.primary, fontWeight: '700' },
  amountGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md },
  amountCell: { width: '50%' },
  amountValue: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginTop: 2 },
  warning: {
    backgroundColor: '#FFF3E0',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  warningText: { color: colors.warning, fontSize: 14, lineHeight: 20 },
  info: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  infoText: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  muted: { color: colors.textMuted, fontSize: 14 },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  actionButton: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignSelf: 'flex-start',
  },
  actionButtonActive: { borderWidth: 1.5, borderColor: colors.primary },
  actionText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  destructiveButton: { backgroundColor: '#FFEBEE' },
  destructiveText: { color: colors.error },
  panel: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...softShadow,
  },
  panelTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md },
  label: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.sm },
  hint: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.md },
  fieldError: { fontSize: 13, color: colors.error, marginTop: -spacing.xs, marginBottom: spacing.md },
  disabled: { opacity: 0.5 },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    ...softShadow,
  },
  submitText: { color: colors.white, fontWeight: '700' },
  step: { paddingVertical: spacing.sm },
  stepDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  stepHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  stepAmount: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  stepMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  stepFlag: { fontSize: 12, color: colors.warning, fontWeight: '700', marginTop: 2 },
  stepComment: { fontSize: 13, color: colors.textSecondary, marginTop: spacing.xs, fontStyle: 'italic' },
});
