import { api } from './client';
import type { Payslip, PayrollLine, PayrollPayRequest, PayrollRun, PayrollRunRequest } from './types';

export function createPayrollRun(schoolId: string, req: PayrollRunRequest) {
  return api.post<PayrollRun>('/api/v1/payroll/runs', req, schoolId);
}

export function processPayrollRun(schoolId: string, id: string) {
  return api.post<PayrollRun>(`/api/v1/payroll/runs/${id}/process`, undefined, schoolId);
}

export function payPayrollRun(schoolId: string, id: string, req: PayrollPayRequest) {
  return api.post<PayrollRun>(`/api/v1/payroll/runs/${id}/pay`, req, schoolId);
}

export function listPayrollRunLines(schoolId: string, id: string) {
  return api.get<PayrollLine[]>(`/api/v1/payroll/runs/${id}/lines`, schoolId);
}

export function getPayslip(schoolId: string, payrollLineId: string) {
  return api.get<Payslip>(`/api/v1/payroll/lines/${payrollLineId}/payslip`, schoolId);
}
