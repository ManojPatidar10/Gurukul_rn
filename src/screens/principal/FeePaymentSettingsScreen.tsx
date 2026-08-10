import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getSchool, updateSchool } from '../../api/schools';
import type { School } from '../../api/types';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { isValidBankAccount, isValidIfsc, isValidUpiId } from '../../utils/validators';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'FeePaymentSettings'>;

export function FeePaymentSettingsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { showToast } = useToast();
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [bankAccountHolderName, setBankAccountHolderName] = useState('');
  const [upiVpaOverride, setUpiVpaOverride] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSchool(schoolId)
      .then((s) => {
        setSchool(s);
        setBankAccountNumber(s.bankAccountNumber ?? '');
        setBankIfsc(s.bankIfsc ?? '');
        setBankAccountHolderName(s.bankAccountHolderName ?? s.name);
        setUpiVpaOverride(s.upiVpaOverride ?? '');
      })
      .catch((e) => showToast((e as Error).message, 'error'))
      .finally(() => setLoading(false));
  }, [schoolId]);

  const handleSave = async () => {
    if (!school) return;
    if (!isValidBankAccount(bankAccountNumber)) {
      showToast(t('fees.paymentSettings.errors.bankAccountNumber'), 'error');
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
    setSaving(true);
    try {
      const updated = await updateSchool(schoolId, {
        name: school.name,
        address: school.address,
        city: school.city,
        state: school.state,
        pincode: school.pincode,
        contactEmail: school.contactEmail,
        contactPhone: school.contactPhone,
        principalName: school.principalName,
        directorName: school.directorName,
        bankAccountNumber: bankAccountNumber.trim(),
        bankIfsc: bankIfsc.trim().toUpperCase(),
        bankAccountHolderName: bankAccountHolderName.trim() || school.name,
        upiVpaOverride: upiVpaOverride.trim() || undefined,
      });
      setSchool(updated);
      showToast(t('fees.paymentSettings.saved'), 'success');
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.root}>
        <ScreenHeader title={t('fees.paymentSettings.title')} onBack={() => navigation.goBack()} />
        <ActivityIndicator style={styles.loading} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('fees.paymentSettings.title')} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <Text style={styles.hint}>{t('fees.paymentSettings.hint')}</Text>
        <LabeledInput
          label={t('fees.paymentSettings.bankAccountNumber')}
          required
          value={bankAccountNumber}
          onChangeText={setBankAccountNumber}
          keyboardType="numeric"
          placeholder="123456789012"
        />
        <LabeledInput
          label={t('fees.paymentSettings.bankIfsc')}
          required
          value={bankIfsc}
          onChangeText={setBankIfsc}
          autoCapitalize="characters"
          placeholder="SBIN0001234"
        />
        <LabeledInput
          label={t('fees.paymentSettings.bankAccountHolderName')}
          value={bankAccountHolderName}
          onChangeText={setBankAccountHolderName}
          placeholder={school?.name}
        />
        <Text style={styles.sectionHint}>{t('fees.paymentSettings.upiVpaOverrideHint')}</Text>
        <LabeledInput
          label={t('fees.paymentSettings.upiVpaOverride')}
          value={upiVpaOverride}
          onChangeText={setUpiVpaOverride}
          autoCapitalize="none"
          placeholder="yourname@oksbi"
        />
        <Pressable style={[styles.save, saving && styles.saveDisabled]} onPress={handleSave} disabled={saving}>
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
