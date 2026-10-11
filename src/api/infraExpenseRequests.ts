import { api } from './client';
import type {
  ExpenseActionRequest,
  InfraExpenseRequest,
  InfraExpenseRequestCreate,
  InfraExpenseStatus,
  InfraPayRequest,
  InfraPurchaseRequest,
  InfraReviseRequest,
} from './expenseTypes';

const BASE = '/api/v1/infra-expense-requests';

/** Newest first. `status` filters on the server. */
export function listInfraExpenseRequests(schoolId: string, status?: InfraExpenseStatus | null) {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return api.get<InfraExpenseRequest[]>(`${BASE}${query}`, schoolId);
}

/** One request, with its timeline. */
export function getInfraExpenseRequest(schoolId: string, id: string) {
  return api.get<InfraExpenseRequest>(`${BASE}/${id}`, schoolId);
}

export function createInfraExpenseRequest(schoolId: string, req: InfraExpenseRequestCreate) {
  return api.post<InfraExpenseRequest>(BASE, req, schoolId);
}

export function submitInfraExpenseRequest(schoolId: string, id: string, req: ExpenseActionRequest) {
  return api.post<InfraExpenseRequest>(`${BASE}/${id}/submit`, req, schoolId);
}

export function approveInfraExpenseRequest(schoolId: string, id: string, req: ExpenseActionRequest) {
  return api.post<InfraExpenseRequest>(`${BASE}/${id}/approve`, req, schoolId);
}

export function rejectInfraExpenseRequest(schoolId: string, id: string, req: ExpenseActionRequest) {
  return api.post<InfraExpenseRequest>(`${BASE}/${id}/reject`, req, schoolId);
}

export function cancelInfraExpenseRequest(schoolId: string, id: string, req: ExpenseActionRequest) {
  return api.post<InfraExpenseRequest>(`${BASE}/${id}/cancel`, req, schoolId);
}

/** Sends the request (back) for approval at a new amount. */
export function reviseInfraExpenseRequest(schoolId: string, id: string, req: InfraReviseRequest) {
  return api.post<InfraExpenseRequest>(`${BASE}/${id}/revise`, req, schoolId);
}

export function purchaseInfraExpenseRequest(schoolId: string, id: string, req: InfraPurchaseRequest) {
  return api.post<InfraExpenseRequest>(`${BASE}/${id}/purchase`, req, schoolId);
}

export function payInfraExpenseRequest(schoolId: string, id: string, req: InfraPayRequest) {
  return api.post<InfraExpenseRequest>(`${BASE}/${id}/pay`, req, schoolId);
}
