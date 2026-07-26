import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { deleteAssessment } from '../../api/assessments';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'AssessmentDetail'>;

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value || '—'}</Text>
    </View>
  );
}

export function AssessmentDetailScreen({ route, navigation }: Props) {
  const schoolId = useSchoolId();
  const { assessment, classSection } = route.params;
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = () => {
    Alert.alert('Delete assessment', `Remove "${assessment.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          setError(null);
          try {
            await deleteAssessment(schoolId, assessment.id);
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
      <ScreenHeader title={assessment.title} subtitle={assessment.subjectName} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <View style={styles.statusRow}>
          <StatusChip label={assessment.type} variant="neutral" />
        </View>

        <View style={styles.card}>
          <Field label="Subject" value={`${assessment.subjectName} (${assessment.subjectCode})`} />
          <Field label="Date" value={assessment.assessmentDate} />
          <Field label="Max marks" value={String(assessment.maxMarks)} />
          <Field label="Description" value={assessment.description} />
          <Field label="Created by" value={assessment.createdByTeacherName} />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.actions}>
          <Pressable
            style={styles.actionButton}
            onPress={() => navigation.navigate('AssessmentForm', { classSection, assessment })}
          >
            <Text style={styles.actionText}>Edit</Text>
          </Pressable>
          <Pressable style={[styles.actionButton, styles.deleteButton]} onPress={handleDelete} disabled={deleting}>
            <Text style={styles.deleteText}>{deleting ? 'Deleting…' : 'Delete'}</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  statusRow: { marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...softShadow,
  },
  field: { marginBottom: spacing.md },
  fieldLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '700' },
  fieldValue: { fontSize: 16, color: colors.textPrimary, marginTop: 2 },
  error: { color: colors.error, marginBottom: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  actionButton: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  actionText: { color: colors.primary, fontWeight: '700' },
  deleteButton: { backgroundColor: '#FFEBEE' },
  deleteText: { color: colors.error, fontWeight: '700' },
});
