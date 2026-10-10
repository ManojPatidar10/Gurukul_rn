import { usePreventRemove } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getAssessmentResults, submitAssessmentResults } from '../../api/assessments';
import { getGradingScale } from '../../api/gradingScale';
import type { AssessmentResults, StudentResult } from '../../api/types';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';
import {
  buildResultsPayload,
  isResultsDirty,
  MAX_REMARK_LENGTH,
  rowFromResult,
  summarizeResults,
  type ResultRowState,
} from '../../utils/assessmentResults';
import { passMarkFromScale } from '../../utils/gradingScale';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'AssessmentResults'>;

type RowState = ResultRowState;

export function AssessmentResultsScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { assessment, readOnly = false } = route.params;
  const [roster, setRoster] = useState<StudentResult[]>([]);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  // Max marks, term and lock come from the results response: the route's copy of the assessment
  // is whatever the list loaded, and max marks may have changed since.
  const [maxMarks, setMaxMarks] = useState(assessment.maxMarks);
  const [term, setTerm] = useState<string | null>(assessment.term);
  const [locked, setLocked] = useState(false);
  const [passMark, setPassMark] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [invalidIds, setInvalidIds] = useState<Set<string>>(new Set());

  const applyResults = useCallback(
    (data: AssessmentResults) => {
      setRoster(data.results);
      const nextRows: Record<string, RowState> = {};
      data.results.forEach((r) => {
        nextRows[r.studentId] = rowFromResult(r);
      });
      setRows(nextRows);
      setMaxMarks(data.maxMarks);
      // An older server sends neither: keep the route's term, and treat it as unlocked (the server
      // still refuses the save).
      setTerm(data.term !== undefined ? data.term : assessment.term);
      setLocked(data.locked === true);
      setInvalidIds(new Set());
    },
    [assessment.term]
  );

  const fetchResults = useCallback(() => {
    Promise.all([
      getAssessmentResults(schoolId, assessment.id),
      // Pass/Fail needs the school's own pass mark. Without the scale they're hidden; never a guessed 33%.
      getGradingScale(schoolId)
        .then(passMarkFromScale)
        .catch(() => null),
    ])
      .then(([data, mark]) => {
        applyResults(data);
        setPassMark(mark);
      })
      .catch((e) => setLoadError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [schoolId, assessment.id, applyResults]);

  useEffect(fetchResults, [fetchResults]);

  const retryLoad = () => {
    setLoading(true);
    setLoadError(null);
    fetchResults();
  };

  const editable = !locked && !readOnly;
  const dirty = useMemo(() => isResultsDirty(roster, rows), [roster, rows]);

  // Covers the header Back, Android Back and the iOS swipe.
  usePreventRemove(dirty && !saving, ({ data }) => {
    Alert.alert(t('assessmentResults.discardTitle'), t('assessmentResults.discardMessage'), [
      { text: t('assessmentResults.keepEditing'), style: 'cancel' },
      { text: t('assessmentResults.discard'), style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  const summary = useMemo(() => summarizeResults(roster, maxMarks, passMark), [roster, maxMarks, passMark]);

  const setRow = (studentId: string, patch: Partial<RowState>) => {
    setRows((prev) => ({ ...prev, [studentId]: { ...prev[studentId], ...patch } }));
    setSuccess(false);
    if (invalidIds.has(studentId)) {
      setInvalidIds((prev) => {
        const next = new Set(prev);
        next.delete(studentId);
        return next;
      });
    }
  };

  const handleSubmit = async () => {
    setSaveError(null);
    setSuccess(false);
    const { results, invalid } = buildResultsPayload(roster, rows, maxMarks);
    setInvalidIds(new Set(invalid.map((s) => s.studentId)));
    if (invalid.length > 0) {
      setSaveError(
        t('assessmentResults.invalidMarks', {
          names: invalid.map((s) => s.studentName).join(', '),
          max: maxMarks,
        })
      );
      return;
    }
    // Every row blank and nothing saved before - the backend rejects an empty list anyway.
    if (results.length === 0) {
      setSaveError(t('assessmentResults.nothingToSave'));
      return;
    }
    setSaving(true);
    try {
      // The response is the fresh marks list, so applying it clears the unsaved-changes flag.
      applyResults(await submitAssessmentResults(schoolId, assessment.id, results));
      setSuccess(true);
    } catch (e) {
      setSaveError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={assessment.title}
        subtitle={t('assessmentResults.subtitle', { max: maxMarks })}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        {locked && (
          <View style={styles.lockNotice}>
            <Text style={styles.lockNoticeText}>
              {term ? t('assessmentResults.lockedNotice', { term }) : t('assessmentResults.lockedNoticeNoTerm')}
            </Text>
          </View>
        )}
        {loading && <ActivityIndicator style={styles.loading} color={colors.primary} />}
        {loadError && (
          <>
            <ErrorNotice message={loadError} />
            <Pressable onPress={retryLoad} style={styles.retry} disabled={loading}>
              <Text style={styles.retryText}>{t('common.retry')}</Text>
            </Pressable>
          </>
        )}

        {!loading && !loadError && roster.length === 0 && (
          <Text style={styles.empty}>{t('assessmentResults.noStudents')}</Text>
        )}

        {!loadError && roster.length > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>
              {t('assessmentResults.enteredCount', { entered: summary.entered, total: summary.total })}
            </Text>
            {summary.average != null ? (
              <View style={styles.summaryStatRow}>
                <View style={styles.summaryStat}>
                  <Text style={styles.summaryStatValue}>{summary.average.toFixed(1)}</Text>
                  <Text style={styles.summaryStatLabel}>{t('assessmentResults.average')}</Text>
                </View>
                <View style={styles.summaryStat}>
                  <Text style={styles.summaryStatValue}>{summary.highest}</Text>
                  <Text style={styles.summaryStatLabel}>{t('assessmentResults.highest')}</Text>
                </View>
                <View style={styles.summaryStat}>
                  <Text style={styles.summaryStatValue}>{summary.lowest}</Text>
                  <Text style={styles.summaryStatLabel}>{t('assessmentResults.lowest')}</Text>
                </View>
                {summary.passCount != null && passMark != null && (
                  <>
                    <View style={styles.summaryStat}>
                      <Text style={[styles.summaryStatValue, { color: colors.success }]}>{summary.passCount}</Text>
                      <Text style={styles.summaryStatLabel}>{t('assessmentResults.pass', { passMark })}</Text>
                    </View>
                    <View style={styles.summaryStat}>
                      <Text style={[styles.summaryStatValue, { color: colors.error }]}>{summary.failCount}</Text>
                      <Text style={styles.summaryStatLabel}>{t('assessmentResults.fail')}</Text>
                    </View>
                  </>
                )}
              </View>
            ) : (
              <Text style={styles.summaryEmpty}>{t('assessmentResults.noMarksYet')}</Text>
            )}
          </View>
        )}

        {!loadError &&
          roster.map((student) => {
            const row = rows[student.studentId] ?? rowFromResult(student);
            const invalid = invalidIds.has(student.studentId);
            const name = student.studentName;
            return (
              <View key={student.studentId} style={styles.card}>
                <Text style={styles.studentName}>
                  {t('assessmentResults.studentLine', { name, roll: student.rollNumber })}
                </Text>
                <View style={styles.rowInputs}>
                  <TextInput
                    style={[styles.marksInput, row.absent && styles.marksInputDisabled, invalid && styles.inputInvalid]}
                    value={row.marksText}
                    onChangeText={(text) => setRow(student.studentId, { marksText: text })}
                    keyboardType="decimal-pad"
                    placeholder={t('assessmentResults.outOf', { max: maxMarks })}
                    placeholderTextColor={colors.textMuted}
                    editable={editable && !row.absent}
                    accessibilityLabel={t('assessmentResults.marksLabel', { name, roll: student.rollNumber, max: maxMarks })}
                  />
                  <Pressable
                    style={[styles.absentToggle, row.absent && styles.absentToggleActive, !editable && styles.readOnlyToggle]}
                    onPress={() => setRow(student.studentId, { absent: !row.absent })}
                    disabled={!editable}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: row.absent, disabled: !editable }}
                    accessibilityLabel={t('assessmentResults.absentLabel', { name })}
                  >
                    <Text style={[styles.absentToggleText, row.absent && styles.absentToggleTextActive]}>
                      {t('assessmentResults.absent')}
                    </Text>
                  </Pressable>
                </View>
                {/* Stays editable when Absent is ticked - "Absent: medical leave" is a useful remark. */}
                {(editable || row.remarksText.trim() !== '') && (
                  <TextInput
                    style={styles.remarkInput}
                    value={row.remarksText}
                    onChangeText={(text) => setRow(student.studentId, { remarksText: text })}
                    placeholder={t('assessmentResults.remarkPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    maxLength={MAX_REMARK_LENGTH}
                    editable={editable}
                    multiline
                    accessibilityLabel={t('assessmentResults.remarkLabel', { name })}
                  />
                )}
              </View>
            );
          })}

        {editable && !loadError && roster.length > 0 && (
          <View style={styles.saveArea}>
            {saveError && <ErrorNotice message={saveError} />}
            {success && <Text style={styles.success}>{t('assessmentResults.saved')}</Text>}
            <Pressable style={[styles.submit, saving && styles.disabled]} onPress={handleSubmit} disabled={saving}>
              <Text style={styles.submitText}>{saving ? t('common.saving') : t('assessmentResults.save')}</Text>
            </Pressable>
          </View>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  lockNotice: {
    backgroundColor: '#FFF3E0',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  lockNoticeText: { fontSize: 13, fontWeight: '600', color: colors.warning, lineHeight: 19 },
  retry: { alignSelf: 'flex-start', paddingVertical: spacing.sm, marginBottom: spacing.sm },
  retryText: { color: colors.primary, fontWeight: '700' },
  success: { color: colors.success, marginTop: spacing.sm, fontWeight: '600' },
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
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.textPrimary,
  },
  marksInputDisabled: { opacity: 0.4 },
  inputInvalid: { borderColor: colors.error },
  remarkInput: {
    marginTop: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.textPrimary,
  },
  absentToggle: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  absentToggleActive: { backgroundColor: colors.error, borderColor: colors.error },
  readOnlyToggle: { opacity: 0.6 },
  absentToggleText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  absentToggleTextActive: { color: colors.white },
  saveArea: { marginTop: spacing.md, marginBottom: spacing.xl },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    ...softShadow,
  },
  disabled: { opacity: 0.5 },
  submitText: { color: colors.white, fontWeight: '700' },
});
