import { api } from './client';
import type { Holiday, HolidayRequest } from './types';

const BASE = '/api/v1/holidays';

/** The next 12 months by default. */
export function listHolidays(schoolId: string) {
  return api.get<Holiday[]>(BASE, schoolId);
}

export function createHoliday(schoolId: string, req: HolidayRequest) {
  return api.post<Holiday>(BASE, req, schoolId);
}

export function updateHoliday(schoolId: string, id: string, req: HolidayRequest) {
  return api.put<Holiday>(`${BASE}/${id}`, req, schoolId);
}

export function deleteHoliday(schoolId: string, id: string) {
  return api.delete<null>(`${BASE}/${id}`, schoolId);
}
