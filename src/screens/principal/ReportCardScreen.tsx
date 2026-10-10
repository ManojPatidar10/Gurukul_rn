import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { downloadStudentReportCardPdf, PDF_MIME_TYPE } from '../../api/reportCardPdf';
import { getPublishedTerms, getReportCard } from '../../api/reportCards';
import type { PublishedTerm, ReportCard } from '../../api/types';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { useAcademicTerms } from '../../hooks/useAcademicTerms';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';
import { latestPublishedTerm, reportCardTermChips, termChipKey, termKey } from '../../utils/academicTerms';
import {
  assessmentMarkLabel,
  attendanceLabelKey,
  formatOverallGrade,
  formatOverallPercentage,
  formatSubjectGrade,
  formatSubjectPercentage,
  hasAbsentOrExcused,
  missingMarksCount,
  subjectCounts,
} from '../../utils/reportCardDisplay';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'ReportCard'>;

export function ReportCardScreen({ route, navigation }: Props) {
  const { t, i18n } = useTranslation();
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const { showToast } = useToast();
  const isSelfView = session.role === 'STUDENT' || session.role === 'PARENT';
  const { student, defaultTerm, defaultSectionId } = route.params;
  // Staff can also preview a draft for one of the school's listed terms. Students and parents only
  // ever see published terms, so they don't need the list.
  const {
    terms: listedTerms,
    configured: termListConfigured,
    loading: termListLoading,
  } = useAcademicTerms(schoolId, !isSelfView);
  // Typed by staff in a school without a term list (or from an older server): today's free text.
  const [typedTerm, setTypedTerm] = useState(defaultTerm ?? '');
  // The chip shown as selected: `classSectionId:term` (termChipKey).
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [publishedTerms, setPublishedTerms] = useState<PublishedTerm[]>([]);
  const [reportCard, setReportCard] = useState<ReportCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  // Staff opening a student with nothing published yet: no term is guessed, they pick or type one.
  const [nothingPublished, setNothingPublished] = useState(false);
  const [downloading, setDownloading] = useState(false);
  // Subjects whose per-assessment list is open.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Ignores a slow response for a term the user has since moved away from.
  const loadSeq = useRef(0);

  const load = (term: string, sectionId?: string) => {
    const seq = ++loadSeq.current;
    setSelectedKey(termChipKey(term, sectionId));
    setTypedTerm(term);
    setLoading(true);
    setError(null);
    setHasLoaded(true);
    setExpanded(new Set());
    getReportCard(schoolId, student.id, term, sectionId)
      .then((card) => {
        if (seq === loadSeq.current) setReportCard(card);
      })
      .catch((e) => {
        if (seq !== loadSeq.current) return;
        setReportCard(null);
        setError(getErrorMessage(e));
      })
      .finally(() => {
        if (seq === loadSeq.current) setLoading(false);
      });
  };

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      // The card's own class, so the PDF is the card on screen (an earlier class after promotion).
      const file = await downloadStudentReportCardPdf(schoolId, student.id, student.name, reportCard?.term ?? typedTerm, {
        sectionId: reportCard?.classSectionId,
        rollNumber: reportCard?.rollNumber,
      });
      if (!(await Sharing.isAvailableAsync())) {
        showToast(t('reportCardPdf.savedTo', { path: file.uri }), 'success');
        return;
      }
      await Sharing.shareAsync(file.uri, {
        mimeType: PDF_MIME_TYPE,
        UTI: 'com.adobe.pdf',
        dialogTitle: t('reportCardPdf.shareTitle'),
      });
    } catch (e) {
      showToast(t('reportCardPdf.failed', { message: getErrorMessage(e) }), 'error');
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    if (defaultTerm) {
      // From a notification or a link: open that term (and class) straight away, and load the
      // published terms only for the chips.
      load(defaultTerm, defaultSectionId);
      const openedKey = termChipKey(defaultTerm, defaultSectionId);
      getPublishedTerms(schoolId, student.id)
        .then((terms) => {
          setPublishedTerms(terms);
          // Mark the matching chip, unless the user has already picked another term.
          const match = terms.find(
            (entry) =>
              termKey(entry.term) === termKey(defaultTerm) &&
              (defaultSectionId ? entry.classSectionId === defaultSectionId : entry.current !== false)
          );
          if (match) {
            const matchKey = termChipKey(match.term, match.classSectionId);
            setSelectedKey((current) => (current === openedKey ? matchKey : current));
          }
        })
        .catch(() => {});
      return;
    }
    // Ask the server which terms are published rather than guessing a term name, and open the
    // latest by the term's dates (else by when it was published). With nothing published, a
    // student or parent is told so; staff get a prompt to pick or type a term to preview a draft,
    // never a guessed "Term 1".
    getPublishedTerms(schoolId, student.id)
      .then((terms) => {
        setPublishedTerms(terms);
        const latest = latestPublishedTerm(terms);
        if (latest) {
          load(latest.term, latest.classSectionId);
        } else if (isSelfView) {
          setError('No report card has been published for your class yet.');
        } else {
          setNothingPublished(true);
        }
      })
      .catch((e) => setError(getErrorMessage(e)));
    // Only auto-load once on mount - further loads are a tap on a term chip (or staff's "View"
    // button), so typing a term doesn't fire a request per keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chips = reportCardTermChips(publishedTerms, termListConfigured ? listedTerms : [], !isSelfView);
  // Students and parents only pick from chips. Staff type a term only while the school has no term list.
  const showTypedTerm = !isSelfView && !termListLoading && !termListConfigured;

  const formatDate = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' });

  const toggleSubject = (subjectId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(subjectId)) next.delete(subjectId);
      else next.add(subjectId);
      return next;
    });

  // Shown on the card so a half-filled one doesn't look finished.
  const missingMarks = missingMarksCount(reportCard?.missingMarksCount);
  const attendanceLabel = reportCard ? attendanceLabelKey(reportCard, formatDate) : null;

  return (
    <View style={styles.root}>
      <ScreenHeader title={`${student.name}'s report card`} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        {showTypedTerm && (
          <View style={styles.termRow}>
            <TextInput
              style={styles.termInput}
              value={typedTerm}
              onChangeText={setTypedTerm}
              placeholder="Term (e.g. Term 1)"
              placeholderTextColor={colors.textMuted}
            />
            <Pressable style={styles.viewButton} onPress={() => load(typedTerm.trim())} disabled={!typedTerm.trim() || loading}>
              {loading ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.viewButtonText}>View</Text>}
            </Pressable>
          </View>
        )}
        {chips.length > 0 && (
          <View style={styles.chips}>
            {chips.map((chip) => {
              const selected = selectedKey === chip.key;
              return (
                <Pressable
                  key={chip.key}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => load(chip.term, chip.sectionId)}
                  disabled={loading}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected, disabled: loading }}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {chip.published ? chip.label : t('reportCardDetail.draftChip', { term: chip.label })}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {loading && <ActivityIndicator style={styles.loading} color={colors.primary} />}
        {!loading && error && <ErrorNotice message={error} />}
        {!loading && !error && !hasLoaded && nothingPublished && (
          <Text style={styles.empty}>
            {termListConfigured
              ? t('reportCardDetail.pickTermPreview')
              : 'No report card has been published for this student yet. Type a term above and tap View to preview one.'}
          </Text>
        )}

        {!loading && !error && hasLoaded && reportCard && (
          <>
            <View style={styles.headerCard}>
              <View style={styles.headerRow}>
                {/* The card's own class: an earlier one when it's from before a promotion. */}
                <Text style={styles.headerClass}>
                  {reportCard.className} - {reportCard.section} · {reportCard.academicYear}
                </Text>
                <StatusChip
                  label={reportCard.published ? 'Published' : 'Draft'}
                  variant={reportCard.published ? 'success' : 'neutral'}
                />
              </View>
              {!isSelfView && reportCard.published && reportCard.frozen !== undefined && (
                <Text style={styles.liveHint}>{t('reportCardDetail.liveHint')}</Text>
              )}
              {missingMarks > 0 && (
                <View style={styles.missingRow}>
                  <StatusChip label={t('reportCardStatus.marksMissing', { count: missingMarks })} variant="warning" />
                </View>
              )}
              <View style={styles.statRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{formatOverallPercentage(reportCard.overallPercentage)}</Text>
                  <Text style={styles.statLabel}>Overall</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{formatOverallGrade(reportCard.overallGrade)}</Text>
                  <Text style={styles.statLabel}>Grade</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>
                    {reportCard.attendancePercentage != null ? `${reportCard.attendancePercentage}%` : '—'}
                  </Text>
                  <Text style={styles.statLabel}>
                    {attendanceLabel ? t(attendanceLabel.key, attendanceLabel.params) : ''}
                  </Text>
                </View>
              </View>
            </View>

            <Pressable style={[styles.pdfButton, downloading && styles.pdfButtonDisabled]} onPress={handleDownloadPdf} disabled={downloading}>
              {downloading ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Text style={styles.pdfButtonText}>{t('reportCardPdf.download')}</Text>
              )}
            </Pressable>

            <Text style={styles.sectionTitle}>Subjects</Text>
            {reportCard.subjects.length === 0 && (
              <Text style={styles.empty}>No results recorded for this term yet.</Text>
            )}
            {reportCard.subjects.map((subject) => {
              const counts = subjectCounts(subject);
              const assessments = subject.assessments ?? [];
              const open = expanded.has(subject.subjectId);
              return (
                <View key={subject.subjectId} style={styles.subjectCard}>
                  <View style={styles.subjectRow}>
                    <View style={styles.subjectMain}>
                      <Text style={styles.subjectName}>{subject.subjectName}</Text>
                      <Text style={styles.subjectMeta}>
                        {subject.marksObtained} / {subject.maxMarks} · {formatSubjectPercentage(subject.percentage)}
                      </Text>
                    </View>
                    <StatusChip label={formatSubjectGrade(subject.grade)} variant="info" />
                  </View>
                  {(counts.absent > 0 || counts.excused > 0) && (
                    <View style={styles.countRow}>
                      {counts.absent > 0 && (
                        <StatusChip label={t('reportCardDetail.absentCount', { count: counts.absent })} variant="error" />
                      )}
                      {counts.excused > 0 && (
                        <StatusChip label={t('reportCardDetail.excusedCount', { count: counts.excused })} variant="neutral" />
                      )}
                    </View>
                  )}
                  {assessments.length > 0 && (
                    <Pressable
                      onPress={() => toggleSubject(subject.subjectId)}
                      style={styles.expandToggle}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: open }}
                    >
                      <Text style={styles.expandToggleText}>
                        {open
                          ? t('reportCardDetail.hideAssessments')
                          : t('reportCardDetail.showAssessments', { count: assessments.length })}
                      </Text>
                    </Pressable>
                  )}
                  {open &&
                    assessments.map((assessment) => (
                      <View key={assessment.assessmentId} style={styles.assessmentRow}>
                        <View style={styles.assessmentLine}>
                          <View style={styles.assessmentMain}>
                            <Text style={styles.assessmentTitle}>{assessment.title}</Text>
                            <Text style={styles.assessmentDate}>{formatDate(assessment.assessmentDate)}</Text>
                          </View>
                          <Text style={styles.assessmentMark}>{assessmentMarkLabel(assessment)}</Text>
                        </View>
                        {!!assessment.remarks && <Text style={styles.assessmentRemark}>{assessment.remarks}</Text>}
                      </View>
                    ))}
                </View>
              );
            })}
            {hasAbsentOrExcused(reportCard) && <Text style={styles.legend}>{t('reportCardDetail.legend')}</Text>}
          </>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  termRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  termInput: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.textPrimary,
  },
  viewButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  viewButtonText: { color: colors.white, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  chipTextSelected: { color: colors.white },
  loading: { marginTop: spacing.xl },
  error: { color: colors.error, marginBottom: spacing.md },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.md },
  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...softShadow,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  headerClass: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  liveHint: { fontSize: 12.5, color: colors.textMuted, lineHeight: 18, marginBottom: spacing.md },
  missingRow: { flexDirection: 'row', marginBottom: spacing.md },
  statRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  statValue: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  statLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2, textAlign: 'center' },
  pdfButton: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
  },
  pdfButtonDisabled: { opacity: 0.6 },
  pdfButtonText: { color: colors.primary, fontWeight: '700' },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.md },
  subjectCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  subjectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subjectMain: { flex: 1, marginRight: spacing.sm },
  subjectName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  subjectMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  countRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  expandToggle: { alignSelf: 'flex-start', paddingTop: spacing.sm },
  expandToggleText: { fontSize: 12.5, fontWeight: '700', color: colors.primary },
  assessmentRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
  },
  assessmentLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  assessmentMain: { flex: 1 },
  assessmentTitle: { fontSize: 13.5, fontWeight: '600', color: colors.textPrimary },
  assessmentDate: { fontSize: 11.5, color: colors.textMuted, marginTop: 1 },
  assessmentMark: { fontSize: 13.5, fontWeight: '700', color: colors.textSecondary },
  assessmentRemark: { fontSize: 12.5, color: colors.textMuted, marginTop: spacing.xs, lineHeight: 18 },
  legend: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.lg },
});
