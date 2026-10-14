import type { Student } from '../api/types';

/**
 * The pupils a class register lists for marking: only those still at the school (ACTIVE), in the
 * order given. `/class-sections/{id}/students` returns every status, and a pupil who left (ALUMNI or
 * WITHDRAWN) keeps their class-section, so without this they would have to be marked every day -
 * and Save would give them a PRESENT record. "Mark all present", Save and the "everyone marked"
 * check cover only these pupils; a past mark for a pupil who left stays as it is (Save sends a
 * partial list, which the backend accepts), and the backend's roster for a date still lists them
 * when they were marked that day.
 */
export function registerStudents<T extends Pick<Student, 'status'>>(students: readonly T[]): T[] {
  return students.filter((s) => s.status === 'ACTIVE');
}
