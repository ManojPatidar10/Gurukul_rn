import type { AttendanceStatus, StaffAttendanceEntry, StaffAttendanceEntryRequest } from '../api/types';

/**
 * The rows an admin's edit actually changed, ready for the bulk mark request. Unchanged rows are
 * left out on purpose: the backend rewrites every row it's sent as an admin mark, which would wipe
 * a teacher's self check-in (and a device's method) on rows nobody touched. Existing remarks ride
 * along because the backend overwrites them too.
 */
export function changedStaffAttendanceRecords(
  entries: StaffAttendanceEntry[],
  draft: Record<string, AttendanceStatus>
): StaffAttendanceEntryRequest[] {
  return entries.flatMap((entry) => {
    const status = draft[entry.employeeId];
    if (!status || status === entry.status) return [];
    return [{ employeeId: entry.employeeId, status, remarks: entry.remarks ?? undefined }];
  });
}
