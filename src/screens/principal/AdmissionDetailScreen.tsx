import { FontAwesome5 } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  changeAdmissionStage,
  convertAdmission,
  deleteAdmission,
  deleteAdmissionDocument,
  getAdmission,
  presignAdmissionDocument,
  registerAdmissionDocument,
} from '../../api/admissions';
import { listSectionsByClass } from '../../api/classSections';
import { ApiError } from '../../api/client';
import { getStudent } from '../../api/students';
import type {
  Admission,
  AdmissionDocumentType,
  AdmissionStage,
  ClassSection,
  ConvertAdmissionResponse,
} from '../../api/types';
import { DatePickerField, parseIsoDate, toIsoDate } from '../../components/DatePickerField';
import Dropdown from '../../components/Dropdown';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { canEdit, canEnrol, nextStages, stageVariant, transitionLabelKey } from '../../utils/admissionStages';
import { getErrorMessage } from '../../api/errorMessage';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'AdmissionDetail'>;

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

const DOCUMENT_TYPES: AdmissionDocumentType[] = [
  'BIRTH_CERTIFICATE',
  'TRANSFER_CERTIFICATE',
  'PREVIOUS_MARKSHEET',
  'AADHAAR',
  'PHOTO',
  'OTHER',
];

async function uploadToPresignedUrl(uploadUrl: string, uri: string, contentType: string) {
  const file = await fetch(uri);
  const blob = await file.blob();
  const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: blob });
  if (!put.ok) throw new Error('Upload failed');
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value || '—'}</Text>
    </View>
  );
}

