import { api } from './client';
import type { Employee, EmployeeRequest, PagedResponse, SalaryHistoryEntry } from './types';

export function listEmployees(schoolId: string, page = 0, size = 50) {
  return api.get<PagedResponse<Employee>>(`/api/v1/employees?page=${page}&size=${size}`, schoolId);
}

// For consumers that need the full roster (pickers, name lookups, filtering) rather than one page.
export async function listAllEmployees(schoolId: string): Promise<Employee[]> {
  const all: Employee[] = [];
  let page = 0;
  for (;;) {
    const res = await listEmployees(schoolId, page, 200);
    all.push(...res.content);
    if (!res.hasNext) break;
    page += 1;
  }
  return all;
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

export function searchEmployees(schoolId: string, q: string) {
  return api.get<Employee[]>(`/api/v1/employees/search?${new URLSearchParams({ q }).toString()}`, schoolId);
}
