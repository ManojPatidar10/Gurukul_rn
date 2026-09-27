import { api } from './client';
import type { PaymentAttempt, PaymentGatewayStatus, RazorpayOrder, RazorpayVerifyRequest } from './types';

export function getPaymentGatewayStatus(schoolId: string) {
  return api.get<PaymentGatewayStatus>('/api/v1/fee-payments/gateway', schoolId);
}

/**
 * Creates the order server-side. The amount is read from the assessment by the backend and is not
 * sent from here - there is deliberately no way for this client to influence what gets charged.
 */
export function createRazorpayOrder(schoolId: string, assessmentId: string) {
  return api.post<RazorpayOrder>(`/api/v1/fee-assessments/${assessmentId}/razorpay-order`, {}, schoolId);
}

/**
 * Reports the checkout result for server-side verification. Safe to call more than once: Razorpay's
 * webhook may have already confirmed the same payment, and the backend is idempotent.
 */
export function verifyRazorpayPayment(schoolId: string, request: RazorpayVerifyRequest) {
  return api.post<PaymentAttempt>('/api/v1/razorpay/verify', request, schoolId);
}
