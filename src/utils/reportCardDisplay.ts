import type { ReportCard, ReportCardAssessment, SubjectResult } from '../api/types';

/** Shown in place of a value the report card doesn't have - never a made-up 0% or "F". */
export const NO_VALUE = '—';

/**
 * The backend sends a null overall percentage and grade when a student has no marks for the term
 * (none entered, none marked absent). Show "—" for them, not "0% · F".
 */
export function formatOverallPercentage(percentage: number | null | undefined): string {
  return percentage == null ? NO_VALUE : `${percentage}%`;
}

export function formatOverallGrade(grade: string | null | undefined): string {
  return grade == null || grade === '' ? NO_VALUE : grade;
}

/**
 * How many of the term's marks the student is missing. A backend without missingMarksCount yet
 * (it ships alongside this app change) leaves it out, which reads as none missing.
 */
export function missingMarksCount(count: number | null | undefined): number {
  return typeof count === 'number' && count > 0 ? count : 0;
}

/**
 * A subject's percentage and grade are null only when every result in it is excused: "—", never a
 * made-up 0%.
 */
export function formatSubjectPercentage(percentage: number | null | undefined): string {
  return formatOverallPercentage(percentage);
}

export function formatSubjectGrade(grade: string | null | undefined): string {
  return formatOverallGrade(grade);
}

/** A subject's absent and excused counts. An older server leaves them out, which reads as none. */
export function subjectCounts(subject: Pick<SubjectResult, 'absentCount' | 'excusedCount'>): {
  absent: number;
  excused: number;
} {
  return { absent: missingMarksCount(subject.absentCount), excused: missingMarksCount(subject.excusedCount) };
}

/** The class marks grid cell: "18/20", or "EX" for a subject where every result is excused. */
export function gridSubjectCell(subject: Pick<SubjectResult, 'marksObtained' | 'maxMarks' | 'percentage'>): string {
  return subject.percentage == null ? 'EX' : `${subject.marksObtained}/${subject.maxMarks}`;
}

/** One assessment's line on the report card: "18 / 20", "AB" (absent, counted as 0), "EX" (excused) or "—". */
export function assessmentMarkLabel(assessment: Pick<ReportCardAssessment, 'status' | 'marksObtained' | 'maxMarks'>): string {
  switch (assessment.status) {
    case 'MARKED':
      return assessment.marksObtained == null ? NO_VALUE : `${assessment.marksObtained} / ${assessment.maxMarks}`;
    case 'ABSENT':
      return 'AB';
    case 'EXCUSED':
      return 'EX';
    default:
      return NO_VALUE;
  }
}

/** True when the card shows any AB or EX, so the legend explaining them is needed. */
export function hasAbsentOrExcused(card: Pick<ReportCard, 'subjects'>): boolean {
  return card.subjects.some((subject) => {
    const counts = subjectCounts(subject);
    return (
      counts.absent > 0 ||
      counts.excused > 0 ||
      (subject.assessments ?? []).some((a) => a.status === 'ABSENT' || a.status === 'EXCUSED')
    );
  });
}

/**
 * The attendance stat's label: the term's dates when the server counted just the term
 * (`attendanceBasis: TERM`), otherwise "to date" - including an older server that doesn't say.
 */
export function attendanceLabelKey(
  card: Pick<ReportCard, 'attendanceBasis' | 'attendanceFrom' | 'attendanceTo'>,
  formatDate: (iso: string) => string = (iso) => iso
): { key: string; params?: { from: string; to: string } } {
  if (card.attendanceBasis === 'TERM' && card.attendanceFrom && card.attendanceTo) {
    return {
      key: 'reportCardDetail.attendanceTerm',
      params: { from: formatDate(card.attendanceFrom), to: formatDate(card.attendanceTo) },
    };
  }
  return { key: 'reportCardDetail.attendanceToDate' };
}
