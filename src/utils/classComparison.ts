/**
 * How far a student has to be from their class before we call it anything.
 *
 * <p>Within a point either way is noise. Calling a 0.4 gap a strength teaches a parent to read
 * meaning into numbers that have none, so the subject bar, the overall-status charts and the
 * report card PDF all decline to - and they have to decline together, or the same student reads
 * as "in line" on one screen and "behind" on the next. The server applies this same band in
 * ReportCardChart.isNotable().
 */
export const CLASS_COMPARISON_NOISE_BAND = 1;

export function isNotableDelta(delta: number | null | undefined): boolean {
  if (delta == null) {
    return false;
  }
  // Rounded first, so a delta that displays as "-1.0" is not treated as notable because its
  // unrounded value happened to be -1.04. What the parent is shown is what is judged.
  return Math.abs(Number(delta.toFixed(1))) > CLASS_COMPARISON_NOISE_BAND;
}
