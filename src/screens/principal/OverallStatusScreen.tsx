import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { BarChart, LineChart } from 'react-native-gifted-charts';

import { getErrorMessage } from '../../api/errorMessage';
import { getPublishedTerms, getReportCard } from '../../api/reportCards';
import type { ReportCard } from '../../api/types';
import { ErrorNotice } from '../../components/ErrorNotice';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { CATEGORICAL_PALETTE, SINGLE_SERIES_COLOR } from '../../theme/chartPalette';
import { colors, radius, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import {
  cardForTerm,
  deltaAxisBound,
  deltaRanking,
  shortSubjectLabel,
  strengths,
  subjectComparison,
  termTrend,
  weaknesses,
  type DeltaPoint,
  type TermCard,
} from '../../utils/overallStatus';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'OverallStatus'>;

const BELOW_COLOR = CATEGORICAL_PALETTE[7]; // red, the diverging partner of slot 0
/**
 * The class average is context, not a rival series, so it wears a neutral rather than a second
 * categorical hue - two bright colours would read as two students. It is deliberately grey, which
 * is why the palette validator's chroma check fails on it: that check is for categorical slots,
 * and this is not one. It is the darker ink rather than the muted one so it still clears 3:1
 * against the surface, which the muted grey does not.
 */
const CLASS_COLOR = colors.textSecondary;

const CHART_HEIGHT = 190;
const PERCENT_AXIS_MAX = 100;
const PERCENT_AXIS_SECTIONS = 4; // 0 / 25 / 50 / 75 / 100

/**
 * Every chart a student's results support, on one screen.
 *
 * <p>The report card itself answers "what did I get". This answers the three questions that come
 * straight after it: am I improving, which subjects are carrying me, and where am I behind. Each
 * is a different question about the same marks, so each gets the form that fits - a line over
 * time, bars across subjects, and a diverging bar for the gap to the class.
 *
 * <p>Every term the student has a published card for is loaded, because the trend is the one
 * thing a single card cannot show.
 */
export function OverallStatusScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { student, term, sectionId } = route.params;
  const [entries, setEntries] = useState<TermCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return getPublishedTerms(schoolId, student.id)
      .then((terms) =>
        Promise.all(
          terms.map((term) =>
            getReportCard(schoolId, student.id, term.term, term.classSectionId)
              .then((card) => ({ term, card }))
              // One unreadable term must not cost the student every other term's chart.
              .catch(() => null)
          )
        )
      )
      .then((loaded) => setEntries(loaded.filter((entry): entry is TermCard => entry !== null)))
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [schoolId, student.id]);

  useEffect(() => {
    load();
  }, [load]);

  const trend = termTrend(entries);
  // The subject charts describe the term the report card was open on, not always the newest one:
  // stepping back through the term chips and opening the charts should keep showing that term.
  const shown = cardForTerm(entries, term, sectionId);
  const subjects = subjectComparison(shown);
  const ranking = deltaRanking(shown);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('overallStatus.title')}
        subtitle={student.name}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        {loading && <ActivityIndicator color={colors.primary} style={styles.loading} />}
        {!loading && error && <ErrorNotice message={error} />}
        {!loading && !error && trend.length === 0 && (
          <Text style={styles.empty}>{t('overallStatus.noPublished')}</Text>
        )}

        {!loading && !error && trend.length > 0 && (
          <>
            <ProgressChart trend={trend} shownTerm={shown?.term} />
            <SubjectChart subjects={subjects} term={shown?.term} />
            <GapChart ranking={ranking} term={shown?.term} />
          </>
        )}
      </ScreenContainer>
    </View>
  );
}

