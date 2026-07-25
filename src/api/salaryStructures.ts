import { api } from './client';
import type { SalaryStructure, SalaryStructureRequest } from './types';

export function listSalaryStructures(schoolId: string) {
  return api.get<SalaryStructure[]>('/api/v1/salary-structures', schoolId);
}

export function createSalaryStructure(schoolId: string, req: SalaryStructureRequest) {
  return api.post<SalaryStructure>('/api/v1/salary-structures', req, schoolId);
}
