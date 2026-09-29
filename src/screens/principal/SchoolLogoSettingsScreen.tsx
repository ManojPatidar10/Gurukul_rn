import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { removeSchoolLogo, uploadSchoolLogo } from '../../api/schoolLogo';
import type { PickedLogo } from '../../api/schoolLogo';
import { getSchool } from '../../api/schools';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SchoolLogoPicker } from '../../components/SchoolLogoPicker';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'SchoolLogoSettings'>;

/** Admin-only: upload, replace or remove the logo printed on report-card PDFs. */
export function SchoolLogoSettingsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { showToast } = useToast();
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [picked, setPicked] = useState<PickedLogo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSchool(schoolId)
      .then((school) => setCurrentUrl(school.logoUrl ?? null))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [schoolId]);

  const handleSave = async () => {
    if (!picked) return;
    setBusy(true);
    try {
      const school = await uploadSchoolLogo(schoolId, picked);
      setCurrentUrl(school.logoUrl ?? null);
      setPicked(null);
      showToast(t('schoolLogo.saved'), 'success');
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    try {
      await removeSchoolLogo(schoolId);
      setCurrentUrl(null);
      setPicked(null);
      showToast(t('schoolLogo.removed'), 'success');
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('schoolLogo.title')} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <Text style={styles.intro}>{t('schoolLogo.intro')}</Text>
        <Text style={styles.hint}>{t('schoolLogo.hint')}</Text>
        {loading && <ActivityIndicator color={colors.primary} />}
        {!loading && error && <Text style={styles.error}>{error}</Text>}
        {!loading && !error && (
          <>
            <SchoolLogoPicker previewUri={picked?.uri ?? currentUrl} onPicked={setPicked} disabled={busy} />
            <Pressable
              style={[styles.save, (!picked || busy) && styles.disabled]}
              onPress={handleSave}
              disabled={!picked || busy}
            >
              {busy ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.saveText}>{t('schoolLogo.save')}</Text>
              )}
            </Pressable>
            {currentUrl && !picked && (
              <Pressable style={styles.remove} onPress={handleRemove} disabled={busy}>
                <Text style={styles.removeText}>{t('schoolLogo.remove')}</Text>
              </Pressable>
            )}
          </>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  intro: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.xs },
  hint: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.lg, fontStyle: 'italic' },
  error: { color: colors.error, marginBottom: spacing.md },
  save: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    ...softShadow,
  },
  saveText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  disabled: { opacity: 0.5 },
  remove: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.sm },
  removeText: { color: colors.error, fontWeight: '700' },
});
