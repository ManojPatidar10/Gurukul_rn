import { api } from './client';
import type { EmployeePerformanceSummary } from './types';

export function getEmployeePerformance(schoolId: string, employeeId: string) {
  return api.get<EmployeePerformanceSummary>(`/api/v1/performance/employees/${employeeId}/summary`, schoolId);
}
