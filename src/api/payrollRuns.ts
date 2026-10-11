import { api } from './client';
import type {
  Payslip,
  PayrollLine,
  PayrollPayRequest,
  PayrollRun,
  PayrollRunDetail,
  PayrollRunRequest,
  PayrollRunStatus,
} from './types';

/** Without a status the server leaves out cancelled runs; status CANCELLED lists only those. */
export function listPayrollRuns(
  schoolId: string,
  params: { year?: number; month?: number; status?: PayrollRunStatus } = {}
) {
  const query = new URLSearchParams();
  if (params.year != null) query.set('year', String(params.year));
  if (params.month != null) query.set('month', String(params.month));
  if (params.status) query.set('status', params.status);
  const qs = query.toString();
  return api.get<PayrollRun[]>(`/api/v1/payroll/runs${qs ? `?${qs}` : ''}`, schoolId);
}

export function getPayrollRun(schoolId: string, id: string) {
  return api.get<PayrollRunDetail>(`/api/v1/payroll/runs/${id}`, schoolId);
}

/** Creates the month's run as a draft, or reopens it when that month's run was cancelled. */
export function createPayrollRun(schoolId: string, req: PayrollRunRequest) {
  return api.post<PayrollRunDetail>('/api/v1/payroll/runs', req, schoolId);
}

export function processPayrollRun(schoolId: string, id: string) {
  return api.post<PayrollRunDetail>(`/api/v1/payroll/runs/${id}/process`, undefined, schoolId);
}

/** Recomputes the run's unpaid lines from current salary structures; paid lines are left alone. */
export function reprocessPayrollRun(schoolId: string, id: string) {
  return api.post<PayrollRunDetail>(`/api/v1/payroll/runs/${id}/reprocess`, undefined, schoolId);
}

/** Refused (409 PAYROLL_RUN_HAS_PAYMENTS) once any line is paid. */
export function cancelPayrollRun(schoolId: string, id: string) {
  return api.post<PayrollRunDetail>(`/api/v1/payroll/runs/${id}/cancel`, undefined, schoolId);
}

/** A held line isn't paid by the next pay, and stays payable later in the same run. */
export function setPayrollLineHold(schoolId: string, lineId: string, held: boolean) {
  return api.put<PayrollRunDetail>(`/api/v1/payroll/lines/${lineId}/hold`, { held }, schoolId);
}

export function payPayrollRun(schoolId: string, id: string, req: PayrollPayRequest) {
  return api.post<PayrollRunDetail>(`/api/v1/payroll/runs/${id}/pay`, req, schoolId);
}

export function listPayrollRunLines(schoolId: string, id: string) {
  return api.get<PayrollLine[]>(`/api/v1/payroll/runs/${id}/lines`, schoolId);
}

export function getPayslip(schoolId: string, payrollLineId: string) {
  return api.get<Payslip>(`/api/v1/payroll/lines/${payrollLineId}/payslip`, schoolId);
}
