import { FontAwesome5 } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { createClassSection, listClassSections } from '../api/classSections';
import type { ClassSection } from '../api/types';
import { colors, radius, softShadow, spacing } from '../theme/colors';
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
  const [open, setOpen] = useState(false);
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

  const selected = sections.find((cs) => cs.id === selectedId) ?? null;

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
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <View>
      {error && !open && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.field} onPress={() => setOpen(true)} disabled={loading}>
        {loading ? (
          <ActivityIndicator color={colors.primary} size="small" />
        ) : (
          <Text style={[styles.fieldText, !selected && styles.fieldPlaceholder]}>
            {selected ? selected.displayLabel : 'Select class-section'}
          </Text>
        )}
        <FontAwesome5 name="chevron-down" size={13} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Select class-section</Text>

            {error && <Text style={styles.error}>{error}</Text>}

            <FlatList
              data={sections}
              keyExtractor={(item) => item.id}
              style={styles.list}
              ListEmptyComponent={!loading ? <Text style={styles.empty}>No class-sections yet.</Text> : null}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.option, selectedId === item.id && styles.optionSelected]}
                  onPress={() => {
                    onSelect(item);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.optionText, selectedId === item.id && styles.optionTextSelected]}>
                    {item.displayLabel}
                  </Text>
                  {selectedId === item.id && <FontAwesome5 name="check" size={13} color={colors.white} />}
                </Pressable>
              )}
            />

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
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceMuted,
    marginBottom: spacing.sm,
  },
  fieldText: { fontSize: 15, color: colors.textPrimary },
  fieldPlaceholder: { color: colors.textMuted },
  error: { color: colors.error, marginBottom: spacing.sm },
  empty: { color: colors.textMuted, marginBottom: spacing.sm, textAlign: 'center' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '70%',
    ...softShadow,
  },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.md },
  list: { flexGrow: 0, marginBottom: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.xs,
    backgroundColor: colors.surfaceMuted,
  },
  optionSelected: { backgroundColor: colors.primary },
  optionText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  optionTextSelected: { color: colors.white },
  addNew: { color: colors.primary, fontWeight: '700', marginTop: spacing.xs, textAlign: 'center' },
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
