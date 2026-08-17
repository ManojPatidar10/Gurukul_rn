import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ApiError } from '../../api/client';
import { createTeacherResource, uploadTeacherResource, type PickedFile } from '../../api/teacherResources';
import type { TeacherResourceType } from '../../api/types';
import Dropdown from '../../components/Dropdown';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'ResourceUpload'>;

const accent = accents.teacherTools;

const RESOURCE_TYPES: TeacherResourceType[] = ['BOOK', 'NOTES', 'WORKSHEET', 'PRESENTATION', 'VIDEO', 'LINK', 'OTHER'];

export function ResourceUploadScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { showToast } = useToast();
  const { teacherId, teacherName, classSectionId, classSectionLabel } = route.params;

  const [subjectName, setSubjectName] = useState('');
  const [resourceType, setResourceType] = useState<TeacherResourceType>('NOTES');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [availableOffline, setAvailableOffline] = useState(false);
  const [resourceUrl, setResourceUrl] = useState('');
  const [pickedFile, setPickedFile] = useState<PickedFile | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isLink = resourceType === 'LINK';

  const handlePickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    setPickedFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'application/octet-stream' });
  };

  const validateCommon = () => {
    if (!subjectName.trim()) {
      showToast(t('teacherTools.upload.errors.subjectName'), 'error');
      return false;
    }
    if (!title.trim()) {
      showToast(t('teacherTools.upload.errors.title'), 'error');
      return false;
    }
    if (!description.trim()) {
      showToast(t('teacherTools.upload.errors.description'), 'error');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateCommon()) return;

    setSubmitting(true);
    try {
      if (isLink) {
        if (!resourceUrl.trim()) {
          showToast(t('teacherTools.upload.errors.resourceUrl'), 'error');
          return;
        }
        await createTeacherResource(schoolId, teacherId, {
          classSectionId,
          subjectName: subjectName.trim(),
          resourceType,
          title: title.trim(),
          description: description.trim(),
          resourceUrl: resourceUrl.trim(),
          availableOffline,
        });
      } else {
        if (!pickedFile) {
          showToast(t('teacherTools.upload.errors.file'), 'error');
          return;
        }
        await uploadTeacherResource(
          schoolId,
          teacherId,
          {
            classSectionId,
            subjectName: subjectName.trim(),
            resourceType,
            title: title.trim(),
            description: description.trim(),
            availableOffline,
          },
          pickedFile
        );
      }
      showToast(t('teacherTools.upload.success'), 'success');
      navigation.goBack();
    } catch (e) {
      const message = e instanceof ApiError ? e.message : (e as Error).message;
      showToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('teacherTools.upload.title')}
        subtitle={`${teacherName} · ${classSectionLabel}`}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        <LabeledInput label={t('teacherTools.upload.subjectName')} required value={subjectName} onChangeText={setSubjectName} />
        <Dropdown
          label={t('teacherTools.upload.resourceType')}
          required
          value={resourceType}
          onSelect={(v) => {
            setResourceType(v as TeacherResourceType);
            setPickedFile(null);
          }}
          options={RESOURCE_TYPES.map((v) => ({ value: v, label: t(`teacherTools.upload.resourceTypes.${v}`) }))}
        />
        <LabeledInput label={t('teacherTools.upload.resourceTitle')} required value={title} onChangeText={setTitle} />
        <LabeledInput
          label={t('teacherTools.upload.description')}
          required
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
        />

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t('teacherTools.upload.availableOffline')}</Text>
          <Switch
            value={availableOffline}
            onValueChange={setAvailableOffline}
            trackColor={{ false: colors.border, true: accent.base }}
          />
        </View>

        {isLink ? (
          <LabeledInput
            label={t('teacherTools.upload.resourceUrl')}
            required
            value={resourceUrl}
            onChangeText={setResourceUrl}
            autoCapitalize="none"
            keyboardType="url"
          />
        ) : (
          <View style={styles.fileSection}>
            <Pressable style={styles.pickButton} onPress={handlePickFile}>
              <Text style={styles.pickButtonText}>
                {pickedFile ? t('teacherTools.upload.changeFile') : t('teacherTools.upload.pickFile')}
              </Text>
            </Pressable>
            <Text style={styles.fileName}>{pickedFile ? pickedFile.name : t('teacherTools.upload.noFileSelected')}</Text>
          </View>
        )}

        <Pressable
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.submitButtonText}>
              {isLink ? t('teacherTools.upload.addLinkButton') : t('teacherTools.upload.uploadButton')}
            </Text>
          )}
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  switchLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  fileSection: { marginBottom: spacing.md },
  pickButton: {
    borderWidth: 1.5,
    borderColor: accent.base,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignSelf: 'flex-start',
    marginBottom: spacing.xs,
  },
  pickButtonText: { color: accent.base, fontWeight: '700', fontSize: 14 },
  fileName: { color: colors.textMuted, fontSize: 13 },
  submitButton: {
    backgroundColor: accent.base,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    ...softShadow,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
