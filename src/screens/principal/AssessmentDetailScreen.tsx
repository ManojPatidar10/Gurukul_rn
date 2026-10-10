import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { deleteAssessment } from '../../api/assessments';
import { ApiError } from '../../api/client';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { useSectionAssignments } from '../../hooks/useSectionAssignments';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';
import { assessmentTypeLabel, hasMarksMessage } from '../../utils/assessmentLabels';
import { actionAccess, assessmentPermissions, rightsDependOnAssignments } from '../../utils/assessmentPermissions';

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
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const { assessment, classSection } = route.params;
  const isStaff = session.role === 'ADMIN' || session.role === 'TEACHER';
  const sectionAssignments = useSectionAssignments(schoolId, isStaff ? classSection.id : null);
  const permissions = assessmentPermissions(session, classSection, sectionAssignments.assignments);
  const canView = permissions.canViewResults(assessment);
  const assignmentsMatter = rightsDependOnAssignments(session, classSection);
  const manageAccess = actionAccess(
    permissions.canManageAssessment(assessment),
    assignmentsMatter,
    sectionAssignments.loading
  );
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openResults = () => navigation.navigate('AssessmentResults', { assessment });

  const handleDelete = () => {
    Alert.alert(t('assessments.detail.deleteTitle'), t('assessments.detail.deleteBody', { title: assessment.title }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          setError(null);
          try {
            await deleteAssessment(schoolId, assessment.id);
            navigation.goBack();
          } catch (e) {
            setDeleting(false);
            // The server refuses while any student has marks, Absent or a remark saved, and says how many.
            if (e instanceof ApiError && e.status === 409 && e.errorCode === 'ASSESSMENT_HAS_MARKS') {
              Alert.alert(t('assessments.detail.cannotDeleteTitle'), hasMarksMessage(e, t), [
                { text: t('assessments.detail.close'), style: 'cancel' },
                { text: t('assessments.detail.enterResults'), onPress: openResults },
              ]);
              return;
            }
            setError(getErrorMessage(e));
          }
        },
      },
    ]);
  };

  const subject = assessment.subjectName
    ? `${assessment.subjectName}${assessment.subjectCode ? ` (${assessment.subjectCode})` : ''}`
    : '';

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={assessment.title}
        subtitle={assessment.subjectName ?? undefined}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        <View style={styles.statusRow}>
          <StatusChip label={assessmentTypeLabel(assessment.type, t)} variant="neutral" />
        </View>

        <View style={styles.card}>
          <Field label={t('assessments.detail.subject')} value={subject} />
          <Field label={t('assessments.detail.date')} value={assessment.assessmentDate} />
          <Field label={t('assessments.detail.maxMarks')} value={String(assessment.maxMarks)} />
          <Field label={t('assessments.detail.term')} value={assessment.term ?? ''} />
          <Field label={t('assessments.detail.description')} value={assessment.description} />
          <Field label={t('assessments.detail.createdBy')} value={assessment.createdByTeacherName ?? ''} />
        </View>

        {error && <ErrorNotice message={error} />}

        {assignmentsMatter && sectionAssignments.error && (
          <View style={styles.assignmentsNotice}>
            <Text style={styles.assignmentsNoticeText}>{t('assessments.subjectsCheckFailed')}</Text>
            <Pressable onPress={sectionAssignments.reload} disabled={sectionAssignments.loading}>
              <Text style={styles.retryText}>{t('common.retry')}</Text>
            </Pressable>
          </View>
        )}

        {manageAccess === 'allowed' ? (
          <View style={styles.actions}>
            <Pressable style={styles.actionButton} onPress={openResults}>
              <Text style={styles.actionText}>{t('assessments.detail.enterResults')}</Text>
            </Pressable>
            <Pressable
              style={styles.actionButton}
              onPress={() => navigation.navigate('AssessmentForm', { classSection, assessment })}
            >
              <Text style={styles.actionText}>{t('common.edit')}</Text>
            </Pressable>
            <Pressable style={[styles.actionButton, styles.deleteButton]} onPress={handleDelete} disabled={deleting}>
              <Text style={styles.deleteText}>{deleting ? t('common.deleting') : t('common.delete')}</Text>
            </Pressable>
          </View>
        ) : manageAccess === 'checking' ? (
          // A subject teacher's buttons wait on their subjects - say so rather than show none.
          <View style={styles.checkingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.checkingText}>{t('assessments.checkingSubjects')}</Text>
          </View>
        ) : (
          canView && (
            <View style={styles.actions}>
              <Pressable
                style={styles.actionButton}
                onPress={() => navigation.navigate('AssessmentResults', { assessment, readOnly: true })}
              >
                <Text style={styles.actionText}>{t('assessments.detail.viewResults')}</Text>
              </Pressable>
            </View>
          )
        )}
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
  assignmentsNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  assignmentsNoticeText: { flex: 1, fontSize: 12, color: colors.textMuted },
  retryText: { color: colors.primary, fontWeight: '700' },
  checkingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkingText: { fontSize: 13, color: colors.textMuted },
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