/** Overall percentage per term. A line, because the question is "which way am I going". */
function ProgressChart({
  trend,
  shownTerm,
}: {
  trend: ReturnType<typeof termTrend>;
  shownTerm?: string;
}) {
  const { t } = useTranslation();
  const hasClass = trend.some((point) => point.classAverage != null);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t('overallStatus.progressTitle')}</Text>
      <Text style={styles.cardHint}>{t('overallStatus.progressHint')}</Text>

      {trend.length === 1 ? (
        // One point is not a trend. Drawing a single dot on an empty grid invites a parent to read
        // a direction into it; the number says everything one term can say.
        <Text style={styles.single}>
          {t('overallStatus.singleTerm', { term: trend[0].label, percent: trend[0].overall })}
        </Text>
      ) : (
        <>
          <Legend
            items={[
              { color: SINGLE_SERIES_COLOR, label: t('overallStatus.legendStudent') },
              ...(hasClass ? [{ color: CLASS_COLOR, label: t('overallStatus.legendClass'), dashed: true }] : []),
            ]}
          />
          <View style={styles.axisWrap}>
            <Text style={styles.yAxisTitle}>{t('overallStatus.axisPercent')}</Text>
            <LineChart
              // The point the two charts below describe is drawn larger, so this chart and those
              // visibly agree about which term is being talked about.
              data={trend.map((point) => ({
                value: point.overall,
                label: point.label,
                dataPointRadius: point.label === shownTerm ? 7 : 4,
              }))}
              data2={
                hasClass
                  ? trend.map((point) => ({ value: point.classAverage ?? 0, label: point.label }))
                  : undefined
              }
              color={SINGLE_SERIES_COLOR}
              color2={CLASS_COLOR}
              thickness={2}
              thickness2={2}
              strokeDashArray2={[5, 4]}
              dataPointsColor={SINGLE_SERIES_COLOR}
              dataPointsColor2={CLASS_COLOR}
              dataPointsRadius={4}
              height={CHART_HEIGHT}
              // Fixed 0-100, never fitted to the data: a 64 to 66 term would otherwise fill the
              // whole chart and read as a leap.
              maxValue={PERCENT_AXIS_MAX}
              noOfSections={PERCENT_AXIS_SECTIONS}
              yAxisLabelSuffix="%"
              initialSpacing={24}
              spacing={Math.max(56, Math.min(96, 260 / Math.max(trend.length - 1, 1)))}
              {...AXIS_STYLE}
            />
          </View>
          <Text style={styles.xAxisTitle}>{t('overallStatus.axisTerm')}</Text>
        </>
      )}
    </View>
  );
}

/** Each subject against its class average. Bars, because the question is "how big is each". */
function SubjectChart({
  subjects,
  term,
}: {
  subjects: ReturnType<typeof subjectComparison>;
  term?: string;
}) {
  const { t } = useTranslation();
  if (subjects.length === 0) {
    return null;
  }
  const hasClass = subjects.some((subject) => subject.classAverage != null);

  // Two bars per subject: the student, then the class. The pair is tight and the gap between
  // pairs is wide, so the grouping is read from the spacing rather than from the colours.
  const data = subjects.flatMap((subject) => {
    const mine = {
      value: subject.percentage,
      label: shortSubjectLabel(subject.label),
      frontColor: SINGLE_SERIES_COLOR,
      spacing: hasClass && subject.classAverage != null ? 2 : 22,
      // Wide enough for a shortSubjectLabel at this font, so the axis shows the name the
      // shortener produced rather than a second, tighter truncation of it. Still under the
      // pair-plus-gap width, so it cannot reach the next subject.
      labelWidth: 40,
      labelTextStyle: styles.barLabel,
    };
    if (!hasClass || subject.classAverage == null) {
      return [mine];
    }
    return [mine, { value: subject.classAverage, frontColor: CLASS_COLOR, spacing: 22 }];
  });

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t('overallStatus.subjectTitle')}</Text>
      <Text style={styles.cardHint}>{t('overallStatus.subjectHint', { term })}</Text>
      <Legend
        items={[
          { color: SINGLE_SERIES_COLOR, label: t('overallStatus.legendStudent') },
          ...(hasClass ? [{ color: CLASS_COLOR, label: t('overallStatus.legendClass') }] : []),
        ]}
      />
      <View style={styles.axisWrap}>
        <Text style={styles.yAxisTitle}>{t('overallStatus.axisPercent')}</Text>
        <BarChart
          data={data}
          height={CHART_HEIGHT}
          barWidth={14}
          initialSpacing={14}
          roundedTop
          maxValue={PERCENT_AXIS_MAX}
          noOfSections={PERCENT_AXIS_SECTIONS}
          yAxisLabelSuffix="%"
          {...AXIS_STYLE}
        />
      </View>
      <Text style={styles.xAxisTitle}>{t('overallStatus.axisSubject')}</Text>
    </View>
  );
}