/** Admin-only: review an application, move it through the stages, attach documents, and enrol it. */
export function AdmissionDetailScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { showToast } = useToast();
  const { admissionId } = route.params;

  const [admission, setAdmission] = useState<Admission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [documentType, setDocumentType] = useState<AdmissionDocumentType>('BIRTH_CERTIFICATE');
  const [uploading, setUploading] = useState(false);

  const [sections, setSections] = useState<ClassSection[]>([]);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [admissionDate, setAdmissionDate] = useState(toIsoDate(new Date()));
  const [sendInvite, setSendInvite] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [enrolResult, setEnrolResult] = useState<ConvertAdmissionResponse | null>(null);

  const load = useCallback(() => {
    setError(null);
    return getAdmission(schoolId, admissionId)
      .then(setAdmission)
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [schoolId, admissionId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    load();
    return unsubscribe;
  }, [navigation, load]);

  const appliedClassName = admission?.appliedClassName;
  const stage = admission?.stage;
  useEffect(() => {
    if (!appliedClassName || stage !== 'APPROVED') return;
    listSectionsByClass(schoolId, appliedClassName)
      .then((rows) => {
        setSections(rows);
        if (rows.length === 1) setSectionId(rows[0].id);
      })
      .catch(() => setSections([]));
  }, [schoolId, appliedClassName, stage]);

  const handleStage = async (target: AdmissionStage) => {
    if (!admission) return;
    setBusy(true);
    try {
      setAdmission(await changeAdmissionStage(schoolId, admission.id, target));
      showToast(t('admissions.detail.stageUpdated'), 'success');
    } catch (e) {
      showToast(getErrorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = () => {
    if (!admission) return;
    Alert.alert(t('admissions.detail.deleteConfirmTitle'), t('admissions.detail.deleteConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await deleteAdmission(schoolId, admission.id);
            showToast(t('admissions.detail.deleted'), 'success');
            navigation.goBack();
          } catch (e) {
            showToast(getErrorMessage(e), 'error');
            setBusy(false);
          }
        },
      },
    ]);
  };

  const upload = async (uri: string, fileName: string, contentType: string, fileSizeBytes: number) => {
    if (!admission) return;
    if (fileSizeBytes > MAX_DOCUMENT_BYTES) {
      showToast(t('admissions.documents.tooLarge'), 'error');
      return;
    }
    setUploading(true);
    try {
      const req = { documentType, fileName, contentType, fileSizeBytes };
      const presigned = await presignAdmissionDocument(schoolId, admission.id, req);
      await uploadToPresignedUrl(presigned.uploadUrl, uri, contentType);
      setAdmission(await registerAdmissionDocument(schoolId, admission.id, { ...req, objectKey: presigned.objectKey }));
      showToast(t('admissions.documents.uploaded'), 'success');
    } catch (e) {
      showToast(getErrorMessage(e), 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleAddPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast(t('admissions.documents.permission'), 'error');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await upload(asset.uri, asset.fileName ?? `photo-${Date.now()}.jpg`, asset.mimeType ?? 'image/jpeg', asset.fileSize ?? 0);
  };

  const handleAddPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await upload(asset.uri, asset.name, asset.mimeType ?? 'application/pdf', asset.size ?? 0);
  };

  const handleRemoveDocument = (documentId: string) => {
    if (!admission) return;
    Alert.alert(t('admissions.documents.removeConfirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.remove'),
        style: 'destructive',
        onPress: async () => {
          try {
            setAdmission(await deleteAdmissionDocument(schoolId, admission.id, documentId));
          } catch (e) {
            showToast(getErrorMessage(e), 'error');
          }
        },
      },
    ]);
  };

  const enrol = async (allowDuplicate: boolean) => {
    if (!admission || !sectionId) return;
    setEnrolling(true);
    try {
      const result = await convertAdmission(schoolId, admission.id, {
        classSectionId: sectionId,
        admissionDate,
        sendParentInvite: sendInvite,
        allowDuplicate,
      });
      setEnrolResult(result);
      setAdmission(result.application);
      showToast(
        result.alreadyEnrolled
          ? t('admissions.enrol.alreadyEnrolled')
          : t('admissions.enrol.success', {
              name: result.studentName ?? admission.studentName,
              section: result.classSectionLabel ?? '',
              roll: result.rollNumber ?? '—',
            }),
        'success'
      );
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        // Possible duplicate: the server refuses until the admin confirms it's a different child.
        Alert.alert(t('admissions.detail.duplicatesTitle'), getErrorMessage(e), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('admissions.enrol.duplicateConfirm'), style: 'destructive', onPress: () => enrol(true) },
        ]);
      } else {
        showToast(getErrorMessage(e), 'error');
      }
    } finally {
      setEnrolling(false);
    }
  };

  const openStudent = async (studentId: string) => {
    try {
      const student = await getStudent(schoolId, studentId);
      navigation.navigate('StudentDetail', { student });
    } catch (e) {
      showToast(getErrorMessage(e), 'error');
    }
  };

  if (loading && !admission) {
    return (
      <View style={styles.root}>
        <ScreenHeader title={t('admissions.detail.title')} onBack={() => navigation.goBack()} />
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      </View>
    );
  }

  if (!admission) {
    return (
      <View style={styles.root}>
        <ScreenHeader title={t('admissions.detail.title')} onBack={() => navigation.goBack()} />
        <Text style={styles.error}>{error ?? t('admissions.loadError')}</Text>
      </View>
    );
  }

  const duplicates = admission.possibleDuplicates ?? [];
  const documents = admission.documents ?? [];
  const uploadsEnabled = admission.documentUploadsEnabled !== false;
  const editable = canEdit(admission.stage);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={admission.studentName}
        subtitle={t('admissions.appliedFor', { className: admission.appliedClassName })}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        <View style={styles.stageRow}>
          <StatusChip label={t(`admissions.stages.${admission.stage}`)} variant={stageVariant(admission.stage)} />
          {editable && (
            <View style={styles.inlineActions}>
              <Pressable onPress={() => navigation.navigate('NewAdmission', { admission })} disabled={busy} hitSlop={8}>
                <Text style={styles.link}>{t('common.edit')}</Text>
              </Pressable>
              <Pressable onPress={handleDelete} disabled={busy} hitSlop={8}>
                <Text style={[styles.link, styles.linkDanger]}>{t('common.delete')}</Text>
              </Pressable>
            </View>
          )}
        </View>

        {duplicates.length > 0 && (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>{t('admissions.detail.duplicatesTitle')}</Text>
            <Text style={styles.warningBody}>{t('admissions.detail.duplicatesBody')}</Text>
            {duplicates.map((d) => (
              <Pressable key={d.id} onPress={() => openStudent(d.id)}>
                <Text style={styles.link}>
                  {d.name} · {d.classSectionLabel}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {nextStages(admission.stage).length > 0 && (
          <View style={styles.actionsRow}>
            {nextStages(admission.stage).map((target) => (
              <Pressable
                key={target}
                style={[styles.actionButton, target === 'REJECTED' && styles.actionButtonDanger, busy && styles.disabled]}
                onPress={() => handleStage(target)}
                disabled={busy}
              >
                <Text style={[styles.actionText, target === 'REJECTED' && styles.actionTextDanger]}>
                  {t(transitionLabelKey(admission.stage, target))}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('admissions.detail.student')}</Text>
          <Field label={t('admissions.form.dob')} value={admission.dob} />
          <Field label={t('admissions.form.gender')} value={admission.gender} />
          <Field label={t('admissions.form.address')} value={admission.address} />
          <Field label={t('admissions.form.previousSchool')} value={admission.previousSchoolName} />
          <Field label={t('admissions.form.appliedClass')} value={admission.appliedClassName} />
          <Field label={t('admissions.form.notes')} value={admission.notes} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('admissions.detail.parent')}</Text>
          <Field label={t('admissions.form.parentName')} value={admission.parentName} />
          <Field label={t('admissions.form.parentContact')} value={admission.parentContact} />
          <Field label={t('admissions.form.parentEmail')} value={admission.parentEmail} />
          <Field label={t('admissions.detail.received')} value={new Date(admission.createdAt).toLocaleDateString()} />
          {admission.decidedAt && (
            <Field label={t('admissions.detail.decided')} value={new Date(admission.decidedAt).toLocaleDateString()} />
          )}
          {admission.enrolledAt && (
            <Field label={t('admissions.detail.enrolledOn')} value={new Date(admission.enrolledAt).toLocaleDateString()} />
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('admissions.documents.title')}</Text>
          {documents.length === 0 && <Text style={styles.muted}>{t('admissions.documents.none')}</Text>}
          {documents.map((doc) => (
            <View key={doc.id} style={styles.docRow}>
              <FontAwesome5 name={doc.contentType.startsWith('image/') ? 'file-image' : 'file-pdf'} size={16} color={colors.primary} />
              <View style={styles.docMain}>
                <Text style={styles.docTitle}>{t(`admissions.documents.types.${doc.documentType}`)}</Text>
                <Text style={styles.muted} numberOfLines={1}>
                  {doc.fileName}
                </Text>
              </View>
              {doc.downloadUrl && (
                <Pressable onPress={() => Linking.openURL(doc.downloadUrl!)} hitSlop={8}>
                  <Text style={styles.link}>{t('admissions.documents.open')}</Text>
                </Pressable>
              )}
              {editable && (
                <Pressable onPress={() => handleRemoveDocument(doc.id)} hitSlop={8}>
                  <FontAwesome5 name="trash-alt" size={14} color={colors.error} />
                </Pressable>
              )}
            </View>
          ))}
          {editable &&
            (uploadsEnabled ? (
              <>
                <Dropdown
                  label={t('admissions.documents.typeLabel')}
                  value={documentType}
                  options={DOCUMENT_TYPES.map((type) => ({ label: t(`admissions.documents.types.${type}`), value: type }))}
                  onSelect={(value) => setDocumentType(value as AdmissionDocumentType)}
                />
                {uploading ? (
                  <Text style={styles.muted}>{t('admissions.documents.uploading')}</Text>
                ) : (
                  <View style={styles.actionsRow}>
                    <Pressable style={styles.actionButton} onPress={handleAddPhoto}>
                      <Text style={styles.actionText}>{t('admissions.documents.addPhoto')}</Text>
                    </Pressable>
                    <Pressable style={styles.actionButton} onPress={handleAddPdf}>
                      <Text style={styles.actionText}>{t('admissions.documents.addFile')}</Text>
                    </Pressable>
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.muted}>{t('admissions.documents.notConfigured')}</Text>
            ))}
        </View>

        {canEnrol(admission.stage) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('admissions.enrol.title')}</Text>
            <Text style={styles.fieldLabel}>{t('admissions.enrol.sectionLabel')} *</Text>
            {sections.length === 0 ? (
              <Text style={styles.warningBody}>{t('admissions.enrol.noSections', { className: admission.appliedClassName })}</Text>
            ) : (
              <>
                <View style={styles.sectionChips}>
                  {sections.map((cs) => {
                    const selected = cs.id === sectionId;
                    return (
                      <Pressable
                        key={cs.id}
                        style={[styles.sectionChip, selected && styles.sectionChipSelected]}
                        onPress={() => setSectionId(cs.id)}
                        accessibilityState={{ selected }}
                      >
                        <Text style={[styles.sectionChipText, selected && styles.sectionChipTextSelected]}>
                          {cs.section} · {cs.academicYear}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.muted}>{t('admissions.enrol.sectionHint', { className: admission.appliedClassName })}</Text>
              </>
            )}
            <DatePickerField
              label={t('admissions.enrol.admissionDate')}
              value={admissionDate}
              onChange={setAdmissionDate}
              minimumDate={parseIsoDate(admission.dob)}
              maximumDate={new Date()}
            />
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>{t('admissions.enrol.sendInvite')}</Text>
              <Switch value={sendInvite} onValueChange={setSendInvite} />
            </View>
            <Text style={styles.muted}>{t('admissions.enrol.rollNumberNote')}</Text>
            <Text style={styles.muted}>{t('admissions.enrol.feeNote')}</Text>
            <Pressable
              style={[styles.submit, (!sectionId || enrolling) && styles.disabled]}
              onPress={() => enrol(false)}
              disabled={!sectionId || enrolling}
            >
              <Text style={styles.submitText}>{enrolling ? t('admissions.enrol.submitting') : t('admissions.enrol.submit')}</Text>
            </Pressable>
          </View>
        )}

        {admission.stage === 'ENROLLED' && (
          <View style={styles.card}>
            {enrolResult && (
              <Text style={styles.successText}>
                {enrolResult.alreadyEnrolled
                  ? t('admissions.enrol.alreadyEnrolled')
                  : t('admissions.enrol.success', {
                      name: enrolResult.studentName ?? admission.studentName,
                      section: enrolResult.classSectionLabel ?? '',
                      roll: enrolResult.rollNumber ?? '—',
                    })}
              </Text>
            )}
            {enrolResult?.inviteCode && (
              <Pressable
                onPress={async () => {
                  await Clipboard.setStringAsync(enrolResult.inviteCode!);
                  showToast(t('common.copied'), 'success');
                }}
              >
                <Text style={styles.inviteCode}>{t('admissions.enrol.inviteCode', { code: enrolResult.inviteCode })}</Text>
              </Pressable>
            )}
            {admission.studentId && (
              <Pressable style={styles.submit} onPress={() => openStudent(admission.studentId!)}>
                <Text style={styles.submitText}>{t('admissions.detail.viewStudent')}</Text>
              </Pressable>
            )}
          </View>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  error: { color: colors.error, margin: spacing.lg },
  stageRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  inlineActions: { flexDirection: 'row', gap: spacing.lg },
  link: { color: colors.primary, fontWeight: '700', paddingVertical: 2 },
  linkDanger: { color: colors.error },
  warningCard: {
    backgroundColor: '#FFF3E0',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  warningTitle: { fontWeight: '800', color: colors.warning, marginBottom: spacing.xs },
  warningBody: { color: colors.textSecondary, marginBottom: spacing.xs },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  actionButton: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  actionButtonDanger: { borderColor: colors.error },
  actionText: { color: colors.primary, fontWeight: '700' },
  actionTextDanger: { color: colors.error },
  disabled: { opacity: 0.5 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...softShadow,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.md },
  field: { marginBottom: spacing.sm },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 2 },
  fieldValue: { fontSize: 14, color: colors.textPrimary },
  muted: { fontSize: 12.5, color: colors.textMuted, marginBottom: spacing.sm },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  docMain: { flex: 1 },
  docTitle: { fontWeight: '700', color: colors.textPrimary },
  sectionChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginVertical: spacing.sm },
  sectionChip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  sectionChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  sectionChipText: { fontWeight: '600', color: colors.textPrimary },
  sectionChipTextSelected: { color: colors.white },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  switchLabel: { flex: 1, color: colors.textPrimary, fontWeight: '600', marginRight: spacing.md },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
    ...softShadow,
  },
  submitText: { color: colors.white, fontWeight: '700' },
  successText: { color: colors.success, fontWeight: '700', marginBottom: spacing.sm },
  inviteCode: { color: colors.textPrimary, fontWeight: '700', marginBottom: spacing.sm },
});
