import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { createStudent, updateStudent } from '../../api/students';
import type { StudentRequest } from '../../api/types';
import ClassSectionPicker from '../../components/ClassSectionPicker';
import DateField, { parseDateString } from '../../components/DateField';
import Dropdown from '../../components/Dropdown';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { isNotBefore, isValidPhone } from '../../utils/validators';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'StudentForm'>;

export function StudentFormScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();

  const GENDER_OPTIONS = [
    { label: t('common.male'), value: 'MALE' },
    { label: t('common.female'), value: 'FEMALE' },
    { label: t('common.other'), value: 'OTHER' },
  ];

  const STATUS_OPTIONS = [
    { label: t('common.active'), value: 'ACTIVE' },
    { label: t('common.inactive'), value: 'INACTIVE' },
  ];
  const student = route.params?.student ?? null;
  const isEdit = !!student;

  const [form, setForm] = useState<StudentRequest>({
    rollNumber: student?.rollNumber ?? '',
    name: student?.name ?? '',
    dob: student?.dob ?? '',
    gender: student?.gender ?? '',
    address: student?.address ?? '',
    parentName: student?.parentName ?? '',
    parentContact: student?.parentContact ?? '',
    classSectionId: student?.classSectionId ?? '',
    admissionDate: student?.admissionDate ?? '',
    status: student?.status ?? 'ACTIVE',
  });
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  const set = (key: keyof StudentRequest) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const canSubmit =
    form.rollNumber && form.name && form.dob && form.gender && form.address &&
    form.parentName && form.parentContact && form.classSectionId && form.admissionDate;

  const handleSubmit = async () => {
    if (!isValidPhone(form.parentContact)) {
      showToast(t('students.form.errors.parentContact'), 'error');
      return;
    }
    if (!isNotBefore(form.admissionDate, form.dob)) {
      showToast(t('students.form.errors.admissionBeforeDob'), 'error');
      return;
    }
    setSubmitting(true);
    try {
      const result = isEdit
        ? await updateStudent(schoolId, student!.id, form)
        : await createStudent(schoolId, form);
      navigation.replace('StudentDetail', { student: result });
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={isEdit ? t('students.form.titleEdit') : t('students.form.titleCreate')}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        <LabeledInput label={t('students.form.rollNumber')} required value={form.rollNumber} onChangeText={set('rollNumber')} />
        <LabeledInput label={t('students.form.name')} required value={form.name} onChangeText={set('name')} />
        <DateField label={t('students.form.dob')} required value={form.dob} onChange={set('dob')} maximumDate={new Date()} />
        <Dropdown label={t('students.form.gender')} required value={form.gender} options={GENDER_OPTIONS} onSelect={set('gender')} />
        <LabeledInput label={t('students.form.address')} required value={form.address} onChangeText={set('address')} />
        <LabeledInput label={t('students.form.parentName')} required value={form.parentName} onChangeText={set('parentName')} />
        <LabeledInput
          label={t('students.form.parentContact')}
          required
          value={form.parentContact}
          onChangeText={set('parentContact')}
          keyboardType="phone-pad"
          maxLength={10}
        />
        <DateField
          label={t('students.form.admissionDate')}
          required
          value={form.admissionDate}
          onChange={set('admissionDate')}
          minimumDate={form.dob ? parseDateString(form.dob) : undefined}
        />
        <Dropdown label={t('students.form.status')} value={form.status ?? 'ACTIVE'} options={STATUS_OPTIONS} onSelect={set('status')} />

        <Text style={styles.label}>{t('students.form.classSection')} *</Text>
        <ClassSectionPicker
          schoolId={schoolId}
          selectedId={form.classSectionId || null}
          onSelect={(cs) => set('classSectionId')(cs.id)}
        />

        <Pressable
          style={[styles.submit, (!canSubmit || submitting) && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          <Text style={styles.submitText}>
            {submitting ? t('common.saving') : isEdit ? t('common.saveChanges') : t('students.form.submitCreate')}
          </Text>
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm },
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
