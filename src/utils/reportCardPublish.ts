import type { TFunction } from 'i18next';

import type { ReportCardPublishCheck } from '../api/types';

export type PublishWarning =
  | { code: 'noStudents' }
  | { code: 'missingMarks'; students: number; marks: number }
  | { code: 'untermedAssessments'; count: number }
  | { code: 'alreadyPublished'; publishedAt: string | null }
  | { code: 'previouslyUnpublished'; unpublishedAt: string; byName: string | null; reason: string | null };

/** The server's limits on an unpublish reason (trimmed). */
export const MIN_UNPUBLISH_REASON_LENGTH = 5;
export const MAX_UNPUBLISH_REASON_LENGTH = 500;

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
  // Only before a first publish: the server sends the last unpublish even while the term is published
  // again, and a re-publish of a published term notifies nobody.
  if (check.lastUnpublishedAt && !check.alreadyPublished) {
    warnings.push({
      code: 'previouslyUnpublished',
      unpublishedAt: check.lastUnpublishedAt,
      byName: check.lastUnpublishedByName ?? null,
      reason: check.lastUnpublishReason ?? null,
    });
  }
  return warnings;
}

function warningText(
  warning: PublishWarning,
  check: ReportCardPublishCheck,
  formatDate: (iso: string) => string,
  t: TFunction
): string {
  const { term } = check;
  switch (warning.code) {
    case 'noStudents':
      return t('reportCardPublish.confirm.noStudents');
    case 'missingMarks':
      return t('reportCardPublish.confirm.missingMarks', {
        count: warning.students,
        marks: t('reportCardPublish.confirm.marks', { count: warning.marks }),
      });
    case 'untermedAssessments': {
      const summary = t('reportCardPublish.confirm.untermed', { count: warning.count });
      // Named by the button's on-screen label, in either language.
      const fix = t('reportCardPublish.fixButton');
      // A published term is locked (the app and the server both refuse the fix for it), so on a
      // re-publish don't point the admin at a fix they can't use for this term.
      const next = check.alreadyPublished
        ? t('reportCardPublish.confirm.untermedLocked', { count: warning.count, term, fix })
        : t('reportCardPublish.confirm.untermedFixFirst', { count: warning.count, term, fix });
      return `${summary} ${next}`;
    }
    case 'alreadyPublished':
      return warning.publishedAt
        ? t('reportCardPublish.confirm.alreadyPublishedOn', { term, date: formatDate(warning.publishedAt) })
        : t('reportCardPublish.confirm.alreadyPublished', { term });
    case 'previouslyUnpublished': {
      const date = formatDate(warning.unpublishedAt);
      const { byName: name, reason } = warning;
      if (name && reason) return t('reportCardPublish.confirm.unpublishedByWhy', { term, date, name, reason });
      if (name) return t('reportCardPublish.confirm.unpublishedBy', { term, date, name });
      if (reason) return t('reportCardPublish.confirm.unpublishedWhy', { term, date, reason });
      return t('reportCardPublish.confirm.unpublished', { term, date });
    }
  }
}

/**
 * The confirmation shown before publishing: the counts, every warning, and what publishing does
 * (notifies families the first time, locks the term's marks, and only an admin can unpublish).
 */
export function publishConfirmation(
  check: ReportCardPublishCheck,
  formatDate: (iso: string) => string,
  t: TFunction
): { title: string; message: string } {
  const { term } = check;
  const lines = [
    t('reportCardPublish.confirm.counts', {
      students: t('reportCardPublish.confirm.students', { count: check.studentCount }),
      assessments: t('reportCardPublish.confirm.assessments', { count: check.assessmentCount }),
      term,
    }),
  ];
  const warnings = publishWarnings(check);
  if (warnings.length > 0) {
    lines.push('', ...warnings.map((w) => `• ${warningText(w, check, formatDate, t)}`));
  }
  lines.push('');
  if (!check.alreadyPublished) {
    lines.push(t('reportCardPublish.confirm.willNotify'));
    lines.push(t('reportCardPublish.confirm.willLock', { term }));
  } else {
    lines.push(t('reportCardPublish.confirm.stayLocked', { term }));
  }
  lines.push(t('reportCardPublish.confirm.unpublishLater'));
  return { title: t('reportCardPublish.confirm.title', { term }), message: lines.join('\n') };
}

/** Why publishing is refused outright (see canPublish). */
export function nothingToPublishMessage(check: ReportCardPublishCheck, t: TFunction): string {
  return t('reportCardPublish.nothingMessage', { term: check.term });
}

/**
 * Null when the unpublish reason can be sent, otherwise the i18n key saying why not: the server
 * wants 5 to 500 characters once trimmed.
 */
export function unpublishReasonError(reason: string): string | null {
  const length = reason.trim().length;
  return length >= MIN_UNPUBLISH_REASON_LENGTH && length <= MAX_UNPUBLISH_REASON_LENGTH
    ? null
    : 'reportCardUnpublish.reasonLength';
}
