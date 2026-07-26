import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { registerSchool } from '../api/schools';
import { setStoredSchoolId } from '../api/schoolStorage';
import { ScreenContainer } from '../components/ScreenContainer';
import { ScreenHeader } from '../components/ScreenHeader';
import LabeledInput from '../components/LabeledInput';
import { colors, radius, softShadow, spacing } from '../theme/colors';
import type { Session } from '../api/authStorage';

interface Props {
  onBack?: () => void;
  onRegistered: (schoolId: string, session: Session) => void;
}

const emptyForm = {
  name: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  contactEmail: '',
  contactPhone: '',
  principalName: '',
  directorName: '',
  adminPhone: '',
};

export default function SchoolSetupScreen({ onBack, onRegistered }: Props) {
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const canSubmit = Object.values(form).every((v) => v.trim().length > 0);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const { school, admin } = await registerSchool(form);
      await setStoredSchoolId(school.id);
      onRegistered(school.id, admin);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Register your school" subtitle="One-time setup for this device" onBack={onBack} />
      <ScreenContainer>
        <Text style={styles.subtitle}>
          You'll be signed in as the school admin right after registering — your phone number below is used to
          sign in with an OTP afterwards.
        </Text>

        <LabeledInput label="School name" value={form.name} onChangeText={set('name')} />
        <LabeledInput label="Address" value={form.address} onChangeText={set('address')} />
        <LabeledInput label="City" value={form.city} onChangeText={set('city')} />
        <LabeledInput label="State" value={form.state} onChangeText={set('state')} />
        <LabeledInput
          label="Pincode"
          value={form.pincode}
          onChangeText={set('pincode')}
          keyboardType="number-pad"
        />
        <LabeledInput
          label="Contact email"
          value={form.contactEmail}
          onChangeText={set('contactEmail')}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <LabeledInput
          label="Contact phone"
          value={form.contactPhone}
          onChangeText={set('contactPhone')}
          keyboardType="phone-pad"
        />
        <LabeledInput label="Principal name" value={form.principalName} onChangeText={set('principalName')} />
        <LabeledInput label="Director name" value={form.directorName} onChangeText={set('directorName')} />
        <LabeledInput
          label="Your phone number (for admin login)"
          value={form.adminPhone}
          onChangeText={set('adminPhone')}
          keyboardType="phone-pad"
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.submit, (!canSubmit || submitting) && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          <Text style={styles.submitText}>{submitting ? 'Registering…' : 'Register school'}</Text>
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.lg },
  error: { color: colors.error, marginBottom: spacing.md },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    ...softShadow,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: colors.white, fontWeight: '700', fontSize: 16 },
});
