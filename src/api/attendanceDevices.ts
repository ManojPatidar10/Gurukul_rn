import { api } from './client';
import type { AttendanceDevice, AttendanceDeviceKey, AttendanceIdentifier, AttendanceMethod } from './types';

export function createAttendanceDevice(schoolId: string, name: string, deviceType: AttendanceMethod) {
  return api.post<AttendanceDeviceKey>('/api/v1/attendance-devices', { name, deviceType }, schoolId);
}

export function listAttendanceDevices(schoolId: string) {
  return api.get<AttendanceDevice[]>('/api/v1/attendance-devices', schoolId);
}

export function updateAttendanceDevice(schoolId: string, deviceId: string, name: string, active: boolean) {
  return api.put<AttendanceDevice>(`/api/v1/attendance-devices/${deviceId}`, { name, active }, schoolId);
}

export function rotateAttendanceDeviceKey(schoolId: string, deviceId: string) {
  return api.post<AttendanceDeviceKey>(`/api/v1/attendance-devices/${deviceId}/rotate-key`, {}, schoolId);
}

export function listStudentAttendanceIdentifiers(schoolId: string, studentId: string) {
  return api.get<AttendanceIdentifier[]>(`/api/v1/students/${studentId}/attendance-identifiers`, schoolId);
}

export function enrollStudentAttendanceIdentifier(
  schoolId: string,
  studentId: string,
  method: AttendanceMethod,
  externalId: string
) {
  return api.post<AttendanceIdentifier>(
    `/api/v1/students/${studentId}/attendance-identifiers`,
    { method, externalId },
    schoolId
  );
}

export function listEmployeeAttendanceIdentifiers(schoolId: string, employeeId: string) {
  return api.get<AttendanceIdentifier[]>(`/api/v1/employees/${employeeId}/attendance-identifiers`, schoolId);
}

export function enrollEmployeeAttendanceIdentifier(
  schoolId: string,
  employeeId: string,
  method: AttendanceMethod,
  externalId: string
) {
  return api.post<AttendanceIdentifier>(
    `/api/v1/employees/${employeeId}/attendance-identifiers`,
    { method, externalId },
    schoolId
  );
}

export function removeAttendanceIdentifier(schoolId: string, identifierId: string) {
  return api.delete<void>(`/api/v1/attendance-identifiers/${identifierId}`, schoolId);
}
