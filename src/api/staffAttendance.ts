import { api } from './client';
import type { SelfMarkAttendanceRequest, StaffAttendanceRecord } from './types';

export function selfMarkAttendance(schoolId: string, req: SelfMarkAttendanceRequest) {
  return api.post<StaffAttendanceRecord>('/api/v1/staff-attendance/self-mark', req, schoolId);
}
