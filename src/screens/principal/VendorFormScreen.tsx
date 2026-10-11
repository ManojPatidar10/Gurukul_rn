import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { useTranslation } from 'react-i18next';

import { createVendor, findSimilarVendors, updateVendor } from '../../api/vendors';
import type { VendorSimilar } from '../../api/expenseTypes';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';
import {
  firstVendorFormError,
  normalizeVendorField,
  VENDOR_MAX_LENGTHS,
  vendorFormErrors,
  vendorFormFrom,
  vendorRequestFrom,
  type VendorForm,
  type VendorFormField,
} from '../../utils/vendors';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'VendorForm'>;

/** Same-named vendors, or none when the check itself fails (an older server) - it never blocks saving. */
async function similarVendors(schoolId: string, name: string, excludeId?: string): Promise<VendorSimilar[]> {
  try {
    return await findSimilarVendors(schoolId, name, excludeId);
  } catch {
    return [];
  }
}

export function VendorFormScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const vendor = route.params?.vendor ?? null;
  const isEdit = !!vendor;
  const original = useMemo(() => (vendor ? vendorFormFrom(vendor) : null), [vendor]);

  const [form, setForm] = useState<VendorForm>(() => vendorFormFrom(vendor));
  // Field errors show once Save has been tapped, then follow the typing.
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  const errors = vendorFormErrors(form, original);
  const set = (key: VendorFormField) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    setSubmitting(true);
    try {
      const request = vendorRequestFrom(form, original);
      if (isEdit) {
        await updateVendor(schoolId, vendor!.id, request);
        // The detail screen underneath refetches on focus.
        navigation.goBack();
      } else {
        const created = await createVendor(schoolId, request);
        navigation.replace('VendorDetail', { vendorId: created.id, vendor: created });
      }
    } catch (e) {
      showToast(getErrorMessage(e), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    setAttempted(true);
    // The fields show their errors inline; the toast says why Save did nothing when they're off-screen.
    const firstError = firstVendorFormError(errors);
    if (firstError) {
      showToast(t(firstError), 'error');
      return;
    }

    // A vendor with the same name is a warning, never a block.
    const name = normalizeVendorField('name', form.name);
    const nameChanged = !original || name !== normalizeVendorField('name', original.name);
    if (nameChanged) {
      setSubmitting(true);
      const matches = await similarVendors(schoolId, name, vendor?.id);
      setSubmitting(false);
      if (matches.length > 0) {
        Alert.alert(t('vendors.similar.title'), t('vendors.similar.body', { name: matches[0].name }), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('vendors.similar.saveAnyway'), onPress: () => save() },
        ]);
        return;
      }
    }
    await save();
  };

  const input = (field: VendorFormField, label: string, props: TextInputProps & { required?: boolean } = {}) => (
    <View key={field}>
      <LabeledInput label={label} value={form[field]} onChangeText={set(field)} maxLength={VENDOR_MAX_LENGTHS[field]} {...props} />
      {attempted && errors[field] && <Text style={styles.fieldError}>{t(errors[field]!)}</Text>}
    </View>
  );

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={isEdit ? t('vendors.form.titleEdit') : t('vendors.form.titleCreate')}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        {input('name', t('vendors.form.name'), { required: true })}
        {input('contactPhone', t('vendors.form.contactPhone'), { keyboardType: 'phone-pad', maxLength: 10 })}
        {input('contactEmail', t('vendors.form.contactEmail'), { keyboardType: 'email-address', autoCapitalize: 'none' })}
        {input('address', t('vendors.form.address'))}
        {input('gstin', t('vendors.form.gstin'), { autoCapitalize: 'characters', placeholder: '08ABCDE1234F1Z5' })}
        {input('pan', t('vendors.form.pan'), { autoCapitalize: 'characters', placeholder: 'ABCDE1234F' })}
        {input('accountHolderName', t('vendors.form.accountHolderName'))}
        {input('bankAccount', t('vendors.form.bankAccount'), { keyboardType: 'number-pad', maxLength: 18 })}
        {input('ifsc', t('vendors.form.ifsc'), { autoCapitalize: 'characters', placeholder: 'SBIN0001234' })}
        {input('upiId', t('vendors.form.upiId'), { autoCapitalize: 'none', placeholder: 'name@bank' })}

        <Pressable
          style={[styles.submit, submitting && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityState={{ disabled: submitting, busy: submitting }}
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
  fieldError: { fontSize: 13, color: colors.error, marginTop: -spacing.xs, marginBottom: spacing.md },
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
