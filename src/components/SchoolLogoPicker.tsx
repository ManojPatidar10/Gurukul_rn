import * as ImagePicker from 'expo-image-picker';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PickedLogo } from '../api/schoolLogo';
import { useToast } from '../context/ToastContext';
import { colors, radius, spacing } from '../theme/colors';
import { validateLogo } from '../utils/reportCardPdfName';

interface Props {
  /** Local pick (not yet uploaded) or the school's current logo URL, for the preview. */
  previewUri: string | null;
  onPicked: (logo: PickedLogo) => void;
  disabled?: boolean;
}

/** Image picker for the school logo (PNG/JPEG, max 2 MB) with a preview - shared by registration and settings. */
export function SchoolLogoPicker({ previewUri, onPicked, disabled }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const handlePick = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast(t('schoolLogo.permission'), 'error');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const contentType = asset.mimeType ?? (asset.uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
    const error = validateLogo(contentType, asset.fileSize);
    if (error) {
      showToast(t(error), 'error');
      return;
    }
    onPicked({ uri: asset.uri, contentType, sizeBytes: asset.fileSize ?? 0 });
  };

  return (
    <View style={styles.row}>
      <View style={styles.preview}>
        {previewUri ? (
          <Image source={{ uri: previewUri }} style={styles.image} resizeMode="contain" />
        ) : (
          <Text style={styles.placeholder}>{t('schoolLogo.none')}</Text>
        )}
      </View>
      <Pressable style={[styles.button, disabled && styles.disabled]} onPress={handlePick} disabled={disabled}>
        <Text style={styles.buttonText}>{previewUri ? t('schoolLogo.change') : t('schoolLogo.choose')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  preview: {
    width: 88,
    height: 88,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { width: 84, height: 84 },
  placeholder: { fontSize: 11, color: colors.textMuted, textAlign: 'center', padding: spacing.xs },
  button: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonText: { color: colors.primary, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
