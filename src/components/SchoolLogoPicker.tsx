import * as ImagePicker from 'expo-image-picker';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PickedLogo } from '../api/schoolLogo';
import { getErrorMessage } from '../api/errorMessage';
import { useToast } from '../context/ToastContext';
import { colors, radius, spacing } from '../theme/colors';
import { prepareImageForUpload } from '../utils/prepareImage';
import { validateLogo } from '../utils/reportCardPdfName';

interface Props {
  /** Local pick (not yet uploaded) or the school's current logo URL, for the preview. */
  previewUri: string | null;
  onPicked: (logo: PickedLogo) => void;
  disabled?: boolean;
}

/**
 * Image picker for the school logo with a preview - shared by registration and settings. Any image
 * works: it's resized and saved as PNG (if it was one, keeping transparency) or JPEG before upload.
 */
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
    let logo;
    try {
      logo = await prepareImageForUpload(asset.uri, { maxDimension: 1024, keepPng: true, sourceContentType: asset.mimeType });
    } catch (e) {
      showToast(getErrorMessage(e), 'error');
      return;
    }
    const error = validateLogo(logo.contentType, logo.sizeBytes);
    if (error) {
      showToast(t(error), 'error');
      return;
    }
    onPicked(logo);
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
