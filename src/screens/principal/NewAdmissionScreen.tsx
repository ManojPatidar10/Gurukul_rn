import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { createAdmission, updateAdmission } from '../../api/admissions';
import { listClassNames } from '../../api/classSections';
import type { AdmissionRequest } from '../../api/types';
import { DatePickerField } from '../../components/DatePickerField';
import Dropdown from '../../components/Dropdown';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { isValidPhone } from '../../utils/validators';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'NewAdmission'>;

type FormState = Required<AdmissionRequest>;

/** Admin-only: record a new admission application (or edit one that isn't enrolled yet). */
export function NewAdmissionScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { showToast } = useToast();
  const existing = route.params?.admission ?? null;
  const isEdit = !!existing;

  const GENDER_OPTIONS = [
    { label: t('common.male'), value: 'MALE' },
    { label: t('common.female'), value: 'FEMALE' },
    { label: t('common.other'), value: 'OTHER' },
  ];

  const [form, setForm] = useState<FormState>({
    studentName: existing?.studentName ?? '',
    dob: existing?.dob ?? '',
    gender: existing?.gender ?? '',
    address: existing?.address ?? '',
    previousSchoolName: existing?.previousSchoolName ?? '',
    parentName: existing?.parentName ?? '',
    parentContact: existing?.parentContact ?? '',
    parentEmail: existing?.parentEmail ?? '',
    appliedClassName: existing?.appliedClassName ?? '',
    notes: existing?.notes ?? '',
  });
  const [classNames, setClassNames] = useState<string[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listClassNames(schoolId)
      .then(setClassNames)
      .catch(() => setClassNames([]))
      .finally(() => setLoadingClasses(false));
  }, [schoolId]);

  const set = (key: keyof FormState) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const canSubmit =
    !!form.studentName.trim() &&
    !!form.dob &&
    !!form.gender &&
    !!form.address.trim() &&
    !!form.parentName.trim() &&
    !!form.parentContact.trim() &&
    !!form.appliedClassName;

  const handleSubmit = async () => {
    if (!isValidPhone(form.parentContact)) {
      showToast(t('admissions.form.errors.parentContact'), 'error');
      return;
    }
    setSubmitting(true);
    try {
      const saved = isEdit
        ? await updateAdmission(schoolId, existing!.id, form)
        : await createAdmission(schoolId, form);
      showToast(t('admissions.form.saved'), 'success');
      navigation.replace('AdmissionDetail', { admissionId: saved.id });
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={isEdit ? t('admissions.form.titleEdit') : t('admissions.form.titleCreate')}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        <Text style={styles.sectionTitle}>{t('admissions.form.studentSection')}</Text>
        <LabeledInput label={t('admissions.form.studentName')} required value={form.studentName} onChangeText={set('studentName')} />
        <DatePickerField label={t('admissions.form.dob')} value={form.dob} onChange={set('dob')} maximumDate={new Date()} />
        <Dropdown label={t('admissions.form.gender')} required value={form.gender} options={GENDER_OPTIONS} onSelect={set('gender')} />
        <LabeledInput label={t('admissions.form.address')} required value={form.address} onChangeText={set('address')} />
        <LabeledInput
          label={t('admissions.form.previousSchool')}
          value={form.previousSchoolName}
          onChangeText={set('previousSchoolName')}
        />

        {loadingClasses ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : classNames.length === 0 ? (
          <Text style={styles.warning}>{t('admissions.form.noClasses')}</Text>
        ) : (
          <Dropdown
            label={t('admissions.form.appliedClass')}
            required
            value={form.appliedClassName}
            options={classNames.map((name) => ({ label: name, value: name }))}
            onSelect={set('appliedClassName')}
          />
        )}
        <Text style={styles.hint}>{t('admissions.form.appliedClassHint')}</Text>

        <Text style={styles.sectionTitle}>{t('admissions.form.parentSection')}</Text>
        <LabeledInput label={t('admissions.form.parentName')} required value={form.parentName} onChangeText={set('parentName')} />
        <LabeledInput
          label={t('admissions.form.parentContact')}
          required
          value={form.parentContact}
          onChangeText={set('parentContact')}
          keyboardType="phone-pad"
          maxLength={10}
        />
        <LabeledInput
          label={t('admissions.form.parentEmail')}
          value={form.parentEmail}
          onChangeText={set('parentEmail')}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <LabeledInput
          label={t('admissions.form.notes')}
          value={form.notes}
          onChangeText={set('notes')}
          multiline
          style={styles.notes}
        />

        <Pressable
          style={[styles.submit, (!canSubmit || submitting) && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          <Text style={styles.submitText}>
            {submitting ? t('common.saving') : isEdit ? t('common.saveChanges') : t('admissions.form.submitCreate')}
          </Text>
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginTop: spacing.sm, marginBottom: spacing.md },
  loading: { marginVertical: spacing.md },
  warning: { color: colors.warning, marginBottom: spacing.sm },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: -spacing.xs, marginBottom: spacing.lg },
  notes: { minHeight: 80, textAlignVertical: 'top' },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    ...softShadow,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: colors.white, fontWeight: '700' },
});
