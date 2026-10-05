import type { AssessmentResultEntry, StudentResult } from '../api/types';

export interface ResultRowState {
  marksText: string;
  absent: boolean;
}

/**
 * Builds the results save payload from the marks grid. A blank row that isn't marked absent is
 * left out, so it stays "not entered" - sending it would save a result with no marks, which report
 * cards count as 0. The backend leaves rows it isn't sent untouched, so saved marks are kept. The
 * one exception is a row that had a saved mark (or absent) and was cleared: it's still sent blank,
 * since that's the only way to undo a mark. Saved remarks ride along because the backend
 * overwrites them on every row it's sent.
 *
 * `invalid` lists the students whose marks aren't a number from 0 to maxMarks - the caller should
 * stop and say so rather than save.
 */
export function buildResultsPayload(
  roster: StudentResult[],
  rows: Record<string, ResultRowState>,
  maxMarks: number
): { results: AssessmentResultEntry[]; invalid: StudentResult[] } {
  const results: AssessmentResultEntry[] = [];
  const invalid: StudentResult[] = [];
  roster.forEach((student) => {
    const row = rows[student.studentId] ?? { marksText: '', absent: false };
    const base = { studentId: student.studentId, remarks: student.remarks ?? undefined };
    if (row.absent) {
      results.push({ ...base, absent: true });
      return;
    }
    const text = row.marksText.trim();
    if (!text) {
      const hadSavedResult = student.absent || student.marksObtained != null;
      if (hadSavedResult) results.push({ ...base, absent: false });
      return;
    }
    const marks = Number(text);
    if (Number.isNaN(marks) || marks < 0 || marks > maxMarks) {
      invalid.push(student);
      return;
    }
    results.push({ ...base, absent: false, marksObtained: marks });
  });
  return { results, invalid };
}
