import { api } from './client';
import type { EmployeeFeedbackRequest, EmployeeFeedbackResponse } from './types';

export function submitEmployeeFeedback(schoolId: string, employeeId: string, req: EmployeeFeedbackRequest) {
  return api.post<EmployeeFeedbackResponse>(`/api/v1/employees/${employeeId}/feedback`, req, schoolId);
}

export function listEmployeeFeedback(schoolId: string, employeeId: string) {
  return api.get<EmployeeFeedbackResponse[]>(`/api/v1/employees/${employeeId}/feedback`, schoolId);
}
