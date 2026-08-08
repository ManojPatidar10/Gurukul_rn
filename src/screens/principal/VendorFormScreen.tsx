import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { createVendor, updateVendor } from '../../api/vendors';
import type { VendorRequest } from '../../api/types';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { isValidBankAccount, isValidEmail, isValidPhone, isValidUpiId } from '../../utils/validators';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'VendorForm'>;

export function VendorFormScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const vendor = route.params?.vendor ?? null;
  const isEdit = !!vendor;

  const [form, setForm] = useState<VendorRequest>({
    name: vendor?.name ?? '',
    contactPhone: vendor?.contactPhone ?? '',
    contactEmail: vendor?.contactEmail ?? '',
    bankAccount: vendor?.bankAccount ?? '',
    upiId: vendor?.upiId ?? '',
    address: vendor?.address ?? '',
  });
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  const set = (key: keyof VendorRequest) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const canSubmit = !!form.name;

  const handleSubmit = async () => {
    if (form.contactPhone && !isValidPhone(form.contactPhone)) {
      showToast(t('vendors.form.errors.contactPhone'), 'error');
      return;
    }
    if (form.contactEmail && !isValidEmail(form.contactEmail)) {
      showToast(t('vendors.form.errors.contactEmail'), 'error');
      return;
    }
    if (form.bankAccount && !isValidBankAccount(form.bankAccount)) {
      showToast(t('vendors.form.errors.bankAccount'), 'error');
      return;
    }
    if (form.upiId && !isValidUpiId(form.upiId)) {
      showToast(t('vendors.form.errors.upiId'), 'error');
      return;
    }
    setSubmitting(true);
    try {
      const result = isEdit
        ? await updateVendor(schoolId, vendor!.id, form)
        : await createVendor(schoolId, form);
      navigation.replace('VendorDetail', { vendor: result });
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={isEdit ? t('vendors.form.titleEdit') : t('vendors.form.titleCreate')}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        <LabeledInput label={t('vendors.form.name')} required value={form.name} onChangeText={set('name')} />
        <LabeledInput
          label={t('vendors.form.contactPhone')}
          value={form.contactPhone}
          onChangeText={set('contactPhone')}
          keyboardType="phone-pad"
          maxLength={10}
        />
        <LabeledInput
          label={t('vendors.form.contactEmail')}
          value={form.contactEmail}
          onChangeText={set('contactEmail')}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <LabeledInput label={t('vendors.form.bankAccount')} value={form.bankAccount} onChangeText={set('bankAccount')} keyboardType="number-pad" />
        <LabeledInput label={t('vendors.form.upiId')} value={form.upiId} onChangeText={set('upiId')} autoCapitalize="none" placeholder="name@bank" />
        <LabeledInput label={t('vendors.form.address')} value={form.address} onChangeText={set('address')} />

        <Pressable
          style={[styles.submit, (!canSubmit || submitting) && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          <Text style={styles.submitText}>
            {submitting ? t('common.saving') : isEdit ? t('common.saveChanges') : t('vendors.form.submitCreate')}
          </Text>
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    ...softShadow,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: colors.white, fontWeight: '700' },
});
