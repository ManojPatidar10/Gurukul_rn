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
