import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { listSectionTerms } from '../../api/assessments';
import { downloadSectionReportCardsPdf, PDF_MIME_TYPE } from '../../api/reportCardPdf';
import { getSectionReportCards } from '../../api/reportCards';
import type { ReportCard, TermSummary } from '../../api/types';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';
import { defaultSectionTerm } from '../../utils/assessmentTerms';
import { formatOverallGrade, formatOverallPercentage, missingMarksCount } from '../../utils/reportCardDisplay';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'SectionReportCardsGrid'>;

const ROLL_WIDTH = 64;
const NAME_WIDTH = 140;
const SUBJECT_WIDTH = 90;
const SUMMARY_WIDTH = 72;

export function SectionReportCardsGridScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { showToast } = useToast();
  const classSection = route.params.classSection;
  // The section's real terms (from its assessments), not a guessed "Term 1" - a school that names
  // its terms differently would otherwise see every student at 0%.
  const [terms, setTerms] = useState<TermSummary[] | null>(null);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [rows, setRows] = useState<ReportCard[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);
  // The term the grid currently shows.
  const [loadedTerm, setLoadedTerm] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(
    (t: string) => {
      setLoading(true);
      setError(null);
      setHasLoaded(true);
      setSubjectFilter(null);
      setLoadedTerm(t);
      getSectionReportCards(schoolId, classSection.id, t)
        .then(setRows)
        .catch((e) => {
          setRows(null);
          setError(getErrorMessage(e));
        })
        .finally(() => setLoading(false));
    },
    [schoolId, classSection.id]
  );

  // Opens on the latest published term, else the first one; further loads are a tap on a term chip.
  const loadTerms = useCallback(() => {
    listSectionTerms(schoolId, classSection.id)
      .then((loaded) => {
        setTerms(loaded);
        const initial = defaultSectionTerm(loaded);
        if (initial) load(initial);
      })
      .catch((e) => setTermsError(getErrorMessage(e)));
  }, [schoolId, classSection.id, load]);

  const retryTerms = () => {
    setTermsError(null);
    loadTerms();
  };

  const handleDownloadPdf = async () => {
    if (!loadedTerm) return;
    setDownloading(true);
    try {
      const file = await downloadSectionReportCardsPdf(schoolId, classSection, loadedTerm);
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

  useEffect(loadTerms, [loadTerms]);

  // Union of every subject that appears for any student, so a student missing one subject's marks
  // still lines up under the right column instead of shifting the whole row.
  const subjectColumns = useMemo(() => {
    if (!rows) return [];
    const bySubjectId = new Map<string, { subjectId: string; subjectName: string }>();
    rows.forEach((r) => r.subjects.forEach((s) => bySubjectId.set(s.subjectId, s)));
    return Array.from(bySubjectId.values()).sort((a, b) => a.subjectName.localeCompare(b.subjectName));
  }, [rows]);

  const visibleSubjectColumns = useMemo(
    () => (subjectFilter ? subjectColumns.filter((s) => s.subjectId === subjectFilter) : subjectColumns),
    [subjectColumns, subjectFilter]
  );

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={`${classSection.className} - ${classSection.section}`}
        subtitle="Class marks grid"
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        {terms === null && !termsError && <ActivityIndicator style={styles.loading} color={colors.primary} />}
        {termsError && (
          <>
            <ErrorNotice message={termsError} />
            <Pressable onPress={retryTerms} style={styles.retry}>
              <Text style={styles.retryText}>{t('common.retry')}</Text>
            </Pressable>
          </>
        )}
        {terms !== null && terms.length === 0 && <Text style={styles.empty}>{t('reportCardStatus.noTerms')}</Text>}
        {terms !== null && terms.length > 0 && (
          <View style={styles.chips}>
            {terms.map(({ term, published }) => (
              <Pressable
                key={term}
                style={[styles.chip, loadedTerm === term && styles.chipSelected]}
                onPress={() => load(term)}
                disabled={loading}
              >
                <Text style={[styles.chipText, loadedTerm === term && styles.chipTextSelected]}>
                  {term}
                  {published ? ' ✓' : ''}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {loading && <ActivityIndicator style={styles.loading} color={colors.primary} />}
        {!loading && error && <ErrorNotice message={error} />}
        {!loading && !error && hasLoaded && rows != null && rows.length === 0 && (
          <Text style={styles.empty}>0 students in this section.</Text>
        )}

        {!loading && !error && rows != null && rows.length > 0 && (
          <Pressable
            style={[styles.pdfButton, downloading && styles.pdfButtonDisabled]}
            onPress={handleDownloadPdf}
            disabled={downloading}
          >
            {downloading ? (
              <View style={styles.pdfButtonBusy}>
                <ActivityIndicator color={colors.primary} size="small" />
                <Text style={styles.pdfButtonText}>{t('reportCardPdf.downloading')}</Text>
              </View>
            ) : (
              <Text style={styles.pdfButtonText}>{t('reportCardPdf.downloadClass')}</Text>
            )}
          </Pressable>
        )}

        {!loading && !error && subjectColumns.length > 1 && (
          <View style={styles.chips}>
            <Pressable
              style={[styles.chip, subjectFilter === null && styles.chipSelected]}
              onPress={() => setSubjectFilter(null)}
            >
              <Text style={[styles.chipText, subjectFilter === null && styles.chipTextSelected]}>All subjects</Text>
            </Pressable>
            {subjectColumns.map((s) => (
              <Pressable
                key={s.subjectId}
                style={[styles.chip, subjectFilter === s.subjectId && styles.chipSelected]}
                onPress={() => setSubjectFilter(s.subjectId)}
              >
                <Text style={[styles.chipText, subjectFilter === s.subjectId && styles.chipTextSelected]}>
                  {s.subjectName}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {!loading && !error && rows != null && rows.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator style={styles.gridScroll}>
            <View>
              <View style={[styles.row, styles.headerRow]}>
                <Text style={[styles.headerCell, { width: ROLL_WIDTH }]}>Roll</Text>
                <Text style={[styles.headerCell, { width: NAME_WIDTH }]}>Name</Text>
                {visibleSubjectColumns.map((s) => (
                  <Text key={s.subjectId} style={[styles.headerCell, { width: SUBJECT_WIDTH }]} numberOfLines={2}>
                    {s.subjectName}
                  </Text>
                ))}
                <Text style={[styles.headerCell, { width: SUMMARY_WIDTH }]}>Total</Text>
                <Text style={[styles.headerCell, { width: SUMMARY_WIDTH }]}>%</Text>
                <Text style={[styles.headerCell, { width: SUMMARY_WIDTH }]}>Grade</Text>
              </View>

              {rows.map((r, index) => (
                <View key={r.studentId} style={[styles.row, index % 2 === 1 && styles.rowAlt]}>
                  <Text style={[styles.cell, { width: ROLL_WIDTH }]}>{r.rollNumber}</Text>
                  <View style={[styles.nameCellBox, { width: NAME_WIDTH }]}>
                    <Text style={styles.nameCell} numberOfLines={1}>
                      {r.studentName}
                    </Text>
                    {missingMarksCount(r.missingMarksCount) > 0 && (
                      <Text style={styles.missingChip} numberOfLines={1}>
                        {t('reportCardStatus.marksMissing', { count: missingMarksCount(r.missingMarksCount) })}
                      </Text>
                    )}
                  </View>
                  {visibleSubjectColumns.map((col) => {
                    const subject = r.subjects.find((s) => s.subjectId === col.subjectId);
                    return (
                      <Text key={col.subjectId} style={[styles.cell, { width: SUBJECT_WIDTH }]}>
                        {subject ? `${subject.marksObtained}/${subject.maxMarks}` : '—'}
                      </Text>
                    );
                  })}
                  <Text style={[styles.cell, { width: SUMMARY_WIDTH }]}>{r.totalMarksObtained}</Text>
                  <Text style={[styles.cell, { width: SUMMARY_WIDTH }]}>{formatOverallPercentage(r.overallPercentage)}</Text>
                  <Text style={[styles.cell, styles.gradeCell, { width: SUMMARY_WIDTH }]}>
                    {formatOverallGrade(r.overallGrade)}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  pdfButton: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  pdfButtonDisabled: { opacity: 0.6 },
  pdfButtonBusy: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pdfButtonText: { color: colors.primary, fontWeight: '700' },
  root: { flex: 1, backgroundColor: colors.background },
  retry: { alignSelf: 'flex-start', paddingVertical: spacing.sm },
  retryText: { color: colors.primary, fontWeight: '700' },
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
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
  gridScroll: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...softShadow,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowAlt: { backgroundColor: colors.surfaceMuted },
  headerRow: { backgroundColor: colors.surfaceMuted, borderBottomWidth: 2 },
  headerCell: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: 11.5,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  cell: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: 13,
    color: colors.textPrimary,
  },
  nameCellBox: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, justifyContent: 'center' },
  nameCell: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  missingChip: {
    alignSelf: 'flex-start',
    marginTop: 2,
    paddingHorizontal: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: '#FFF3E0',
    color: colors.warning,
    fontSize: 10.5,
    fontWeight: '700',
    overflow: 'hidden',
  },
  gradeCell: { fontWeight: '800', color: colors.primary },
});
