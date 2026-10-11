import { api } from './client';
import type { InfraExpenseCategory, InfraExpenseCategoryCreate, InfraExpenseCategoryUpdate } from './expenseTypes';

const BASE = '/api/v1/infra-expense-categories';

/** Active categories only, unless `includeInactive`. Sorted by name. */
export function listInfraExpenseCategories(schoolId: string, includeInactive = false) {
  return api.get<InfraExpenseCategory[]>(includeInactive ? `${BASE}?includeInactive=true` : BASE, schoolId);
}

export function createInfraExpenseCategory(schoolId: string, req: InfraExpenseCategoryCreate) {
  return api.post<InfraExpenseCategory>(BASE, req, schoolId);
}

/** Renames and/or turns a category on or off. The code never changes. */
export function updateInfraExpenseCategory(schoolId: string, id: string, req: InfraExpenseCategoryUpdate) {
  return api.put<InfraExpenseCategory>(`${BASE}/${id}`, req, schoolId);
}
