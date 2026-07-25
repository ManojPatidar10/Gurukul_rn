import { api } from './client';
import type {
  ApprovalActionRequest,
  InfraExpenseRequest,
  InfraExpenseRequestCreate,
  InfraPayRequest,
  InfraPurchaseRequest,
} from './types';

export function listInfraExpenseRequests(schoolId: string) {
  return api.get<InfraExpenseRequest[]>('/api/v1/infra-expense-requests', schoolId);
}

export function createInfraExpenseRequest(schoolId: string, req: InfraExpenseRequestCreate) {
  return api.post<InfraExpenseRequest>('/api/v1/infra-expense-requests', req, schoolId);
}

export function submitInfraExpenseRequest(schoolId: string, id: string, req: ApprovalActionRequest) {
  return api.post<InfraExpenseRequest>(`/api/v1/infra-expense-requests/${id}/submit`, req, schoolId);
}

export function approveInfraExpenseRequest(schoolId: string, id: string, req: ApprovalActionRequest) {
  return api.post<InfraExpenseRequest>(`/api/v1/infra-expense-requests/${id}/approve`, req, schoolId);
}

export function rejectInfraExpenseRequest(schoolId: string, id: string, req: ApprovalActionRequest) {
  return api.post<InfraExpenseRequest>(`/api/v1/infra-expense-requests/${id}/reject`, req, schoolId);
}

export function purchaseInfraExpenseRequest(schoolId: string, id: string, req: InfraPurchaseRequest) {
  return api.post<InfraExpenseRequest>(`/api/v1/infra-expense-requests/${id}/purchase`, req, schoolId);
}

export function payInfraExpenseRequest(schoolId: string, id: string, req: InfraPayRequest) {
  return api.post<InfraExpenseRequest>(`/api/v1/infra-expense-requests/${id}/pay`, req, schoolId);
}
