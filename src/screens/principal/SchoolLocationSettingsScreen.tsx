import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getSchool, updateSchoolLocation } from '../../api/schools';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'SchoolLocationSettings'>;

export function SchoolLocationSettingsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radiusMeters, setRadiusMeters] = useState('100');
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setLoading(true);
    getSchool(schoolId)
      .then((school) => {
        if (school.latitude != null) setLatitude(String(school.latitude));
        if (school.longitude != null) setLongitude(String(school.longitude));
        setRadiusMeters(String(school.geofenceRadiusMeters));
      })
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [schoolId]);

  const handleUseCurrentLocation = async () => {
    setError(null);
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError(t('schoolLocation.permissionDenied'));
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLatitude(String(position.coords.latitude));
      setLongitude(String(position.coords.longitude));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLocating(false);
    }
  };

  const canSave =
    latitude.trim() !== '' &&
    longitude.trim() !== '' &&
    radiusMeters.trim() !== '' &&
    !Number.isNaN(Number(latitude)) &&
    !Number.isNaN(Number(longitude)) &&
    Number(radiusMeters) > 0 &&
    Number(radiusMeters) <= 700;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await updateSchoolLocation(schoolId, {
        latitude: Number(latitude),
        longitude: Number(longitude),
        geofenceRadiusMeters: Math.round(Number(radiusMeters)),
      });
      setSuccess(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('dashboard.features.schoolLocation.title')}
        subtitle={t('schoolLocation.subtitle')}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        <Text style={styles.description}>{t('schoolLocation.description')}</Text>

        {loading && <ActivityIndicator style={styles.loading} color={colors.primary} />}
        {error && <ErrorNotice message={error} />}
        {success && <Text style={styles.success}>{t('schoolLocation.updated')}</Text>}

        {!loading && (
          <View style={styles.card}>
            <Pressable style={styles.locateButton} onPress={handleUseCurrentLocation} disabled={locating}>
              {locating ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={styles.locateButtonText}>{t('schoolSetup.useCurrentLocation')}</Text>
              )}
            </Pressable>

            <LabeledInput
              label={t('schoolLocation.latitude')}
              value={latitude}
              onChangeText={setLatitude}
              keyboardType="numbers-and-punctuation"
              placeholder={t('schoolLocation.latitudePlaceholder')}
            />
            <LabeledInput
              label={t('schoolLocation.longitude')}
              value={longitude}
              onChangeText={setLongitude}
              keyboardType="numbers-and-punctuation"
              placeholder={t('schoolLocation.longitudePlaceholder')}
            />
            <LabeledInput
              label={t('schoolLocation.radius')}
              value={radiusMeters}
              onChangeText={setRadiusMeters}
              keyboardType="numeric"
              placeholder={t('schoolLocation.radiusPlaceholder')}
            />

            <Pressable
              style={[styles.saveButton, (!canSave || saving) && styles.disabled]}
              onPress={handleSave}
              disabled={!canSave || saving}
            >
              {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveButtonText}>{t('schoolLocation.save')}</Text>}
            </Pressable>
          </View>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  description: { fontSize: 13, color: colors.textMuted, lineHeight: 19, marginBottom: spacing.lg },
  loading: { marginTop: spacing.xl },
  error: { color: colors.error, marginBottom: spacing.md },
  success: { color: colors.success, marginBottom: spacing.md, fontWeight: '600' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...softShadow,
  },
  locateButton: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  locateButtonText: { color: colors.primary, fontWeight: '700' },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    ...softShadow,
  },
  disabled: { opacity: 0.5 },
  saveButtonText: { color: colors.white, fontWeight: '700' },
});
