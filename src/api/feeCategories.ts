import { api } from './client';
import type { FeeCategory, FeeCategoryRequest } from './types';

export function listFeeCategories(schoolId: string) {
  return api.get<FeeCategory[]>('/api/v1/fee-categories', schoolId);
}

export function createFeeCategory(schoolId: string, req: FeeCategoryRequest) {
  return api.post<FeeCategory>('/api/v1/fee-categories', req, schoolId);
}
