import type { ReportCardPublishCheck } from '../api/types';

export type PublishWarning =
  | { code: 'noStudents' }
  | { code: 'missingMarks'; students: number; marks: number }
  | { code: 'untermedAssessments'; count: number }
  | { code: 'alreadyPublished'; publishedAt: string | null };

/** A term no assessment in the section uses would publish nothing but empty report cards. */
export function canPublish(check: ReportCardPublishCheck): boolean {
  return check.assessmentCount > 0;
}

/** Everything the admin should know before publishing, most serious first. */
export function publishWarnings(check: ReportCardPublishCheck): PublishWarning[] {
  const warnings: PublishWarning[] = [];
  if (check.studentCount === 0) warnings.push({ code: 'noStudents' });
  if (check.studentsWithMissingMarks > 0 || check.missingMarksCount > 0) {
    warnings.push({ code: 'missingMarks', students: check.studentsWithMissingMarks, marks: check.missingMarksCount });
  }
  if (check.untermedAssessmentCount > 0) {
    warnings.push({ code: 'untermedAssessments', count: check.untermedAssessmentCount });
  }
  if (check.alreadyPublished) warnings.push({ code: 'alreadyPublished', publishedAt: check.publishedAt });
  return warnings;
}

function count(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

function defaultFormatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function warningText(warning: PublishWarning, term: string, formatDate: (iso: string) => string): string {
  switch (warning.code) {
    case 'noStudents':
      return 'This section has no students, so no report cards will be published.';
    case 'missingMarks':
      return (
        `${count(warning.students, 'student has', 'students have')} marks missing ` +
        `(${count(warning.marks, 'mark')} in all). Their report cards will say marks are missing.`
      );
    case 'untermedAssessments':
      return (
        `${count(warning.count, 'assessment')} in this section ${warning.count === 1 ? 'has' : 'have'} no term, ` +
        `so ${warning.count === 1 ? 'its' : 'their'} marks won't be on any report card. If ${warning.count === 1 ? 'it belongs' : 'they belong'} ` +
        `to "${term}", use "Fix assessments missing a term" first: after publishing, nothing can be added to "${term}".`
      );
    case 'alreadyPublished':
      return (
        `"${term}" was already published${warning.publishedAt ? ` on ${formatDate(warning.publishedAt)}` : ''}. ` +
        'Publishing again only updates the published date. Students and parents are not notified again.'
      );
  }
}

/**
 * The confirmation shown before publishing: the counts, every warning, and what publishing does
 * (notifies families the first time, locks the term's marks, can't be undone from the app yet).
 * English only, like the rest of the Publish screen.
 */
export function publishConfirmation(
  check: ReportCardPublishCheck,
  formatDate: (iso: string) => string = defaultFormatDate
): { title: string; message: string } {
  const { term } = check;
  const lines = [`${count(check.studentCount, 'student')} · ${count(check.assessmentCount, 'assessment')} in "${term}".`];
  const warnings = publishWarnings(check);
  if (warnings.length > 0) {
    lines.push('', ...warnings.map((w) => `• ${warningText(w, term, formatDate)}`));
  }
  lines.push('');
  if (!check.alreadyPublished) {
    lines.push('Every student and parent in this section will be notified.');
    lines.push(`Marks for every assessment in "${term}" will be locked.`);
  } else {
    lines.push(`Marks for every assessment in "${term}" stay locked.`);
  }
  lines.push("There's no undo yet: published report cards can't be withdrawn from the app.");
  return { title: `Publish "${term}" report cards?`, message: lines.join('\n') };
}

/** Why publishing is refused outright (see canPublish). */
export function nothingToPublishMessage(check: ReportCardPublishCheck): string {
  return `No assessment in this section has the term "${check.term}", so every report card would be empty.`;
}
