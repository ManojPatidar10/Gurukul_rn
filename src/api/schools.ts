import { api } from './client';
import type {
  School,
  SchoolRegistrationRequest,
  SchoolRegistrationResponse,
  SchoolSearchResult,
  SchoolUpdateRequest,
} from './types';

export function searchSchools(name?: string) {
  const query = name ? `?name=${encodeURIComponent(name)}` : '';
  return api.get<SchoolSearchResult[]>(`/api/v1/schools${query}`);
}

export function registerSchool(req: SchoolRegistrationRequest) {
  return api.post<SchoolRegistrationResponse>('/api/v1/schools', req);
}

export function getSchool(id: string) {
  return api.get<School>(`/api/v1/schools/${id}`, id);
}

export function updateSchool(id: string, req: SchoolUpdateRequest) {
  return api.put<School>(`/api/v1/schools/${id}`, req, id);
}
