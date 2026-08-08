import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { registerSchool } from '../api/schools';
import { setStoredSchoolId } from '../api/schoolStorage';
import { ScreenContainer } from '../components/ScreenContainer';
import { ScreenHeader } from '../components/ScreenHeader';
import LabeledInput from '../components/LabeledInput';
import { useToast } from '../context/ToastContext';
import { colors, radius, softShadow, spacing } from '../theme/colors';
import type { Session } from '../api/authStorage';
import { isValidEmail, isValidPhone, isValidPincode } from '../utils/validators';

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
  principalPhone: '',
  directorName: '',
  adminPhone: '',
};

export default function SchoolSetupScreen({ onBack, onRegistered }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const canSubmit = Object.values(form).every((v) => v.trim().length > 0);

  const handleSubmit = async () => {
    if (!isValidPincode(form.pincode)) {
      showToast(t('schoolSetup.errors.pincode'), 'error');
      return;
    }
    if (!isValidEmail(form.contactEmail)) {
      showToast(t('schoolSetup.errors.email'), 'error');
      return;
    }
    if (!isValidPhone(form.contactPhone)) {
      showToast(t('schoolSetup.errors.phone'), 'error');
      return;
    }
    setSubmitting(true);
    try {
      const { school, admin } = await registerSchool(form);
      await setStoredSchoolId(school.id);
      onRegistered(school.id, admin);
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('schoolSetup.title')} subtitle={t('schoolSetup.subtitle')} onBack={onBack} />
      <ScreenContainer>
        <Text style={styles.subtitle}>{t('schoolSetup.intro')}</Text>

        <LabeledInput label={t('schoolSetup.schoolName')} required value={form.name} onChangeText={set('name')} />
        <LabeledInput label={t('schoolSetup.address')} required value={form.address} onChangeText={set('address')} />
        <LabeledInput label={t('schoolSetup.city')} required value={form.city} onChangeText={set('city')} />
        <LabeledInput label={t('schoolSetup.state')} required value={form.state} onChangeText={set('state')} />
        <LabeledInput
          label={t('schoolSetup.pincode')}
          required
          value={form.pincode}
          onChangeText={set('pincode')}
          keyboardType="number-pad"
          maxLength={6}
        />
        <LabeledInput
          label={t('schoolSetup.contactEmail')}
          required
          value={form.contactEmail}
          onChangeText={set('contactEmail')}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <LabeledInput
          label={t('schoolSetup.contactPhone')}
          required
          value={form.contactPhone}
          onChangeText={set('contactPhone')}
          keyboardType="phone-pad"
          maxLength={10}
        />
        <LabeledInput label={t('schoolSetup.principalName')} required value={form.principalName} onChangeText={set('principalName')} />
        <LabeledInput
          label={t('schoolSetup.principalPhone')}
          required
          value={form.principalPhone}
          onChangeText={set('principalPhone')}
          keyboardType="phone-pad"
          maxLength={10}
        />
        <LabeledInput label={t('schoolSetup.directorName')} required value={form.directorName} onChangeText={set('directorName')} />
        <LabeledInput
          label={t('schoolSetup.adminPhone')}
          required
          value={form.adminPhone}
          onChangeText={set('adminPhone')}
          keyboardType="phone-pad"
          maxLength={10}
        />

        <Pressable
          style={[styles.submit, (!canSubmit || submitting) && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          <Text style={styles.submitText}>{submitting ? t('schoolSetup.submitting') : t('schoolSetup.submit')}</Text>
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.lg },
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
