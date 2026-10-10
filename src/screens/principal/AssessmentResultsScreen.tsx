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
  clearMovedEntry,
  isResultsDirty,
  MAX_REMARK_LENGTH,
  resultsGridMode,
  rowFromResult,
  savedResultLabel,
  summarizeResults,
  supportsExcused as serverSupportsExcused,
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
  // Results saved for students who have since left the section: read-only here, and only clearable.
  const [movedStudents, setMovedStudents] = useState<StudentResult[]>([]);
  // Only a server that sends `excused` on its rows knows Excused; an older one gets no toggle.
  const [supportsExcused, setSupportsExcused] = useState(false);
  const [clearingId, setClearingId] = useState<string | null>(null);
  const [clearError, setClearError] = useState<string | null>(null);
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
      const moved = data.movedStudents ?? [];
      setMovedStudents(moved);
      setSupportsExcused(serverSupportsExcused([...data.results, ...moved]));
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

  // A Clear is a save too: its response replaces every row, so the grid waits for it like for Save.
  const { editable, inputsEnabled } = resultsGridMode({ locked, readOnly, saving: saving || clearingId !== null });
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
    const { results, invalid } = buildResultsPayload(roster, rows, maxMarks, { supportsExcused });
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

  // Clears a moved student's result on its own save call. Only offered while the grid has no unsaved
  // changes: the response replaces the whole grid, so anything typed would be lost.
  const confirmClearMoved = (student: StudentResult) => {
    Alert.alert(
      t('assessmentResults.clearConfirmTitle'),
      t('assessmentResults.clearConfirmMessage', { name: student.studentName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('assessmentResults.clear'),
          style: 'destructive',
          onPress: async () => {
            setClearingId(student.studentId);
            setClearError(null);
            setSuccess(false);
            try {
              applyResults(await submitAssessmentResults(schoolId, assessment.id, [clearMovedEntry(student.studentId)]));
            } catch (e) {
              setClearError(getErrorMessage(e));
            } finally {
              setClearingId(null);
            }
          },
        },
      ]
    );
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

        {editable && !loadError && roster.length > 0 && (
          <Text style={styles.remarkHint}>{t('assessmentResults.remarkVisibleHint')}</Text>
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
                    style={[
                      styles.marksInput,
                      (row.absent || row.excused) && styles.marksInputDisabled,
                      invalid && styles.inputInvalid,
                    ]}
                    value={row.marksText}
                    onChangeText={(text) => setRow(student.studentId, { marksText: text })}
                    keyboardType="decimal-pad"
                    placeholder={t('assessmentResults.outOf', { max: maxMarks })}
                    placeholderTextColor={colors.textMuted}
                    editable={inputsEnabled && !row.absent && !row.excused}
                    accessibilityLabel={t('assessmentResults.marksLabel', { name, roll: student.rollNumber, max: maxMarks })}
                  />
                  <Pressable
                    style={[styles.absentToggle, row.absent && styles.absentToggleActive, !editable && styles.readOnlyToggle]}
                    // Absent and Excused can't both be set: ticking one unticks the other.
                    onPress={() => setRow(student.studentId, { absent: !row.absent, excused: false })}
                    disabled={!inputsEnabled}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: row.absent, disabled: !inputsEnabled }}
                    accessibilityLabel={t('assessmentResults.absentLabel', { name })}
                  >
                    <Text style={[styles.absentToggleText, row.absent && styles.absentToggleTextActive]}>
                      {t('assessmentResults.absent')}
                    </Text>
                  </Pressable>
                  {supportsExcused && (
                    <Pressable
                      style={[styles.absentToggle, row.excused && styles.excusedToggleActive, !editable && styles.readOnlyToggle]}
                      onPress={() => setRow(student.studentId, { excused: !row.excused, absent: false })}
                      disabled={!inputsEnabled}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: row.excused, disabled: !inputsEnabled }}
                      accessibilityLabel={t('assessmentResults.excusedLabel', { name })}
                    >
                      <Text style={[styles.absentToggleText, row.excused && styles.absentToggleTextActive]}>
                        {t('assessmentResults.excused')}
                      </Text>
                    </Pressable>
                  )}
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
                    editable={inputsEnabled}
                    multiline
                    accessibilityLabel={t('assessmentResults.remarkLabel', { name })}
                  />
                )}
              </View>
            );
          })}

        {!loadError && movedStudents.length > 0 && (
          <View style={styles.movedArea}>
            <Text style={styles.movedTitle}>{t('assessmentResults.movedTitle')}</Text>
            <Text style={styles.movedHint}>{t('assessmentResults.movedHint')}</Text>
            {editable && dirty && <Text style={styles.movedWarning}>{t('assessmentResults.saveFirst')}</Text>}
            {clearError && <ErrorNotice message={clearError} />}
            {movedStudents.map((student) => (
              <View key={student.studentId} style={styles.card}>
                <View style={styles.movedRow}>
                  <View style={styles.movedMain}>
                    <Text style={styles.studentName}>
                      {t('assessmentResults.studentLine', { name: student.studentName, roll: student.rollNumber })}
                    </Text>
                    <Text style={styles.movedValue}>{savedResultLabel(student, maxMarks)}</Text>
                    {!!student.remarks?.trim() && <Text style={styles.movedRemark}>{student.remarks}</Text>}
                  </View>
                  {editable && (
                    <Pressable
                      style={[styles.clearButton, (dirty || !inputsEnabled) && styles.disabled]}
                      onPress={() => confirmClearMoved(student)}
                      disabled={dirty || !inputsEnabled}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: dirty || !inputsEnabled }}
                    >
                      {clearingId === student.studentId ? (
                        <ActivityIndicator color={colors.error} size="small" />
                      ) : (
                        <Text style={styles.clearButtonText}>{t('assessmentResults.clear')}</Text>
                      )}
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

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
  excusedToggleActive: { backgroundColor: colors.textSecondary, borderColor: colors.textSecondary },
  readOnlyToggle: { opacity: 0.6 },
  absentToggleText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  absentToggleTextActive: { color: colors.white },
  saveArea: { marginTop: spacing.md, marginBottom: spacing.xl },
  remarkHint: { fontSize: 12.5, color: colors.textMuted, lineHeight: 18, marginBottom: spacing.md },
  movedArea: { marginTop: spacing.lg },
  movedTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.xs },
  movedHint: { fontSize: 12.5, color: colors.textMuted, lineHeight: 18, marginBottom: spacing.sm },
  movedWarning: { fontSize: 12.5, fontWeight: '600', color: colors.warning, marginBottom: spacing.sm },
  movedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  movedMain: { flex: 1 },
  movedValue: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  movedRemark: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs },
  clearButton: {
    borderWidth: 1.5,
    borderColor: colors.error,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: 64,
    alignItems: 'center',
  },
  clearButtonText: { fontSize: 12, fontWeight: '700', color: colors.error },
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
