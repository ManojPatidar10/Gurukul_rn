import { api, SLOW_TIMEOUT_MS } from './client';
import type {
  FeeStructure,
  FeeStructureRequest,
  FeeStructureUpdateRequest,
  FeeStructureUpdateResult,
  GenerateBillsResult,
  GeneratePreview,
} from './types';

export function listFeeStructures(schoolId: string) {
  return api.get<FeeStructure[]>('/api/v1/fee-structures', schoolId);
}

export function getFeeStructure(schoolId: string, id: string) {
  return api.get<FeeStructure>(`/api/v1/fee-structures/${id}`, schoolId);
}

export function createFeeStructure(schoolId: string, req: FeeStructureRequest) {
  return api.post<FeeStructure>('/api/v1/fee-structures', req, schoolId);
}

/** Replaces the lines; with repriceBills, also re-prices bills that have no payments or adjustments. */
export function updateFeeStructure(schoolId: string, id: string, req: FeeStructureUpdateRequest) {
  return api.put<FeeStructureUpdateResult>(`/api/v1/fee-structures/${id}`, req, schoolId);
}

/** How many bills Generate would create, for the confirmation. */
export function getGeneratePreview(schoolId: string, id: string) {
  return api.get<GeneratePreview>(`/api/v1/fee-structures/${id}/generate-preview`, schoolId);
}

/** Bills every active student without one, due on `dueDate` (today to two years ahead). */
export function generateBills(schoolId: string, id: string, dueDate: string) {
  return api.post<GenerateBillsResult>(`/api/v1/fee-structures/${id}/generate-bills`, { dueDate }, schoolId, {
    timeoutMs: SLOW_TIMEOUT_MS,
  });
}
