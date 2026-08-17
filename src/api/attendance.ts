import { api } from './client';
import type {
  BulkAttendanceRequest,
  SectionAttendance,
  SectionAttendanceHistory,
  StudentAttendanceHistory,
} from './types';

export function markSectionAttendance(schoolId: string, sectionId: string, req: BulkAttendanceRequest) {
  return api.post<SectionAttendance>(`/api/v1/class-sections/${sectionId}/attendance`, req, schoolId);
}

export function getSectionAttendance(schoolId: string, sectionId: string, date: string) {
  return api.get<SectionAttendance>(`/api/v1/class-sections/${sectionId}/attendance?date=${date}`, schoolId);
}

export function getStudentAttendanceHistory(schoolId: string, studentId: string, from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const query = params.toString() ? `?${params.toString()}` : '';
  return api.get<StudentAttendanceHistory>(`/api/v1/students/${studentId}/attendance${query}`, schoolId);
}

export function getSectionAttendanceHistory(schoolId: string, sectionId: string, from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const query = params.toString() ? `?${params.toString()}` : '';
  return api.get<SectionAttendanceHistory>(`/api/v1/class-sections/${sectionId}/attendance/history${query}`, schoolId);
}
