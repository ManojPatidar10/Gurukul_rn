import { api } from './client';
import type { DuesReport, FeeAssessment } from './types';

export function listFeeAssessments(schoolId: string, status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return api.get<FeeAssessment[]>(`/api/v1/fee-assessments${query}`, schoolId);
}

export function listStudentFeeAssessments(schoolId: string, studentId: string) {
  return api.get<FeeAssessment[]>(`/api/v1/students/${studentId}/fee-assessments`, schoolId);
}

export function getDuesReport(schoolId: string) {
  return api.get<DuesReport>('/api/v1/reports/dues', schoolId);
}
