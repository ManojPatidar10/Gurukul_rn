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
import { isValidPhone, isValidPincode } from '../utils/validators';
import { getErrorMessage } from '../api/errorMessage';

interface Props {
  onBack?: () => void;
  onRegistered: (schoolId: string, session: Session) => void;
}

/**
 * The two-minute sign-up: the school (name, city, state, pincode), then the person registering it
 * (name, mobile). That mobile becomes the principal's OTP login and the app signs them straight in.
 * Logo, location, address and a second admin are checklist items on the home screen afterwards,
 * not questions here - the point is to get a school running before anyone has to think.
 */
export default function SchoolSetupScreen({ onBack, onRegistered }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [principalName, setPrincipalName] = useState('');
  const [principalPhone, setPrincipalPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  const schoolFilled = [name, city, state, pincode].every((v) => v.trim().length > 0);
  const youFilled = principalName.trim().length > 0 && principalPhone.trim().length > 0;

  const handleNext = () => {
    if (!isValidPincode(pincode)) {
      showToast(t('schoolSetup.errors.pincode'), 'error');
      return;
    }
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!isValidPhone(principalPhone)) {
      showToast(t('schoolSetup.errors.phone'), 'error');
      return;
    }
    setSubmitting(true);
    try {
      const { school, principal } = await registerSchool({
        name: name.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        principalName: principalName.trim(),
        principalPhone: principalPhone.trim(),
      });
      await setStoredSchoolId(school.id);
      onRegistered(school.id, principal);
    } catch (e) {
      showToast(getErrorMessage(e), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('schoolSetup.title')}
        subtitle={t('schoolSetup.stepOf', { step, total: 2 })}
        onBack={step === 2 ? () => setStep(1) : onBack}
      />
      <ScreenContainer>
        {step === 1 ? (
          <>
            <Text style={styles.stepTitle}>{t('schoolSetup.schoolStep.title')}</Text>
            <Text style={styles.subtitle}>{t('schoolSetup.schoolStep.intro')}</Text>
            <LabeledInput label={t('schoolSetup.schoolName')} required value={name} onChangeText={setName} autoFocus />
            <LabeledInput label={t('schoolSetup.city')} required value={city} onChangeText={setCity} />
            <LabeledInput label={t('schoolSetup.state')} required value={state} onChangeText={setState} />
            <LabeledInput
              label={t('schoolSetup.pincode')}
              required
              value={pincode}
              onChangeText={setPincode}
              keyboardType="number-pad"
              maxLength={6}
            />
            <Pressable
              style={[styles.submit, !schoolFilled && styles.submitDisabled]}
              onPress={handleNext}
              disabled={!schoolFilled}
              accessibilityRole="button"
            >
              <Text style={styles.submitText}>{t('schoolSetup.next')}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.stepTitle}>{t('schoolSetup.youStep.title')}</Text>
            <Text style={styles.subtitle}>{t('schoolSetup.youStep.intro')}</Text>
            <LabeledInput label={t('schoolSetup.principalName')} required value={principalName} onChangeText={setPrincipalName} autoFocus />
            <LabeledInput
              label={t('schoolSetup.principalPhone')}
              required
              value={principalPhone}
              onChangeText={setPrincipalPhone}
              keyboardType="phone-pad"
              maxLength={10}
            />
            <Text style={styles.hint}>{t('schoolSetup.youStep.phoneHint')}</Text>
            <Pressable
              style={[styles.submit, (!youFilled || submitting) && styles.submitDisabled]}
              onPress={handleSubmit}
              disabled={!youFilled || submitting}
              accessibilityRole="button"
            >
              <Text style={styles.submitText}>{submitting ? t('schoolSetup.submitting') : t('schoolSetup.submit')}</Text>
            </Pressable>
            <Text style={styles.hint}>{t('schoolSetup.youStep.afterwards')}</Text>
          </>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  stepTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.lg },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.sm },
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
