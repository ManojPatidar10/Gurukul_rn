import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getSchool, updateSchool } from '../../api/schools';
import type { School } from '../../api/types';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { isValidUpiId } from '../../utils/validators';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'FeePaymentSettings'>;

export function FeePaymentSettingsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { showToast } = useToast();
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [upiVpa, setUpiVpa] = useState('');
  const [upiPayeeName, setUpiPayeeName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSchool(schoolId)
      .then((s) => {
        setSchool(s);
        setUpiVpa(s.upiVpa ?? '');
        setUpiPayeeName(s.upiPayeeName ?? s.name);
      })
      .catch((e) => showToast((e as Error).message, 'error'))
      .finally(() => setLoading(false));
  }, [schoolId]);

  const handleSave = async () => {
    if (!school) return;
    if (!isValidUpiId(upiVpa)) {
      showToast(t('fees.paymentSettings.errors.upiVpa'), 'error');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateSchool(schoolId, {
        name: school.name,
        address: school.address,
        city: school.city,
        state: school.state,
        pincode: school.pincode,
        contactEmail: school.contactEmail,
        contactPhone: school.contactPhone,
        principalName: school.principalName,
        directorName: school.directorName,
        upiVpa: upiVpa.trim(),
        upiPayeeName: upiPayeeName.trim() || school.name,
      });
      setSchool(updated);
      showToast(t('fees.paymentSettings.saved'), 'success');
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.root}>
        <ScreenHeader title={t('fees.paymentSettings.title')} onBack={() => navigation.goBack()} />
        <ActivityIndicator style={styles.loading} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('fees.paymentSettings.title')} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <Text style={styles.hint}>{t('fees.paymentSettings.hint')}</Text>
        <LabeledInput
          label={t('fees.paymentSettings.upiVpa')}
          required
          value={upiVpa}
          onChangeText={setUpiVpa}
          autoCapitalize="none"
          placeholder="school@bank"
        />
        <LabeledInput
          label={t('fees.paymentSettings.upiPayeeName')}
          value={upiPayeeName}
          onChangeText={setUpiPayeeName}
          placeholder={school?.name}
        />
        <Pressable style={[styles.save, saving && styles.saveDisabled]} onPress={handleSave} disabled={saving}>
          <Text style={styles.saveText}>{saving ? t('common.saving') : t('common.save')}</Text>
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  hint: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.lg },
  save: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    ...softShadow,
  },
  saveDisabled: { opacity: 0.5 },
  saveText: { color: colors.white, fontWeight: '700' },
});
