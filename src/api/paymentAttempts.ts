import { api } from './client';
import type { PaymentAttempt, PaymentAttemptResultRequest } from './types';

export function findPendingPaymentAttempt(schoolId: string, assessmentId: string) {
  return api.get<PaymentAttempt | null>(`/api/v1/fee-assessments/${assessmentId}/payment-attempts/pending`, schoolId);
}

export function listPaymentAttempts(schoolId: string, assessmentId: string) {
  return api.get<PaymentAttempt[]>(`/api/v1/fee-assessments/${assessmentId}/payment-attempts`, schoolId);
}

export function recordPaymentAttemptResult(
  schoolId: string,
  transactionRef: string,
  request: PaymentAttemptResultRequest
) {
  return api.post<PaymentAttempt>(`/api/v1/payment-attempts/${transactionRef}/result`, request, schoolId);
}
