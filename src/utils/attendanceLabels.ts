import type { TFunction } from 'i18next';

import type { AttendanceMethod, AttendanceStatus } from '../api/types';

/**
 * The words for an attendance status, for students and staff alike: "Present", "Absent", "Late",
 * "Half day". Full keys, so tsc checks every status has one and the parity test checks every key
 * exists.
 */
export const ATTENDANCE_STATUS_KEYS: Record<AttendanceStatus, string> = {
  PRESENT: 'staffAttendance.statuses.PRESENT',
  ABSENT: 'staffAttendance.statuses.ABSENT',
  LATE: 'staffAttendance.statuses.LATE',
  HALF_DAY: 'staffAttendance.statuses.HALF_DAY',
};

/** The words for the device that marked someone: "RFID", "Fingerprint", "Face recognition". */
export const ATTENDANCE_METHOD_KEYS: Record<AttendanceMethod, string> = {
  RFID: 'attendanceDevices.method.RFID',
  FINGERPRINT: 'attendanceDevices.method.FINGERPRINT',
  FACE: 'attendanceDevices.method.FACE',
};

/** A status in words. One a newer server adds shows as sent rather than as a raw key. */
export function attendanceStatusLabel(status: AttendanceStatus, t: TFunction): string {
  const key = ATTENDANCE_STATUS_KEYS[status] as string | undefined;
  return key ? t(key) : status;
}

/** A device method in words. One a newer server adds shows as sent. */
export function attendanceMethodLabel(method: AttendanceMethod, t: TFunction): string {
  const key = ATTENDANCE_METHOD_KEYS[method] as string | undefined;
  return key ? t(key) : method;
}
