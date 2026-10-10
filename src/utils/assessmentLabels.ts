import type { TFunction } from 'i18next';

import type { ApiError } from '../api/client';
import type { AssessmentType } from '../api/types';

/** The words for an assessment's type chip. Full keys, so tsc checks every type has one. */
const TYPE_KEYS: Record<AssessmentType, string> = {
  ASSIGNMENT: 'assessments.types.ASSIGNMENT',
  QUIZ: 'assessments.types.QUIZ',
  TEST: 'assessments.types.TEST',
  EXAM: 'assessments.types.EXAM',
};

/** "Assignment", "Quiz", "Test" or "Exam". A type a newer server adds shows as sent. */
export function assessmentTypeLabel(type: AssessmentType, t: TFunction): string {
  const key = TYPE_KEYS[type] as string | undefined;
  return key ? t(key) : type;
}

/** A whole number of students from the 409's data, or null when it's missing or isn't one. */
function studentCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

/**
 * The body of the alert when the server refuses to delete an assessment because students have
 * marks, Absent or a remark saved (409 ASSESSMENT_HAS_MARKS), built from the counts it sends in
 * `data` so it can be translated. An older server, or counts that don't make sense, falls back to
 * the server's own message.
 */
export function hasMarksMessage(error: ApiError, t: TFunction): string {
  const data = error.data && typeof error.data === 'object' ? (error.data as Record<string, unknown>) : {};
  const withMarks = studentCount(data.studentsWithMarks);
  if (withMarks === null || withMarks < 1) return error.message;
  const message = t('assessments.detail.hasMarks', { count: withMarks });
  const moved = studentCount(data.movedStudentsWithMarks);
  if (moved === null || moved < 1) return message;
  return `${message} ${t('assessments.detail.movedStudents', { count: moved })}`;
}
