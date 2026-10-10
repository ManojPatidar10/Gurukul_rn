import type { AssessmentResultEntry, StudentResult } from '../api/types';
import { isPassingMark } from './gradingScale';

/** The assessment_result.remarks limit the server enforces. */
export const MAX_REMARK_LENGTH = 500;

export interface ResultRowState {
  marksText: string;
  absent: boolean;
  remarksText: string;
}

const MARKS = /^\d{1,3}(\.\d{1,2})?$/;

/**
 * Typed marks (or max marks), or null if they aren't a plain number of up to 3 digits with at most
 * 2 decimal places - the DECIMAL(5,2) the server stores. Number() alone would accept "1e1", "0x10",
 * "-1" or "" (as 0). Doesn't check the upper limit: that's the assessment's max marks.
 */
export function parseMarks(text: string): number | null {
  const trimmed = text.trim();
  return MARKS.test(trimmed) ? Number(trimmed) : null;
}

/** A row of the marks grid as it was saved. */
export function rowFromResult(result: StudentResult): ResultRowState {
  return {
    marksText: result.marksObtained != null ? String(result.marksObtained) : '',
    absent: result.absent,
    remarksText: result.remarks ?? '',
  };
}

function sameMarks(typed: string, saved: string): boolean {
  const text = typed.trim();
  if (text === saved) return true;
  const a = parseMarks(text);
  const b = parseMarks(saved);
  return a !== null && b !== null && a === b;
}

/** True when anything typed on the grid differs from what was loaded, so leaving would lose it. */
export function isResultsDirty(roster: StudentResult[], rows: Record<string, ResultRowState>): boolean {
  return roster.some((student) => {
    const row = rows[student.studentId];
    if (!row) return false;
    const saved = rowFromResult(student);
    if (row.absent !== saved.absent) return true;
    if (row.remarksText.trim() !== saved.remarksText.trim()) return true;
    return !row.absent && !sameMarks(row.marksText, saved.marksText);
  });
}

/**
 * Builds the results save payload from the marks grid. A row is sent when it has marks, Absent, a
 * remark, or a result saved before. A row with none of those is left out, so it stays "not
 * entered" - the backend leaves rows it isn't sent untouched. A row that had something saved and
 * was cleared is still sent blank, since that's the only way to undo a mark. The backend replaces
 * the stored remark with the one sent, so every sent row carries its (trimmed) remark.
 *
 * `invalid` lists the students whose marks aren't a number from 0 to maxMarks with at most 2
 * decimal places - the caller should stop and say so rather than save.
 */
export function buildResultsPayload(
  roster: StudentResult[],
  rows: Record<string, ResultRowState>,
  maxMarks: number
): { results: AssessmentResultEntry[]; invalid: StudentResult[] } {
  const results: AssessmentResultEntry[] = [];
  const invalid: StudentResult[] = [];
  roster.forEach((student) => {
    const row = rows[student.studentId] ?? rowFromResult(student);
    const remarks = row.remarksText.trim();
    const base: AssessmentResultEntry = { studentId: student.studentId, absent: false };
    if (remarks) base.remarks = remarks;
    if (row.absent) {
      results.push({ ...base, absent: true });
      return;
    }
    const text = row.marksText.trim();
    if (!text) {
      const hadSavedResult = student.absent || student.marksObtained != null || !!student.remarks;
      if (hadSavedResult || remarks) results.push(base);
      return;
    }
    const marks = parseMarks(text);
    if (marks === null || marks > maxMarks) {
      invalid.push(student);
      return;
    }
    results.push({ ...base, marksObtained: marks });
  });
  return { results, invalid };
}

export interface ResultsSummary {
  /** Students with a mark or Absent saved. */
  entered: number;
  total: number;
  average: number | null;
  highest: number | null;
  lowest: number | null;
  /** Null when there's no pass mark (the grading scale didn't load, or has under 2 bands). */
  passCount: number | null;
  failCount: number | null;
}

/** Quick sanity-check stats over the saved marks, for the teacher before report cards are published. */
export function summarizeResults(roster: StudentResult[], maxMarks: number, passMark: number | null): ResultsSummary {
  const entered = roster.filter((r) => r.absent || r.marksObtained != null).length;
  const marks = roster.filter((r) => !r.absent && r.marksObtained != null).map((r) => r.marksObtained as number);
  if (marks.length === 0) {
    return { entered, total: roster.length, average: null, highest: null, lowest: null, passCount: null, failCount: null };
  }
  const passCount = passMark === null ? null : marks.filter((m) => isPassingMark(m, maxMarks, passMark)).length;
  return {
    entered,
    total: roster.length,
    average: marks.reduce((a, b) => a + b, 0) / marks.length,
    highest: Math.max(...marks),
    lowest: Math.min(...marks),
    passCount,
    failCount: passCount === null ? null : marks.length - passCount,
  };
}
