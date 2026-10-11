import { api } from './client';
import type { SalaryStructure, SalaryStructureRequest } from './types';

/** All of the school's structures, or one employee's: by name, then newest first. */
export function listSalaryStructures(schoolId: string, params: { employeeId?: string } = {}) {
  const query = params.employeeId ? `?${new URLSearchParams({ employeeId: params.employeeId }).toString()}` : '';
  return api.get<SalaryStructure[]>(`/api/v1/salary-structures${query}`, schoolId);
}

export function createSalaryStructure(schoolId: string, req: SalaryStructureRequest) {
  return api.post<SalaryStructure>('/api/v1/salary-structures', req, schoolId);
}

/** Refused (409 SALARY_STRUCTURE_IN_USE) once salary paid for a month it covers. */
export function updateSalaryStructure(schoolId: string, id: string, req: SalaryStructureRequest) {
  return api.put<SalaryStructure>(`/api/v1/salary-structures/${id}`, req, schoolId);
}
