import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { getSchool, updateSchoolLocation } from '../../api/schools';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'SchoolLocationSettings'>;

export function SchoolLocationSettingsScreen({ navigation }: Props) {
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
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [schoolId]);

  const handleUseCurrentLocation = async () => {
    setError(null);
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission is required to use your current location.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLatitude(String(position.coords.latitude));
      setLongitude(String(position.coords.longitude));
    } catch (e) {
      setError((e as Error).message);
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
    Number(radiusMeters) > 0;

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
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="School Location" subtitle="Geofence for self-attendance" onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <Text style={styles.description}>
          Teachers can self-mark today&apos;s attendance only when their device reports a location
          within this radius of the school. Outdoor GPS is typically accurate to 5-20m, so a
          radius under ~75m may produce false rejections.
        </Text>

        {loading && <ActivityIndicator style={styles.loading} color={colors.primary} />}
        {error && <Text style={styles.error}>{error}</Text>}
        {success && <Text style={styles.success}>School location updated.</Text>}

        {!loading && (
          <View style={styles.card}>
            <Pressable style={styles.locateButton} onPress={handleUseCurrentLocation} disabled={locating}>
              {locating ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={styles.locateButtonText}>📍 Use my current location</Text>
              )}
            </Pressable>

            <LabeledInput
              label="Latitude"
              value={latitude}
              onChangeText={setLatitude}
              keyboardType="numbers-and-punctuation"
              placeholder="e.g. 26.9124"
            />
            <LabeledInput
              label="Longitude"
              value={longitude}
              onChangeText={setLongitude}
              keyboardType="numbers-and-punctuation"
              placeholder="e.g. 75.7873"
            />
            <LabeledInput
              label="Geofence radius (meters)"
              value={radiusMeters}
              onChangeText={setRadiusMeters}
              keyboardType="numeric"
              placeholder="100"
            />

            <Pressable
              style={[styles.saveButton, (!canSave || saving) && styles.disabled]}
              onPress={handleSave}
              disabled={!canSave || saving}
            >
              {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveButtonText}>Save location</Text>}
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
