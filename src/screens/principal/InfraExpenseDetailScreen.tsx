import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  approveInfraExpenseRequest,
  payInfraExpenseRequest,
  purchaseInfraExpenseRequest,
  rejectInfraExpenseRequest,
  submitInfraExpenseRequest,
} from '../../api/infraExpenseRequests';
import type { InfraExpenseRequest } from '../../api/types';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { DatePickerField } from '../../components/DatePickerField';
import LabeledInput from '../../components/LabeledInput';
import VendorPicker from '../../components/VendorPicker';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'InfraExpenseDetail'>;

type ActivePanel = null | 'review' | 'purchase' | 'pay';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value || '—'}</Text>
    </View>
  );
}

export function InfraExpenseDetailScreen({ route, navigation }: Props) {
  const schoolId = useSchoolId();
  const [request, setRequest] = useState<InfraExpenseRequest>(route.params.request);
  const [panel, setPanel] = useState<ActivePanel>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [actor, setActor] = useState('');
  const [comment, setComment] = useState('');

  const [vendorId, setVendorId] = useState<string | null>(null);
  const [vendorLabel, setVendorLabel] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [actualAmount, setActualAmount] = useState('');

  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));

  const closePanel = () => {
    setPanel(null);
    setError(null);
  };

  const handleSubmit = async () => {
    setBusy(true);
    setError(null);
    try {
      const updated = await submitInfraExpenseRequest(schoolId, request.id, {
        actor: actor || undefined,
        comment: comment || undefined,
      });
      setRequest(updated);
      closePanel();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async () => {
    setBusy(true);
    setError(null);
    try {
      const updated = await approveInfraExpenseRequest(schoolId, request.id, {
        actor: actor || undefined,
        comment: comment || undefined,
      });
      setRequest(updated);
      closePanel();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    setBusy(true);
    setError(null);
    try {
      const updated = await rejectInfraExpenseRequest(schoolId, request.id, {
        actor: actor || undefined,
        comment: comment || undefined,
      });
      setRequest(updated);
      closePanel();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handlePurchase = async () => {
    if (!vendorId) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await purchaseInfraExpenseRequest(schoolId, request.id, {
        vendorId,
        invoiceNumber,
        actualAmount: Number(actualAmount),
      });
      setRequest(updated);
      closePanel();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handlePay = async () => {
    if (!paymentMethod) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await payInfraExpenseRequest(schoolId, request.id, {
        paymentMethod,
        paymentReference: paymentReference || undefined,
        transactionDate: transactionDate || undefined,
      });
      setRequest(updated);
      closePanel();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={request.description} subtitle={request.categoryCode} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <View style={styles.statusRow}>
          <StatusChip label={request.status} variant="neutral" />
        </View>

        <View style={styles.card}>
          <Field label="Category" value={request.categoryCode} />
          <Field label="Estimated amount" value={`₹${request.estimatedAmount.toLocaleString('en-IN')}`} />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.actions}>
          <Pressable style={styles.actionButton} onPress={() => setPanel(panel === 'review' ? null : 'review')}>
            <Text style={styles.actionText}>Submit / Approve / Reject</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => setPanel(panel === 'purchase' ? null : 'purchase')}>
            <Text style={styles.actionText}>Record purchase</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => setPanel(panel === 'pay' ? null : 'pay')}>
            <Text style={styles.actionText}>Mark as paid</Text>
          </Pressable>
        </View>

        {panel === 'review' && (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Workflow action</Text>
            <LabeledInput label="Actor (optional)" value={actor} onChangeText={setActor} placeholder="Your name" />
            <LabeledInput label="Comment (optional)" value={comment} onChangeText={setComment} />
            <View style={styles.panelRow}>
              <Pressable style={[styles.smallButton, busy && styles.disabled]} onPress={handleSubmit} disabled={busy}>
                <Text style={styles.smallButtonText}>Submit</Text>
              </Pressable>
              <Pressable style={[styles.smallButton, busy && styles.disabled]} onPress={handleApprove} disabled={busy}>
                <Text style={styles.smallButtonText}>Approve</Text>
              </Pressable>
              <Pressable
                style={[styles.smallButton, styles.rejectButton, busy && styles.disabled]}
                onPress={handleReject}
                disabled={busy}
              >
                <Text style={[styles.smallButtonText, styles.rejectText]}>Reject</Text>
              </Pressable>
            </View>
          </View>
        )}

        {panel === 'purchase' && (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Record purchase</Text>
            <Text style={styles.label}>Vendor</Text>
            <VendorPicker
              schoolId={schoolId}
              selectedId={vendorId}
              onSelect={(v) => {
                setVendorId(v.id);
                setVendorLabel(v.name);
              }}
            />
            {vendorLabel ? <Text style={styles.selectedHint}>Selected: {vendorLabel}</Text> : null}
            <LabeledInput label="Invoice number" value={invoiceNumber} onChangeText={setInvoiceNumber} />
            <LabeledInput
              label="Actual amount"
              value={actualAmount}
              onChangeText={setActualAmount}
              keyboardType="numeric"
            />
            <Pressable
              style={[styles.submit, (!vendorId || !invoiceNumber || !actualAmount || busy) && styles.disabled]}
              onPress={handlePurchase}
              disabled={!vendorId || !invoiceNumber || !actualAmount || busy}
            >
              <Text style={styles.submitText}>{busy ? 'Recording…' : 'Record purchase'}</Text>
            </Pressable>
          </View>
        )}

        {panel === 'pay' && (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Mark as paid</Text>
            <LabeledInput
              label="Payment method"
              value={paymentMethod}
              onChangeText={setPaymentMethod}
              placeholder="CASH / UPI / BANK_TRANSFER"
            />
            <LabeledInput
              label="Payment reference (optional)"
              value={paymentReference}
              onChangeText={setPaymentReference}
            />
            <DatePickerField label="Transaction date" value={transactionDate} onChange={setTransactionDate} />
            <Pressable
              style={[styles.submit, (!paymentMethod || busy) && styles.disabled]}
              onPress={handlePay}
              disabled={!paymentMethod || busy}
            >
              <Text style={styles.submitText}>{busy ? 'Paying…' : 'Pay'}</Text>
            </Pressable>
          </View>
        )}
      </ScreenContainer>
    </View>
  );
}

const accentColor = colors.primary;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  statusRow: { marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...softShadow,
  },
  field: { marginBottom: spacing.md },
  fieldLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '700' },
  fieldValue: { fontSize: 16, color: colors.textPrimary, marginTop: 2 },
  error: { color: colors.error, marginBottom: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  actionButton: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  actionText: { color: accentColor, fontWeight: '700', fontSize: 13 },
  panel: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...softShadow,
  },
  panelTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md },
  panelRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  smallButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  smallButtonText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  rejectButton: { backgroundColor: '#FFEBEE' },
  rejectText: { color: colors.error },
  disabled: { opacity: 0.5 },
  label: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.sm },
  selectedHint: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.sm },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
    ...softShadow,
  },
  submitText: { color: colors.white, fontWeight: '700' },
});
