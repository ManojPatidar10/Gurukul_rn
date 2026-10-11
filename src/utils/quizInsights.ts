import type { TFunction } from 'i18next';

import type {
  QuestionStat,
  QuestionStatsResponse,
  SectionQuizSummary,
  SectionQuizTotals,
  StudentQuizSummary,
} from '../api/quizInsights';
import type { ClassSection, LoginResponse, QuizOption, TeacherSubjectAssignment } from '../api/types';
import { reportWarning } from './questionAuthor';

/**
 * Pure helpers for the Quiz results and Question stats screens. Dates are school days in
 * Asia/Kolkata (a fixed +05:30, no DST), the same calendar the server uses for `from` / `to`.
 */

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Short month names, January first. Full keys, resolved when a label is built. */
const MONTH_KEYS = [
  'quizInsights.months.jan',
  'quizInsights.months.feb',
  'quizInsights.months.mar',
  'quizInsights.months.apr',
  'quizInsights.months.may',
  'quizInsights.months.jun',
  'quizInsights.months.jul',
  'quizInsights.months.aug',
  'quizInsights.months.sep',
  'quizInsights.months.oct',
  'quizInsights.months.nov',
  'quizInsights.months.dec',
] as const;
const OPTIONS: QuizOption[] = ['A', 'B', 'C', 'D'];

/** The range chips, in days. */
export const RANGE_PRESETS = [7, 30, 90] as const;
export const DEFAULT_RANGE_DAYS = 30;

/** Answers only count as evidence that a question is confusing once there are this many. */
export const MIN_ANSWERS_FOR_FLAG = 5;

const pad = (n: number) => String(n).padStart(2, '0');

