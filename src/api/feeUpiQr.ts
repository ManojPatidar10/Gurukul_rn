import { api } from './client';
import type { UpiQrResponse } from './types';

export function generateUpiQr(schoolId: string, assessmentId: string, amount?: number) {
  return api.post<UpiQrResponse>(`/api/v1/fee-assessments/${assessmentId}/upi-qr`, { amount }, schoolId);
}
