import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getVendor, getVendorPayments } from '../../api/vendors';
import type { Vendor, VendorPayments } from '../../api/expenseTypes';
import { AvatarBadge } from '../../components/AvatarBadge';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';
import { actorLabel, formatExpenseDate, paymentCategoryLabel, paymentMethodLabel } from '../../utils/expenses';
import { formatInr } from '../../utils/money';
import { bankDetailsChangedRecently } from '../../utils/vendors';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'VendorDetail'>;

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value || '—'}</Text>
    </View>
  );
}

export function VendorDetailScreen({ route, navigation }: Props) {
  const { t, i18n } = useTranslation();
  const schoolId = useSchoolId();
  const { vendorId } = route.params;
  const [vendor, setVendor] = useState<Vendor | null>(route.params.vendor ?? null);
  const [loading, setLoading] = useState(!route.params.vendor);
  const [error, setError] = useState<string | null>(null);
  const [payments, setPayments] = useState<VendorPayments | null>(null);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);

  // Refetched on every focus, so coming back from Edit shows what was saved.
  const load = useCallback(() => {
    setError(null);
    setPaymentsError(null);
    return Promise.all([
      getVendor(schoolId, vendorId)
        .then(setVendor)
        .catch((e) => setError(getErrorMessage(e))),
      getVendorPayments(schoolId, vendorId)
        .then(setPayments)
        .catch((e) => setPaymentsError(getErrorMessage(e))),
    ]);
  }, [schoolId, vendorId]);

  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
    }, [load])
  );

  if (!vendor) {
    return (
      <View style={styles.root}>
        <ScreenHeader title={t('vendors.list.title')} onBack={() => navigation.goBack()} />
        <ScreenContainer>
          {loading ? (
            <ActivityIndicator style={styles.loader} color={colors.primary} />
          ) : (
            <>
              <ErrorNotice message={error ?? t('errors.generic')} />
              <Pressable style={styles.actionButton} onPress={() => load()} accessibilityRole="button">
                <Text style={styles.actionText}>{t('common.retry')}</Text>
              </Pressable>
            </>
          )}
        </ScreenContainer>
      </View>
    );
  }

  const locale = i18n.language;
  const changedAt = vendor.bankDetailsChangedAt ?? null;
  const changedBy = actorLabel(vendor.bankDetailsChangedByName, vendor.bankDetailsChangedBy);
  const changedRecently = bankDetailsChangedRecently(changedAt);

  return (
    <View style={styles.root}>
      <ScreenHeader title={vendor.name} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <View style={styles.heroRow}>
          <AvatarBadge name={vendor.name} accentKey="vendors" size={56} />
          <Text style={styles.heroName}>{vendor.name}</Text>
        </View>

        {error && <ErrorNotice message={error} />}

        <View style={styles.card}>
          <Field label={t('vendors.detail.contactPhone')} value={vendor.contactPhone} />
          <Field label={t('vendors.detail.contactEmail')} value={vendor.contactEmail} />
          <Field label={t('vendors.detail.address')} value={vendor.address} />
          <Field label={t('vendors.detail.gstin')} value={vendor.gstin} />
          <Field label={t('vendors.detail.pan')} value={vendor.pan} />
        </View>

        <View style={styles.card}>
          <Field label={t('vendors.detail.accountHolderName')} value={vendor.accountHolderName} />
          <Field label={t('vendors.detail.bankAccount')} value={vendor.bankAccount} />
          <Field label={t('vendors.detail.ifsc')} value={vendor.ifsc} />
          <Field label={t('vendors.detail.upiId')} value={vendor.upiId} />
          {changedAt && (
            <View style={[styles.changed, changedRecently && styles.changedRecent]}>
              <Text style={[styles.changedText, changedRecently && styles.changedRecentText]}>
                {changedBy
                  ? t('vendors.detail.bankChanged', { date: formatExpenseDate(changedAt, locale), name: changedBy })
                  : t('vendors.detail.bankChangedNoName', { date: formatExpenseDate(changedAt, locale) })}
              </Text>
              {changedRecently && <Text style={styles.changedRecentText}>{t('vendors.detail.bankChangedRecent')}</Text>}
            </View>
          )}
        </View>

        <Pressable style={styles.actionButton} onPress={() => navigation.navigate('VendorForm', { vendor })} accessibilityRole="button">
          <Text style={styles.actionText}>{t('common.edit')}</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>{t('vendors.detail.paymentsTitle')}</Text>
        {paymentsError && <ErrorNotice message={t('vendors.detail.paymentsLoadError')} />}
        {payments && (
          <View style={styles.card}>
            <View style={styles.totalRow}>
              <View>
                <Text style={styles.fieldLabel}>{t('vendors.detail.totalPaid')}</Text>
                <Text style={styles.totalValue}>{formatInr(payments.totalPaid)}</Text>
              </View>
              <Text style={styles.count}>{t('vendors.detail.paymentCount', { count: payments.paymentCount })}</Text>
            </View>
            {payments.payments.length === 0 ? (
              <Text style={styles.empty}>{t('vendors.detail.paymentsEmpty')}</Text>
            ) : (
              payments.payments.map((p) => (
                <View key={`${p.source}-${p.transactionId}`} style={styles.paymentRow}>
                  <View style={styles.paymentMain}>
                    <Text style={styles.paymentTitle} numberOfLines={2}>
                      {p.description}
                    </Text>
                    <Text style={styles.paymentMeta}>
                      {[
                        formatExpenseDate(p.transactionDate, locale),
                        p.source === 'EVENT' && p.eventName
                          ? t('vendors.detail.eventLabel', { name: p.eventName })
                          : paymentCategoryLabel(p.categoryName, t),
                        p.invoiceNumber ? t('vendors.detail.invoice', { number: p.invoiceNumber }) : null,
                        paymentMethodLabel(p.paymentMethod, t),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  <Text style={styles.paymentAmount}>{formatInr(p.amount)}</Text>
                </View>
              ))
            )}
          </View>
        )}
        {!payments && !paymentsError && <ActivityIndicator style={styles.paymentsLoader} color={colors.primary} />}
      </ScreenContainer>
    </View>
  );
}

const accent = accents.vendors;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loader: { marginTop: 40 },
  heroRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  heroName: { flex: 1, fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginLeft: spacing.md },
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
  changed: { borderRadius: radius.md, padding: spacing.sm, backgroundColor: colors.surfaceMuted },
  changedRecent: { backgroundColor: '#FFF3E0' },
  changedText: { fontSize: 13, color: colors.textSecondary },
  changedRecentText: { fontSize: 13, color: colors.warning, fontWeight: '600' },
  actionButton: {
    backgroundColor: accent.light,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignSelf: 'flex-start',
    marginBottom: spacing.lg,
  },
  actionText: { color: accent.base, fontWeight: '700' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.sm },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: spacing.md },
  totalValue: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginTop: 2 },
  count: { fontSize: 13, color: colors.textMuted },
  empty: { color: colors.textMuted },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  paymentMain: { flex: 1 },
  paymentTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  paymentMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  paymentAmount: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  paymentsLoader: { marginVertical: spacing.md },
});
