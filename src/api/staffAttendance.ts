import { api } from './client';
import type {
  BulkStaffAttendanceRequest,
  EmployeeAttendanceHistory,
  SelfMarkAttendanceRequest,
  StaffAttendanceRecord,
  StaffAttendanceRoster,
} from './types';

export function selfMarkAttendance(schoolId: string, req: SelfMarkAttendanceRequest) {
  return api.post<StaffAttendanceRecord>('/api/v1/staff-attendance/self-mark', req, schoolId);
}

/** Admin only: marks or corrects staff for one date (past dates too) and returns that day's roster. */
export function markStaffAttendance(schoolId: string, req: BulkStaffAttendanceRequest) {
  return api.post<StaffAttendanceRoster>('/api/v1/staff-attendance', req, schoolId);
}

export function getStaffAttendanceRoster(schoolId: string, date: string) {
  return api.get<StaffAttendanceRoster>(`/api/v1/staff-attendance?date=${date}`, schoolId);
}

export function getEmployeeAttendanceHistory(schoolId: string, employeeId: string, from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const query = params.toString() ? `?${params.toString()}` : '';
  return api.get<EmployeeAttendanceHistory>(`/api/v1/employees/${employeeId}/attendance${query}`, schoolId);
}
