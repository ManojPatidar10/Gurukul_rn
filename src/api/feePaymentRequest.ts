import { api } from './client';
import type { FeePaymentRequestResponse } from './types';

export function createFeePaymentRequest(schoolId: string, assessmentId: string) {
  return api.post<FeePaymentRequestResponse>(`/api/v1/fee-assessments/${assessmentId}/payment-request`, {}, schoolId);
}
