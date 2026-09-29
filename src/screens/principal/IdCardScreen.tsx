import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { downloadIdCardPdf, getIdCard, removeIdCardPhoto, updateIdCardDetails, uploadIdCardPhoto } from '../../api/idCards';
import type { IdCard } from '../../api/idCards';
import { IdCardView } from '../../components/IdCardView';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { usePdfDownload } from '../../hooks/usePdfDownload';
import { colors, radius, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { BLOOD_GROUPS, isValidPhone, missingLabelKey, validatePhoto } from '../../utils/idCard';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'IdCard'>;

/**
 * Digital ID card plus the details behind it. The person themselves (or a linked parent, for a
 * student) can add a photo, blood group and emergency contact here; everyone else who may see the
 * card (an admin) gets it read-only. The backend decides which via `canEdit`.
 */
export function IdCardScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { showToast } = useToast();
  const { kind, id, name } = route.params;
  const [card, setCard] = useState<IdCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bloodGroup, setBloodGroup] = useState<string | null>(null);
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const { busy: downloading, run } = usePdfDownload(t('idCard.shareTitle'));

  const apply = (next: IdCard) => {
    setCard(next);
    setBloodGroup(next.bloodGroup ?? null);
    setEmergencyName(next.emergencyContactName ?? '');
    setEmergencyPhone(next.emergencyPhone ?? '');
  };

  useEffect(() => {
    getIdCard(schoolId, kind, id)
      .then(apply)
      .catch((e) => setError((e as Error).message));
  }, [schoolId, kind, id]);

  const pickPhoto = async (source: 'camera' | 'library') => {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast(t('idCard.photo.permission'), 'error');
      return;
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [3, 4], quality: 0.7 };
    const result =
      source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const contentType = asset.mimeType ?? (asset.uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
    const invalid = validatePhoto(contentType, asset.fileSize);
    if (invalid) {
      showToast(t(invalid), 'error');
      return;
    }
    setPhotoBusy(true);
    try {
      apply(await uploadIdCardPhoto(schoolId, kind, id, { uri: asset.uri, contentType, sizeBytes: asset.fileSize ?? 0 }));
      showToast(t('idCard.photo.saved'), 'success');
    } catch (e) {
      showToast(t('idCard.photo.failed', { message: (e as Error).message }), 'error');
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async () => {
    setPhotoBusy(true);
    try {
      apply(await removeIdCardPhoto(schoolId, kind, id));
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setPhotoBusy(false);
    }
  };

  const save = async () => {
    if (!isValidPhone(emergencyPhone)) {
      showToast(t('idCard.errors.phone'), 'error');
      return;
    }
    setSaving(true);
    try {
      apply(
        await updateIdCardDetails(schoolId, kind, id, {
          bloodGroup,
          emergencyContactName: emergencyName.trim() || null,
          emergencyPhone: emergencyPhone.trim() || null,
        })
      );
      showToast(t('idCard.saved'), 'success');
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('idCard.title')} subtitle={card?.name ?? name} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        {error && <Text style={styles.error}>{error}</Text>}
        {!card && !error && <ActivityIndicator color={colors.primary} />}
        {card && (
          <>
            <IdCardView card={card} />

            <Pressable
              style={[styles.outlineButton, downloading && styles.disabled]}
              disabled={downloading}
              onPress={() => run(() => downloadIdCardPdf(schoolId, card))}
            >
              {downloading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={styles.outlineButtonText}>{t('idCard.download')}</Text>
              )}
            </Pressable>

            {card.missing.length > 0 && (
              <View style={styles.prompt}>
                <Text style={styles.promptTitle}>{t('idCard.completeProfile')}</Text>
                {card.missing.map((code) => (
                  <Text key={code} style={styles.promptItem}>
                    {'• '}
                    {t(missingLabelKey(code))}
                  </Text>
                ))}
              </View>
            )}

            {card.canEdit && (
              <View style={styles.form}>
                <Text style={styles.sectionTitle}>{t('idCard.detailsTitle')}</Text>

                <Text style={styles.label}>{t('idCard.photo.label')}</Text>
                <View style={styles.photoRow}>
                  <Pressable style={styles.chipButton} disabled={photoBusy} onPress={() => pickPhoto('camera')}>
                    <Text style={styles.chipButtonText}>{t('idCard.photo.take')}</Text>
                  </Pressable>
                  <Pressable style={styles.chipButton} disabled={photoBusy} onPress={() => pickPhoto('library')}>
                    <Text style={styles.chipButtonText}>{t('idCard.photo.choose')}</Text>
                  </Pressable>
                  {card.hasPhoto && (
                    <Pressable style={styles.chipButton} disabled={photoBusy} onPress={removePhoto}>
                      <Text style={[styles.chipButtonText, styles.danger]}>{t('idCard.photo.remove')}</Text>
                    </Pressable>
                  )}
                  {photoBusy && <ActivityIndicator color={colors.primary} />}
                </View>
                <Text style={styles.hint}>{t('idCard.photo.hint')}</Text>

                <Text style={styles.label}>{t('idCard.fields.bloodGroup')}</Text>
                <View style={styles.chips}>
                  {BLOOD_GROUPS.map((group) => (
                    <Pressable
                      key={group}
                      style={[styles.chip, bloodGroup === group && styles.chipActive]}
                      onPress={() => setBloodGroup(bloodGroup === group ? null : group)}
                    >
                      <Text style={[styles.chipText, bloodGroup === group && styles.chipTextActive]}>{group}</Text>
                    </Pressable>
                  ))}
                </View>

                <LabeledInput label={t('idCard.fields.emergencyName')} value={emergencyName} onChangeText={setEmergencyName} />
                <LabeledInput
                  label={t('idCard.fields.emergencyPhone')}
                  value={emergencyPhone}
                  onChangeText={setEmergencyPhone}
                  keyboardType="phone-pad"
                />
                <Text style={styles.hint}>
                  {kind === 'STUDENT' ? t('idCard.emergencyHintStudent') : t('idCard.emergencyHintStaff')}
                </Text>

                <Pressable style={[styles.saveButton, saving && styles.disabled]} disabled={saving} onPress={save}>
                  {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveButtonText}>{t('idCard.save')}</Text>}
                </Pressable>
              </View>
            )}
          </>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  error: { color: colors.error, fontSize: 13 },
  disabled: { opacity: 0.6 },
  outlineButton: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginBottom: spacing.lg,
  },
  outlineButtonText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  prompt: {
    backgroundColor: '#FFF7E6',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#F5D48A',
  },
  promptTitle: { fontSize: 13, fontWeight: '800', color: colors.warning, marginBottom: spacing.xs },
  promptItem: { fontSize: 13, color: colors.textPrimary, marginTop: 2 },
  form: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.xl },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.md },
  label: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.sm, marginTop: spacing.sm },
  hint: { fontSize: 11, color: colors.textMuted, marginBottom: spacing.md },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center', marginBottom: spacing.xs },
  chipButton: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipButtonText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  danger: { color: colors.error },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    minWidth: 52,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  chipText: { fontWeight: '700', color: colors.textSecondary },
  chipTextActive: { color: colors.primary },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  saveButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
