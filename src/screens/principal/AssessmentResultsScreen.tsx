import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { getAssessmentResults, submitAssessmentResults } from '../../api/assessments';
import type { AssessmentResultEntry, StudentResult } from '../../api/types';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'AssessmentResults'>;

interface RowState {
  marksText: string;
  absent: boolean;
}

export function AssessmentResultsScreen({ route, navigation }: Props) {
  const schoolId = useSchoolId();
  const assessment = route.params.assessment;
  const [roster, setRoster] = useState<StudentResult[]>([]);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    getAssessmentResults(schoolId, assessment.id)
      .then((data) => {
        setRoster(data.results);
        const nextRows: Record<string, RowState> = {};
        data.results.forEach((r) => {
          nextRows[r.studentId] = { marksText: r.marksObtained != null ? String(r.marksObtained) : '', absent: r.absent };
        });
        setRows(nextRows);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [schoolId, assessment.id]);

  // Quick sanity-check stats for the teacher before publishing goes to the principal - "pass"
  // uses the same 33% floor as the default grading scale's D/F boundary (GradingScaleService).
  const summary = useMemo(() => {
    const entered = roster.filter((r) => r.absent || r.marksObtained != null);
    const scored = roster.filter(
      (r): r is StudentResult & { marksObtained: number } => !r.absent && r.marksObtained != null
    );
    if (scored.length === 0) {
      return { entered: entered.length, total: roster.length, average: null, highest: null, lowest: null, passCount: 0, failCount: 0 };
    }
    const marks = scored.map((r) => r.marksObtained);
    const passThreshold = assessment.maxMarks * 0.33;
    const passCount = scored.filter((r) => r.marksObtained >= passThreshold).length;
    return {
      entered: entered.length,
      total: roster.length,
      average: marks.reduce((a, b) => a + b, 0) / marks.length,
      highest: Math.max(...marks),
      lowest: Math.min(...marks),
      passCount,
      failCount: scored.length - passCount,
    };
  }, [roster, assessment.maxMarks]);

  const setRow = (studentId: string, patch: Partial<RowState>) => {
    setRows((prev) => ({ ...prev, [studentId]: { ...prev[studentId], ...patch } }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const results: AssessmentResultEntry[] = roster.map((r) => {
        const row = rows[r.studentId] ?? { marksText: '', absent: false };
        const marks = Number(row.marksText);
        return {
          studentId: r.studentId,
          absent: row.absent,
          marksObtained: !row.absent && row.marksText.trim() && !Number.isNaN(marks) ? marks : undefined,
        };
      });
      await submitAssessmentResults(schoolId, assessment.id, results);
      setSuccess(true);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={assessment.title}
        subtitle={`Results · Max ${assessment.maxMarks}`}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        {loading && <ActivityIndicator style={styles.loading} color={colors.primary} />}
        {error && <Text style={styles.error}>{error}</Text>}
        {success && <Text style={styles.success}>Results saved.</Text>}

        {!loading && roster.length === 0 && <Text style={styles.empty}>0 students in this section.</Text>}

        {!loading && roster.length > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>
              {summary.entered} / {summary.total} entered
            </Text>
            {summary.average != null ? (
              <View style={styles.summaryStatRow}>
                <View style={styles.summaryStat}>
                  <Text style={styles.summaryStatValue}>{summary.average.toFixed(1)}</Text>
                  <Text style={styles.summaryStatLabel}>Average</Text>
                </View>
                <View style={styles.summaryStat}>
                  <Text style={styles.summaryStatValue}>{summary.highest}</Text>
                  <Text style={styles.summaryStatLabel}>Highest</Text>
                </View>
                <View style={styles.summaryStat}>
                  <Text style={styles.summaryStatValue}>{summary.lowest}</Text>
                  <Text style={styles.summaryStatLabel}>Lowest</Text>
                </View>
                <View style={styles.summaryStat}>
                  <Text style={[styles.summaryStatValue, { color: colors.success }]}>{summary.passCount}</Text>
                  <Text style={styles.summaryStatLabel}>Pass</Text>
                </View>
                <View style={styles.summaryStat}>
                  <Text style={[styles.summaryStatValue, { color: colors.error }]}>{summary.failCount}</Text>
                  <Text style={styles.summaryStatLabel}>Fail</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.summaryEmpty}>No marks entered yet.</Text>
            )}
          </View>
        )}

        {roster.map((student) => {
          const row = rows[student.studentId] ?? { marksText: '', absent: false };
          return (
            <View key={student.studentId} style={styles.card}>
              <Text style={styles.studentName}>
                {student.studentName} · Roll {student.rollNumber}
              </Text>
              <View style={styles.rowInputs}>
                <TextInput
                  style={[styles.marksInput, row.absent && styles.marksInputDisabled]}
                  value={row.marksText}
                  onChangeText={(text) => setRow(student.studentId, { marksText: text })}
                  keyboardType="numeric"
                  placeholder={`/ ${assessment.maxMarks}`}
                  placeholderTextColor={colors.textMuted}
                  editable={!row.absent}
                />
                <Pressable
                  style={[styles.absentToggle, row.absent && styles.absentToggleActive]}
                  onPress={() => setRow(student.studentId, { absent: !row.absent })}
                >
                  <Text style={[styles.absentToggleText, row.absent && styles.absentToggleTextActive]}>Absent</Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        {roster.length > 0 && (
          <Pressable style={[styles.submit, saving && styles.disabled]} onPress={handleSubmit} disabled={saving}>
            <Text style={styles.submitText}>{saving ? 'Saving…' : 'Save results'}</Text>
          </Pressable>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  error: { color: colors.error, marginBottom: spacing.md },
  success: { color: colors.success, marginBottom: spacing.md, fontWeight: '600' },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
  summaryCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  summaryTitle: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.sm },
  summaryEmpty: { fontSize: 13, color: colors.textMuted },
  summaryStatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  summaryStat: { alignItems: 'center', minWidth: 56 },
  summaryStatValue: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  summaryStatLabel: { fontSize: 10.5, color: colors.textMuted, marginTop: 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...softShadow,
  },
  studentName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  rowInputs: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  marksInput: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.textPrimary,
  },
  marksInputDisabled: { opacity: 0.4 },
  absentToggle: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  absentToggleActive: { backgroundColor: colors.error, borderColor: colors.error },
  absentToggleText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  absentToggleTextActive: { color: colors.white },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    ...softShadow,
  },
  disabled: { opacity: 0.5 },
  submitText: { color: colors.white, fontWeight: '700' },
});
