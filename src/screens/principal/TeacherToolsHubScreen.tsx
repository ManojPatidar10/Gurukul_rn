import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import ClassSectionPicker from '../../components/ClassSectionPicker';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import TeacherPicker from '../../components/TeacherPicker';
import { useSchoolId } from '../../context/SchoolContext';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { ClassSection, Teacher } from '../../api/types';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'TeacherToolsHub'>;

const accent = accents.teacherTools;

export function TeacherToolsHubScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [classSection, setClassSection] = useState<ClassSection | null>(null);

  const ready = teacher !== null && classSection !== null;

  const navigateTo = (route: 'ResourceGenerator' | 'ResourceUpload') => {
    if (!teacher || !classSection) return;
    navigation.navigate(route, {
      teacherId: teacher.id,
      teacherName: teacher.name,
      classSectionId: classSection.id,
      classSectionLabel: classSection.displayLabel,
    });
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('teacherTools.hub.title')} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <Text style={styles.sectionLabel}>{t('teacherTools.hub.selectTeacher')}</Text>
        <TeacherPicker schoolId={schoolId} selectedId={teacher?.id ?? null} onSelect={setTeacher} />

        <Text style={styles.sectionLabel}>{t('teacherTools.hub.selectClass')}</Text>
        <ClassSectionPicker schoolId={schoolId} selectedId={classSection?.id ?? null} onSelect={setClassSection} />

        {!ready ? (
          <Text style={styles.hint}>{t('teacherTools.hub.incompleteHint')}</Text>
        ) : (
          <View style={styles.options}>
            <Pressable style={styles.row} onPress={() => navigateTo('ResourceGenerator')}>
              <View style={styles.accentBar} />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{t('teacherTools.hub.generate.title')}</Text>
                <Text style={styles.rowDescription}>{t('teacherTools.hub.generate.description')}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
            <Pressable style={styles.row} onPress={() => navigateTo('ResourceUpload')}>
              <View style={styles.accentBar} />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{t('teacherTools.hub.upload.title')}</Text>
                <Text style={styles.rowDescription}>{t('teacherTools.hub.upload.description')}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          </View>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  hint: { color: colors.textMuted, marginTop: spacing.md },
  options: { marginTop: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...softShadow,
  },
  accentBar: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: radius.pill,
    backgroundColor: accent.base,
    marginRight: spacing.md,
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  rowDescription: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  chevron: { fontSize: 22, color: colors.textMuted, marginLeft: spacing.sm },
});
