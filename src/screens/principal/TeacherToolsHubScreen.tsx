import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getErrorMessage } from '../../api/errorMessage';
import { listSectionSubjects } from '../../api/sectionSubjects';
import ClassSectionPicker from '../../components/ClassSectionPicker';
import { ErrorNotice } from '../../components/ErrorNotice';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { FEATURE_FLAGS } from '../../config/featureFlags';
import { useSchoolId } from '../../context/SchoolContext';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { ClassSection } from '../../api/types';
import type { PrincipalStackParamList } from '../../types/principal';
import { sectionTeachers, type SectionTeacher } from '../../utils/sectionTeachers';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'TeacherToolsHub'>;

const accent = accents.teacherTools;

/**
 * The admin's way into the quiz tools (Dashboard → Academics → Teacher Tools): the Arena question
 * bank, and the AI quiz generator run on behalf of one of a class-section's subject teachers. The
 * teacher list comes from the section's subject assignments, the only staff list for a section on
 * backend main.
 */
export function TeacherToolsHubScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const [classSection, setClassSection] = useState<ClassSection | null>(null);
  const [teachers, setTeachers] = useState<SectionTeacher[]>([]);
  const [teachersLoading, setTeachersLoading] = useState(false);
  const [teachersError, setTeachersError] = useState<string | null>(null);
  const [teacher, setTeacher] = useState<SectionTeacher | null>(null);
  // The section whose teachers were last asked for, so a slow reply for a section the admin has
  // since switched away from is dropped.
  const requestedSectionId = useRef<string | null>(null);

  const sectionId = classSection?.id ?? null;

  // Callers set the loading state first (selecting a section, or Retry); this only fetches.
  const fetchTeachers = useCallback(() => {
    if (!sectionId) return;
    requestedSectionId.current = sectionId;
    listSectionSubjects(schoolId, sectionId)
      .then((rows) => {
        if (requestedSectionId.current === sectionId) setTeachers(sectionTeachers(rows));
      })
      .catch((e) => {
        if (requestedSectionId.current === sectionId) setTeachersError(getErrorMessage(e));
      })
      .finally(() => {
        if (requestedSectionId.current === sectionId) setTeachersLoading(false);
      });
  }, [schoolId, sectionId]);

  useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers]);

  const retryTeachers = () => {
    setTeachersLoading(true);
    setTeachersError(null);
    fetchTeachers();
  };

  const selectClassSection = (cs: ClassSection) => {
    if (cs.id !== classSection?.id) {
      setTeacher(null);
      setTeachers([]);
      setTeachersError(null);
      setTeachersLoading(true);
    }
    setClassSection(cs);
  };

  const ready = teacher !== null && classSection !== null;

  const navigateTo = (route: 'ResourceGenerator' | 'ResourceUpload') => {
    if (!teacher || !classSection) return;
    navigation.navigate(route, {
      teacherId: teacher.teacherId,
      teacherName: teacher.teacherName,
      classSectionId: classSection.id,
      classSectionLabel: classSection.displayLabel,
    });
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('teacherTools.hub.title')} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <Pressable style={styles.row} onPress={() => navigation.navigate('Arena')} accessibilityRole="button">
          <View style={styles.accentBar} />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{t('teacherTools.hub.questionBank.title')}</Text>
            <Text style={styles.rowDescription}>{t('teacherTools.hub.questionBank.description')}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <Text style={[styles.sectionLabel, styles.firstPickerLabel]}>{t('teacherTools.hub.selectClass')}</Text>
        <ClassSectionPicker schoolId={schoolId} selectedId={classSection?.id ?? null} onSelect={selectClassSection} />

        {classSection && (
          <>
            <Text style={styles.sectionLabel}>{t('teacherTools.hub.selectTeacher')}</Text>
            {teachersLoading ? (
              <ActivityIndicator color={colors.primary} style={styles.loading} />
            ) : teachersError ? (
              <View>
                <ErrorNotice message={teachersError} />
                <Pressable onPress={retryTeachers} style={styles.retry} accessibilityRole="button">
                  <Text style={styles.retryText}>{t('common.retry')}</Text>
                </Pressable>
              </View>
            ) : teachers.length === 0 ? (
              <Text style={styles.hint}>{t('teacherTools.hub.noTeachers')}</Text>
            ) : (
              <View style={styles.chips}>
                {teachers.map((item) => {
                  const selected = teacher?.teacherId === item.teacherId;
                  const label = item.subjectNames.length
                    ? `${item.teacherName} · ${item.subjectNames.join(', ')}`
                    : item.teacherName;
                  return (
                    <Pressable
                      key={item.teacherId}
                      onPress={() => setTeacher(item)}
                      style={[styles.chip, selected && styles.chipSelected]}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </>
        )}

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
            {FEATURE_FLAGS.teacherResources && (
              <Pressable style={styles.row} onPress={() => navigateTo('ResourceUpload')}>
                <View style={styles.accentBar} />
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{t('teacherTools.hub.upload.title')}</Text>
                  <Text style={styles.rowDescription}>{t('teacherTools.hub.upload.description')}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
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
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  firstPickerLabel: { marginTop: spacing.sm },
  hint: { color: colors.textMuted, marginTop: spacing.md },
  loading: { marginVertical: spacing.md },
  retry: { alignSelf: 'flex-start', paddingVertical: spacing.sm },
  retryText: { color: colors.primary, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  chipTextSelected: { color: colors.white },
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
