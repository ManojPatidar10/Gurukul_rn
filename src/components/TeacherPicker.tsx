import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { listTeachers } from '../api/teachers';
import type { Teacher } from '../api/types';
import { useToast } from '../context/ToastContext';
import { colors, radius, spacing } from '../theme/colors';

interface Props {
  schoolId: string;
  selectedId: string | null;
  onSelect: (teacher: Teacher) => void;
}

export default function TeacherPicker({ schoolId, selectedId, onSelect }: Props) {
  const { t } = useTranslation();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    setLoading(true);
    listTeachers(schoolId)
      .then(setTeachers)
      .catch((e) => showToast((e as Error).message, 'error'))
      .finally(() => setLoading(false));
  }, [schoolId]);

  if (loading) return <ActivityIndicator style={styles.loading} />;

  if (teachers.length === 0) {
    return <Text style={styles.empty}>{t('teacherTools.picker.empty')}</Text>;
  }

  return (
    <View style={styles.chips}>
      {teachers.map((teacher) => (
        <Pressable
          key={teacher.id}
          onPress={() => onSelect(teacher)}
          style={[styles.chip, selectedId === teacher.id && styles.chipSelected]}
        >
          <Text style={[styles.chipText, selectedId === teacher.id && styles.chipTextSelected]}>
            {teacher.name}
          </Text>
        </Pressable>
      ))}
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
});
