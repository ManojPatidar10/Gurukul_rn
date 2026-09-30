import * as Location from 'expo-location';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { setAuthSession } from '../api/client';
import { uploadSchoolLogo } from '../api/schoolLogo';
import type { PickedLogo } from '../api/schoolLogo';
import { registerSchool } from '../api/schools';
import { setStoredSchoolId } from '../api/schoolStorage';
import { ScreenContainer } from '../components/ScreenContainer';
import { ScreenHeader } from '../components/ScreenHeader';
import LabeledInput from '../components/LabeledInput';
import { SchoolLogoPicker } from '../components/SchoolLogoPicker';
import { useToast } from '../context/ToastContext';
import { colors, radius, softShadow, spacing } from '../theme/colors';
import type { Session } from '../api/authStorage';
import { isValidEmail, isValidPhone, isValidPincode } from '../utils/validators';
import { getErrorMessage } from '../api/errorMessage';

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
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radiusMeters, setRadiusMeters] = useState('');
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [logo, setLogo] = useState<PickedLogo | null>(null);
  const { showToast } = useToast();

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const canSubmit = Object.values(form).every((v) => v.trim().length > 0);

  const handleUseCurrentLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showToast(t('schoolSetup.locationPermissionDenied'), 'error');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLatitude(String(position.coords.latitude));
      setLongitude(String(position.coords.longitude));
    } catch (e) {
      showToast(getErrorMessage(e), 'error');
    } finally {
      setLocating(false);
    }
  };

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
    const lat = latitude.trim();
    const lng = longitude.trim();
    const hasLocation = lat !== '' || lng !== '';
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (hasLocation && (lat === '' || lng === '' || !Number.isFinite(latNum) || !Number.isFinite(lngNum)
        || Math.abs(latNum) > 90 || Math.abs(lngNum) > 180)) {
      showToast(t('schoolSetup.errors.location'), 'error');
      return;
    }
    const radiusText = radiusMeters.trim();
    const radiusNum = radiusText === '' ? 100 : Number(radiusText);
    if (hasLocation && (!Number.isInteger(radiusNum) || radiusNum < 25 || radiusNum > 700)) {
      showToast(t('schoolSetup.errors.radius'), 'error');
      return;
    }
    setSubmitting(true);
    try {
      const { school, admin } = await registerSchool({
        ...form,
        latitude: hasLocation ? latNum : undefined,
        longitude: hasLocation ? lngNum : undefined,
        geofenceRadiusMeters: hasLocation ? radiusNum : undefined,
      });
      await setStoredSchoolId(school.id);
      if (logo) {
        // The school exists now, so the logo goes up with the new admin's token. A failed upload
        // never undoes or blocks registration - it can be added later from the School Logo tile.
        setAuthSession(admin);
        try {
          await uploadSchoolLogo(school.id, logo);
        } catch (e) {
          showToast(t('schoolSetup.logoUploadFailed', { message: getErrorMessage(e) }), 'error');
        }
      }
      onRegistered(school.id, admin);
    } catch (e) {
      showToast(getErrorMessage(e), 'error');
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

        <Text style={styles.fieldLabel}>{t('schoolLogo.label')}</Text>
        <Text style={styles.sectionHint}>{t('schoolLogo.hint')}</Text>
        <SchoolLogoPicker previewUri={logo?.uri ?? null} onPicked={setLogo} disabled={submitting} />

        <Text style={styles.sectionHint}>{t('schoolSetup.locationHint')}</Text>
        <Pressable style={styles.locateButton} onPress={handleUseCurrentLocation} disabled={locating}>
          {locating ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.locateButtonText}>{t('schoolSetup.useCurrentLocation')}</Text>
          )}
        </Pressable>
        <LabeledInput
          label={t('schoolSetup.latitude')}
          value={latitude}
          onChangeText={setLatitude}
          keyboardType="numbers-and-punctuation"
          placeholder="e.g. 26.9124"
        />
        <LabeledInput
          label={t('schoolSetup.longitude')}
          value={longitude}
          onChangeText={setLongitude}
          keyboardType="numbers-and-punctuation"
          placeholder="e.g. 75.7873"
        />
        <LabeledInput
          label={t('schoolSetup.radius')}
          value={radiusMeters}
          onChangeText={setRadiusMeters}
          keyboardType="numeric"
          placeholder="100"
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
  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginTop: spacing.sm },
  sectionHint: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.xs, fontStyle: 'italic' },
  locateButton: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  locateButtonText: { color: colors.primary, fontWeight: '700' },
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
