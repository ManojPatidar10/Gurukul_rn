import { api } from './client';
import type { QuizQuestionResponse } from './types';

/**
 * Teacher / admin view of how a class did in Practice, Arena and Battle Rooms, and per-question
 * stats for bank questions. Read-only. The response types live here rather than in types.ts.
 * Percentages are whole numbers, and null (never 0) when nothing was answered.
 */

const BASE = '/api/v1/gamification/quiz-insights';

export interface SubjectOption {
  id: string;
  name: string;
}

export interface PracticeActivity {
  answered: number;
  correct: number;
  /** Distinct practice sessions with at least one answer in the range. */
  sessions: number;
}

/** Arena challenges or Battle Rooms. `played` counts COMPLETED games only; a draw has no winner. */
export interface MatchActivity {
  answered: number;
  correct: number;
  played: number;
  won: number;
}

export interface StudentQuizSummary {
  studentId: string;
  name: string;
  rollNumber: string | null;
  /** Practice + Arena + Battle. */
  answered: number;
  correct: number;
  percentCorrect: number | null;
  practice: PracticeActivity;
  arena: MatchActivity;
  battle: MatchActivity;
  /** The student's latest answer in the range (ISO instant), or null. */
  lastActiveAt: string | null;
}

export interface SectionQuizTotals {
  /** ACTIVE students in the section. */
  students: number;
  /** Of those, how many answered at least one question. */
  activeStudents: number;
  answered: number;
  correct: number;
  percentCorrect: number | null;
}

export interface SectionQuizSummary {
  sectionId: string;
  className: string;
  section: string;
  academicYear: string;
  /** The subject filter as applied; null = every subject the caller may see. */
  subjectId: string | null;
  subjectName: string | null;
  /** The range actually used, after defaults (YYYY-MM-DD, inclusive). */
  from: string;
  to: string;
  /** The subjects the caller may filter by, sorted by name. */
  subjects: SubjectOption[];
  /** False for a subject teacher: the unfiltered totals then cover only `subjects`. */
  allSubjectsAllowed: boolean;
  totals: SectionQuizTotals;
  students: StudentQuizSummary[];
}

export interface GameTally {
  answered: number;
  correct: number;
}

export interface QuestionStat {
  question: QuizQuestionResponse;
  answered: number;
  correct: number;
  percentCorrect: number | null;
  /** How many answers picked each option. Always has all four keys. */
  optionCounts: Record<'A' | 'B' | 'C' | 'D', number>;
  practice: GameTally;
  arena: GameTally;
  battle: GameTally;
}

export interface QuestionStatsResponse {
  subjectId: string;
  subjectName: string;
  className: string;
  sectionId: string | null;
  /** "Grade 8 - A" when scoped to a section, else null. */
  sectionLabel: string | null;
  from: string;
  to: string;
  /** True for a teacher (only questions they wrote); false for an admin (every author). */
  onlyMine: boolean;
  questions: QuestionStat[];
}

/** "?a=1&b=2" with empty, null and false values left out; "" when nothing is left. */
function queryString(params: Record<string, string | boolean | null | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `?${text}` : '';
}

/** ADMIN, the class teacher, or a teacher of a subject in the section (only their subjects). */
export function getSectionQuizSummary(
  schoolId: string,
  sectionId: string,
  opts?: { subjectId?: string | null; from?: string; to?: string }
) {
  const query = queryString({ subjectId: opts?.subjectId, from: opts?.from, to: opts?.to });
  return api.get<SectionQuizSummary>(`${BASE}/sections/${sectionId}${query}`, schoolId);
}

/**
 * Stats for MCQ bank questions in one subject + grade: a teacher's own questions, or every
 * author's for an admin. With `sectionId`, only that section's students' answers count and the
 * grade is taken from the section.
 */
export function getQuestionStats(
  schoolId: string,
  opts: {
    subjectId: string;
    className?: string;
    sectionId?: string;
    from?: string;
    to?: string;
    includeRetired?: boolean;
  }
) {
  const query = queryString({
    subjectId: opts.subjectId,
    className: opts.className?.trim(),
    sectionId: opts.sectionId,
    from: opts.from,
    to: opts.to,
    includeRetired: opts.includeRetired,
  });
  return api.get<QuestionStatsResponse>(`${BASE}/questions${query}`, schoolId);
}
