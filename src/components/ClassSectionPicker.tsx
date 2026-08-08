import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { createClassSection, listClassSections } from '../api/classSections';
import type { ClassSection } from '../api/types';
import { ACADEMIC_YEAR_OPTIONS } from '../constants/academicYear';
import { useToast } from '../context/ToastContext';
import { colors, radius, softShadow, spacing } from '../theme/colors';
import Dropdown from './Dropdown';
import LabeledInput from './LabeledInput';

const SECTION_OPTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((letter) => ({
  label: letter,
  value: letter,
}));

interface Props {
  schoolId: string;
  selectedId: string | null;
  onSelect: (classSection: ClassSection) => void;
}

export default function ClassSectionPicker({ schoolId, selectedId, onSelect }: Props) {
  const { t } = useTranslation();
  const [sections, setSections] = useState<ClassSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [className, setClassName] = useState('');
  const [section, setSection] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [creating, setCreating] = useState(false);
  const { showToast } = useToast();

  const load = () => {
    setLoading(true);
    listClassSections(schoolId)
      .then(setSections)
      .catch((e) => showToast(e.message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [schoolId]);

  const handleCreate = async () => {
    if (!className.trim()) {
      showToast(t('classSection.picker.errors.className'), 'error');
      return;
    }
    if (!section) {
      showToast(t('classSection.picker.errors.section'), 'error');
      return;
    }
    if (!academicYear) {
      showToast(t('classSection.picker.errors.academicYear'), 'error');
      return;
    }
    setCreating(true);
    try {
      const created = await createClassSection(schoolId, { className, section, academicYear });
      setSections((prev) => [...prev, created]);
      onSelect(created);
      setShowCreate(false);
      setClassName('');
      setSection('');
      setAcademicYear('');
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <ActivityIndicator style={styles.loading} />;

  return (
    <View>
      {sections.length === 0 && !showCreate && (
        <Text style={styles.empty}>{t('classSection.picker.empty')}</Text>
      )}
      <View style={styles.chips}>
        {sections.map((cs) => (
          <Pressable
            key={cs.id}
            onPress={() => onSelect(cs)}
            style={[styles.chip, selectedId === cs.id && styles.chipSelected]}
          >
            <Text style={[styles.chipText, selectedId === cs.id && styles.chipTextSelected]}>
              {cs.displayLabel}
            </Text>
          </Pressable>
        ))}
      </View>

      {showCreate ? (
        <View style={styles.createForm}>
          <LabeledInput label={t('classSection.picker.className')} required value={className} onChangeText={setClassName} placeholder="e.g. Grade 5" />
          <Dropdown label={t('classSection.picker.section')} required value={section} options={SECTION_OPTIONS} onSelect={setSection} />
          <Dropdown
            label={t('classSection.picker.academicYear')}
            required
            value={academicYear}
            options={ACADEMIC_YEAR_OPTIONS}
            onSelect={setAcademicYear}
          />
          <Pressable style={styles.createButton} onPress={handleCreate} disabled={creating}>
            <Text style={styles.createButtonText}>{creating ? t('common.creating') : t('common.createAndSelect')}</Text>
          </Pressable>
          <Pressable onPress={() => setShowCreate(false)}>
            <Text style={styles.cancel}>{t('common.cancel')}</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={() => setShowCreate(true)}>
          <Text style={styles.addNew}>{t('classSection.picker.addNew')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { marginVertical: spacing.md },
  empty: { color: colors.textMuted, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
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
  addNew: { color: colors.primary, fontWeight: '700', marginTop: spacing.xs },
  createForm: { marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  createButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
    ...softShadow,
  },
  createButtonText: { color: colors.white, fontWeight: '600' },
  cancel: { color: colors.textMuted, textAlign: 'center' },
});
