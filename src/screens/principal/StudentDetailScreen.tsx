import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { deleteStudent, transferStudentClassSection } from '../../api/students';
import type { Student } from '../../api/types';
import ClassSectionPicker from '../../components/ClassSectionPicker';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'StudentDetail'>;

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value || '—'}</Text>
    </View>
  );
}

export function StudentDetailScreen({ route, navigation }: Props) {
  const schoolId = useSchoolId();
  const [student, setStudent] = useState<Student>(route.params.student);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTransfer = async (classSectionId: string) => {
    setTransferring(true);
    setError(null);
    try {
      const updated = await transferStudentClassSection(schoolId, student.id, { classSectionId });
      setStudent(updated);
      setShowTransfer(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTransferring(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete student', `Remove ${student.name}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          setError(null);
          try {
            await deleteStudent(schoolId, student.id);
            navigation.goBack();
          } catch (e) {
            setError((e as Error).message);
            setDeleting(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={student.name} subtitle={`Roll ${student.rollNumber}`} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <View style={styles.statusRow}>
          <StatusChip label={student.status} variant={student.status === 'ACTIVE' ? 'success' : 'neutral'} />
        </View>

        <Field label="Class-section" value={student.classSectionLabel} />
        <Field label="Date of birth" value={student.dob} />
        <Field label="Gender" value={student.gender} />
        <Field label="Address" value={student.address} />
        <Field label="Parent name" value={student.parentName} />
        <Field label="Parent contact" value={student.parentContact} />
        <Field label="Admission date" value={student.admissionDate} />

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.actions}>
          <Pressable style={styles.actionButton} onPress={() => navigation.navigate('StudentForm', { student })}>
            <Text style={styles.actionText}>Edit</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => setShowTransfer((v) => !v)}>
            <Text style={styles.actionText}>{showTransfer ? 'Cancel transfer' : 'Transfer class'}</Text>
          </Pressable>
          <Pressable style={[styles.actionButton, styles.deleteButton]} onPress={handleDelete} disabled={deleting}>
            <Text style={styles.deleteText}>{deleting ? 'Deleting…' : 'Delete'}</Text>
          </Pressable>
        </View>

        {showTransfer && (
          <View style={styles.transferPanel}>
            <Text style={styles.transferTitle}>Move to a different class-section</Text>
            <ClassSectionPicker
              schoolId={schoolId}
              selectedId={student.classSectionId}
              onSelect={(cs) => handleTransfer(cs.id)}
            />
            {transferring && <Text style={styles.transferring}>Transferring…</Text>}
          </View>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  statusRow: { marginBottom: spacing.lg },
  field: { marginBottom: spacing.md },
  fieldLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  fieldValue: { fontSize: 16, color: colors.textPrimary, marginTop: 2 },
  error: { color: colors.error, marginTop: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, flexWrap: 'wrap' },
  actionButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  actionText: { color: colors.primary, fontWeight: '600' },
  deleteButton: { borderColor: colors.error },
  deleteText: { color: colors.error, fontWeight: '600' },
  transferPanel: { marginTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg },
  transferTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md },
  transferring: { color: colors.textMuted, marginTop: spacing.sm },
});
