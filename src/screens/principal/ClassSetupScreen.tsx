import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { createClassSection, listClassSections } from '../../api/classSections';
import { getErrorMessage } from '../../api/errorMessage';
import type { ClassSection } from '../../api/types';
import { ErrorNotice } from '../../components/ErrorNotice';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { CLASS_CHOICES, SECTION_CHOICES, currentAcademicYear, planClassSections } from '../../utils/classSetup';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'ClassSetup'>;

/**
 * Sets up a school's class structure in one go: tap the classes the school runs and the sections
 * each has, and every missing combination is created for the current year. The API creates one
 * class-section per call; a school has a few dozen at most, so they go up one after another.
 */
export function ClassSetupScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { showToast } = useToast();
  const academicYear = currentAcademicYear();
  const [existing, setExisting] = useState<ClassSection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [classes, setClasses] = useState<string[]>([]);
  const [sections, setSections] = useState<string[]>(['A']);
  const [otherClass, setOtherClass] = useState('');
  const [otherSection, setOtherSection] = useState('');
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);

  const load = useCallback(() => {
    listClassSections(schoolId)
      .then(setExisting)
      .catch((e) => setError(getErrorMessage(e)));
  }, [schoolId]);
  useEffect(load, [load]);

  const toggle = (list: string[], set: (next: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const allClasses = [...CLASS_CHOICES, ...classes.filter((c) => !CLASS_CHOICES.includes(c))];
  const allSections = [...SECTION_CHOICES, ...sections.filter((s) => !SECTION_CHOICES.includes(s))];
  const plan = planClassSections(classes, sections, existing ?? [], academicYear);
  const thisYear = (existing ?? []).filter((cs) => cs.academicYear === academicYear);

  const addOther = (value: string, list: string[], set: (next: string[]) => void, clear: () => void) => {
    const v = value.trim();
    if (!v) return;
    if (!list.some((x) => x.toLowerCase() === v.toLowerCase())) set([...list, v]);
    clear();
  };

  const handleCreate = async () => {
    setSaving(true);
    setProgress(0);
    let created = 0;
    let failed: string | null = null;
    for (const item of plan) {
      try {
        await createClassSection(schoolId, item);
        created += 1;
        setProgress(created);
      } catch (e) {
        failed = `${item.className}-${item.section}: ${getErrorMessage(e)}`;
        break;
      }
    }
    setSaving(false);
    if (failed) {
      setError(t('classSetup.partlyCreated', { count: created, error: failed }));
      load();
      return;
    }
    showToast(t('classSetup.created', { count: created }), 'success');
    navigation.goBack();
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('classSetup.title')} subtitle={t('classSetup.year', { year: academicYear })} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        {error && <ErrorNotice message={error} />}
        <Text style={styles.intro}>{t('classSetup.intro')}</Text>

        <Text style={styles.label}>{t('classSetup.classes')}</Text>
        <View style={styles.chips}>
          {allClasses.map((c) => (
            <Chip key={c} label={c} selected={classes.includes(c)} onPress={() => toggle(classes, setClasses, c)} />
          ))}
        </View>
        <View style={styles.otherRow}>
          <View style={styles.otherInput}>
            <LabeledInput label={t('classSetup.otherClass')} value={otherClass} onChangeText={setOtherClass} placeholder="Pre-Nursery" />
          </View>
          <Pressable style={styles.otherAdd} onPress={() => addOther(otherClass, classes, setClasses, () => setOtherClass(''))} accessibilityRole="button">
            <Text style={styles.otherAddText}>{t('classSetup.add')}</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>{t('classSetup.sections')}</Text>
        <View style={styles.chips}>
          {allSections.map((s) => (
            <Chip key={s} label={s} selected={sections.includes(s)} onPress={() => toggle(sections, setSections, s)} />
          ))}
        </View>
        <View style={styles.otherRow}>
          <View style={styles.otherInput}>
            <LabeledInput label={t('classSetup.otherSection')} value={otherSection} onChangeText={setOtherSection} placeholder="E" autoCapitalize="characters" />
          </View>
          <Pressable style={styles.otherAdd} onPress={() => addOther(otherSection.toUpperCase(), sections, setSections, () => setOtherSection(''))} accessibilityRole="button">
            <Text style={styles.otherAddText}>{t('classSetup.add')}</Text>
          </Pressable>
        </View>

        {existing === null ? (
          <ActivityIndicator color={colors.primary} style={styles.spinner} />
        ) : (
          <View style={styles.summary}>
            <Text style={styles.summaryText}>{t('classSetup.existing', { count: thisYear.length })}</Text>
            <Text style={styles.summaryText}>{t('classSetup.toCreate', { count: plan.length })}</Text>
            {plan.length > 0 && (
              <Text style={styles.planList} numberOfLines={3}>
                {plan.map((p) => `${p.className}-${p.section}`).join(', ')}
              </Text>
            )}
          </View>
        )}

        <Pressable
          style={[styles.submit, (plan.length === 0 || saving) && styles.submitDisabled]}
          onPress={handleCreate}
          disabled={plan.length === 0 || saving}
          accessibilityRole="button"
        >
          <Text style={styles.submitText}>
            {saving ? t('classSetup.creating', { done: progress, total: plan.length }) : t('classSetup.create', { count: plan.length })}
          </Text>
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, selected && styles.chipSelected]} onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: selected }}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  intro: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.md },
  label: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: spacing.sm, marginBottom: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipSelected: { backgroundColor: accents.classes.light, borderColor: accents.classes.base },
  chipText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  chipTextSelected: { color: accents.classes.base },
  otherRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  otherInput: { flex: 1 },
  otherAdd: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, marginBottom: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted },
  otherAddText: { color: colors.primary, fontWeight: '700' },
  spinner: { marginVertical: spacing.lg },
  summary: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.md, marginBottom: spacing.md },
  summaryText: { fontSize: 14, color: colors.textPrimary, marginBottom: 2 },
  planList: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
  submit: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: spacing.md, alignItems: 'center', ...softShadow },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: colors.white, fontWeight: '700', fontSize: 16 },
});
