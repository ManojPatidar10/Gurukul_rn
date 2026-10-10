import type { AssessmentResultEntry, StudentResult } from '../api/types';
import { isPassingMark } from './gradingScale';
import { NO_VALUE } from './reportCardDisplay';

/** The assessment_result.remarks limit the server enforces. */
export const MAX_REMARK_LENGTH = 500;

export interface ResultRowState {
  marksText: string;
  absent: boolean;
  /** Left out of the report card's sums. Absent and Excused are never both ticked. */
  excused: boolean;
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

export interface ResultsGridMode {
  /** The grid is for entering marks: Save and the remark boxes show. */
  editable: boolean;
  /**
   * The inputs take typing. Off while a save is in flight: its response replaces every row, so
   * anything typed meanwhile would be lost without a word (audit M7).
   */
  inputsEnabled: boolean;
}

/** How the marks grid behaves: read-only for a locked term or a caller who may only view. */
export function resultsGridMode(state: { locked: boolean; readOnly: boolean; saving: boolean }): ResultsGridMode {
  const editable = !state.locked && !state.readOnly;
  return { editable, inputsEnabled: editable && !state.saving };
}

/** A row of the marks grid as it was saved. */
export function rowFromResult(result: StudentResult): ResultRowState {
  return {
    marksText: result.marksObtained != null ? String(result.marksObtained) : '',
    absent: result.absent,
    excused: result.excused === true,
    remarksText: result.remarks ?? '',
  };
}

/**
 * The server knows Excused when its result rows carry the field. An older server has none, so the
 * Excused toggle stays hidden and `excused` is never sent to it.
 */
export function supportsExcused(results: StudentResult[]): boolean {
  return results.some((r) => typeof r.excused === 'boolean');
}

/** What's saved for a student, read-only: "18 / 20", "AB", "EX", or "—" when there are no marks. */
export function savedResultLabel(result: StudentResult, maxMarks: number): string {
  if (result.absent) return 'AB';
  if (result.excused) return 'EX';
  return result.marksObtained != null ? `${result.marksObtained} / ${maxMarks}` : NO_VALUE;
}

/**
 * The save entry that clears a moved student's result here (no marks, not absent or excused, no
 * remark) - the only change the server accepts for a student no longer in the section.
 */
export function clearMovedEntry(studentId: string): AssessmentResultEntry {
  return { studentId, absent: false, excused: false };
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
    if (!!row.excused !== saved.excused) return true;
    if (row.remarksText.trim() !== saved.remarksText.trim()) return true;
    // Absent or Excused before and after: the marks box isn't used, so what's in it doesn't matter.
    return !row.absent && !row.excused && !sameMarks(row.marksText, saved.marksText);
  });
}

/**
 * Builds the results save payload from the marks grid. A row is sent when it has marks, Absent,
 * Excused, a remark, or a result saved before. A row with none of those is left out, so it stays
 * "not entered" - the backend leaves rows it isn't sent untouched. A row that had something saved
 * and was cleared is still sent blank, since that's the only way to undo a mark. The backend
 * replaces the stored remark with the one sent, so every sent row carries its (trimmed) remark.
 *
 * With `supportsExcused`, every sent row says whether it's excused (an excused row is sent like an
 * absent one, with no marks). Without it (an older server) `excused` is never sent.
 *
 * `invalid` lists the students whose marks aren't a number from 0 to maxMarks with at most 2
 * decimal places - the caller should stop and say so rather than save.
 */
export function buildResultsPayload(
  roster: StudentResult[],
  rows: Record<string, ResultRowState>,
  maxMarks: number,
  options: { supportsExcused?: boolean } = {}
): { results: AssessmentResultEntry[]; invalid: StudentResult[] } {
  const results: AssessmentResultEntry[] = [];
  const invalid: StudentResult[] = [];
  const withExcused = options.supportsExcused === true;
  roster.forEach((student) => {
    const row = rows[student.studentId] ?? rowFromResult(student);
    const remarks = row.remarksText.trim();
    const base: AssessmentResultEntry = { studentId: student.studentId, absent: false };
    if (withExcused) base.excused = false;
    if (remarks) base.remarks = remarks;
    if (row.absent) {
      results.push({ ...base, absent: true });
      return;
    }
    if (withExcused && row.excused) {
      results.push({ ...base, excused: true });
      return;
    }
    const text = row.marksText.trim();
    if (!text) {
      const hadSavedResult =
        student.absent || student.excused === true || student.marksObtained != null || !!student.remarks;
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
  /** Students with a mark, Absent or Excused saved. */
  entered: number;
  total: number;
  average: number | null;
  highest: number | null;
  lowest: number | null;
  /** Null when there's no pass mark (the grading scale didn't load, or has under 2 bands). */
  passCount: number | null;
  failCount: number | null;
}

/**
 * Quick sanity-check stats over the saved marks, for the teacher before report cards are published.
 * An excused student counts as entered but is left out of the average and Pass/Fail.
 */
export function summarizeResults(roster: StudentResult[], maxMarks: number, passMark: number | null): ResultsSummary {
  const entered = roster.filter((r) => r.absent || r.excused === true || r.marksObtained != null).length;
  const marks = roster
    .filter((r) => !r.absent && r.excused !== true && r.marksObtained != null)
    .map((r) => r.marksObtained as number);
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
