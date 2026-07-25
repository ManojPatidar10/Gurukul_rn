import { api } from './client';
import type { ClassSection, ClassSectionRequest, Student } from './types';

export function listClassSections(schoolId: string) {
  return api.get<ClassSection[]>('/api/v1/class-sections', schoolId);
}

export function createClassSection(schoolId: string, req: ClassSectionRequest) {
  return api.post<ClassSection>('/api/v1/class-sections', req, schoolId);
}

export function listStudentsInClassSection(schoolId: string, classSectionId: string) {
  return api.get<Student[]>(`/api/v1/class-sections/${classSectionId}/students`, schoolId);
}
