import type { SubjectAssignment } from '../api/types';

export interface SectionTeacher {
  teacherId: string;
  teacherName: string;
  /** The subjects this teacher takes in the section, in the order the backend listed them. */
  subjectNames: string[];
}

/**
 * The teachers of one class-section, from its subject assignments (GET /class-sections/{id}/subjects):
 * one entry per teacher with their subjects merged, sorted by name. A row with no teacher assigned
 * yet is skipped. The Teacher Tools hub uses this to pick who an admin generates a quiz for.
 */
export function sectionTeachers(assignments: SubjectAssignment[]): SectionTeacher[] {
  const byId = new Map<string, SectionTeacher>();
  for (const row of assignments) {
    if (!row.teacherId) continue;
    const existing = byId.get(row.teacherId);
    if (!existing) {
      byId.set(row.teacherId, {
        teacherId: row.teacherId,
        teacherName: row.teacherName ?? '',
        subjectNames: row.subjectName ? [row.subjectName] : [],
      });
    } else if (row.subjectName && !existing.subjectNames.includes(row.subjectName)) {
      existing.subjectNames.push(row.subjectName);
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.teacherName.localeCompare(b.teacherName));
}
