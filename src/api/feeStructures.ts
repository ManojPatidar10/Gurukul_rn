import { api } from './client';
import type { FeeAssessment, FeeStructure, FeeStructureRequest } from './types';

export function listFeeStructures(schoolId: string) {
  return api.get<FeeStructure[]>('/api/v1/fee-structures', schoolId);
}

export function getFeeStructure(schoolId: string, id: string) {
  return api.get<FeeStructure>(`/api/v1/fee-structures/${id}`, schoolId);
}

export function createFeeStructure(schoolId: string, req: FeeStructureRequest) {
  return api.post<FeeStructure>('/api/v1/fee-structures', req, schoolId);
}

export function generateAssessments(schoolId: string, id: string) {
  return api.post<FeeAssessment[]>(`/api/v1/fee-structures/${id}/generate-assessments`, undefined, schoolId);
}
