import { api } from './client';
import type { Employee, EmployeeRequest, SalaryHistoryEntry } from './types';

export function listEmployees(schoolId: string) {
  return api.get<Employee[]>('/api/v1/employees', schoolId);
}

export function getEmployee(schoolId: string, id: string) {
  return api.get<Employee>(`/api/v1/employees/${id}`, schoolId);
}

export function createEmployee(schoolId: string, req: EmployeeRequest) {
  return api.post<Employee>('/api/v1/employees', req, schoolId);
}

export function updateEmployee(schoolId: string, id: string, req: EmployeeRequest) {
  return api.put<Employee>(`/api/v1/employees/${id}`, req, schoolId);
}

export function getSalaryHistory(schoolId: string, employeeId: string) {
  return api.get<SalaryHistoryEntry[]>(`/api/v1/employees/${employeeId}/salary-history`, schoolId);
}
