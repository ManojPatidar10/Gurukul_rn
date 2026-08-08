import { api } from './client';
import type { Teacher } from './types';

export function listTeachers(schoolId: string) {
  return api.get<Teacher[]>('/api/v1/teachers', schoolId);
}
