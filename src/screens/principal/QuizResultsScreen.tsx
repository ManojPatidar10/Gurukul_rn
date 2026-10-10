import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '../../api/errorMessage';
import { getSectionQuizSummary, type SectionQuizSummary, type SubjectOption } from '../../api/quizInsights';
import { ErrorNotice } from '../../components/ErrorNotice';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import {
  DEFAULT_RANGE_DAYS,
  RANGE_PRESETS,
  accuracyBand,
  bandChipVariant,
  formatIstDay,
  formatPercent,
  formatRange,
  gameBreakdown,
  rangeForDays,
  sortStudents,
  summaryEmptyMessage,
  totalsSummary,
  type StudentSortKey,
} from '../../utils/quizInsights';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'QuizResults'>;

const SORTS: { key: StudentSortKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'leastActive', label: 'Least active' },
  { key: 'lowestAccuracy', label: 'Lowest accuracy' },
];

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Text
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      {label}
    </Text>
  );
}

/**
 * How a class's students did in Practice, Arena and Battle Rooms over a period. Reached from the
 * section screen by the admin, the class teacher and the section's subject teachers; the server
 * limits a subject teacher to the subjects they teach here.
 */
export function QuizResultsScreen({ route, navigation }: Props) {
  const schoolId = useSchoolId();
  const { classSection } = route.params;
  const [days, setDays] = useState<number>(DEFAULT_RANGE_DAYS);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<StudentSortKey>('name');
  // The subject chips come from the latest successful response (the first request has no subject),
  // so they stay usable when a later load fails.
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [allSubjectsAllowed, setAllSubjectsAllowed] = useState(true);
  const [reload, setReload] = useState(0);
  // The outcome of the latest request, tagged with the filters it was for. Until the result for the
  // current filters arrives the screen shows the spinner, never an older period's or subject's numbers.
  const [result, setResult] = useState<{ key: string; summary: SectionQuizSummary | null; error: string | null } | null>(
    null
  );
  const requestKey = `${subjectId ?? ''}|${days}|${reload}`;

  // A response for filters that have since changed is dropped.
  useEffect(() => {
    let cancelled = false;
    getSectionQuizSummary(schoolId, classSection.id, { subjectId, ...rangeForDays(days, new Date()) })
      .then((res) => {
        if (cancelled) return;
        setResult({ key: requestKey, summary: res, error: null });
        setSubjects(res.subjects);
        setAllSubjectsAllowed(res.allSubjectsAllowed);
      })
      .catch((e) => {
        if (!cancelled) setResult({ key: requestKey, summary: null, error: getErrorMessage(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [schoolId, classSection.id, subjectId, days, requestKey]);

  const current = result?.key === requestKey ? result : null;
  const loading = current === null;
  const summary = current?.summary ?? null;
  const error = current?.error ?? null;
  const students = useMemo(() => (summary ? sortStudents(summary.students, sortKey) : []), [summary, sortKey]);
  const selectedSubject = subjects.find((s) => s.id === subjectId) ?? null;
  const allLabel = allSubjectsAllowed ? 'All subjects' : 'All my subjects';
  const emptyMessage = summary ? summaryEmptyMessage(summary.totals) : null;

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Quiz results"
        subtitle={`${classSection.className} - ${classSection.section}`}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        <Text style={styles.fieldLabel}>Period</Text>
        <View style={styles.chips}>
          {RANGE_PRESETS.map((d) => (
            <FilterChip key={d} label={`${d} days`} selected={days === d} onPress={() => setDays(d)} />
          ))}
        </View>

        {subjects.length > 0 && (
          <>
            <Text style={styles.fieldLabel}>Subject</Text>
            <View style={styles.chips}>
              <FilterChip label={allLabel} selected={subjectId === null} onPress={() => setSubjectId(null)} />
              {subjects.map((s) => (
                <FilterChip key={s.id} label={s.name} selected={subjectId === s.id} onPress={() => setSubjectId(s.id)} />
              ))}
            </View>
          </>
        )}

        {selectedSubject && (
          <Pressable
            style={styles.outlineButton}
            onPress={() =>
              navigation.navigate('QuestionStats', {
                subjectId: selectedSubject.id,
                subjectName: selectedSubject.name,
                className: classSection.className,
                classSection,
              })
            }
          >
            <Text style={styles.outlineButtonText}>Question stats</Text>
          </Pressable>
        )}

        {error && (
          <>
            <ErrorNotice message={error} />
            <Pressable style={styles.outlineButton} onPress={() => setReload((n) => n + 1)}>
              <Text style={styles.outlineButtonText}>Retry</Text>
            </Pressable>
          </>
        )}
        {loading && <ActivityIndicator color={colors.primary} style={styles.loading} />}

        {summary && (
          <>
            {summary.totals.students > 0 && (
              <View style={styles.totalsCard}>
                <Text style={styles.totalsTitle}>{summary.subjectName ?? allLabel}</Text>
                <Text style={styles.totalsRange}>{formatRange(summary.from, summary.to)}</Text>
                <Text style={styles.totalsText}>{totalsSummary(summary.totals)}</Text>
              </View>
            )}

            {emptyMessage && <Text style={styles.empty}>{emptyMessage}</Text>}

            {students.length > 0 && (
              <>
                <Text style={styles.fieldLabel}>Sort by</Text>
                <View style={styles.chips}>
                  {SORTS.map((s) => (
                    <FilterChip key={s.key} label={s.label} selected={sortKey === s.key} onPress={() => setSortKey(s.key)} />
                  ))}
                </View>
              </>
            )}

            {students.map((s) => (
              <View key={s.studentId} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.nameBlock}>
                    <Text style={styles.name}>{s.name}</Text>
                    {!!s.rollNumber && <Text style={styles.meta}>Roll {s.rollNumber}</Text>}
                  </View>
                  <StatusChip
                    label={formatPercent(s.percentCorrect)}
                    variant={bandChipVariant(accuracyBand(s.percentCorrect))}
                  />
                </View>
                <Text style={styles.answered}>{s.answered} answered</Text>
                <Text style={styles.meta}>{gameBreakdown(s)}</Text>
                {s.lastActiveAt && <Text style={styles.meta}>Last played {formatIstDay(s.lastActiveAt)}</Text>}
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
  loading: { marginTop: spacing.xl },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    overflow: 'hidden',
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary, color: colors.white },
  outlineButton: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs + 2,
    marginBottom: spacing.md,
  },
  outlineButtonText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  totalsCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  totalsTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  totalsRange: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  totalsText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginTop: spacing.sm },
  empty: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  nameBlock: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  answered: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginTop: spacing.sm },
  meta: { fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
});
