import { api } from './client';
import type { FeeCategory, FeeCategoryRequest, FeeCategoryUpdateRequest } from './types';

/** Every category, in use or not, ordered by code. */
export function listFeeCategories(schoolId: string) {
  return api.get<FeeCategory[]>('/api/v1/fee-categories', schoolId);
}

export function createFeeCategory(schoolId: string, req: FeeCategoryRequest) {
  return api.post<FeeCategory>('/api/v1/fee-categories', req, schoolId);
}

/** Renames it, or takes it in or out of use. The code never changes. */
export function updateFeeCategory(schoolId: string, id: string, req: FeeCategoryUpdateRequest) {
  return api.put<FeeCategory>(`/api/v1/fee-categories/${id}`, req, schoolId);
}
