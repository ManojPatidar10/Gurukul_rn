import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { createVendor, updateVendor } from '../../api/vendors';
import type { VendorRequest } from '../../api/types';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'VendorForm'>;

export function VendorFormScreen({ route, navigation }: Props) {
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
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof VendorRequest) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const canSubmit = !!form.name;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const result = isEdit
        ? await updateVendor(schoolId, vendor!.id, form)
        : await createVendor(schoolId, form);
      navigation.replace('VendorDetail', { vendor: result });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={isEdit ? 'Edit vendor' : 'Add vendor'}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        <LabeledInput label="Name" value={form.name} onChangeText={set('name')} />
        <LabeledInput
          label="Contact phone"
          value={form.contactPhone}
          onChangeText={set('contactPhone')}
          keyboardType="phone-pad"
        />
        <LabeledInput
          label="Contact email"
          value={form.contactEmail}
          onChangeText={set('contactEmail')}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <LabeledInput label="Bank account" value={form.bankAccount} onChangeText={set('bankAccount')} />
        <LabeledInput label="UPI ID" value={form.upiId} onChangeText={set('upiId')} autoCapitalize="none" />
        <LabeledInput label="Address" value={form.address} onChangeText={set('address')} />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.submit, (!canSubmit || submitting) && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          <Text style={styles.submitText}>
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Add vendor'}
          </Text>
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  error: { color: colors.error, marginTop: spacing.md },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: colors.white, fontWeight: '700' },
});
