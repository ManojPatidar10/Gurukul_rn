import { api } from './client';
import type { EmployeePerformanceSummary, StudentPerformanceSummary } from './types';

export function getStudentPerformance(schoolId: string, studentId: string) {
  return api.get<StudentPerformanceSummary>(`/api/v1/performance/students/${studentId}/summary`, schoolId);
}

export function getEmployeePerformance(schoolId: string, employeeId: string) {
  return api.get<EmployeePerformanceSummary>(`/api/v1/performance/employees/${employeeId}/summary`, schoolId);
}
