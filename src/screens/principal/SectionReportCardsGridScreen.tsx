import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { getSectionReportCards } from '../../api/reportCards';
import type { ReportCard } from '../../api/types';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'SectionReportCardsGrid'>;

const COMMON_TERMS = ['Term 1', 'Term 2', 'Annual'];

const ROLL_WIDTH = 64;
const NAME_WIDTH = 140;
const SUBJECT_WIDTH = 90;
const SUMMARY_WIDTH = 72;

export function SectionReportCardsGridScreen({ route, navigation }: Props) {
  const schoolId = useSchoolId();
  const classSection = route.params.classSection;
  const [term, setTerm] = useState('Term 1');
  const [rows, setRows] = useState<ReportCard[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);

  const load = (t: string) => {
    setLoading(true);
    setError(null);
    setHasLoaded(true);
    setSubjectFilter(null);
    getSectionReportCards(schoolId, classSection.id, t)
      .then(setRows)
      .catch((e) => {
        setRows(null);
        setError((e as Error).message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(term);
    // Only auto-load once on mount - further loads are user-triggered, same pattern as ReportCardScreen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <View style={styles.termRow}>
          <TextInput
            style={styles.termInput}
            value={term}
            onChangeText={setTerm}
            placeholder="Term (e.g. Term 1)"
            placeholderTextColor={colors.textMuted}
          />
          <Pressable style={styles.viewButton} onPress={() => load(term)} disabled={!term.trim()}>
            <Text style={styles.viewButtonText}>Load</Text>
          </Pressable>
        </View>
        <View style={styles.chips}>
          {COMMON_TERMS.map((t) => (
            <Pressable
              key={t}
              style={[styles.chip, term === t && styles.chipSelected]}
              onPress={() => {
                setTerm(t);
                load(t);
              }}
            >
              <Text style={[styles.chipText, term === t && styles.chipTextSelected]}>{t}</Text>
            </Pressable>
          ))}
        </View>

        {loading && <ActivityIndicator style={styles.loading} color={colors.primary} />}
        {!loading && error && <Text style={styles.error}>{error}</Text>}
        {!loading && !error && hasLoaded && rows != null && rows.length === 0 && (
          <Text style={styles.empty}>0 students in this section.</Text>
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
                  <Text style={[styles.cell, styles.nameCell, { width: NAME_WIDTH }]} numberOfLines={1}>
                    {r.studentName}
                  </Text>
                  {visibleSubjectColumns.map((col) => {
                    const subject = r.subjects.find((s) => s.subjectId === col.subjectId);
                    return (
                      <Text key={col.subjectId} style={[styles.cell, { width: SUBJECT_WIDTH }]}>
                        {subject ? `${subject.marksObtained}/${subject.maxMarks}` : '—'}
                      </Text>
                    );
                  })}
                  <Text style={[styles.cell, { width: SUMMARY_WIDTH }]}>{r.totalMarksObtained}</Text>
                  <Text style={[styles.cell, { width: SUMMARY_WIDTH }]}>{r.overallPercentage}%</Text>
                  <Text style={[styles.cell, styles.gradeCell, { width: SUMMARY_WIDTH }]}>{r.overallGrade}</Text>
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
  nameCell: { fontWeight: '600' },
  gradeCell: { fontWeight: '800', color: colors.primary },
});
