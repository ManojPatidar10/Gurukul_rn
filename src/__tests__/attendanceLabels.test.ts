import type { AttendanceMethod, AttendanceStatus } from '../api/types';
import hi from '../i18n/locales/hi.json';
import { tEn, tHi } from '../testUtils/i18nFixture';
import {
  ATTENDANCE_METHOD_KEYS,
  ATTENDANCE_STATUS_KEYS,
  attendanceMethodLabel,
  attendanceStatusLabel,
} from '../utils/attendanceLabels';

const STATUSES: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY'];
const METHODS: AttendanceMethod[] = ['RFID', 'FINGERPRINT', 'FACE'];

describe('attendanceStatusLabel', () => {
  it('has a key for every status', () => {
    expect(Object.keys(ATTENDANCE_STATUS_KEYS).sort()).toEqual([...STATUSES].sort());
  });

  it('names each status in words, not the raw code', () => {
    expect(STATUSES.map((s) => attendanceStatusLabel(s, tEn))).toEqual(['Present', 'Absent', 'Late', 'Half day']);
    expect(STATUSES.map((s) => attendanceStatusLabel(s, tHi))).toEqual(STATUSES.map((s) => hi.staffAttendance.statuses[s]));
  });

  it('shows a status a newer server adds as sent', () => {
    expect(attendanceStatusLabel('ON_LEAVE' as AttendanceStatus, tHi)).toBe('ON_LEAVE');
  });
});

describe('attendanceMethodLabel', () => {
  it('has a key for every method', () => {
    expect(Object.keys(ATTENDANCE_METHOD_KEYS).sort()).toEqual([...METHODS].sort());
  });

  it('names each device method in words', () => {
    expect(METHODS.map((m) => attendanceMethodLabel(m, tEn))).toEqual(['RFID', 'Fingerprint', 'Face recognition']);
    expect(attendanceMethodLabel('FINGERPRINT', tHi)).toBe(hi.attendanceDevices.method.FINGERPRINT);
  });

  it('shows a method a newer server adds as sent', () => {
    expect(attendanceMethodLabel('QR' as AttendanceMethod, tEn)).toBe('QR');
  });
});
