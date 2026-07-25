import { api } from './client';
import type { FeePayment, FeePaymentRequest } from './types';

export function recordFeePayment(schoolId: string, req: FeePaymentRequest) {
  return api.post<FeePayment>('/api/v1/fee-payments', req, schoolId);
}

export function getFeePayment(schoolId: string, id: string) {
  return api.get<FeePayment>(`/api/v1/fee-payments/${id}`, schoolId);
}
