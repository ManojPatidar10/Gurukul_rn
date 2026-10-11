import { File, Paths } from 'expo-file-system';

import { feeReceiptFileName } from '../utils/feePayments';
import { api, BASE_URL, ensureFreshAccessToken, getAuthToken } from './client';
import type { FeePayment, FeePaymentRequest, FeePaymentReversalRequest } from './types';

const IDEMPOTENCY_KEY = 'Idempotency-Key';

/**
 * Records a payment on a bill (ADMIN). `idempotencyKey` is one UUID per form submission
 * (newIdempotencyKey): sending the same form again with the same key returns the first payment
 * instead of recording a second one.
 */
export function recordFeePayment(schoolId: string, req: FeePaymentRequest, idempotencyKey: string) {
  return api.post<FeePayment>('/api/v1/fee-payments', req, schoolId, { headers: { [IDEMPOTENCY_KEY]: idempotencyKey } });
}

/** One payment with everything its receipt shows (ADMIN, the student, or a linked parent). */
export function getFeePayment(schoolId: string, id: string) {
  return api.get<FeePayment>(`/api/v1/fee-payments/${id}`, schoolId);
}

/** Every payment on one bill, reversed ones included, newest first. */
export function listBillPayments(schoolId: string, assessmentId: string) {
  return api.get<FeePayment[]>(`/api/v1/fee-assessments/${assessmentId}/payments`, schoolId);
}

/** Every payment on every bill of one student, reversed ones included, newest first. */
export function listStudentPayments(schoolId: string, studentId: string) {
  return api.get<FeePayment[]>(`/api/v1/students/${studentId}/fee-payments`, schoolId);
}

/** Reverses a payment as a correction, a bounce or a refund (ADMIN). Same key rules as recording. */
export function reverseFeePayment(
  schoolId: string,
  paymentId: string,
  req: FeePaymentReversalRequest,
  idempotencyKey: string
) {
  return api.post<FeePayment>(`/api/v1/fee-payments/${paymentId}/reverse`, req, schoolId, {
    headers: { [IDEMPOTENCY_KEY]: idempotencyKey },
  });
}

/**
 * The receipt as the server's PDF (CANCELLED once reversed), saved to the cache for sharing. Same
 * access as getFeePayment. Rejects on any non-2xx response, so an error body is never saved as a .pdf.
 */
export async function downloadFeeReceiptPdf(
  schoolId: string,
  payment: Pick<FeePayment, 'id' | 'receiptNumber'>
): Promise<File> {
  await ensureFreshAccessToken();
  const headers: Record<string, string> = { 'X-School-Id': schoolId };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const destination = new File(Paths.cache, feeReceiptFileName(payment));
  return File.downloadFileAsync(`${BASE_URL}/api/v1/fee-payments/${payment.id}/receipt.pdf`, destination, {
    headers,
    idempotent: true,
  });
}
