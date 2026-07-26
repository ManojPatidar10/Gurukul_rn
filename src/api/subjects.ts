import { api } from './client';
import type { Subject, SubjectRequest } from './types';

export function listSubjects(schoolId: string) {
  return api.get<Subject[]>('/api/v1/subjects', schoolId);
}

export function createSubject(schoolId: string, req: SubjectRequest) {
  return api.post<Subject>('/api/v1/subjects', req, schoolId);
}

export function getSubject(schoolId: string, id: string) {
  return api.get<Subject>(`/api/v1/subjects/${id}`, schoolId);
}
