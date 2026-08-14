import { api } from './client';
import type { DuesReport, FeeAssessment, PayrollOverview } from './types';

export function listFeeAssessments(
  schoolId: string,
  status?: string,
  classSectionId?: string,
  page = 0,
  size = 50
) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (classSectionId) params.set('classSectionId', classSectionId);
  params.set('page', String(page));
  params.set('size', String(size));
  return api.getPaginated<FeeAssessment>(`/api/v1/fee-assessments?${params.toString()}`, schoolId);
}

export function listStudentFeeAssessments(schoolId: string, studentId: string) {
  return api.get<FeeAssessment[]>(`/api/v1/students/${studentId}/fee-assessments`, schoolId);
}

export function getClassSectionFeeStatus(schoolId: string, classSectionId: string) {
  return api.get<FeeAssessment[]>(`/api/v1/class-sections/${classSectionId}/fee-status`, schoolId);
}

export function getDuesReport(schoolId: string) {
  return api.get<DuesReport>('/api/v1/reports/dues', schoolId);
}

export function getPayrollOverview(schoolId: string) {
  return api.get<PayrollOverview>('/api/v1/reports/payroll/overview', schoolId);
}
