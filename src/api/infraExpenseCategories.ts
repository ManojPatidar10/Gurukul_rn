import { api } from './client';
import type { InfraExpenseCategory } from './types';

export function listInfraExpenseCategories(schoolId: string) {
  return api.get<InfraExpenseCategory[]>('/api/v1/infra-expense-categories', schoolId);
}