/** The gap to the class, signed. Diverging bars about a zero line: the question is which side. */
function GapChart({ ranking, term }: { ranking: DeltaPoint[]; term?: string }) {
  const { t } = useTranslation();
  if (ranking.length === 0) {
    return null;
  }
  const bound = deltaAxisBound(ranking);
  const strong = strengths(ranking);
  const weak = weaknesses(ranking);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t('overallStatus.gapTitle')}</Text>
      <Text style={styles.cardHint}>{t('overallStatus.gapHint', { term })}</Text>
      <Legend
        items={[
          { color: SINGLE_SERIES_COLOR, label: t('overallStatus.legendAhead') },
          { color: BELOW_COLOR, label: t('overallStatus.legendBehind') },
        ]}
      />
      <View style={styles.axisWrap}>
        <Text style={styles.yAxisTitle}>{t('overallStatus.axisPoints')}</Text>
        <BarChart
          data={ranking.map((point) => ({
            value: point.delta,
            label: shortSubjectLabel(point.label),
            // A gap inside the noise band is drawn, because the number is real, but in neutral
            // ink - it is not a side, and colouring it would argue that it is.
            frontColor: !point.notable ? colors.textMuted : point.delta > 0 ? SINGLE_SERIES_COLOR : BELOW_COLOR,
            labelTextStyle: styles.barLabel,
          }))}
          height={CHART_HEIGHT}
          barWidth={18}
          spacing={32}
          initialSpacing={16}
          roundedTop
          roundedBottom
          // Symmetric about zero so +4 and -4 are the same length on every card.
          maxValue={bound}
          mostNegativeValue={-bound}
          noOfSections={2}
          noOfSectionsBelowXAxis={2}
          // The zero line runs through the middle of this chart, so labels left at the axis sit
          // on top of the bars going down. The negative half is a full CHART_HEIGHT tall, so they
          // have to clear all of it to land under the plot rather than inside it.
          // The zero line runs through the middle of this chart, so labels left at the axis would
          // sit on top of the bars going down. Pushed clear of the negative half instead.
          labelsDistanceFromXaxis={CHART_HEIGHT + 4}
          xAxisLabelsHeight={24}
          {...AXIS_STYLE}
          xAxisThickness={1}
          xAxisColor={colors.textSecondary}
        />
      </View>
      <Text style={styles.xAxisTitle}>{t('overallStatus.axisSubject')}</Text>

      {/* The verdict in words, so the conclusion never rests on the bar colours alone. */}
      <Verdict label={t('overallStatus.strengths')} points={strong} color={SINGLE_SERIES_COLOR} />
      <Verdict label={t('overallStatus.weaknesses')} points={weak} color={BELOW_COLOR} />
      {strong.length === 0 && weak.length === 0 && (
        <Text style={styles.footnote}>{t('overallStatus.allInLine')}</Text>
      )}
    </View>
  );
}

function Verdict({ label, points, color }: { label: string; points: DeltaPoint[]; color: string }) {
  if (points.length === 0) {
    return null;
  }
  return (
    <View style={styles.verdict}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.verdictLabel}>{label}</Text>
      <Text style={styles.verdictNames}>{points.map((p) => p.label).join(', ')}</Text>
    </View>
  );
}

function Legend({ items }: { items: { color: string; label: string; dashed?: boolean }[] }) {
  return (
    <View style={styles.legend}>
      {items.map((item) => (
        <View key={item.label} style={styles.legendItem}>
          <View
            style={[
              item.dashed ? styles.legendDash : styles.legendSwatch,
              { backgroundColor: item.color },
            ]}
          />
          <Text style={styles.legendText}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** Recessive axes, shared so the three charts read as one family. */
const AXIS_STYLE = {
  hideRules: false,
  rulesColor: colors.border,
  rulesType: 'dashed' as const,
  dashWidth: 3,
  dashGap: 5,
  xAxisThickness: 1,
  yAxisThickness: 0,
  xAxisColor: colors.border,
  yAxisTextStyle: { color: colors.textMuted, fontSize: 10 },
  xAxisLabelTextStyle: { color: colors.textSecondary, fontSize: 9 },
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  empty: { color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  cardHint: { fontSize: 12, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.sm },
  single: { fontSize: 13, color: colors.textSecondary, paddingVertical: spacing.sm },
  axisWrap: { paddingRight: spacing.sm },
  yAxisTitle: { fontSize: 10, color: colors.textMuted, fontWeight: '600', marginBottom: 2 },
  xAxisTitle: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  barLabel: { color: colors.textSecondary, fontSize: 8 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendSwatch: { width: 10, height: 10, borderRadius: 2 },
  legendDash: { width: 14, height: 3, borderRadius: 2 },
  legendText: { fontSize: 11, color: colors.textSecondary },
  verdict: { flexDirection: 'row', alignItems: 'baseline', marginTop: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6, transform: [{ translateY: -1 }] },
  verdictLabel: { fontSize: 12, fontWeight: '700', color: colors.textPrimary, marginRight: 4 },
  verdictNames: { flex: 1, fontSize: 12, color: colors.textSecondary },
  footnote: { fontSize: 11, color: colors.textMuted, fontStyle: 'italic', marginTop: spacing.xs },
});
