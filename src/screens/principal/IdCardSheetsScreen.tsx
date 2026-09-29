import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { downloadSectionIdSheet, downloadStaffIdSheet } from '../../api/idCards';
import type { ClassSection } from '../../api/types';
import ClassSectionPicker from '../../components/ClassSectionPicker';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { usePdfDownload } from '../../hooks/usePdfDownload';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'IdCardSheets'>;

/** Admin only: print-ready A4 sheets (10 cards per page) for a class-section or all staff. */
export function IdCardSheetsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const [section, setSection] = useState<ClassSection | null>(null);
  const classSheet = usePdfDownload(t('idCard.sheets.shareTitle'));
  const staffSheet = usePdfDownload(t('idCard.sheets.shareTitle'));

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('idCard.sheets.title')} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <Text style={styles.intro}>{t('idCard.sheets.intro')}</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('idCard.sheets.classTitle')}</Text>
          <ClassSectionPicker schoolId={schoolId} selectedId={section?.id ?? null} onSelect={setSection} />
          <Pressable
            style={[styles.button, (!section || classSheet.busy) && styles.disabled]}
            disabled={!section || classSheet.busy}
            onPress={() => section && classSheet.run(() => downloadSectionIdSheet(schoolId, section))}
          >
            {classSheet.busy ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>{t('idCard.sheets.downloadClass')}</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('idCard.sheets.staffTitle')}</Text>
          <Pressable
            style={[styles.button, staffSheet.busy && styles.disabled]}
            disabled={staffSheet.busy}
            onPress={() => staffSheet.run(() => downloadStaffIdSheet(schoolId))}
          >
            {staffSheet.busy ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>{t('idCard.sheets.downloadStaff')}</Text>
            )}
          </Pressable>
        </View>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  intro: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...softShadow,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.md },
  button: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.5 },
});
