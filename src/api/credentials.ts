import { api } from './client';
import type { Credential, CredentialRequest } from './types';

export function createEmployeeCredential(schoolId: string, employeeId: string, req: CredentialRequest) {
  return api.post<Credential>(`/api/v1/employees/${employeeId}/credentials`, req, schoolId);
}

export function createStudentCredential(schoolId: string, studentId: string, req: CredentialRequest) {
  return api.post<Credential>(`/api/v1/students/${studentId}/credentials`, req, schoolId);
}
