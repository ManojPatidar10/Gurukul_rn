import { File, Paths } from 'expo-file-system';

import { BASE_URL, getAuthToken } from './client';

export type AttendanceExportType = 'STUDENT' | 'STAFF';

export const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function exportFileName(type: AttendanceExportType, from: string, to: string) {
  return `attendance-${type.toLowerCase()}-${from}-to-${to}.xlsx`;
}

/**
 * Downloads the admin attendance spreadsheet to the cache directory and returns the local file.
 * Rejects on any non-2xx response, so an error body is never saved as a .xlsx.
 */
export async function downloadAttendanceExport(
  schoolId: string,
  params: { type: AttendanceExportType; from: string; to: string; sectionId?: string }
): Promise<File> {
  const query = new URLSearchParams({ type: params.type, from: params.from, to: params.to });
  if (params.sectionId) query.set('sectionId', params.sectionId);

  const headers: Record<string, string> = { 'X-School-Id': schoolId };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const destination = new File(Paths.cache, exportFileName(params.type, params.from, params.to));
  return File.downloadFileAsync(`${BASE_URL}/api/v1/attendance/export?${query.toString()}`, destination, {
    headers,
    idempotent: true,
  });
}
