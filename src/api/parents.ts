import { api } from './client';
import type { LinkChildRequest, Student } from './types';

export function getMyChildren(schoolId: string) {
  return api.get<Student[]>('/api/v1/parents/me/children', schoolId);
}

export function linkChild(schoolId: string, req: LinkChildRequest) {
  return api.post<void>('/api/v1/parents/me/children', req, schoolId);
}
