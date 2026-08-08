import { api } from './client';
import type { GradingBand } from './types';

export function getGradingScale(schoolId: string) {
  return api.get<GradingBand[]>('/api/v1/grading-scale', schoolId);
}

export function replaceGradingScale(schoolId: string, bands: Omit<GradingBand, 'id'>[]) {
  return api.put<GradingBand[]>('/api/v1/grading-scale', bands, schoolId);
}
