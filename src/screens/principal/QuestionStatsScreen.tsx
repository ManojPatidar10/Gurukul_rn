import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { getErrorMessage } from '../../api/errorMessage';
import { getQuestionStats, type QuestionStatsResponse } from '../../api/quizInsights';
import type { QuizOption, QuizQuestionResponse } from '../../api/types';
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
  formatPercent,
  formatRange,
  noQuestionsMessage,
  optionCountsLine,
  questionAnswersLine,
  questionFlags,
  questionGameSplit,
  questionScopeLine,
  rangeForDays,
} from '../../utils/quizInsights';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'QuestionStats'>;

const OPTIONS: QuizOption[] = ['A', 'B', 'C', 'D'];

function optionValue(q: QuizQuestionResponse, option: QuizOption): string {
  const values = { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD };
  return values[option] ?? '';
}

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
 * How students answered each multiple-choice bank question in a subject + grade: a teacher sees
 * only the questions they wrote, an admin every author's. With a class-section, only that
 * section's students' answers count.
 */
export function QuestionStatsScreen({ route, navigation }: Props) {
  const schoolId = useSchoolId();
  const { subjectId, subjectName, className, classSection } = route.params;
  const sectionId = classSection?.id;
  const sectionLabel = classSection ? `${classSection.className} - ${classSection.section}` : null;
  const [days, setDays] = useState<number>(DEFAULT_RANGE_DAYS);
  const [includeRetired, setIncludeRetired] = useState(false);
  const [data, setData] = useState<QuestionStatsResponse | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latestRequest = useRef(0);
  const filterKey = `${days}|${includeRetired}`;

  // Runs when the filters change, every time the screen comes back into focus (so an edit made on
  // the question screen shows up here), and on Retry. Only the latest request's response is used,
  // so a response for filters that have since changed is dropped.
  const load = useCallback(() => {
    const request = ++latestRequest.current;
    const key = `${days}|${includeRetired}`;
    setLoading(true);
    setError(null);
    getQuestionStats(schoolId, {
      subjectId,
      className,
      sectionId,
      includeRetired,
      ...rangeForDays(days, new Date()),
    })
      .then((res) => {
        if (request !== latestRequest.current) return;
        setData(res);
        setLoadedKey(key);
      })
      .catch((e) => {
        if (request === latestRequest.current) setError(getErrorMessage(e));
      })
      .finally(() => {
        if (request === latestRequest.current) setLoading(false);
      });
  }, [schoolId, subjectId, className, sectionId, days, includeRetired]);

  useFocusEffect(load);

  // Coming back from an edit keeps the list on screen while it reloads; a filter change hides it
  // until the numbers for the new filters arrive.
  const showList = data !== null && !error && loadedKey === filterKey;
  const subtitle = [subjectName ?? data?.subjectName, data?.sectionLabel ?? sectionLabel ?? className]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.root}>
      <ScreenHeader title="Question stats" subtitle={subtitle} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <Text style={styles.scope}>
          {questionScopeLine({ sectionLabel: data?.sectionLabel ?? sectionLabel, className: data?.className ?? className })}
        </Text>
        {data?.onlyMine && <Text style={styles.scope}>Only questions you wrote</Text>}

        <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Period</Text>
        <View style={styles.chips}>
          {RANGE_PRESETS.map((d) => (
            <FilterChip key={d} label={`${d} days`} selected={days === d} onPress={() => setDays(d)} />
          ))}
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchText}>Show retired</Text>
          <Switch
            value={includeRetired}
            onValueChange={setIncludeRetired}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>

        {error && (
          <>
            <ErrorNotice message={error} />
            <Pressable style={styles.retryButton} onPress={load}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </>
        )}
        {loading && <ActivityIndicator color={colors.primary} style={styles.loading} />}

        {showList && data && (
          <>
            <Text style={styles.range}>{formatRange(data.from, data.to)}</Text>
            {data.questions.length === 0 && (
              <Text style={styles.empty}>{noQuestionsMessage(data.onlyMine, data.subjectName, data.className)}</Text>
            )}

            {data.questions.map((item) => {
              const q = item.question;
              const flags = questionFlags(item);
              const comments = q.openReportComments ?? [];
              const split = questionGameSplit(item);
              return (
                <View key={q.id} style={[styles.card, q.retired && styles.cardRetired]}>
                  {q.retired && (
                    <View style={styles.badges}>
                      <StatusChip label="Retired" variant="neutral" />
                    </View>
                  )}
                  <View style={styles.cardTop}>
                    <Text style={styles.questionText}>{q.questionText}</Text>
                    {item.answered > 0 && (
                      <StatusChip
                        label={formatPercent(item.percentCorrect)}
                        variant={bandChipVariant(accuracyBand(item.percentCorrect))}
                      />
                    )}
                  </View>
                  {OPTIONS.map((o) => (
                    <Text key={o} style={[styles.optionText, o === q.correctOption && styles.optionCorrect]}>
                      {o}. {optionValue(q, o)}
                      {o === q.correctOption ? ' ✓' : ''}
                    </Text>
                  ))}

                  <Text style={styles.answers}>{questionAnswersLine(item)}</Text>
                  {item.answered > 0 && (
                    <>
                      <Text style={styles.meta}>{optionCountsLine(item)}</Text>
                      {!!split && <Text style={styles.meta}>{split}</Text>}
                    </>
                  )}

                  {flags.length > 0 && (
                    <View style={styles.flagBox}>
                      {flags.map((flag) => (
                        <Text key={flag} style={styles.flag}>
                          ⚠ {flag}
                        </Text>
                      ))}
                      {comments.map((comment, index) => (
                        <Text key={index} style={styles.reportComment}>
                          “{comment}”
                        </Text>
                      ))}
                    </View>
                  )}

                  {q.canEdit && (
                    <View style={styles.actions}>
                      <Pressable onPress={() => navigation.navigate('QuestionAuthor', { questionId: q.id })} hitSlop={6}>
                        <Text style={styles.action}>Edit</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  scope: { fontSize: 13, color: colors.textSecondary, marginBottom: 2 },
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  switchText: { fontSize: 14, color: colors.textPrimary, fontWeight: '600' },
  retryButton: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs + 2,
    marginBottom: spacing.md,
  },
  retryButtonText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  range: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },
  empty: { color: colors.textMuted, fontSize: 13 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  cardRetired: { opacity: 0.75 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.xs },
  questionText: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  optionText: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  optionCorrect: { color: colors.success, fontWeight: '700' },
  answers: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginTop: spacing.sm },
  meta: { fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  flagBox: {
    backgroundColor: '#FFF3E0',
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  flag: { fontSize: 13, fontWeight: '700', color: colors.warning, marginTop: 2 },
  reportComment: { fontSize: 12.5, color: colors.textSecondary, marginTop: 4, fontStyle: 'italic' },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  action: { fontSize: 13, fontWeight: '700', color: colors.primary },
});
