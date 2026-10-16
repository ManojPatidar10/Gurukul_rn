import type { PublishedTerm, ReportCard } from '../api/types';
import { termKey } from './academicTerms';
import { compareTermsLatestFirst } from './assessmentTerms';
import { isNotableDelta } from './classComparison';

/** A term's card, paired with the published-term entry that carries its dates. */
export interface TermCard {
  term: PublishedTerm;
  card: ReportCard;
}

/** One point on the term trend: the student's overall, and the class's, for one term. */
export interface TermPoint {
  key: string;
  label: string;
  overall: number;
  classAverage: number | null;
}

export interface SubjectPoint {
  subjectId: string;
  label: string;
  percentage: number;
  classAverage: number | null;
}

export interface DeltaPoint {
  subjectId: string;
  label: string;
  delta: number;
  /** False inside the noise band - drawn, but neutral, and never called a strength or weakness. */
  notable: boolean;
}

/**
 * The overall percentage per term, oldest first, for the progress line.
 *
 * <p>Oldest first because the chart reads left to right as time. Terms with no overall at all are
 * dropped rather than plotted as zero: a term with no marks entered is not a term the student
 * scored nothing in, and a line dropping to the floor says exactly that.
 */
export function termTrend(entries: TermCard[]): TermPoint[] {
  return [...entries]
    .sort((a, b) => -compareTermsLatestFirst(a.term, b.term))
    .filter((entry) => entry.card.overallPercentage != null)
    .map((entry) => ({
      key: `${entry.card.term}:${entry.card.classSectionId ?? ''}`,
      label: entry.card.term,
      overall: round1(entry.card.overallPercentage as number),
      classAverage: entry.card.classAveragePercentage == null
        ? null
        : round1(entry.card.classAveragePercentage),
    }));
}

/**
 * The card the subject charts should describe.
 *
 * <p>Follows the term the report card was open on, so walking back through the term chips and
 * opening the charts does not silently jump to a different term's marks. A section is matched
 * alongside the name because the same term can be published for more than one of a student's
 * classes after a promotion, and those are different cards.
 *
 * <p>Falls back to the newest term when the requested one has nothing to show - staff can open
 * this screen from a draft preview of a term that was never published, and the charts are built
 * from published cards only.
 */
export function cardForTerm(
  entries: TermCard[],
  term?: string | null,
  sectionId?: string | null
): ReportCard | null {
  const trend = termTrend(entries);
  if (trend.length === 0) {
    return null;
  }
  const plottable = (entry: TermCard) =>
    trend.some((point) => point.key === `${entry.card.term}:${entry.card.classSectionId ?? ''}`);
  const wanted = termKey(term);

  const exact = entries.find(
    (entry) =>
      plottable(entry) &&
      termKey(entry.card.term) === wanted &&
      (entry.card.classSectionId ?? '') === (sectionId ?? '')
  );
  const byName = exact ?? entries.find((entry) => plottable(entry) && termKey(entry.card.term) === wanted);
  if (byName) {
    return byName.card;
  }
  const newest = trend[trend.length - 1];
  return entries.find((entry) => `${entry.card.term}:${entry.card.classSectionId ?? ''}` === newest.key)?.card ?? null;
}

/**
 * Each subject's percentage next to its class average, in the order the card lists them.
 *
 * <p>Card order, not ranked by score: this chart answers "how did each subject go", and resorting
 * it would make the same student's chart change shape between terms for no reason. The ranking
 * question is what {@link deltaRanking} is for.
 */
export function subjectComparison(card: ReportCard | null): SubjectPoint[] {
  if (!card) {
    return [];
  }
  return card.subjects
    .filter((subject) => subject.percentage != null)
    .map((subject) => ({
      subjectId: subject.subjectId,
      label: subject.subjectName,
      percentage: round1(subject.percentage as number),
      classAverage: subject.classAveragePercentage == null
        ? null
        : round1(subject.classAveragePercentage),
    }));
}

/**
 * Subjects ranked by how far above or below the class they sit, strongest first.
 *
 * <p>Ranked here because the whole point is the extremes: the top of this list is what the student
 * is good at and the bottom is what needs work. Subjects with no class to compare against are left
 * out entirely - a delta is the only thing this chart plots, and inventing one would be a lie.
 */
export function deltaRanking(card: ReportCard | null): DeltaPoint[] {
  if (!card) {
    return [];
  }
  return card.subjects
    .filter((subject) => subject.deltaFromClassAverage != null)
    .map((subject) => ({
      subjectId: subject.subjectId,
      label: subject.subjectName,
      delta: round1(subject.deltaFromClassAverage as number),
      notable: isNotableDelta(subject.deltaFromClassAverage),
    }))
    .sort((a, b) => b.delta - a.delta);
}

/** The subjects worth naming as strengths, strongest first. Empty when none clear the band. */
export function strengths(ranking: DeltaPoint[]): DeltaPoint[] {
  return ranking.filter((point) => point.notable && point.delta > 0);
}

/** The subjects worth naming as needing work, weakest first. */
export function weaknesses(ranking: DeltaPoint[]): DeltaPoint[] {
  return ranking.filter((point) => point.notable && point.delta < 0).reverse();
}

/**
 * The y-axis bound for a diverging delta chart: symmetric, so +4 and -4 are the same length.
 *
 * <p>An axis fitted to the data alone would put a -3 bar at full width on one card and a quarter
 * width on another, and a parent comparing two terms would read that as a change in the child.
 * Rounded up to a multiple of the step so the axis labels come out whole.
 */
export function deltaAxisBound(ranking: DeltaPoint[], step = 5): number {
  const largest = ranking.reduce((max, point) => Math.max(max, Math.abs(point.delta)), 0);
  if (largest === 0) {
    return step;
  }
  return Math.ceil(largest / step) * step;
}

/**
 * Longest axis label that fits upright in one bar's slot at phone width.
 *
 * <p>Seven characters at the axis font is about 37px against a 50px slot. Tilting longer names
 * instead was tried and is worse: the chart library staggers tilted labels by bar direction and
 * clips the last one at the plot edge, so the tidy fix is to make them short enough to stand up.
 */
const MAX_AXIS_LABEL = 7;

/**
 * A subject name shortened to fit under a bar.
 *
 * <p>Five subjects across a phone is about 35px of axis each, and "Social Science" at full length
 * simply overlaps the subject beside it - which costs both labels, not just the long one. Short
 * enough to read beats complete and unreadable, and the full names are still spelled out in the
 * strengths and weaknesses lines underneath.
 */
export function shortSubjectLabel(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= MAX_AXIS_LABEL) {
    return trimmed;
  }
  const words = trimmed.split(/\s+/);
  if (words.length > 1) {
    // "Social Science" -> "Soc Sci": every word survives, so the subject stays recognisable.
    return words.map((word) => word.slice(0, 3)).join(' ');
  }
  return `${trimmed.slice(0, MAX_AXIS_LABEL - 1)}.`;
}

function round1(value: number): number {
  return Number(Number(value).toFixed(1));
}
