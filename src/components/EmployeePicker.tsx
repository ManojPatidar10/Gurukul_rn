import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { createEmployee, listEmployees } from '../api/employees';
import type { Employee } from '../api/types';
import { colors, radius, softShadow, spacing } from '../theme/colors';
import LabeledInput from './LabeledInput';

interface Props {
  schoolId: string;
  selectedId: string | null;
  onSelect: (employee: Employee) => void;
}

export default function EmployeePicker({ schoolId, selectedId, onSelect }: Props) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('');
  const [joinDate, setJoinDate] = useState('');
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    listEmployees(schoolId)
      .then(setEmployees)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [schoolId]);

  const handleCreate = async () => {
    if (!name || !designation || !joinDate) return;
    setCreating(true);
    setError(null);
    try {
      const created = await createEmployee(schoolId, { name, designation, joinDate });
      setEmployees((prev) => [...prev, created]);
      onSelect(created);
      setShowCreate(false);
      setName('');
      setDesignation('');
      setJoinDate('');
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
      {employees.length === 0 && !showCreate && (
        <Text style={styles.empty}>No employees yet.</Text>
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
          <LabeledInput label="Name" value={name} onChangeText={setName} />
          <LabeledInput label="Designation" value={designation} onChangeText={setDesignation} />
          <LabeledInput
            label="Join date (YYYY-MM-DD)"
            value={joinDate}
            onChangeText={setJoinDate}
            placeholder="2026-04-01"
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
          <Text style={styles.addNew}>+ New employee</Text>
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
