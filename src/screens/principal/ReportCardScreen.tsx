import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { getPublishedTerms, getReportCard } from '../../api/reportCards';
import type { PublishedTerm, ReportCard } from '../../api/types';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'ReportCard'>;

const FALLBACK_TERM = 'Term 1';

export function ReportCardScreen({ route, navigation }: Props) {
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const isSelfView = session.role === 'STUDENT' || session.role === 'PARENT';
  const student = route.params.student;
  const [term, setTerm] = useState(route.params.defaultTerm ?? '');
  const [publishedTerms, setPublishedTerms] = useState<PublishedTerm[]>([]);
  const [reportCard, setReportCard] = useState<ReportCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const load = (t: string) => {
    setLoading(true);
    setError(null);
    setHasLoaded(true);
    getReportCard(schoolId, student.id, t)
      .then(setReportCard)
      .catch((e) => {
        setReportCard(null);
        setError((e as Error).message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (route.params.defaultTerm) {
      load(route.params.defaultTerm);
      return;
    }
    // A student/parent opening their own report card is the common case this fixes: rather than
    // guessing a hardcoded term string that may not match whatever a teacher actually typed at
    // publish time, ask the backend which terms are actually published and default to the latest.
    // A teacher/admin previewing a student's card can still freely type any term below (including
    // an unpublished draft), so falling back to a sensible starting guess for them is fine.
    getPublishedTerms(schoolId, student.id)
      .then((terms) => {
        setPublishedTerms(terms);
        if (terms.length > 0) {
          setTerm(terms[0].term);
          load(terms[0].term);
        } else if (isSelfView) {
          setError('No report card has been published for your class yet.');
        } else {
          setTerm(FALLBACK_TERM);
          load(FALLBACK_TERM);
        }
      })
      .catch((e) => setError((e as Error).message));
    // Only auto-load once on mount - further loads are user-triggered via the "View" button or a
    // term chip, so typing a new term doesn't fire a request per keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.root}>
      <ScreenHeader title={`${student.name}'s report card`} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <View style={styles.termRow}>
          <TextInput
            style={styles.termInput}
            value={term}
            onChangeText={setTerm}
            placeholder="Term (e.g. Term 1)"
            placeholderTextColor={colors.textMuted}
          />
          <Pressable style={styles.viewButton} onPress={() => load(term)} disabled={!term.trim() || loading}>
            {loading ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.viewButtonText}>View</Text>}
          </Pressable>
        </View>
        {publishedTerms.length > 0 && (
          <View style={styles.chips}>
            {publishedTerms.map(({ term: t }) => (
              <Pressable
                key={t}
                style={[styles.chip, term === t && styles.chipSelected]}
                onPress={() => {
                  setTerm(t);
                  load(t);
                }}
                disabled={loading}
              >
                <Text style={[styles.chipText, term === t && styles.chipTextSelected]}>{t}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {loading && <ActivityIndicator style={styles.loading} color={colors.primary} />}
        {!loading && error && <Text style={styles.error}>{error}</Text>}

        {!loading && !error && hasLoaded && reportCard && (
          <>
            <View style={styles.headerCard}>
              <View style={styles.headerRow}>
                <Text style={styles.headerClass}>
                  {reportCard.className} - {reportCard.section} · {reportCard.academicYear}
                </Text>
                <StatusChip
                  label={reportCard.published ? 'Published' : 'Draft'}
                  variant={reportCard.published ? 'success' : 'neutral'}
                />
              </View>
              <View style={styles.statRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{reportCard.overallPercentage}%</Text>
                  <Text style={styles.statLabel}>Overall</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{reportCard.overallGrade}</Text>
                  <Text style={styles.statLabel}>Grade</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>
                    {reportCard.attendancePercentage != null ? `${reportCard.attendancePercentage}%` : '—'}
                  </Text>
                  <Text style={styles.statLabel}>Attendance</Text>
                </View>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Subjects</Text>
            {reportCard.subjects.length === 0 && (
              <Text style={styles.empty}>No results recorded for this term yet.</Text>
            )}
            {reportCard.subjects.map((subject) => (
              <View key={subject.subjectId} style={styles.subjectRow}>
                <View style={styles.subjectMain}>
                  <Text style={styles.subjectName}>{subject.subjectName}</Text>
                  <Text style={styles.subjectMeta}>
                    {subject.marksObtained} / {subject.maxMarks} · {subject.percentage}%
                  </Text>
                </View>
                <StatusChip label={subject.grade} variant="info" />
              </View>
            ))}
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
  statRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  statValue: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  statLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.md },
  subjectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  subjectMain: { flex: 1, marginRight: spacing.sm },
  subjectName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  subjectMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
});
