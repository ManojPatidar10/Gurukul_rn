import { api } from './client';
import type { SectionSubjectRequest, SubjectAssignment, TeacherSubjectAssignment } from './types';

export function listSectionSubjects(schoolId: string, sectionId: string) {
  return api.get<SubjectAssignment[]>(`/api/v1/class-sections/${sectionId}/subjects`, schoolId);
}

export function assignSectionSubject(schoolId: string, sectionId: string, req: SectionSubjectRequest) {
  return api.post<SubjectAssignment>(`/api/v1/class-sections/${sectionId}/subjects`, req, schoolId);
}

/** Every section + subject a teacher is assigned to. */
export function listTeacherAssignments(schoolId: string, employeeId: string) {
  return api.get<TeacherSubjectAssignment[]>(`/api/v1/employees/${employeeId}/subject-assignments`, schoolId);
}
