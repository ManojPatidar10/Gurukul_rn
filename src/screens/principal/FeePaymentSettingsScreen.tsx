import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getSchool, updateSchool } from '../../api/schools';
import type { School } from '../../api/types';
import { ErrorNotice } from '../../components/ErrorNotice';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { paymentSettingsConfirmText } from '../../utils/feeBills';
import { isValidBankAccount, isValidIfsc, isValidUpiId } from '../../utils/validators';
import { getErrorMessage } from '../../api/errorMessage';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'FeePaymentSettings'>;

/**
 * The school's fee bank account and UPI ID. Save stays off until the school's current settings
 * have loaded (saving over a failed load would wipe them), the account number has to be typed
 * twice, and Save asks first, naming the account and UPI ID it's about to store.
 */
export function FeePaymentSettingsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { showToast } = useToast();
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [bankAccountHolderName, setBankAccountHolderName] = useState('');
  const [upiVpaOverride, setUpiVpaOverride] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    getSchool(schoolId)
      .then((s) => {
        setSchool(s);
        setBankAccountNumber(s.bankAccountNumber ?? '');
        // The saved number counts as confirmed; changing it means typing the new one twice.
        setConfirmAccountNumber(s.bankAccountNumber ?? '');
        setBankIfsc(s.bankIfsc ?? '');
        // Not filled in with the school's name: that's only the placeholder (the server uses it when this is blank).
        setBankAccountHolderName(s.bankAccountHolderName ?? '');
        setUpiVpaOverride(s.upiVpaOverride ?? '');
      })
      .catch((e) => setLoadError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [schoolId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (current: School) => {
    setSaving(true);
    try {
      const updated = await updateSchool(schoolId, {
        name: current.name,
        address: current.address,
        city: current.city,
        state: current.state,
        pincode: current.pincode,
        contactEmail: current.contactEmail,
        contactPhone: current.contactPhone,
        principalName: current.principalName,
        directorName: current.directorName,
        bankAccountNumber: bankAccountNumber.trim(),
        bankIfsc: bankIfsc.trim().toUpperCase(),
        bankAccountHolderName: bankAccountHolderName.trim(),
        upiVpaOverride: upiVpaOverride.trim() || undefined,
      });
      setSchool(updated);
      showToast(t('fees.paymentSettings.saved'), 'success');
    } catch (e) {
      showToast(getErrorMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (!school) return;
    if (!isValidBankAccount(bankAccountNumber)) {
      showToast(t('fees.paymentSettings.errors.bankAccountNumber'), 'error');
      return;
    }
    if (confirmAccountNumber.trim() !== bankAccountNumber.trim()) {
      showToast(t('fees.paymentSettings.errors.confirmAccountNumber'), 'error');
      return;
    }
    if (!isValidIfsc(bankIfsc)) {
      showToast(t('fees.paymentSettings.errors.bankIfsc'), 'error');
      return;
    }
    if (upiVpaOverride.trim() && !isValidUpiId(upiVpaOverride)) {
      showToast(t('fees.paymentSettings.errors.upiVpaOverride'), 'error');
      return;
    }
    Alert.alert(t('fees.paymentSettings.confirmTitle'), paymentSettingsConfirmText(bankAccountNumber, upiVpaOverride, t), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.save'), onPress: () => save(school) },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.root}>
        <ScreenHeader title={t('fees.paymentSettings.title')} onBack={() => navigation.goBack()} />
        <ActivityIndicator style={styles.loading} />
      </View>
    );
  }

  const accountMismatch = confirmAccountNumber.trim() !== '' && confirmAccountNumber.trim() !== bankAccountNumber.trim();
  const upiId = upiVpaOverride.trim();

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('fees.paymentSettings.title')} onBack={() => navigation.goBack()} />
      <ScreenContainer keyboardShouldPersistTaps="handled">
        {loadError && (
          <>
            <ErrorNotice message={`${t('fees.paymentSettings.loadError')} ${loadError}`} />
            <Pressable style={styles.retry} onPress={load} accessibilityRole="button">
              <Text style={styles.retryText}>{t('common.retry')}</Text>
            </Pressable>
          </>
        )}
        <Text style={styles.hint}>{t('fees.paymentSettings.hint')}</Text>
        <LabeledInput
          label={t('fees.paymentSettings.bankAccountNumber')}
          required
          value={bankAccountNumber}
          onChangeText={setBankAccountNumber}
          keyboardType="numeric"
          placeholder="123456789012"
          editable={!!school}
        />
        <LabeledInput
          label={t('fees.paymentSettings.confirmAccountNumber')}
          required
          value={confirmAccountNumber}
          onChangeText={setConfirmAccountNumber}
          keyboardType="numeric"
          placeholder="123456789012"
          editable={!!school}
        />
        {accountMismatch && <Text style={styles.fieldError}>{t('fees.paymentSettings.errors.confirmAccountNumber')}</Text>}
        <LabeledInput
          label={t('fees.paymentSettings.bankIfsc')}
          required
          value={bankIfsc}
          onChangeText={setBankIfsc}
          autoCapitalize="characters"
          placeholder="SBIN0001234"
          editable={!!school}
        />
        <LabeledInput
          label={t('fees.paymentSettings.bankAccountHolderName')}
          value={bankAccountHolderName}
          onChangeText={setBankAccountHolderName}
          placeholder={school?.name}
          editable={!!school}
        />
        <Text style={styles.sectionHint}>{t('fees.paymentSettings.upiVpaOverrideHint')}</Text>
        {/* Only once the settings have loaded: after a failed load the blank field says nothing about them. */}
        {school && !upiId && (
          <Text style={styles.warning}>{t('fees.paymentSettings.upiVpaOverrideWarning')}</Text>
        )}
        <LabeledInput
          label={t('fees.paymentSettings.upiVpaOverride')}
          value={upiVpaOverride}
          onChangeText={setUpiVpaOverride}
          autoCapitalize="none"
          placeholder="yourname@oksbi"
          editable={!!school}
        />
        {school && upiId ? (
          <View style={styles.payee}>
            <Text style={styles.payeeText}>{t('fees.paymentSettings.payeePreview', { upiId })}</Text>
          </View>
        ) : null}
        <Pressable
          style={[styles.save, (saving || !school) && styles.saveDisabled]}
          onPress={handleSave}
          disabled={saving || !school}
        >
          <Text style={styles.saveText}>{saving ? t('common.saving') : t('common.save')}</Text>
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  hint: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.lg },
  sectionHint: { fontSize: 12, color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.xs, fontStyle: 'italic' },
  warning: { fontSize: 12.5, color: colors.warning, fontWeight: '600', marginBottom: spacing.sm },
  fieldError: { fontSize: 12.5, color: colors.error, marginTop: -spacing.sm, marginBottom: spacing.md },
  payee: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  payeeText: { fontSize: 13.5, fontWeight: '600', color: colors.textPrimary },
  retry: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  retryText: { color: colors.primary, fontWeight: '700' },
  save: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    ...softShadow,
  },
  saveDisabled: { opacity: 0.5 },
  saveText: { color: colors.white, fontWeight: '700' },
});
