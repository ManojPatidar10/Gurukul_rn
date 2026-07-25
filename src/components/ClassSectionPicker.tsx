import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { createClassSection, listClassSections } from '../api/classSections';
import type { ClassSection } from '../api/types';
import { colors, radius, spacing } from '../theme/colors';
import LabeledInput from './LabeledInput';

interface Props {
  schoolId: string;
  selectedId: string | null;
  onSelect: (classSection: ClassSection) => void;
}

export default function ClassSectionPicker({ schoolId, selectedId, onSelect }: Props) {
  const [sections, setSections] = useState<ClassSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [className, setClassName] = useState('');
  const [section, setSection] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    listClassSections(schoolId)
      .then(setSections)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [schoolId]);

  const handleCreate = async () => {
    if (!className || !section || !academicYear) return;
    setCreating(true);
    setError(null);
    try {
      const created = await createClassSection(schoolId, { className, section, academicYear });
      setSections((prev) => [...prev, created]);
      onSelect(created);
      setShowCreate(false);
      setClassName('');
      setSection('');
      setAcademicYear('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <ActivityIndicator style={styles.loading} />;

  return (
    <View>
      {error && <Text style={styles.error}>{error}</Text>}
      {sections.length === 0 && !showCreate && (
        <Text style={styles.empty}>No class-sections yet.</Text>
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
          <LabeledInput label="Class name" value={className} onChangeText={setClassName} placeholder="e.g. Grade 5" />
          <LabeledInput label="Section" value={section} onChangeText={setSection} placeholder="e.g. A" />
          <LabeledInput
            label="Academic year"
            value={academicYear}
            onChangeText={setAcademicYear}
            placeholder="e.g. 2026-2027"
          />
          <Pressable style={styles.createButton} onPress={handleCreate} disabled={creating}>
            <Text style={styles.createButtonText}>{creating ? 'Creating…' : 'Create & select'}</Text>
          </Pressable>
          <Pressable onPress={() => setShowCreate(false)}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={() => setShowCreate(true)}>
          <Text style={styles.addNew}>+ New class-section</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { marginVertical: spacing.md },
  error: { color: colors.error, marginBottom: spacing.sm },
  empty: { color: colors.textMuted, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.textPrimary },
  chipTextSelected: { color: colors.white },
  addNew: { color: colors.primary, fontWeight: '600', marginTop: spacing.xs },
  createForm: { marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  createButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  createButtonText: { color: colors.white, fontWeight: '600' },
  cancel: { color: colors.textMuted, textAlign: 'center' },
});
