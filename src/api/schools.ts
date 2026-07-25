import { api } from './client';
import type { School, SchoolRegistrationRequest } from './types';

export function registerSchool(req: SchoolRegistrationRequest) {
  return api.post<School>('/api/v1/schools', req);
}

export function getSchool(id: string) {
  return api.get<School>(`/api/v1/schools/${id}`, id);
}
