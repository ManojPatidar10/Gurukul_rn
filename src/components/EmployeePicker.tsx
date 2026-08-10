import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { createEmployee, listEmployees } from '../api/employees';
import type { Employee } from '../api/types';
import { useToast } from '../context/ToastContext';
import { colors, radius, softShadow, spacing } from '../theme/colors';
import LabeledInput from './LabeledInput';

interface Props {
  schoolId: string;
  selectedId: string | null;
  onSelect: (employee: Employee) => void;
}

export default function EmployeePicker({ schoolId, selectedId, onSelect }: Props) {
  const { t } = useTranslation();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('');
  const [joinDate, setJoinDate] = useState('');
  const [creating, setCreating] = useState(false);
  const { showToast } = useToast();

  const load = () => {
    setLoading(true);
    listEmployees(schoolId)
      .then(setEmployees)
      .catch((e) => showToast(e.message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [schoolId]);

  const handleCreate = async () => {
    if (!name.trim()) {
      showToast(t('employees.picker.errors.name'), 'error');
      return;
    }
    if (!designation.trim()) {
      showToast(t('employees.picker.errors.designation'), 'error');
      return;
    }
    if (!joinDate.trim()) {
      showToast(t('employees.picker.errors.joinDate'), 'error');
      return;
    }
    setCreating(true);
    try {
      const created = await createEmployee(schoolId, { name, designation, joinDate });
      setEmployees((prev) => [...prev, created]);
      onSelect(created);
      setShowCreate(false);
      setName('');
      setDesignation('');
      setJoinDate('');
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <ActivityIndicator style={styles.loading} />;

  return (
    <View>
      {employees.length === 0 && !showCreate && (
        <Text style={styles.empty}>{t('employees.picker.empty')}</Text>
      )}
      <View style={styles.chips}>
        {employees.map((emp) => (
          <Pressable
            key={emp.id}
            onPress={() => onSelect(emp)}
            style={[styles.chip, selectedId === emp.id && styles.chipSelected]}
          >
            <Text style={[styles.chipText, selectedId === emp.id && styles.chipTextSelected]}>
              {emp.name} ({emp.designation})
            </Text>
          </Pressable>
        ))}
      </View>

      {showCreate ? (
        <View style={styles.createForm}>
          <LabeledInput label={t('employees.picker.name')} required value={name} onChangeText={setName} />
          <LabeledInput label={t('employees.picker.designation')} required value={designation} onChangeText={setDesignation} />
          <LabeledInput
            label={t('employees.picker.joinDate')}
            required
            value={joinDate}
            onChangeText={setJoinDate}
            placeholder="2026-04-01"
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
          <Text style={styles.addNew}>{t('employees.picker.addNew')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { marginVertical: spacing.md },
  empty: { color: colors.textMuted, marginBottom: spacing.sm },
  // alignItems: 'flex-start' matters here - without it, flexWrap's default cross-axis stretch
  // makes every chip in a wrapped row match the height of the tallest one in that row, so a short
  // chip next to a two-line-wrapping long one visibly balloons in padding for no reason.
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
