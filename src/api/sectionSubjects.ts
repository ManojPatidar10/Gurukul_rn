import { api } from './client';
import type { SectionSubjectRequest, SubjectAssignment } from './types';

export function listSectionSubjects(schoolId: string, sectionId: string) {
  return api.get<SubjectAssignment[]>(`/api/v1/class-sections/${sectionId}/subjects`, schoolId);
}

export function assignSectionSubject(schoolId: string, sectionId: string, req: SectionSubjectRequest) {
  return api.post<SubjectAssignment>(`/api/v1/class-sections/${sectionId}/subjects`, req, schoolId);
}