/** YYYY-MM-DD of a UTC timestamp. */
function isoDateOf(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function parseIsoDate(value: string): { year: number; month: number; day: number } {
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}

function dayLabel(value: string, withYear: boolean, t: TFunction): string {
  const { year, month, day } = parseIsoDate(value);
  const monthName = t(MONTH_KEYS[month - 1]);
  return withYear
    ? t('quizInsights.dayMonthYear', { day, month: monthName, year })
    : t('quizInsights.dayMonth', { day, month: monthName });
}

/** Today in Asia/Kolkata as YYYY-MM-DD. */
export function istToday(now: Date): string {
  return isoDateOf(now.getTime() + IST_OFFSET_MS);
}

/** The last `days` school days, today included: `to` = today (IST), `from` = `to` - (days - 1). */
export function rangeForDays(days: number, now: Date): { from: string; to: string } {
  const to = istToday(now);
  const { year, month, day } = parseIsoDate(to);
  const from = isoDateOf(Date.UTC(year, month - 1, day) - (days - 1) * DAY_MS);
  return { from, to };
}

/** "11 Sep – 10 Oct 2026"; the start shows its year only when it differs from the end's. */
export function formatRange(from: string, to: string, t: TFunction): string {
  const sameYear = parseIsoDate(from).year === parseIsoDate(to).year;
  return `${dayLabel(from, !sameYear, t)} – ${dayLabel(to, true, t)}`;
}

/** The IST calendar day of an ISO instant, e.g. "8 Oct 2026"; "" when it can't be read. */
export function formatIstDay(instant: string, t: TFunction): string {
  const ms = Date.parse(instant);
  if (Number.isNaN(ms)) return '';
  return dayLabel(isoDateOf(ms + IST_OFFSET_MS), true, t);
}

/** "68%", or a dash when nothing was answered. */
export function formatPercent(p: number | null): string {
  return p === null || p === undefined ? '–' : `${p}%`;
}

export type AccuracyBand = 'none' | 'low' | 'mid' | 'high';

export function accuracyBand(p: number | null): AccuracyBand {
  if (p === null || p === undefined) return 'none';
  if (p < 40) return 'low';
  if (p < 70) return 'mid';
  return 'high';
}

/** The StatusChip variant for an accuracy band. */
export function bandChipVariant(band: AccuracyBand): 'neutral' | 'error' | 'warning' | 'success' {
  switch (band) {
    case 'low':
      return 'error';
    case 'mid':
      return 'warning';
    case 'high':
      return 'success';
    default:
      return 'neutral';
  }
}

export type StudentSortKey = 'name' | 'leastActive' | 'lowestAccuracy';

const byText = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
const byName = (a: StudentQuizSummary, b: StudentQuizSummary) =>
  byText(a.name, b.name) || byText(a.rollNumber ?? '', b.rollNumber ?? '');

/**
 * A sorted copy (the input is left alone). `leastActive`: fewest answers first. `lowestAccuracy`:
 * lowest % first, students with no answers last. Ties go by name, then roll number.
 */
export function sortStudents(rows: readonly StudentQuizSummary[], key: StudentSortKey): StudentQuizSummary[] {
  const copy = [...rows];
  if (key === 'leastActive') return copy.sort((a, b) => a.answered - b.answered || byName(a, b));
  if (key === 'lowestAccuracy') {
    return copy.sort((a, b) => {
      const pa = a.percentCorrect;
      const pb = b.percentCorrect;
      if (pa === null && pb === null) return byName(a, b);
      if (pa === null) return 1;
      if (pb === null) return -1;
      return pa - pb || byName(a, b);
    });
  }
  return copy.sort(byName);
}

/**
 * "Practice 12 · Arena 10 (won 1 of 2) · Battle 9 (won 0 of 1)", leaving out games with nothing in
 * them. A student with no answers in the period has no activity, whatever games finished in it (a
 * challenge answered earlier can complete in the range): the same rule as `totals.activeStudents`,
 * so a card never shows a game for a student the totals count as not having played.
 */
export function gameBreakdown(s: StudentQuizSummary, t: TFunction): string {
  if (s.answered === 0) return t('quizInsights.results.noActivity');
  const { arena, battle } = s;
  const parts: string[] = [];
  if (s.practice.answered > 0) parts.push(t('quizInsights.results.practice', { answered: s.practice.answered }));
  if (arena.answered > 0 || arena.played > 0) {
    parts.push(
      arena.played > 0
        ? t('quizInsights.results.arenaWon', { answered: arena.answered, won: arena.won, played: arena.played })
        : t('quizInsights.results.arena', { answered: arena.answered })
    );
  }
  if (battle.answered > 0 || battle.played > 0) {
    parts.push(
      battle.played > 0
        ? t('quizInsights.results.battleWon', { answered: battle.answered, won: battle.won, played: battle.played })
        : t('quizInsights.results.battle', { answered: battle.answered })
    );
  }
  return parts.length > 0 ? parts.join(' · ') : t('quizInsights.results.noActivity');
}

/** "18 of 40 students played · 412 answers · 68% correct"; the % is left out when nothing was answered. */
export function totalsSummary(totals: SectionQuizTotals, t: TFunction): string {
  const parts = [
    t('quizInsights.results.played', { count: totals.students, active: totals.activeStudents }),
    t('quizInsights.answers', { count: totals.answered }),
  ];
  if (totals.percentCorrect !== null && totals.percentCorrect !== undefined) {
    parts.push(t('quizInsights.correct', { percent: formatPercent(totals.percentCorrect) }));
  }
  return parts.join(' · ');
}

/**
 * The empty-state line for the class summary, or null when someone played. With no subject filter
 * and no subjects to choose from, the server lists no students even when the class has some, so
 * that case is checked first.
 */
export function summaryEmptyMessage(
  summary: Pick<SectionQuizSummary, 'subjectId' | 'subjects' | 'totals'>,
  t: TFunction
): string | null {
  const totals = summary.totals;
  if (summary.subjectId === null && summary.subjects.length === 0) return t('quizInsights.results.noSubjects');
  if (totals.students === 0) return t('quizInsights.results.noStudents');
  if (totals.activeStudents === 0) return t('quizInsights.results.nobodyPlayed');
  return null;
}

/**
 * Why a question may need a look: open "wrong answer" reports, a wrong option picked more often
 * than the right one, or a low % correct. The last two need at least MIN_ANSWERS_FOR_FLAG answers.
 */
export function questionFlags(item: QuestionStat, t: TFunction): string[] {
  const flags: string[] = [];
  const report = reportWarning(item.question.openReportCount, t);
  if (report) flags.push(report);
  if (item.answered < MIN_ANSWERS_FOR_FLAG) return flags;

  const correctOption = item.question.correctOption;
  if (correctOption) {
    const count = (o: QuizOption) => item.optionCounts?.[o] ?? 0;
    let topWrong: QuizOption | null = null;
    for (const o of OPTIONS) {
      if (o === correctOption || count(o) <= count(correctOption)) continue;
      if (topWrong === null || count(o) > count(topWrong)) topWrong = o;
    }
    if (topWrong) flags.push(t('quizInsights.stats.moreChose', { option: topWrong }));
  }
  if (item.percentCorrect !== null && item.percentCorrect !== undefined && item.percentCorrect < 40) {
    flags.push(t('quizInsights.stats.lowCorrect', { percent: item.percentCorrect }));
  }
  return flags;
}

/** "A 5 · B 15 ✓ · C 28 · D 2", the correct option marked. */
export function optionCountsLine(item: QuestionStat): string {
  return OPTIONS.map((o) => {
    const text = `${o} ${item.optionCounts?.[o] ?? 0}`;
    return o === item.question.correctOption ? `${text} ✓` : text;
  }).join(' · ');
}

/** "50 answers · 30% correct", or "Not answered in this period". */
export function questionAnswersLine(item: QuestionStat, t: TFunction): string {
  if (item.answered === 0) return t('quizInsights.stats.notAnswered');
  const answers = t('quizInsights.answers', { count: item.answered });
  return `${answers} · ${t('quizInsights.correct', { percent: formatPercent(item.percentCorrect) })}`;
}

/** "Practice 20 (6 right) · Arena 18 (5 right) · Battle 12 (4 right)", leaving out games with no answers. */
export function questionGameSplit(item: QuestionStat, t: TFunction): string {
  const games: [string, QuestionStat['practice']][] = [
    ['quizInsights.stats.practice', item.practice],
    ['quizInsights.stats.arena', item.arena],
    ['quizInsights.stats.battle', item.battle],
  ];
  return games
    .filter(([, tally]) => tally.answered > 0)
    .map(([key, tally]) => t(key, { answered: tally.answered, correct: tally.correct }))
    .join(' · ');
}

/** "Answers from students in Grade 8 - A", or "Answers from all Grade 8 students". */
export function questionScopeLine(
  res: Pick<QuestionStatsResponse, 'sectionLabel' | 'className'>,
  t: TFunction
): string {
  return res.sectionLabel
    ? t('quizInsights.stats.scopeSection', { section: res.sectionLabel })
    : t('quizInsights.stats.scopeClass', { className: res.className });
}

/** The empty state when no MCQ question matches the filters. */
export function noQuestionsMessage(onlyMine: boolean, subjectName: string, className: string, t: TFunction): string {
  return onlyMine
    ? t('quizInsights.stats.noQuestionsMine', { subject: subjectName, className })
    : t('quizInsights.stats.noQuestions', { subject: subjectName, className });
}

/**
 * Whether the section screen must load the caller's subject assignments before it can decide on the
 * "Quiz results" tile: only a TEACHER signed in as staff who isn't this section's class teacher.
 * ADMIN and the class teacher don't need them, and STUDENT, PARENT and DRIVER never make the call.
 */
export function quizResultsNeedsAssignments(
  session: Pick<LoginResponse, 'role' | 'ownerType' | 'ownerId'>,
  classSection: Pick<ClassSection, 'classTeacherId'>
): boolean {
  return (
    session.role === 'TEACHER' && session.ownerType === 'EMPLOYEE' && classSection.classTeacherId !== session.ownerId
  );
}

/**
 * Whether to show the "Quiz results" tile on a section. Mirrors the server rule: ADMIN, the
 * section's class teacher, or a teacher assigned to a subject in it. `assignments` is null until
 * the teacher's assignments have loaded (or when the call failed), and the tile stays hidden.
 */
export function canSeeQuizResults(
  session: Pick<LoginResponse, 'role' | 'ownerType' | 'ownerId'>,
  classSection: Pick<ClassSection, 'id' | 'classTeacherId'>,
  assignments: TeacherSubjectAssignment[] | null
): boolean {
  if (session.role === 'ADMIN') return true;
  if (session.role !== 'TEACHER' || session.ownerType !== 'EMPLOYEE') return false;
  if (classSection.classTeacherId === session.ownerId) return true;
  return (assignments ?? []).some((a) => a.sectionId === classSection.id);
}
