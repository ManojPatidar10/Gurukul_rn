export interface AssessmentStatus {
  label: string;
  variant: 'info' | 'warning' | 'success';
}

export interface MarksCounts {
  /** ACTIVE students in the section with a mark or Absent saved. Null/missing for non-staff, or an older server. */
  entered?: number | null;
  /** ACTIVE students in the section. */
  expected?: number | null;
}

/**
 * The phone's local date as YYYY-MM-DD (the same as DatePickerField's toIsoDate) - the `today` for
 * assessmentStatus. Not toISOString(), which is the UTC date and is still yesterday in India until
 * 05:30 (audit L1).
 */
export function localToday(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * The status chip on the section's assessments list. Dates are compared as YYYY-MM-DD strings, so
 * `today` must be the phone's local date - localToday() - not the UTC one.
 * Staff see how far marks entry has got once the date has passed; everyone else, or an older server
 * that doesn't send the counts, sees "Completed".
 */
export function assessmentStatus(
  assessmentDate: string,
  today: string,
  counts: MarksCounts,
  isStaff: boolean
): AssessmentStatus {
  if (assessmentDate > today) return { label: 'Upcoming', variant: 'info' };
  if (assessmentDate === today) return { label: 'Today', variant: 'info' };
  const { entered, expected } = counts;
  if (!isStaff || entered == null || expected == null || expected === 0) {
    return { label: 'Completed', variant: 'success' };
  }
  if (entered === 0) return { label: 'Marks pending', variant: 'warning' };
  if (entered < expected) return { label: `Marks ${entered}/${expected}`, variant: 'warning' };
  return { label: 'Marks entered', variant: 'success' };
}
