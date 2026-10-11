import { api } from './client';
import type {
  DuesReport,
  FeeAdjustmentRequest,
  FeeAssessment,
  FeeAssessmentFilters,
  FeeAssessmentSummary,
  PayrollOverview,
} from './types';
import { feeAssessmentQuery } from '../utils/feeBills';

/** The admin's bill list: the current academic year, active students and no cancelled bills unless filtered. */
export function listFeeAssessments(schoolId: string, filters: FeeAssessmentFilters = {}, page = 0, size = 50) {
  return api.getPaginated<FeeAssessment>(`/api/v1/fee-assessments?${feeAssessmentQuery(filters, page, size)}`, schoolId);
}

/** Server totals for the same filters (status and search aside). */
export function getFeeAssessmentSummary(
  schoolId: string,
  filters: Pick<FeeAssessmentFilters, 'academicYear' | 'classSectionId' | 'includeInactive'> = {}
) {
  const query = feeAssessmentQuery(filters);
  return api.get<FeeAssessmentSummary>(`/api/v1/fee-assessments/summary${query ? `?${query}` : ''}`, schoolId);
}

/** One bill with its adjustments: an admin, the student, a linked parent or the class teacher. */
export function getFeeAssessment(schoolId: string, id: string) {
  return api.get<FeeAssessment>(`/api/v1/fee-assessments/${id}`, schoolId);
}

export function updateFeeAssessmentDueDate(schoolId: string, id: string, dueDate: string) {
  return api.patch<FeeAssessment>(`/api/v1/fee-assessments/${id}`, { dueDate }, schoolId);
}

export function addFeeAdjustment(schoolId: string, id: string, req: FeeAdjustmentRequest) {
  return api.post<FeeAssessment>(`/api/v1/fee-assessments/${id}/adjustments`, req, schoolId);
}

/** Only a bill with no payments on it can be cancelled; cancelling it again changes nothing. */
export function cancelFeeAssessment(schoolId: string, id: string, reason: string) {
  return api.post<FeeAssessment>(`/api/v1/fee-assessments/${id}/cancel`, { reason }, schoolId);
}

export function listStudentFeeAssessments(schoolId: string, studentId: string) {
  return api.get<FeeAssessment[]>(`/api/v1/students/${studentId}/fee-assessments`, schoolId);
}

export function getClassSectionFeeStatus(schoolId: string, classSectionId: string) {
  return api.get<FeeAssessment[]>(`/api/v1/class-sections/${classSectionId}/fee-status`, schoolId);
}

/** Left out: the current academic year. 'ALL' for every year. */
export function getDuesReport(schoolId: string, academicYear?: string) {
  const query = academicYear ? `?academicYear=${encodeURIComponent(academicYear)}` : '';
  return api.get<DuesReport>(`/api/v1/reports/dues${query}`, schoolId);
}

export function getPayrollOverview(schoolId: string) {
  return api.get<PayrollOverview>('/api/v1/reports/payroll/overview', schoolId);
}
